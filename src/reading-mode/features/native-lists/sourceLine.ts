import { getIndentColumns } from '../../../shared/utils/orderedListMarkers';
import { ListBlockValidator } from '../../../shared/utils/listBlockValidator';
import {
    FenceState,
    getBlockQuoteDepth,
    getFenceOpening,
    getIndentedBacktickCodeSpan,
    getMultilineBacktickCodeSpanEndIndex,
    getRawTexEnvironmentOpening,
    getStandaloneOpaqueBlockEndIndex,
    isFenceClosing,
    isFencedDivClosing,
    isFencedDivOpening,
    isLineBlock,
    isLineBlockContinuation,
    isYamlMetadataStart,
    stripBlockQuoteDepth
} from '../../../shared/utils/pandocBlockBoundaries';

export type NativeListKind = 'ul' | 'ol';

export interface ParsedNativeListLine {
    kind: NativeListKind;
    indentColumns: number;
    itemText: string;
    startNumber?: number;
}

export function parseNativeListLine(line: string): ParsedNativeListLine | null {
    const content = stripBlockQuotePrefix(line);
    const unorderedMatch = content.match(/^([ \t]*)([-+*])(?:[ \t]+|$)/);
    if (unorderedMatch) {
        return {
            kind: 'ul',
            indentColumns: getIndentColumns(unorderedMatch[1]),
            itemText: content.slice(unorderedMatch[0].length).trim()
        };
    }

    const orderedMatch = content.match(/^([ \t]*)(\d+)[.)](?:([ \t]+)|$)/);
    return orderedMatch
        ? {
            kind: 'ol',
            indentColumns: getIndentColumns(orderedMatch[1]),
            itemText: content.slice(orderedMatch[0].length).trim(),
            startNumber: Number(orderedMatch[2])
        }
        : null;
}

export function findSourceItemSubtreeEnd(
    startIndex: number,
    parentIndent: number,
    sourceLines: string[]
): number {
    let endIndex = startIndex;
    let sawBlankLine = false;
    const parentQuoteDepth = getBlockQuoteDepth(sourceLines[startIndex] ?? '');

    for (let index = startIndex + 1; index < sourceLines.length; index++) {
        const line = sourceLines[index];
        if (!line.trim()) {
            sawBlankLine = true;
            continue;
        }

        // Only remove the quote containers shared with the owning item. Removing
        // every `>` also removes the physical indentation of a nested block quote
        // (for example `  > quote`) and makes it look like a root sibling.
        const content = stripBlockQuoteDepth(line, parentQuoteDepth);
        const indent = content.match(/^([ \t]*)/)?.[1] ?? '';
        const indentColumns = getIndentColumns(indent);
        if (ListBlockValidator.isListItemForValidation(line) && indentColumns <= parentIndent) {
            break;
        }
        if (sawBlankLine && indentColumns <= parentIndent) {
            break;
        }

        endIndex = index;
        sawBlankLine = false;
    }

    return endIndex;
}

export function findInterruptedSourceSubtreeEnd(
    startIndex: number,
    parentIndent: number,
    paragraphEndIndex: number,
    includeMaterializedTail: boolean,
    sourceLines: string[]
): number {
    const subtreeEndIndex = findSourceItemSubtreeEnd(
        startIndex,
        parentIndent,
        sourceLines
    );
    if (subtreeEndIndex <= paragraphEndIndex || !includeMaterializedTail) {
        return paragraphEndIndex;
    }

    const firstOutsideLine = sourceLines[paragraphEndIndex + 1];
    if (firstOutsideLine === undefined ||
        !/^[ \t]*$/.test(stripBlockQuotePrefix(firstOutsideLine))) {
        return paragraphEndIndex;
    }

    return subtreeEndIndex;
}

export function getNativeListSourceOccurrence(
    lines: string[],
    target: ParsedNativeListLine & { index: number }
): number {
    return getNativeListSourceOccurrenceByComparison(lines, target, true);
}

export function getNativeListSourceTextOccurrence(
    lines: string[],
    target: ParsedNativeListLine & { index: number }
): number {
    return getNativeListSourceOccurrenceByComparison(lines, target, false);
}

export function getRenderableNativeListLineIndices(lines: string[]): Set<number> {
    return new Set(Array.from(getRenderableSourceLineIndices(lines)).filter(index =>
        parseNativeListLine(lines[index]) !== null));
}

