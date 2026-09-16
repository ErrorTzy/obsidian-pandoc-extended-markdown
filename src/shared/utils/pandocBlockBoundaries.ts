import {
    getPandocContainerContent,
    isPandocThematicBreak
} from './pandocListMarkers';
import { getRawTexCommandBlockEndIndex } from './pandocRawTexBlocks';
import { getIndentColumns } from './orderedListMarkers';

export interface FenceState {
    character: '`' | '~';
    length: number;
    indentColumns: number;
}

export interface IndentedBacktickCodeSpan {
    endIndex: number;
    text: string;
}

export interface RawHtmlContainerOpening {
    tagName: string;
    openingEndIndex: number;
    bodyIndentColumns: number;
    hasBody: boolean;
}

const ATX_HEADING = /^ {0,3}#{1,6}(?:[ \t]+|$)/;
const SETEXT_UNDERLINE = /^ {0,3}(?:=+|-+)[ \t]*$/;
const PIPE_TABLE_CELL_DELIMITER = /^\s*:?-{3,}:?\s*$/;
const GRID_TABLE_BORDER = /^ {0,3}\+(?:[-=:]+\+)+[ \t]*$/;
const FENCED_DIV_OPENING = /^ {0,3}:{3,}[ \t]*(?:\{[^}]*\}|[^ \t:{}][^ \t{}]*)[ \t]*$/;
const LINE_BLOCK = /^ {0,3}\|(?:[ \t]|$)/;
const RAW_TEX_ENVIRONMENT = /^ {0,3}\\begin\{([^}]+)\}/;
const HTML_BLOCK_BOUNDARY = /^ {0,3}<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|pre|script|search|section|style|summary|table|tbody|td|textarea|tfoot|th|thead|title|tr|track|ul)(?:[ \t]|\/?>|$)/i;

export function isSetextHeading(
    lines: string[],
    paragraphStartIndex: number,
    index: number
): boolean {
    return paragraphStartIndex === index - 1 &&
        SETEXT_UNDERLINE.test(getPandocContainerContent(lines[index]));
}

export function isStandaloneBlock(lines: string[], index: number, content: string): boolean {
    return ATX_HEADING.test(content) ||
        isPandocThematicBreak(content) ||
        FENCED_DIV_OPENING.test(content) ||
        isLineBlock(content) ||
        isHtmlBlockBoundary(content) ||
        isPipeTableDelimiter(lines, index, content) ||
        /^ {4}|^\t/.test(content);
}

export function isYamlMetadataStart(
    lines: string[],
    index: number,
    content: string
): boolean {
    if (index !== 0 || !/^---[ \t]*$/.test(content)) {
        return false;
    }

    const closingIndex = lines.findIndex((line, lineIndex) =>
        lineIndex > index && /^(?:---|\.\.\.)[ \t]*$/.test(getPandocContainerContent(line))
    );
    return closingIndex > index + 1;
}

export function getRawTexEnvironmentOpening(
    lines: string[],
    index: number,
    content: string
): string | null {
    const environment = content.match(RAW_TEX_ENVIRONMENT)?.[1];
    if (!environment) {
        return null;
    }

    const closingText = `\\end{${environment}}`;
    return lines.slice(index).some(line =>
        getPandocContainerContent(line).includes(closingText)
    ) ? environment : null;
}

export function isFencedDivOpening(content: string): boolean {
    return FENCED_DIV_OPENING.test(content);
}

export function isFencedDivClosing(content: string): boolean {
    return /^ {0,3}:{3,}[ \t]*$/.test(content);
}

export function isLineBlock(content: string): boolean {
    return LINE_BLOCK.test(content);
}

export function isLineBlockContinuation(content: string): boolean {
    return /^[ \t]+\S/.test(content);
}

export function isPipeTableDelimiter(
    lines: string[],
    index: number,
    content: string
): boolean {
    if (index === 0 || !getPandocContainerContent(lines[index - 1]).includes('|')) {
        return false;
    }

    const row = content.trim().replace(/^\|/, '').replace(/\|$/, '');
    const cells = row.split('|');
    return cells.length > 0 && cells.every(cell => PIPE_TABLE_CELL_DELIMITER.test(cell));
}

export function getPipeTableEndIndex(lines: string[], delimiterIndex: number): number {
    let endIndex = delimiterIndex;
    for (let index = delimiterIndex + 1; index < lines.length; index++) {
        const content = getPandocContainerContent(lines[index]);
        if (isBlankContainerLine(content) || !content.includes('|')) {
            break;
        }
        endIndex = index;
    }
    return endIndex;
}

