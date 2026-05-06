import { ListPatterns } from '../shared/patterns';

export interface PandocDefinitionListBlock {
    startLine: number;
    endLine: number;
    termTexts: string[];
    definitionTexts: string[];
    items: PandocDefinitionListItem[];
}

export interface PandocDefinitionListItem {
    term: string;
    definitions: PandocDefinitionDescription[];
}

export interface PandocDefinitionDescription {
    lines: string[];
    plainText: string;
    wrapParagraph: boolean;
}

export interface DefinitionMarker {
    marker: ':' | '~';
    content: string;
}

export interface MarkdownListItem {
    ordered: boolean;
    content: string;
    checked?: boolean;
}

export function findPandocDefinitionListBlocks(sourceText: string): PandocDefinitionListBlock[] {
    const lines = sourceText.split('\n');
    const blocks: PandocDefinitionListBlock[] = [];
    let index = 0;

    while (index < lines.length) {
        if (!canStartDefinitionListItem(lines, index)) {
            index++;
            continue;
        }

        const block = readDefinitionListBlock(lines, index);
        blocks.push(block);
        index = block.endLine + 1;
    }

    return blocks;
}

export function isStandalonePandocDefinitionList(
    sourceText: string,
    blocks: PandocDefinitionListBlock[] = findPandocDefinitionListBlocks(sourceText)
): boolean {
    if (blocks.length === 0) {
        return false;
    }

    const lines = sourceText.split('\n');
    return lines.every((line, index) => {
        if (line.trim().length === 0) {
            return true;
        }
        return blocks.some(block => index >= block.startLine && index <= block.endLine);
    });
}

export function parseIndentedDefinitionMarker(line: string): DefinitionMarker | null {
    const match = line.match(/^([ \t]*)([:~])(?:([ \t]+)(.*)|[ \t]*)$/);
    if (!match || getIndentWidth(match[1]) < 4) {
        return null;
    }

    return {
        marker: match[2] as ':' | '~',
        content: removePandocMarkerPadding(match[4] ?? '')
    };
}

export function parseMarkdownListItem(line: string): MarkdownListItem | null {
    const taskMatch = line.match(/^[-+*]\s+\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
        return {
            ordered: false,
            checked: taskMatch[1].toLowerCase() === 'x',
            content: taskMatch[2]
        };
    }

    const bulletMatch = line.match(/^[-+*]\s+(.*)$/);
    if (bulletMatch) {
        return { ordered: false, content: bulletMatch[1] };
    }

    const orderedMatch = line.match(/^\d+[.)]\s+(.*)$/);
    if (orderedMatch) {
        return { ordered: true, content: orderedMatch[1] };
    }

    return null;
}

export function trimOuterBlankLines(lines: string[]): string[] {
    let start = 0;
    let end = lines.length;
    while (start < end && lines[start].trim().length === 0) {
        start++;
    }
    while (end > start && lines[end - 1].trim().length === 0) {
        end--;
    }
    return lines.slice(start, end);
}

export function normalizePlainText(lines: string[]): string {
    return trimOuterBlankLines(lines)
        .filter(line => line.trim().length > 0)
        .map(line => line.trim())
        .join(' ');
}

function readDefinitionListBlock(lines: string[], startLine: number): PandocDefinitionListBlock {
    const items: PandocDefinitionListItem[] = [];
    const termTexts: string[] = [];
    const definitionTexts: string[] = [];
    let index = startLine;

    while (canStartDefinitionListItem(lines, index)) {
        const itemStart = index;
        const term = lines[index].trim();
        const markerStart = findFirstDefinitionMarker(lines, itemStart);
        const hasBlankAfterTerm = markerStart > itemStart + 1;
        index = markerStart;

        const definitions: PandocDefinitionDescription[] = [];
        while (index < lines.length) {
            if (!parseTopLevelDefinitionMarker(lines[index])) {
                break;
            }

            const result = readDefinitionDescription(lines, index, hasBlankAfterTerm, definitions.length);
            definitions.push(result.description);
            definitionTexts.push(result.description.plainText);
            index = result.nextIndex;

            if (canStartDefinitionListItem(lines, index) || isListTerminator(lines, index)) {
                break;
            }
        }

        items.push({ term, definitions });
        termTexts.push(term);

        while (index < lines.length && lines[index].trim().length === 0) {
            index++;
        }
    }

    return {
        startLine,
        endLine: Math.max(startLine, index - 1),
        termTexts,
        definitionTexts,
        items
    };
}

