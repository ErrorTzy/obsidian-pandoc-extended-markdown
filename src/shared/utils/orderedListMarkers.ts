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
export type OrderedListMoveDirection = 'indent' | 'outdent';
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

export interface OrderedListStyleContext {
    lines: string[];
    currentLineIndex: number;
    currentIndentColumns: number;
    targetIndentColumns: number;
    currentStyle: OrderedListMarkerStyle;
    direction: OrderedListMoveDirection;
    settings: Partial<PandocExtendedMarkdownSettings>;
}

export type OrderedListMoveContext = OrderedListStyleContext;

export interface ResolvedOrderedMarker {
    style: OrderedListMarkerStyle;
    ordinal: number;
    marker: string;
}

export interface OrderedListContinuationContext {
    line: string;
    lines?: string[];
    lineIndex?: number;
    settings: Partial<PandocExtendedMarkdownSettings>;
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

export function resolveOrderedListMarkerStyle(context: OrderedListStyleContext): OrderedListMarkerStyle {
    return resolveOrderedMarkerStyleForMove(context);
}

export function resolveOrderedMarkerForMove(context: OrderedListMoveContext): string {
    return resolveOrderedMarkerForTarget(context).marker;
}

export function resolveOrderedMarkerForTarget(context: OrderedListMoveContext): ResolvedOrderedMarker {
    const style = resolveOrderedMarkerStyleForMove(context);
    const ordinal = resolveOrderedMarkerOrdinalForMove(context);

    return {
        style,
        ordinal,
        marker: formatOrderedListMarker(style, ordinal)
    };
}

export function resolveOrderedMarkerForContinuation(
    context: OrderedListContinuationContext
): string | null {
    const parsed = context.lines && context.lineIndex !== undefined
        ? resolveOrderedListItem(context.lines, context.lineIndex, context.settings)
        : resolveOrderedListLine(context.line, context.lines, context.lineIndex, context.settings);

    if (!parsed || !isOrderedMarkerStyleAvailable(parsed.style, context.settings)) {
        return null;
    }

    return formatOrderedListMarker(parsed.style, parsed.ordinal + 1);
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

function resolveOrderedMarkerStyleForMove(context: OrderedListStyleContext): OrderedListMarkerStyle {
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

function findTargetIndentStyle(context: OrderedListStyleContext): OrderedListMarkerStyle | null {
    const subtreeEnd = findSubtreeEnd(context.lines, context.currentLineIndex, context.currentIndentColumns);
    const { groupStart, groupEnd } = getTargetSiblingBounds(context);
    const before = scanForStyleAtIndent(context, context.currentLineIndex - 1, -1, groupStart, groupEnd, subtreeEnd);
    return before ?? scanForStyleAtIndent(context, subtreeEnd + 1, 1, groupStart, groupEnd, subtreeEnd);
}

function resolveOrderedMarkerOrdinalForMove(context: OrderedListMoveContext): number {
    const previousSibling = findPreviousTargetSibling(context);
    return previousSibling ? previousSibling.ordinal + 1 : 1;
}

function findPreviousTargetSibling(context: OrderedListMoveContext): ParsedOrderedListMarker | null {
    const { groupStart } = getTargetSiblingBounds(context);

    for (let index = context.currentLineIndex - 1; index >= groupStart; index--) {
        if (!context.lines[index].trim()) {
            break;
        }

        const parsed = parseOrderedListMarker(context.lines[index], context.lines, index);
        if (parsed?.indentColumns === context.targetIndentColumns) {
            return parsed;
        }
    }

    return null;
}

function getTargetSiblingBounds(context: OrderedListStyleContext): { groupStart: number; groupEnd: number } {
    const parentIndex = findTargetParentIndex(context);
    if (parentIndex < 0) {
        return {
            groupStart: 0,
            groupEnd: findTopLevelGroupEnd(context.lines, context.currentLineIndex)
        };
    }

    return {
        groupStart: parentIndex + 1,
        groupEnd: findSubtreeEnd(
            context.lines,
            parentIndex,
            getIndentColumns(context.lines[parentIndex].match(/^(\s*)/)?.[1] ?? '')
        )
    };
}

function scanForStyleAtIndent(
    context: OrderedListStyleContext,
    startIndex: number,
    step: 1 | -1,
    groupStart: number,
    groupEnd: number,
    subtreeEnd: number
): OrderedListMarkerStyle | null {
    for (let index = startIndex; index >= groupStart && index <= groupEnd; index += step) {
        if (index >= context.currentLineIndex && index <= subtreeEnd) {
            continue;
        }

        if (!context.lines[index].trim()) {
            break;
        }

        const parsed = parseOrderedListMarker(context.lines[index], context.lines, index);
        if (parsed?.indentColumns === context.targetIndentColumns) {
            return isOrderedMarkerStyleAvailable(parsed.style, context.settings) ? parsed.style : null;
        }
    }

    return null;
}

function findNearestParentStyle(context: OrderedListStyleContext): OrderedListMarkerStyle | null {
    const parentIndex = findTargetParentIndex(context);
    const parent = parentIndex >= 0
        ? parseOrderedListMarker(context.lines[parentIndex], context.lines, parentIndex)
        : null;

    return parent && isOrderedMarkerStyleAvailable(parent.style, context.settings)
        ? parent.style
        : null;
}

function findTargetParentIndex(context: OrderedListStyleContext): number {
    if (context.targetIndentColumns <= 0) {
        return -1;
    }

    for (let index = context.currentLineIndex - 1; index >= 0; index--) {
        if (!context.lines[index].trim()) {
            break;
        }

        const listItem = parseStandardListItem(context.lines[index]);
        const indentColumns = listItem?.indentColumns ?? getIndentColumns(context.lines[index].match(/^(\s*)/)?.[1] ?? '');

        if (listItem && indentColumns < context.targetIndentColumns) {
            return index;
        }
    }

    return -1;
}

function findTopLevelGroupEnd(lines: string[], currentLineIndex: number): number {
    for (let index = currentLineIndex + 1; index < lines.length; index++) {
        if (!lines[index].trim()) {
            return index - 1;
        }
    }

    return lines.length - 1;
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
