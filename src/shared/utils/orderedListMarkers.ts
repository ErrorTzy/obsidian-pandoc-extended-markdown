import { INDENTATION } from '../../core/constants';
import {
    OrderedListMarkerStyle,
    normalizeOrderedListMarkerOrder
} from '../types/orderedListTypes';
import {
    PandocExtendedMarkdownSettings,
    isSyntaxFeatureEnabled
} from '../types/settingsTypes';
import { parseStandardListItem } from './listContext';
import { intToRoman, letterToNumber, romanToInt } from './listHelpers';

export type OrderedListMarkerDelimiter = '.' | ')';
export type OrderedListOwnership = 'native' | 'extended' | 'bridge';

export interface ParsedOrderedListMarker {
    indent: string;
    indentColumns: number;
    style: OrderedListMarkerStyle;
    ordinal: number;
    delimiter: OrderedListMarkerDelimiter;
    spaces: string;
    content: string;
}

export interface ResolvedOrderedListItem extends ParsedOrderedListMarker {
    lineIndex: number;
    markerText: string;
    styleId: OrderedListMarkerStyle;
    ownership: OrderedListOwnership;
    parentLineIndex?: number;
}

interface ListAncestor {
    indentColumns: number;
    lineIndex: number;
    ownership: OrderedListOwnership;
}

const ORDERED_LINE = /^(\s*)(\d+|[A-Za-z]+)([.)])(\s*)(.*)$/;
const DECIMAL_STYLES = new Set<OrderedListMarkerStyle>([
    'decimal-period',
    'decimal-one-paren'
]);
const ROMAN_NUMERAL = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i;
const ROMAN_CHARS = /^[ivxlcdm]+$/i;

export function getIndentColumns(indent: string): number {
    return Array.from(indent).reduce((columns, character) => {
        return columns + (character === INDENTATION.TAB ? INDENTATION.TAB_SIZE : 1);
    }, 0);
}

export function parseOrderedListMarker(
    line: string,
    lines?: string[],
    lineIndex?: number
): ParsedOrderedListMarker | null {
    const match = line.match(ORDERED_LINE);
    if (!match) {
        return null;
    }

    const [, indent, token, delimiter, spaces, content] = match;
    if (spaces.length === 0 && content.length > 0) {
        return null;
    }

    const style = getStyleForToken(token, delimiter as OrderedListMarkerDelimiter, indent, lines, lineIndex);
    const ordinal = getOrdinalForToken(token, style);

    if (ordinal < 1) {
        return null;
    }

    return {
        indent,
        indentColumns: getIndentColumns(indent),
        style,
        ordinal,
        delimiter: delimiter as OrderedListMarkerDelimiter,
        spaces,
        content
    };
}

export function formatOrderedListMarker(style: OrderedListMarkerStyle, ordinal: number): string {
    const delimiter = style.endsWith('one-paren') ? ')' : '.';

    if (style.startsWith('decimal')) {
        return `${ordinal}${delimiter}`;
    }

    if (style.includes('roman')) {
        return `${intToRoman(ordinal, style.startsWith('upper'))}${delimiter}`;
    }

    return `${numberToAlpha(ordinal, style.startsWith('upper'))}${delimiter}`;
}

export function getAvailableOrderedMarkerStyles(
    settings: Partial<PandocExtendedMarkdownSettings>
): OrderedListMarkerStyle[] {
    return normalizeOrderedListMarkerOrder(settings.orderedListMarkerOrder)
        .filter(style => DECIMAL_STYLES.has(style) ||
            isSyntaxFeatureEnabled(settings, 'enableFancyLists'));
}

export function isOrderedMarkerStyleAvailable(
    style: OrderedListMarkerStyle,
    settings: Partial<PandocExtendedMarkdownSettings>
): boolean {
    return DECIMAL_STYLES.has(style) || isSyntaxFeatureEnabled(settings, 'enableFancyLists');
}

export function resolveOrderedListItem(
    lines: string[],
    lineIndex: number,
    settings: Partial<PandocExtendedMarkdownSettings> = {}
): ResolvedOrderedListItem | null {
    return resolveOrderedListItems(lines, settings).find(item => item.lineIndex === lineIndex) ?? null;
}

export function resolveOrderedListLine(
    line: string,
    lines?: string[],
    lineIndex?: number,
    settings: Partial<PandocExtendedMarkdownSettings> = {}
): ResolvedOrderedListItem | null {
    if (lines && lineIndex !== undefined) {
        return resolveOrderedListItem(lines, lineIndex, settings);
    }

    const parsed = parseOrderedListMarker(line);
    return parsed ? createResolvedItem(parsed, 0, undefined, settings) : null;
}

export function resolveOrderedListItems(
    lines: string[],
    settings: Partial<PandocExtendedMarkdownSettings> = {}
): ResolvedOrderedListItem[] {
    const items: ResolvedOrderedListItem[] = [];
    const stack: ListAncestor[] = [];

    lines.forEach((line, lineIndex) => {
        if (!line.trim()) {
            stack.length = 0;
            return;
        }

        const parsed = parseOrderedListMarker(line, lines, lineIndex);
        const standardItem = parseStandardListItem(line);
        const indentColumns = standardItem?.indentColumns ??
            parsed?.indentColumns ??
            getIndentColumns(line.match(/^(\s*)/)?.[1] ?? '');

        while (stack.length > 0 && stack[stack.length - 1].indentColumns >= indentColumns) {
            stack.pop();
        }

        if (!standardItem) {
            if (indentColumns === 0) {
                stack.length = 0;
            }
            return;
        }

        const parent = stack[stack.length - 1];
        if (!parsed) {
            stack.push({
                indentColumns,
                lineIndex,
                ownership: resolveUnorderedOwnership(settings)
            });
            return;
        }

        const item = createResolvedItem(parsed, lineIndex, parent, settings);
        items.push(item);
        stack.push(item);
    });

    return items;
}