export function getStandaloneOpaqueBlockEndIndex(
    lines: string[],
    index: number,
    content: string
): number | null {
    return getRawHtmlBlockEndIndex(lines, index, content) ??
        getRawTexCommandBlockEndIndex(lines, index) ??
        getGridTableEndIndex(lines, index, content);
}

function getGridTableEndIndex(
    lines: string[],
    startIndex: number,
    content: string
): number | null {
    if (!GRID_TABLE_BORDER.test(content)) {
        return null;
    }

    let sawRow = false;
    let lastBorderIndex = startIndex;
    for (let index = startIndex + 1; index < lines.length; index++) {
        const candidate = getPandocContainerContent(lines[index]);
        if (/^ {0,3}\|/.test(candidate)) {
            sawRow = true;
            continue;
        }
        if (GRID_TABLE_BORDER.test(candidate)) {
            lastBorderIndex = index;
            continue;
        }
        break;
    }

    return sawRow && lastBorderIndex > startIndex ? lastBorderIndex : null;
}

export function getRawHtmlBlockEndIndex(
    lines: string[],
    startIndex: number,
    content: string
): number | null {
    if (/^ {0,3}<!--/.test(content)) {
        return findClosingLine(lines, startIndex, '-->');
    }
    if (/^ {0,3}<\?/.test(content)) {
        return findClosingLine(lines, startIndex, '?>');
    }
    const rawTag = content.match(/^ {0,3}<(script|pre|style|textarea)(?:[ \t]|>|$)/i)?.[1];
    return rawTag
        ? findClosingLine(lines, startIndex, `</${rawTag}>`, true)
        : null;
}

function findClosingLine(
    lines: string[],
    startIndex: number,
    closingText: string,
    caseInsensitive: boolean = false
): number {
    const expected = caseInsensitive ? closingText.toLowerCase() : closingText;
    for (let index = startIndex; index < lines.length; index++) {
        const content = getPandocContainerContent(lines[index]);
        const candidate = caseInsensitive ? content.toLowerCase() : content;
        if (candidate.includes(expected)) {
            return index;
        }
    }
    return lines.length - 1;
}

export function getBlockQuoteDepth(line: string): number {
    let depth = 0;
    let content = line;
    while (true) {
        const match = content.match(/^ {0,3}>[ \t]?/);
        if (!match) {
            return depth;
        }
        depth++;
        content = content.slice(match[0].length);
    }
}

export function isBlankContainerLine(content: string): boolean {
    return /^[ \t]*$/.test(content);
}

export function isHtmlBlockBoundary(content: string): boolean {
    return HTML_BLOCK_BOUNDARY.test(content);
}

/**
 * rawHtmlBlocks consumes the first body's indentation and repeats that removal
 * at subsequent block entries, not on paragraph/list continuation lines.
 * Native divs, comments, and balanced verbatim elements use other productions.
 */
