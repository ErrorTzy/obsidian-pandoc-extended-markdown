import { getIndentColumns } from './orderedListMarkers';

export type PandocListMarkerKind = 'bullet' | 'ordered' | 'definition';

export interface ParsedPandocListMarker {
    kind: PandocListMarkerKind;
    indentColumns: number;
    contentIndentColumns: number;
    markerStart: number;
    markerEnd: number;
    hasValidMarkerSpacing: boolean;
    orderedStartNumber?: number;
    orderedGroup?: string;
}

interface ParsedOrderedMarker {
    delimiter: 'period' | 'one-paren' | 'two-parens';
    style: 'decimal' | 'example' | 'default' | 'lower-alpha' |
        'lower-roman' | 'upper-alpha' | 'upper-roman';
    number: number;
}

const UNORDERED_LIST_MARKER = /^([ \t]*)([-+*])(?:([ \t]+)|$)/;
const ORDERED_LIST_MARKER = /^([ \t]*)(\((?:@[A-Za-z0-9_-]*|#|[A-Za-z0-9]+)\)|(?:@[A-Za-z0-9_-]*|#|[A-Za-z0-9]+)[.)])([ \t]+|$)/;
const DEFINITION_LIST_MARKER = /^([ \t]*)[:~]([ \t]+|$)/;
const PANDOC_ROMAN_NUMERAL = /^(M*)(CM)?(D)?(CD)?(C*)(XC)?(L)?(XL)?(X*)(IX)?(V)?(IV)?(I*)$/;
const AMBIGUOUS_UPPER_ROMAN_VALUES = new Set([1, 5, 10, 50, 100, 500, 1000]);

export function parsePandocListMarker(
    line: string,
    allowNested: boolean
): ParsedPandocListMarker | null {
    const { content, offset } = splitContainerPrefix(line);
    const unordered = parseUnorderedMarker(content, offset, allowNested);
    if (unordered) {
        return unordered;
    }

    const ordered = parseOrderedMarker(content, offset, allowNested);
    if (ordered) {
        return ordered;
    }

    return parseDefinitionMarker(content, offset, allowNested);
}

export function escapePandocListMarker(line: string): string {
    const marker = parsePandocListMarker(line, true);
    if (!marker) {
        return line;
    }

    const markerText = line.slice(marker.markerStart, marker.markerEnd);
    const escapeOffset = /^[A-Za-z0-9]+[.)]$/.test(markerText)
        ? markerText.length - 1
        : 0;
    return line.slice(0, marker.markerStart + escapeOffset) + '\\' +
        line.slice(marker.markerStart + escapeOffset);
}

export function getPandocContainerContent(line: string): string {
    return splitContainerPrefix(line).content;
}

export function isPandocThematicBreak(content: string): boolean {
    const compact = content.replace(/^[ \t]+|[ \t]+$/g, '').replace(/[ \t]/g, '');
    return compact.length >= 3 &&
        (/^\*+$/.test(compact) || /^-+$/.test(compact) || /^_+$/.test(compact));
}

function parseUnorderedMarker(
    content: string,
    offset: number,
    allowNested: boolean
): ParsedPandocListMarker | null {
    const match = content.match(UNORDERED_LIST_MARKER);
    if (!match || isPandocThematicBreak(content)) {
        return null;
    }

    const indentColumns = getIndentColumns(match[1]);
    return allowNested || indentColumns <= 3
        ? createMarker(
            'bullet',
            indentColumns,
            offset,
            match[1].length,
            match[2].length,
            match[3] ?? '',
            true
        )
        : null;
}

function parseOrderedMarker(
    content: string,
    offset: number,
    allowNested: boolean
): ParsedPandocListMarker | null {
    const match = content.match(ORDERED_LIST_MARKER);
    if (!match) {
        return null;
    }

    const indentColumns = getIndentColumns(match[1]);
    const result = allowNested || indentColumns <= 3
        ? createMarker(
            'ordered',
            indentColumns,
            offset,
            match[1].length,
            match[2].length,
            match[3] ?? '',
            hasValidOrderedMarkerSpacing(match[2], match[3] ?? '')
        )
        : null;
    if (result) {
        const ordered = parsePandocOrderedMarker(match[2]);
        result.orderedStartNumber = ordered?.number;
        result.orderedGroup = ordered ? `${ordered.style}:${ordered.delimiter}` : undefined;
    }
    return result;
}

function parseDefinitionMarker(
    content: string,
    offset: number,
    allowNested: boolean
): ParsedPandocListMarker | null {
    const match = content.match(DEFINITION_LIST_MARKER);
    if (!match) {
        return null;
    }

    const indentColumns = getIndentColumns(match[1]);
    return allowNested || indentColumns <= 3
        ? createMarker(
            'definition',
            indentColumns,
            offset,
            match[1].length,
            1,
            match[2] ?? '',
            true
        )
        : null;
}

function createMarker(
    kind: PandocListMarkerKind,
    indentColumns: number,
    offset: number,
    indentLength: number,
    markerLength: number,
    spacing: string,
    hasValidMarkerSpacing: boolean
): ParsedPandocListMarker {
    return {
        kind,
        indentColumns,
        contentIndentColumns: getContentIndentColumns(indentColumns, markerLength, spacing),
        markerStart: offset + indentLength,
        markerEnd: offset + indentLength + markerLength,
        hasValidMarkerSpacing
    };
}

function splitContainerPrefix(line: string): { content: string; offset: number } {
    let offset = 0;
    let remaining = line;
    while (true) {
        const match = remaining.match(/^ {0,3}>[ \t]?/);
        if (!match) {
            return { content: remaining, offset };
        }
        offset += match[0].length;
        remaining = remaining.slice(match[0].length);
    }
}

function hasValidOrderedMarkerSpacing(marker: string, spacing: string): boolean {
    const parsed = parsePandocOrderedMarker(marker);
    if (!parsed) {
        return false;
    }

    return !isAmbiguousUppercasePeriodMarker(parsed) ||
        spacing.length >= 2 || spacing.includes('\t') || spacing.length === 0;
}

/** Return the minimum ASCII padding Pandoc needs before ordered-list item content. */
export function getPandocOrderedMarkerSpacing(marker: string): ' ' | '  ' {
    const parsed = parsePandocOrderedMarker(marker);
    return parsed && isAmbiguousUppercasePeriodMarker(parsed) ? '  ' : ' ';
}

function isAmbiguousUppercasePeriodMarker(marker: ParsedOrderedMarker): boolean {
    return marker.delimiter === 'period' &&
        (marker.style === 'upper-alpha' ||
            (marker.style === 'upper-roman' &&
                AMBIGUOUS_UPPER_ROMAN_VALUES.has(marker.number)));
}

function getContentIndentColumns(
    indentColumns: number,
    markerLength: number,
    spacing: string
): number {
    let column = indentColumns + markerLength;
    for (const character of spacing) {
        column += character === '\t' ? 4 - (column % 4) : 1;
    }
    const markerEndColumn = indentColumns + markerLength;
    return column - markerEndColumn <= 4 ? column : markerEndColumn + 1;
}

function parsePandocOrderedMarker(marker: string): ParsedOrderedMarker | null {
    const twoParens = marker.startsWith('(') && marker.endsWith(')');
    const delimiter = twoParens
        ? 'two-parens'
        : marker.endsWith('.') ? 'period' : 'one-paren';
    const numeral = twoParens ? marker.slice(1, -1) : marker.slice(0, -1);
    const simple = parseSimpleOrderedNumeral(numeral, delimiter);
    if (simple) {
        return simple;
    }

    const romanNumber = parsePandocRomanNumeral(numeral);
    return romanNumber === null
        ? null
        : {
            delimiter,
            style: numeral === numeral.toUpperCase() ? 'upper-roman' : 'lower-roman',
            number: romanNumber
        };
}

function parseSimpleOrderedNumeral(
    numeral: string,
    delimiter: ParsedOrderedMarker['delimiter']
): ParsedOrderedMarker | null {
    if (/^\d+$/.test(numeral)) {
        return { delimiter, style: 'decimal', number: Number(numeral) };
    }
    if (numeral === '#') {
        return { delimiter, style: 'default', number: 1 };
    }
    if (/^@(?:[A-Za-z0-9]+|[_-][A-Za-z0-9]+)*$/.test(numeral)) {
        return { delimiter, style: 'example', number: 1 };
    }
    if (numeral === 'i' || numeral === 'I') {
        return {
            delimiter,
            style: numeral === 'i' ? 'lower-roman' : 'upper-roman',
            number: 1
        };
    }
    if (/^[a-z]$/.test(numeral)) {
        return { delimiter, style: 'lower-alpha', number: numeral.charCodeAt(0) - 96 };
    }
    if (/^[A-Z]$/.test(numeral)) {
        return { delimiter, style: 'upper-alpha', number: numeral.charCodeAt(0) - 64 };
    }
    return null;
}

function parsePandocRomanNumeral(numeral: string): number | null {
    if (!numeral || (numeral !== numeral.toUpperCase() && numeral !== numeral.toLowerCase())) {
        return null;
    }

    const upper = numeral.toUpperCase();
    if (!PANDOC_ROMAN_NUMERAL.test(upper)) {
        return null;
    }

    const values: Record<string, number> = {
        I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000
    };
    return Array.from(upper).reduce((total, character, index) => {
        const value = values[character];
        const nextValue = values[upper[index + 1]] ?? 0;
        return total + (value < nextValue ? -value : value);
    }, 0);
}