/** Shared source visibility for source-to-DOM matching, excluding opaque blocks. */
export function getRenderableSourceLineIndices(lines: string[]): Set<number> {
    const indices = new Set<number>();
    let fence: FenceState | null = null;
    let inYaml = false;
    let fencedDivDepth = 0;
    let opaqueBlockEndIndex: number | null = null;
    let inLineBlock = false;
    let rawTexEnvironment: string | null = null;
    let inlineCodeSpanEndIndex: number | null = null;

    for (let index = 0; index < lines.length; index++) {
        if (inlineCodeSpanEndIndex !== null && index <= inlineCodeSpanEndIndex) {
            if (index === inlineCodeSpanEndIndex) {
                inlineCodeSpanEndIndex = null;
            }
            continue;
        }
        const content = stripBlockQuotePrefix(lines[index]);
        const state = updateOpaqueBlockState(lines, index, content, {
            fence,
            inYaml,
            fencedDivDepth,
            opaqueBlockEndIndex,
            inLineBlock,
            rawTexEnvironment
        });
        fence = state.fence;
        inYaml = state.inYaml;
        fencedDivDepth = state.fencedDivDepth;
        opaqueBlockEndIndex = state.opaqueBlockEndIndex;
        inLineBlock = state.inLineBlock;
        rawTexEnvironment = state.rawTexEnvironment;
        if (state.isOpaque) {
            continue;
        }

        indices.add(index);
        inlineCodeSpanEndIndex = getMultilineBacktickCodeSpanEndIndex(
            lines,
            index,
            content
        );
    }

    return indices;
}

function getNativeListSourceOccurrenceByComparison(
    lines: string[],
    target: ParsedNativeListLine & { index: number },
    matchIndent: boolean
): number {
    let occurrence = -1;
    let fence: FenceState | null = null;
    let inYaml = false;
    let fencedDivDepth = 0;
    let opaqueBlockEndIndex: number | null = null;
    let inLineBlock = false;
    let rawTexEnvironment: string | null = null;
    let inlineCodeSpanEndIndex: number | null = null;

    for (let index = 0; index <= target.index; index++) {
        if (inlineCodeSpanEndIndex !== null && index <= inlineCodeSpanEndIndex) {
            if (index === inlineCodeSpanEndIndex) {
                inlineCodeSpanEndIndex = null;
            }
            continue;
        }
        const content = stripBlockQuotePrefix(lines[index]);
        const state = updateOpaqueBlockState(
            lines,
            index,
            content,
            {
                fence,
                inYaml,
                fencedDivDepth,
                opaqueBlockEndIndex,
                inLineBlock,
                rawTexEnvironment
            }
        );
        fence = state.fence;
        inYaml = state.inYaml;
        fencedDivDepth = state.fencedDivDepth;
        opaqueBlockEndIndex = state.opaqueBlockEndIndex;
        inLineBlock = state.inLineBlock;
        rawTexEnvironment = state.rawTexEnvironment;
        if (state.isOpaque) {
            continue;
        }

        inlineCodeSpanEndIndex = getMultilineBacktickCodeSpanEndIndex(
            lines,
            index,
            content
        );

        const parsed = parseNativeListLine(lines[index]);
        if (isSameNativeListItem(parsed, target, matchIndent)) {
            occurrence++;
        }
    }

    return occurrence;
}