function readDefinitionDescription(
    lines: string[],
    markerLine: number,
    hasBlankAfterTerm: boolean,
    definitionIndex: number
): { description: PandocDefinitionDescription, nextIndex: number } {
    const marker = parseTopLevelDefinitionMarker(lines[markerLine]);
    const descriptionLines = [marker?.content ?? ''];
    let index = markerLine + 1;
    let sawBlank = false;

    while (index < lines.length) {
        if (parseTopLevelDefinitionMarker(lines[index])) {
            break;
        }

        if (sawBlank && canStartDefinitionListItem(lines, index)) {
            break;
        }

        if (lines[index].trim().length === 0) {
            if (isBlankBeforeSiblingDefinition(lines, index + 1) || isBlankThenListTerminator(lines, index + 1)) {
                break;
            }
            sawBlank = true;
            descriptionLines.push('');
            index++;
            continue;
        }

        descriptionLines.push(stripContinuationIndent(lines[index]));
        index++;
    }

    return {
        description: {
            lines: trimTrailingBlankLines(descriptionLines),
            plainText: normalizePlainText(descriptionLines),
            wrapParagraph: hasBlankAfterTerm && (definitionIndex > 0 || !hasInlineBlockContent(descriptionLines)) || sawBlank
        },
        nextIndex: index
    };
}

function canStartDefinitionListItem(lines: string[], index: number): boolean {
    if (index >= lines.length || lines[index].trim().length === 0 || parseTopLevelDefinitionMarker(lines[index])) {
        return false;
    }

    const markerIndex = findFirstDefinitionMarker(lines, index);
    return markerIndex === index + 1 || markerIndex === index + 2;
}

function findFirstDefinitionMarker(lines: string[], termLine: number): number {
    let index = termLine + 1;
    if (lines[index]?.trim().length === 0) {
        index++;
    }
    return parseTopLevelDefinitionMarker(lines[index] ?? '') ? index : -1;
}

function isListTerminator(lines: string[], index: number): boolean {
    if (index >= lines.length) {
        return true;
    }

    if (lines[index].trim().length === 0) {
        return isBlankThenListTerminator(lines, index + 1);
    }

    return false;
}

function isBlankThenListTerminator(lines: string[], index: number): boolean {
    while (index < lines.length && lines[index].trim().length === 0) {
        index++;
    }

    if (index >= lines.length) {
        return true;
    }

    if (parseTopLevelDefinitionMarker(lines[index]) || canStartDefinitionListItem(lines, index)) {
        return false;
    }

    return getIndentWidth(getLeadingWhitespace(lines[index])) < 4;
}

function isBlankBeforeSiblingDefinition(lines: string[], index: number): boolean {
    while (index < lines.length && lines[index].trim().length === 0) {
        index++;
    }

    return parseTopLevelDefinitionMarker(lines[index] ?? '') !== null ||
        canStartDefinitionListItem(lines, index);
}

function parseTopLevelDefinitionMarker(line: string): DefinitionMarker | null {
    const match = line.match(/^([ \t]*)([:~])(?:([ \t]+)(.*)|[ \t]*)$/);
    if (!match || getIndentWidth(match[1]) >= 4) {
        return null;
    }

    if (!match[3] && line.trim().length > 1) {
        return null;
    }

    return {
        marker: match[2] as ':' | '~',
        content: removePandocMarkerPadding(match[4] ?? '')
    };
}

function stripContinuationIndent(line: string): string {
    if (parseIndentedDefinitionMarker(line)) {
        return line;
    }
    return line.replace(/^ {0,2}/, '');
}

function removePandocMarkerPadding(content: string): string {
    return content.replace(/^ {0,3}/, '');
}

function trimTrailingBlankLines(lines: string[]): string[] {
    let end = lines.length;
    while (end > 0 && lines[end - 1].trim().length === 0) {
        end--;
    }
    return lines.slice(0, end);
}

function hasInlineBlockContent(lines: string[]): boolean {
    return trimOuterBlankLines(lines).some(line =>
        !!parseMarkdownListItem(line) ||
        !!parseIndentedDefinitionMarker(line) ||
        line.trimStart().startsWith('>') ||
        ListPatterns.CODE_BLOCK_FENCE.test(line)
    );
}

function getLeadingWhitespace(line: string): string {
    return line.match(/^[ \t]*/)?.[0] ?? '';
}

function getIndentWidth(indent: string): number {
    return Array.from(indent).reduce((width, char) => width + (char === '\t' ? 4 : 1), 0);
}
