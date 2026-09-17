import { ListPatterns } from '../../../shared/patterns';
import {
    getBlockQuoteDepth,
    stripBlockQuoteDepth
} from '../../../shared/utils/pandocBlockBoundaries';
import { ListBlockValidator } from '../../../shared/utils/listBlockValidator';
import { parsePandocListMarker } from '../../../shared/utils/pandocListMarkers';
import {
    isFencedDivClosing,
    parseFencedDivOpening
} from '../../../live-preview/pipeline/structural/fencedDiv/parser';

export interface PandocDefinitionListBlock {
    startLine: number;
    endLine: number;
    termTexts: string[];
    definitionTexts: string[];
    items: PandocDefinitionListItem[];
    joinsLazyContainer: boolean;
    termContainerDepth: number;
    definitionContainerDepth: number;
    nativeListParentIndex?: number;
}

export interface PandocDefinitionListItem {
    term: string;
    definitions: PandocDefinitionDescription[];
}

export interface PandocDefinitionDescription {
    marker: ':' | '~';
    lines: string[];
    plainText: string;
    wrapParagraph: boolean;
    nestedDefinitionBlocks: PandocDefinitionListBlock[];
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

export interface DefinitionListSpacingSettings {
    enableListsWithoutPrecedingBlankline: boolean;
}

// Discover validator-approved definition blocks across document and container projections.
export function findPandocDefinitionListBlocks(
    sourceText: string,
    settings: DefinitionListSpacingSettings = {
        enableListsWithoutPrecedingBlankline: true
    }
): PandocDefinitionListBlock[] {
    const sourceLines = sourceText.split('\n');
    const analysis = ListBlockValidator.analyzeListBlocks(sourceLines, {
        enableListsWithoutPrecedingBlankline:
            settings.enableListsWithoutPrecedingBlankline
    });
    const invalidLines = analysis.invalidLines;
    const nativeListOwnedLines = getNativeListOwnedNonMarkerLines(
        sourceLines,
        invalidLines
    );
    const projections = new Map<number, string[]>();
    const blocks: PandocDefinitionListBlock[] = [];
    let index = 0;

    while (index < sourceLines.length) {
        const ownerContainerDepth = getBlockQuoteDepth(sourceLines[index]);
        const lines = getDefinitionContainerProjection(
            analysis.sourceLines,
            sourceLines,
            invalidLines,
            ownerContainerDepth,
            projections
        );
        const nativeProjection = getNativeListDefinitionProjection(
            lines,
            sourceLines,
            index
        );
        const sourceMarker = parsePandocListMarker(sourceLines[index], true);
        if (nativeListOwnedLines.has(index)) {
            index++;
            continue;
        }
        if (sourceMarker && sourceMarker.kind !== 'definition' && !nativeProjection) {
            index++;
            continue;
        }
        const candidateLines = nativeProjection?.lines ?? lines;
        const allowLiteralMarkerTerm = isInvalidLiteralDefinitionTerm(
            candidateLines,
            invalidLines,
            index
        );
        const markerIndex = findFirstDefinitionMarker(candidateLines, index);
        if (!canStartDefinitionListItem(candidateLines, index, allowLiteralMarkerTerm) ||
            invalidLines.has(markerIndex)) {
            index++;
            continue;
        }

        const block = readDefinitionListBlock(
            candidateLines,
            sourceLines,
            index,
            markerIndex,
            ownerContainerDepth,
            settings.enableListsWithoutPrecedingBlankline,
            nativeProjection ? index : undefined,
            allowLiteralMarkerTerm
        );
        blocks.push(block);
        index = block.endLine + 1;
    }

    return blocks;
}

/**
 * Lines owned by a native list item cannot also act as root definition terms.
 * Nested native markers remain eligible to establish their own item projection.
 */
function getNativeListOwnedNonMarkerLines(
    sourceLines: string[],
    invalidLines: Set<number>
): Set<number> {
    const ownedLines = new Set<number>();
    sourceLines.forEach((line, parentIndex) => {
        const parent = parsePandocListMarker(line, true);
        if (!parent || parent.kind === 'definition' || invalidLines.has(parentIndex)) {
            return;
        }

        const endIndex = findNativeListItemEnd(
            sourceLines,
            parentIndex,
            parent.indentColumns,
            parent.contentIndentColumns,
            getBlockQuoteDepth(line)
        );
        for (let index = parentIndex + 1; index < endIndex; index++) {
            const marker = parsePandocListMarker(sourceLines[index], true);
            if (!marker || marker.kind === 'definition') {
                ownedLines.add(index);
            }
        }
    });
    return ownedLines;
}

function getDefinitionContainerProjection(
    analyzedLines: string[],
    sourceLines: string[],
    invalidLines: Set<number>,
    ownerContainerDepth: number,
    projections: Map<number, string[]>
): string[] {
    const existing = projections.get(ownerContainerDepth);
    if (existing) {
        return existing;
    }

    const projected = analyzedLines.map(line =>
        stripBlockQuoteDepth(line, ownerContainerDepth)
    );
    normalizeIndentedLazyDefinitionMarkers(projected, sourceLines, invalidLines);
    projections.set(ownerContainerDepth, projected);
    return projected;
}

function isInvalidLiteralDefinitionTerm(
    lines: string[],
    invalidLines: Set<number>,
    index: number
): boolean {
    return invalidLines.has(index) &&
        parseTopLevelDefinitionMarker(lines[index] ?? '') !== null;
}

function getNativeListDefinitionProjection(
    lines: string[],
    sourceLines: string[],
    index: number
): { lines: string[] } | null {
    const parent = parsePandocListMarker(sourceLines[index], true);
    if (!parent || parent.kind === 'definition' ||
        !sourceLines[index].slice(parent.markerEnd).trim()) {
        return null;
    }

    const endIndex = findNativeListItemEnd(
        sourceLines,
        index,
        parent.indentColumns,
        parent.contentIndentColumns,
        getBlockQuoteDepth(sourceLines[index])
    );
    const projected = lines.slice(0, endIndex);
    projected[index] = sourceLines[index].slice(parent.markerEnd).trimStart();
    for (let lineIndex = index + 1; lineIndex < endIndex; lineIndex++) {
        projected[lineIndex] = stripIndentColumns(
            lines[lineIndex],
            parent.contentIndentColumns
        );
    }

    const markerIndex = findFirstDefinitionMarker(projected, index);
    if (markerIndex < 0) {
        return null;
    }
    const originalMarker = parsePandocListMarker(sourceLines[markerIndex], true);
    if (originalMarker?.kind !== 'definition' ||
        originalMarker.indentColumns < parent.contentIndentColumns ||
        originalMarker.indentColumns > parent.contentIndentColumns + 3) {
        return null;
    }
    return { lines: projected };
}

function findNativeListItemEnd(
    sourceLines: string[],
    startIndex: number,
    parentIndentColumns: number,
    parentContentIndentColumns: number,
    parentContainerDepth: number
): number {
    let followsBlank = false;
    for (let index = startIndex + 1; index < sourceLines.length; index++) {
        const ownerContent = stripBlockQuoteDepth(
            sourceLines[index],
            parentContainerDepth
        );
        if (ownerContent.trim().length === 0) {
            followsBlank = true;
            continue;
        }

        const marker = parsePandocListMarker(sourceLines[index], true);
        if (marker && marker.kind !== 'definition' &&
            marker.indentColumns <= parentIndentColumns) {
            return index;
        }
        if (marker?.kind === 'definition' &&
            marker.indentColumns < parentContentIndentColumns) {
            return index;
        }
        if (followsBlank && (
            getBlockQuoteDepth(sourceLines[index]) < parentContainerDepth ||
            getIndentWidth(getLeadingWhitespace(ownerContent)) <
                parentContentIndentColumns
        )) {
            return index;
        }
        followsBlank = false;
    }
    return sourceLines.length;
}

function stripIndentColumns(line: string, columnsToStrip: number): string {
    let offset = 0;
    let columns = 0;
    while (offset < line.length && columns < columnsToStrip) {
        if (line[offset] === ' ') {
            columns++;
            offset++;
            continue;
        }
        if (line[offset] === '\t') {
            columns += 4 - columns % 4;
            offset++;
            continue;
        }
        break;
    }
    return columns >= columnsToStrip ? line.slice(offset) : line;
}

function normalizeIndentedLazyDefinitionMarkers(
    lines: string[],
    sourceLines: string[],
    invalidLines: Set<number>
): void {
    for (let index = 1; index < lines.length; index++) {
        const marker = parsePandocListMarker(sourceLines[index], true);
        if (invalidLines.has(index) || marker?.kind !== 'definition' ||
            marker.indentColumns < 4 ||
            getBlockQuoteDepth(sourceLines[index - 1]) <=
                getBlockQuoteDepth(sourceLines[index])) {
            continue;
        }
        lines[index] = lines[index].trimStart();
    }
}

export function isStandalonePandocDefinitionList(
    sourceText: string,
    blocks: PandocDefinitionListBlock[] = findPandocDefinitionListBlocks(sourceText)
): boolean {
    if (blocks.length === 0) {
        return false;
    }
    if (blocks.some(block =>
        block.nativeListParentIndex !== undefined ||
        block.termContainerDepth !== 0 ||
        block.definitionContainerDepth !== 0
    )) {
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
    const parsed = parseDefinitionMarkerAtAnyIndent(line);
    if (!parsed || parsed.indentColumns < 4) {
        return null;
    }

    return {
        marker: parsed.marker,
        content: parsed.content
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

// Parse one contiguous definition-list block and its descriptions.
function readDefinitionListBlock(
    lines: string[],
    sourceLines: string[],
    startLine: number,
    firstMarkerLine: number,
    ownerContainerDepth: number,
    enableListsWithoutPrecedingBlankline: boolean,
    nativeListParentIndex?: number,
    allowLiteralMarkerTerm = false
): PandocDefinitionListBlock {
    const items: PandocDefinitionListItem[] = [];
    const termTexts: string[] = [];
    const definitionTexts: string[] = [];
    let index = startLine;
    const definitionQuoteDepth = getBlockQuoteDepth(sourceLines[firstMarkerLine]);

    while (canStartDefinitionListItem(
        lines,
        index,
        allowLiteralMarkerTerm && index === startLine
    ) && getBlockQuoteDepth(sourceLines[index]) >= ownerContainerDepth) {
        const itemStart = index;
        const term = lines[index].trim();
        const markerStart = findFirstDefinitionMarker(lines, itemStart);
        const hasBlankAfterTerm = markerStart > itemStart + 1;
        index = markerStart;

        const definitions: PandocDefinitionDescription[] = [];
        while (index < lines.length) {
            if (!isDefinitionMarkerInOwningContainer(
                sourceLines[index],
                ownerContainerDepth,
                enableListsWithoutPrecedingBlankline
            ) ||
                !parseTopLevelDefinitionMarker(lines[index])) {
                break;
            }

            const result = readDefinitionDescription(
                lines,
                index,
                hasBlankAfterTerm,
                definitions.length,
                enableListsWithoutPrecedingBlankline
            );
            definitions.push(result.description);
            definitionTexts.push(result.description.plainText);
            index = result.nextIndex;

            if (canStartDefinitionListItem(lines, index) || isListTerminator(lines, index)) {
                break;
            }
        }

        items.push({ term, definitions });
        termTexts.push(term);

        let crossedContainerBoundary = false;
        while (index < lines.length && lines[index].trim().length === 0) {
            if (getBlockQuoteDepth(sourceLines[index]) < ownerContainerDepth) {
                crossedContainerBoundary = true;
            }
            index++;
        }
        if (crossedContainerBoundary) {
            break;
        }
    }

    return {
        startLine,
        endLine: Math.max(startLine, index - 1),
        termTexts,
        definitionTexts,
        items,
        joinsLazyContainer: ownerContainerDepth > definitionQuoteDepth,
        termContainerDepth: ownerContainerDepth,
        definitionContainerDepth: definitionQuoteDepth,
        nativeListParentIndex
    };
}

function readDefinitionDescription(
    lines: string[],
    markerLine: number,
    hasBlankAfterTerm: boolean,
    definitionIndex: number,
    enableListsWithoutPrecedingBlankline: boolean
): { description: PandocDefinitionDescription, nextIndex: number } {
    const marker = parseTopLevelDefinitionMarker(lines[markerLine]);
    const owner = parsePandocListMarker(lines[markerLine], true);
    const descriptionLines = [marker?.content ?? ''];
    let index = markerLine + 1;
    let sawBlank = false;

    while (index < lines.length) {
        if (isDefinitionDescriptionListBoundary(lines, markerLine, index)) {
            break;
        }

        if (isDefinitionTermBoundary(lines[index])) {
            break;
        }

        if (parseTopLevelDefinitionMarker(lines[index]) &&
            !isNestedDefinitionMarker(owner, lines[index])) {
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

        descriptionLines.push(normalizeDefinitionContinuation(
            lines[index],
            owner?.contentIndentColumns ?? 2,
            descriptionLines[0]
        ));
        index++;
    }

    const nestedDefinitionBlocks = findPandocDefinitionListBlocks(
        descriptionLines.join('\n'),
        { enableListsWithoutPrecedingBlankline }
    ).filter(block => block.termContainerDepth === 0);

    return {
        description: {
            marker: marker?.marker ?? ':',
            lines: trimTrailingBlankLines(descriptionLines),
            plainText: normalizePlainText(descriptionLines),
            wrapParagraph: hasBlankAfterTerm && (definitionIndex > 0 || !hasInlineBlockContent(descriptionLines)) || sawBlank,
            nestedDefinitionBlocks
        },
        nextIndex: index
    };
}

function isNestedDefinitionMarker(
    owner: ReturnType<typeof parsePandocListMarker>,
    candidateLine: string
): boolean {
    const candidate = parsePandocListMarker(candidateLine, true);
    return owner?.kind === 'definition' &&
        candidate?.kind === 'definition' &&
        candidate.indentColumns >= owner.contentIndentColumns &&
        candidate.indentColumns <= owner.contentIndentColumns + 3;
}

// Definition-list boundary and continuation rules.
function normalizeDefinitionContinuation(
    line: string,
    ownerContentIndent: number,
    firstLine: string
): string {
    // The description body starts at the definition marker's content column.
    // Project continuations into that coordinate system so a child definition
    // marker is parsed recursively at its actual body depth. Keep the existing
    // list-body representation for the synchronous native-list fallback.
    if (!parseMarkdownListItem(firstLine)) {
        return stripIndentColumns(line, ownerContentIndent);
    }
    return stripContinuationIndent(line);
}

function isDefinitionMarkerInOwningContainer(
    sourceLine: string,
    ownerContainerDepth: number,
    enableListsWithoutPrecedingBlankline: boolean
): boolean {
    const marker = parsePandocListMarker(sourceLine, true);
    if (marker?.kind !== 'definition') {
        return false;
    }

    const markerContainerDepth = getBlockQuoteDepth(sourceLine);
    return markerContainerDepth >= ownerContainerDepth ||
        !enableListsWithoutPrecedingBlankline ||
        marker.indentColumns >= 4;
}

function isDefinitionDescriptionListBoundary(
    lines: string[],
    definitionMarkerLine: number,
    candidateLine: number
): boolean {
    if (getBlockQuoteDepth(lines[candidateLine]) > 0) {
        return false;
    }

    const candidate = parsePandocListMarker(lines[candidateLine], true);
    if (!candidate || candidate.kind === 'definition') {
        return false;
    }

    const definition = parsePandocListMarker(lines[definitionMarkerLine], true);
    return Boolean(definition &&
        candidate.indentColumns < definition.contentIndentColumns);
}

function canStartDefinitionListItem(
    lines: string[],
    index: number,
    allowDefinitionMarkerTerm = false
): boolean {
    if (
        index >= lines.length ||
        lines[index].trim().length === 0 ||
        getIndentWidth(getLeadingWhitespace(lines[index])) >= 4 ||
        (!allowDefinitionMarkerTerm && parseTopLevelDefinitionMarker(lines[index])) ||
        isDefinitionTermBoundary(lines[index])
    ) {
        return false;
    }

    const markerIndex = findFirstDefinitionMarker(lines, index);
    return markerIndex === index + 1 || markerIndex === index + 2;
}

function isDefinitionTermBoundary(line: string): boolean {
    return Boolean(parseFencedDivOpening(line) || isFencedDivClosing(line));
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
    const parsed = parseDefinitionMarkerAtAnyIndent(line);
    if (!parsed || parsed.indentColumns >= 4) {
        return null;
    }

    return {
        marker: parsed.marker,
        content: parsed.content
    };
}

function parseDefinitionMarkerAtAnyIndent(
    line: string
): DefinitionMarker & { indentColumns: number } | null {
    const parsed = parsePandocListMarker(line, true);
    if (parsed?.kind !== 'definition' ||
        !/^[ \t]*$/.test(line.slice(0, parsed.markerStart))) {
        return null;
    }

    const marker = line.slice(parsed.markerStart, parsed.markerEnd);
    if (marker !== ':' && marker !== '~') {
        return null;
    }
    const markerEndColumn = parsed.indentColumns + marker.length;
    const paddingColumns = parsed.contentIndentColumns - markerEndColumn;
    return {
        marker,
        content: stripIndentColumns(line.slice(parsed.markerEnd), paddingColumns),
        indentColumns: parsed.indentColumns
    };
}

function stripContinuationIndent(line: string): string {
    if (parseIndentedDefinitionMarker(line)) {
        return line;
    }
    return line.replace(/^ {0,2}/, '');
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
    return Array.from(indent).reduce((width, char) => width +
        (char === '\t' ? 4 - width % 4 : 1), 0);
}