export function getComparableNativeListText(sourceItemText: string): string {
    const protectedCode: string[] = [];
    const protectedEscapes: string[] = [];
    const withProtectedEscapes = sourceItemText.replace(
        /\\([!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~])/g,
        (_match: string, literal: string) => {
            const token = `\uE100${protectedEscapes.length}\uE101`;
            protectedEscapes.push(literal);
            return token;
        }
    );
    const withProtectedCode = withProtectedEscapes.replace(
        /(`+)(?!`)([\s\S]*?)\1(?!`)/g,
        (_match: string, _ticks: string, code: string) => {
            const token = `\uE000${protectedCode.length}\uE001`;
            protectedCode.push(code.replace(/^ | $/g, '').replace(/\s+/g, ' '));
            return token;
        }
    );
    const comparable = stripMarkdownEmphasis(withProtectedCode)
        .replace(/^\[[ xX]\]\s*/, '')
        .replace(
            /!?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
            (_match: string, target: string, alias?: string) => alias ?? target
        )
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
        .replace(/<(https?:\/\/[^>]+|mailto:[^>]+)>/g, (_match, target: string) =>
            target.replace(/^mailto:/, ''))
        .replace(/<[^>]+>/g, '');

    const restoredCode = comparable.replace(
        /\uE000(\d+)\uE001/g,
        (_match: string, index: string) => protectedCode[Number(index)] ?? ''
    );
    const restored = restoredCode.replace(
        /\uE100(\d+)\uE101/g,
        (_match: string, index: string) => protectedEscapes[Number(index)] ?? ''
    );
    return decodeHtmlEntities(restored);
}

function stripMarkdownEmphasis(text: string): string {
    return text
        .replace(/(\*{3}|_{3})(?=\S)([\s\S]*?\S)\1/g, '$2')
        .replace(/(\*{2}|_{2}|~~)(?=\S)([\s\S]*?\S)\1/g, '$2')
        .replace(/\*(?=\S)([\s\S]*?\S)\*/g, '$1')
        .replace(/(^|[^A-Za-z0-9])_(?=\S)([\s\S]*?\S)_(?![A-Za-z0-9])/g, '$1$2');
}

export function normalizeNativeListText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

export function rewriteIndentedBacktickCodeSpans(lines: string[]): string[] {
    const rewritten: Array<string | null> = [...lines];
    for (let index = 0; index < lines.length; index++) {
        const span = getIndentedBacktickCodeSpan(lines, index);
        if (!span) {
            continue;
        }

        const content = stripBlockQuotePrefix(lines[index]);
        const containerPrefix = lines[index].slice(0, lines[index].length - content.length);
        rewritten[index] = `${containerPrefix}<code>${escapeHtml(span.text)}</code>`;
        for (let consumed = index + 1; consumed <= span.endIndex; consumed++) {
            rewritten[consumed] = null;
        }
        index = span.endIndex;
    }

    return rewritten.filter((line): line is string => line !== null);
}

export function escapeExcessBlockQuoteMarkers(
    line: string,
    retainedDepth: number
): string {
    let depth = 0;
    let offset = 0;
    let escaped = '';
    while (offset < line.length) {
        const prefix = line.slice(offset).match(/^ {0,3}>[ \t]?/)?.[0];
        if (!prefix) {
            break;
        }

        escaped += depth < retainedDepth
            ? prefix
            : prefix.replace('>', '\\>');
        offset += prefix.length;
        depth++;
    }
    return escaped + line.slice(offset);
}

export function stripBlockQuotePrefix(line: string): string {
    let content = line;
    while (/^ {0,3}>[ \t]?/.test(content)) {
        content = content.replace(/^ {0,3}>[ \t]?/, '');
    }
    return content;
}

interface OpaqueBlockState {
    fence: FenceState | null;
    inYaml: boolean;
    fencedDivDepth: number;
    opaqueBlockEndIndex: number | null;
    inLineBlock: boolean;
    rawTexEnvironment: string | null;
    isOpaque?: boolean;
}

function updateOpaqueBlockState(
    lines: string[],
    index: number,
    content: string,
    state: OpaqueBlockState
): OpaqueBlockState {
    if (state.opaqueBlockEndIndex !== null && index <= state.opaqueBlockEndIndex) {
        return {
            ...state,
            opaqueBlockEndIndex: index < state.opaqueBlockEndIndex
                ? state.opaqueBlockEndIndex
                : null,
            isOpaque: true
        };
    }
    if (state.inYaml) {
        return {
            ...state,
            inYaml: !/^(?:---|\.\.\.)[ \t]*$/.test(content),
            isOpaque: true
        };
    }
    if (state.rawTexEnvironment) {
        return {
            ...state,
            rawTexEnvironment: content.includes(`\\end{${state.rawTexEnvironment}}`)
                ? null
                : state.rawTexEnvironment,
            isOpaque: true
        };
    }
    if (state.inLineBlock &&
        (isLineBlock(content) || isLineBlockContinuation(content))) {
        return { ...state, isOpaque: true };
    }
    if (state.fence) {
        return {
            ...state,
            fence: isFenceClosing(content, state.fence) ? null : state.fence,
            isOpaque: true
        };
    }

    const baseState = state.inLineBlock
        ? { ...state, inLineBlock: false }
        : state;
    if (isYamlMetadataStart(lines, index, content)) {
        return { ...baseState, inYaml: true, isOpaque: true };
    }

    const openingFence = getFenceOpening(lines, index, content);
    if (openingFence) {
        return { ...baseState, fence: openingFence, isOpaque: true };
    }
    if (isFencedDivClosing(content) && baseState.fencedDivDepth > 0) {
        return {
            ...baseState,
            fencedDivDepth: baseState.fencedDivDepth - 1,
            isOpaque: true
        };
    }
    if (isFencedDivOpening(content)) {
        return {
            ...baseState,
            fencedDivDepth: baseState.fencedDivDepth + 1,
            isOpaque: true
        };
    }

    const opaqueBlockEndIndex = getStandaloneOpaqueBlockEndIndex(lines, index, content);
    if (opaqueBlockEndIndex !== null) {
        return {
            ...baseState,
            opaqueBlockEndIndex: opaqueBlockEndIndex > index ? opaqueBlockEndIndex : null,
            isOpaque: true
        };
    }

    const rawTexEnvironment = getRawTexEnvironmentOpening(lines, index, content);
    if (rawTexEnvironment) {
        return {
            ...baseState,
            rawTexEnvironment: content.includes(`\\end{${rawTexEnvironment}}`)
                ? null
                : rawTexEnvironment,
            isOpaque: true
        };
    }
    if (isLineBlock(content)) {
        return { ...baseState, inLineBlock: true, isOpaque: true };
    }

    return { ...baseState, isOpaque: false };
}

function isSameNativeListItem(
    parsed: ParsedNativeListLine | null,
    target: ParsedNativeListLine,
    matchIndent: boolean = true
): boolean {
    return Boolean(parsed &&
        parsed.kind === target.kind &&
        (!matchIndent || parsed.indentColumns === target.indentColumns) &&
        normalizeNativeListText(getComparableNativeListText(parsed.itemText)) ===
            normalizeNativeListText(getComparableNativeListText(target.itemText)));
}

function decodeHtmlEntities(text: string): string {
    if (typeof DOMParser === 'undefined') {
        return text;
    }

    const parsed = new DOMParser().parseFromString(text, 'text/html');
    return parsed.documentElement.textContent ?? text;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