export function getRawHtmlContainerOpening(
    lines: string[],
    index: number,
    content: string = getPandocContainerContent(lines[index] ?? '')
): RawHtmlContainerOpening | null {
    const name = content.match(/^<([?]?[A-Za-z][\w:-]*)(?=[ \t\n/>?]|$)/)?.[1];
    if (!name || (!name.startsWith('?') && !isHtmlBlockBoundary(content)) ||
        /^(?:div|pre|script|style|textarea)$/i.test(name)) {
        return null;
    }
    const opening = findOpeningTagEnd(lines, index, content);
    // Inline body text needs no indentation adjustment on the next line.
    if (!opening || /\bmarkdown\s*=\s*["']?0\b/.test(opening.source)) {
        return null;
    }
    const nextContent = getPandocContainerContent(lines[opening.endIndex + 1] ?? '');
    const indentation = nextContent.match(/^[ \t]*/)?.[0] ?? '';
    return {
        tagName: name.toLowerCase(),
        openingEndIndex: opening.endIndex,
        bodyIndentColumns: getIndentColumns(indentation),
        hasBody: !/\/>[ \t]*$/.test(opening.source) &&
            !/^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i.test(name)
    };
}

function findOpeningTagEnd(
    lines: string[],
    startIndex: number,
    firstLine: string
): { endIndex: number; source: string } | null {
    const sourceLines: string[] = [];
    let quote: string | null = null;
    for (let index = startIndex; index < lines.length; index++) {
        const content = index === startIndex ? firstLine : getPandocContainerContent(lines[index]);
        sourceLines.push(content);
        for (let offset = 0; offset < content.length; offset++) {
            const character = content[offset];
            if (quote) {
                if (character === quote) {
                    quote = null;
                }
            } else if (character === '"' || character === "'") {
                quote = character;
            } else if (character === '>') {
                return content.slice(offset + 1).trim() === ''
                    ? { endIndex: index, source: sourceLines.join('\n') }
                    : null;
            }
        }
    }
    return null;
}

export function getFenceOpening(
    lines: string[],
    index: number,
    content: string
): FenceState | null {
    const match = content.match(/^( {0,3})(`{3,}|~{3,})(.*)$/);
    if (!match || (match[2][0] === '`' && match[3].includes('`'))) {
        return null;
    }

    const fence = {
        character: match[2][0] as '`' | '~',
        length: match[2].length,
        indentColumns: match[1].length
    };
    return lines.slice(index + 1).some(line =>
        isFenceClosing(getPandocContainerContent(line), fence)
    ) ? fence : null;
}

export function getIndentedBacktickCodeSpan(
    lines: string[],
    index: number,
    content: string = getPandocContainerContent(lines[index] ?? '')
): IndentedBacktickCodeSpan | null {
    const opening = content.match(/^ {1,3}(`{3,})(.*)$/);
    if (!opening) {
        return null;
    }

    const delimiterLength = opening[1].length;
    const contentLines = [opening[2]];
    for (let lineIndex = index + 1; lineIndex < lines.length; lineIndex++) {
        const candidate = getPandocContainerContent(lines[lineIndex]);
        if (isBlankContainerLine(candidate)) {
            return null;
        }

        const closingOffset = findExactBacktickRun(candidate, delimiterLength);
        if (closingOffset !== null) {
            contentLines.push(candidate.slice(0, closingOffset));
            return {
                endIndex: lineIndex,
                text: contentLines.join('\n').replace(/\r?\n/g, ' ').trim()
            };
        }
        contentLines.push(candidate);
    }

    return null;
}

/** Return the closing line of an inline code span that crosses a line boundary. */
export function getMultilineBacktickCodeSpanEndIndex(
    lines: string[],
    index: number,
    content: string = getPandocContainerContent(lines[index] ?? '')
): number | null {
    let openingOffset = 0;
    while (openingOffset < content.length) {
        const opening = findNextBacktickRun(content, openingOffset);
        if (!opening) {
            return null;
        }

        const closing = findInlineCodeClosing(
            lines,
            index,
            opening.end,
            opening.length
        );
        if (closing?.lineIndex === index) {
            openingOffset = closing.offset + opening.length;
            continue;
        }
        if (closing) {
            return closing.lineIndex;
        }
        openingOffset = opening.end;
    }

    return null;
}

function findNextBacktickRun(
    content: string,
    startOffset: number
): { end: number; length: number } | null {
    for (let offset = startOffset; offset < content.length; offset++) {
        if (content[offset] !== '`' || content[offset - 1] === '`' ||
            isBackslashEscaped(content, offset)) {
            continue;
        }
        let end = offset + 1;
        while (content[end] === '`') {
            end++;
        }
        return { end, length: end - offset };
    }
    return null;
}

function findInlineCodeClosing(
    lines: string[],
    openingLineIndex: number,
    openingEndOffset: number,
    delimiterLength: number
): { lineIndex: number; offset: number } | null {
    for (let lineIndex = openingLineIndex; lineIndex < lines.length; lineIndex++) {
        const candidate = getPandocContainerContent(lines[lineIndex]);
        if (lineIndex > openingLineIndex && isBlankContainerLine(candidate)) {
            return null;
        }
        const startOffset = lineIndex === openingLineIndex ? openingEndOffset : 0;
        const relativeOffset = findExactBacktickRun(
            candidate.slice(startOffset),
            delimiterLength
        );
        if (relativeOffset !== null) {
            return { lineIndex, offset: startOffset + relativeOffset };
        }
    }
    return null;
}

function isBackslashEscaped(content: string, offset: number): boolean {
    let slashCount = 0;
    for (let index = offset - 1; index >= 0 && content[index] === '\\'; index--) {
        slashCount++;
    }
    return slashCount % 2 === 1;
}

function findExactBacktickRun(content: string, length: number): number | null {
    for (let index = 0; index <= content.length - length; index++) {
        if (content[index] !== '`' || content[index - 1] === '`') {
            continue;
        }
        if (content.slice(index, index + length) === '`'.repeat(length) &&
            content[index + length] !== '`') {
            return index;
        }
    }
    return null;
}

export function isFenceClosing(content: string, fence: FenceState): boolean {
    const match = content.match(fence.character === '`'
        ? /^ {0,3}(`+)([ \t]*)$/
        : /^ {0,3}(~+)([ \t]*)$/);
    return Boolean(match && match[1].length >= fence.length);
}
