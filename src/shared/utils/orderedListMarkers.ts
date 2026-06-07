import { INDENTATION } from '../../core/constants';
import {
    OrderedListMarkerStyle,
    normalizeOrderedListMarkerOrder
} from '../types/orderedListTypes';
import {
    PandocExtendedMarkdownSettings,
    isSyntaxFeatureEnabled
} from '../types/settingsTypes';
import { intToRoman, letterToNumber, romanToInt } from './listHelpers';

export type OrderedListMarkerDelimiter = '.' | ')';
export type OrderedListMoveDirection = 'indent' | 'outdent';

export interface ParsedOrderedListMarker {
    indent: string;
    indentColumns: number;
    style: OrderedListMarkerStyle;
    ordinal: number;
    delimiter: OrderedListMarkerDelimiter;
    spaces: string;
    content: string;
}

export interface OrderedListStyleContext {
    lines: string[];
    currentLineIndex: number;
    currentIndentColumns: number;
    targetIndentColumns: number;
    currentStyle: OrderedListMarkerStyle;
    direction: OrderedListMoveDirection;
    settings: Partial<PandocExtendedMarkdownSettings>;
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

export function resolveOrderedListMarkerStyle(context: OrderedListStyleContext): OrderedListMarkerStyle {
    if (!isSyntaxFeatureEnabled(context.settings, 'enableOrderedListMarkerCycling')) {
        return context.currentStyle;
    }

    const order = getAvailableOrderedMarkerStyles(context.settings);
    if (order.length === 0) {
        return context.currentStyle;
    }

    const siblingStyle = findTargetIndentStyle(context);
    if (siblingStyle) {
        return siblingStyle;
    }

    const parentStyle = findNearestParentStyle(context);
    if (parentStyle) {
        return stepStyle(parentStyle, 1, order);
    }

    return stepStyle(context.currentStyle, context.direction === 'indent' ? 1 : -1, order);
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

    return token.length > 1 ? ROMAN_NUMERAL.test(token) : /^[Ii]$/.test(token);
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

    for (let index = lineIndex - 1; index >= 0; index--) {
        const parsed = parseOrderedListMarker(lines[index], lines, index);
        if (!parsed) {
            if (lines[index].trim()) {
                break;
            }
            continue;
        }

        if (parsed.indent === indent && parsed.delimiter === delimiter) {
            return parsed.style;
        }
    }

    return null;
}

function findTargetIndentStyle(context: OrderedListStyleContext): OrderedListMarkerStyle | null {
    const subtreeEnd = findSubtreeEnd(context.lines, context.currentLineIndex, context.currentIndentColumns);
    const before = scanForStyleAtIndent(context, context.currentLineIndex - 1, -1);
    return before ?? scanForStyleAtIndent(context, subtreeEnd + 1, 1);
}

function scanForStyleAtIndent(
    context: OrderedListStyleContext,
    startIndex: number,
    step: 1 | -1
): OrderedListMarkerStyle | null {
    const boundaryIndent = Math.min(context.currentIndentColumns, context.targetIndentColumns);

    for (let index = startIndex; index >= 0 && index < context.lines.length; index += step) {
        if (!context.lines[index].trim()) {
            continue;
        }

        const parsed = parseOrderedListMarker(context.lines[index], context.lines, index);
        const indentColumns = parsed?.indentColumns ?? getIndentColumns(context.lines[index].match(/^(\s*)/)?.[1] ?? '');

        if (indentColumns < boundaryIndent) {
            break;
        }

        if (parsed?.indentColumns === context.targetIndentColumns) {
            return isOrderedMarkerStyleAvailable(parsed.style, context.settings) ? parsed.style : null;
        }
    }

    return null;
}

function findNearestParentStyle(context: OrderedListStyleContext): OrderedListMarkerStyle | null {
    for (let index = context.currentLineIndex - 1; index >= 0; index--) {
        const parsed = parseOrderedListMarker(context.lines[index], context.lines, index);
        if (parsed && parsed.indentColumns < context.targetIndentColumns &&
            isOrderedMarkerStyleAvailable(parsed.style, context.settings)) {
            return parsed.style;
        }
    }

    return null;
}

function stepStyle(
    style: OrderedListMarkerStyle,
    delta: number,
    order: OrderedListMarkerStyle[]
): OrderedListMarkerStyle {
    const index = order.indexOf(style);
    const startIndex = index >= 0 ? index : 0;
    return order[(startIndex + delta + order.length) % order.length];
}

function findSubtreeEnd(lines: string[], startIndex: number, baseIndentColumns: number): number {
    let endIndex = startIndex;

    for (let index = startIndex + 1; index < lines.length; index++) {
        if (!lines[index].trim()) {
            endIndex = index;
            continue;
        }

        const indent = lines[index].match(/^(\s*)/)?.[1] ?? '';
        if (getIndentColumns(indent) <= baseIndentColumns) {
            break;
        }

        endIndex = index;
    }

    return endIndex;
}