export function isPluginOwnedOrderedListItem(item: ResolvedOrderedListItem): boolean {
    return item.ownership === 'extended' || item.ownership === 'bridge';
}

function createResolvedItem(
    parsed: ParsedOrderedListMarker,
    lineIndex: number,
    parent: ListAncestor | undefined,
    settings: Partial<PandocExtendedMarkdownSettings>
): ResolvedOrderedListItem {
    const ownership = resolveOwnership(parsed.style, parent, settings);

    return {
        ...parsed,
        lineIndex,
        markerText: formatOrderedListMarker(parsed.style, parsed.ordinal),
        styleId: parsed.style,
        ownership,
        parentLineIndex: parent?.lineIndex
    };
}

function resolveOwnership(
    style: OrderedListMarkerStyle,
    parent: ListAncestor | undefined,
    settings: Partial<PandocExtendedMarkdownSettings>
): OrderedListOwnership {
    if (style === 'decimal-period') {
        return parent && parent.ownership !== 'native' ? 'bridge' : 'native';
    }

    if (isOrderedMarkerStyleAvailable(style, settings)) {
        return 'extended';
    }

    return 'native';
}

function resolveUnorderedOwnership(
    settings: Partial<PandocExtendedMarkdownSettings>
): OrderedListOwnership {
    return isSyntaxFeatureEnabled(settings, 'enableUnorderedListMarkerStyles') ||
        isSyntaxFeatureEnabled(settings, 'enableUnorderedListMarkerCycling')
        ? 'extended'
        : 'native';
}

function getStyleForToken(
    token: string,
    delimiter: OrderedListMarkerDelimiter,
    indent: string,
    lines?: string[],
    lineIndex?: number
): OrderedListMarkerStyle {
    if (/^\d+$/.test(token)) {
        return delimiter === ')' ? 'decimal-one-paren' : 'decimal-period';
    }

    const isUpper = token[0] === token[0].toUpperCase();
    const isRoman = isRomanToken(token, indent, delimiter, lines, lineIndex);
    const family = isRoman ? 'roman' : 'alpha';
    const prefix = isUpper ? 'upper' : 'lower';
    const suffix = delimiter === ')' ? 'one-paren' : 'period';

    return `${prefix}-${family}-${suffix}` as OrderedListMarkerStyle;
}

function getOrdinalForToken(token: string, style: OrderedListMarkerStyle): number {
    if (style.startsWith('decimal')) {
        return Number.parseInt(token, 10);
    }

    if (style.includes('roman')) {
        return romanToInt(token);
    }

    return token.split('').reduce((value, character) => {
        return value * 26 + letterToNumber(character);
    }, 0);
}

function numberToAlpha(ordinal: number, isUpperCase: boolean): string {
    let value = ordinal;
    let result = '';

    while (value > 0) {
        value -= 1;
        result = String.fromCharCode('A'.charCodeAt(0) + (value % 26)) + result;
        value = Math.floor(value / 26);
    }

    return isUpperCase ? result : result.toLowerCase();
}

function isRomanToken(
    token: string,
    indent: string,
    delimiter: OrderedListMarkerDelimiter,
    lines?: string[],
    lineIndex?: number
): boolean {
    const previousStyle = findPreviousOrderedStyleAtIndent(indent, delimiter, lines, lineIndex);
    if (previousStyle) {
        return previousStyle.includes('roman');
    }

    if (!ROMAN_CHARS.test(token)) {
        return false;
    }

    if (token.length > 1) {
        return ROMAN_NUMERAL.test(token);
    }

    if (/^[Ii]$/.test(token)) {
        return true;
    }

    return hasFollowingRomanEvidenceAtIndent(indent, delimiter, lines, lineIndex);
}

function findPreviousOrderedStyleAtIndent(
    indent: string,
    delimiter: OrderedListMarkerDelimiter,
    lines?: string[],
    lineIndex?: number
): OrderedListMarkerStyle | null {
    if (!lines || lineIndex === undefined) {
        return null;
    }

    const targetIndentColumns = getIndentColumns(indent);

    for (let index = lineIndex - 1; index >= 0; index--) {
        const parsed = parseOrderedListMarker(lines[index], lines, index);
        if (!parsed) {
            break;
        }

        if (parsed.indentColumns < targetIndentColumns) {
            break;
        }

        if (parsed.indent === indent && parsed.delimiter === delimiter) {
            return parsed.style;
        }
    }

    return null;
}

function hasFollowingRomanEvidenceAtIndent(
    indent: string,
    delimiter: OrderedListMarkerDelimiter,
    lines?: string[],
    lineIndex?: number
): boolean {
    if (!lines || lineIndex === undefined) {
        return false;
    }

    const targetIndentColumns = getIndentColumns(indent);

    for (let index = lineIndex + 1; index < lines.length; index++) {
        if (!lines[index].trim()) {
            break;
        }

        const match = lines[index].match(ORDERED_LINE);
        const lineIndent = match?.[1] ?? lines[index].match(/^(\s*)/)?.[1] ?? '';
        const indentColumns = getIndentColumns(lineIndent);

        if (indentColumns < targetIndentColumns) {
            break;
        }

        if (!match || indentColumns !== targetIndentColumns || match[3] !== delimiter) {
            continue;
        }

        const token = match[2];
        if (!ROMAN_CHARS.test(token)) {
            return false;
        }

        return token.length > 1 && ROMAN_NUMERAL.test(token);
    }

    return false;
}
