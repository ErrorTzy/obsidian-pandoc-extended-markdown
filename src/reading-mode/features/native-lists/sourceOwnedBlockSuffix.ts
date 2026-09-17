import {
    InterruptedListParagraph
} from '../../../shared/utils/listBlockValidator';
import { getBlockQuoteDepth } from '../../../shared/utils/pandocBlockBoundaries';
import {
    PandocListMarkerKind,
    parsePandocListMarker
} from '../../../shared/utils/pandocListMarkers';

import {
    findNativeListItem,
    NativeListGroupMatch,
    NativeListSourceLine
} from './sourceDomMatcher';
import { getDirectListItems } from './nativeListDom';
import {
    findSourceItemSubtreeEnd,
    getComparableNativeListText,
    normalizeNativeListText,
    parseNativeListLine,
    stripBlockQuotePrefix
} from './sourceLine';

interface SourceOwnedSuffixBase {
    index: number;
    source: string;
    subtreeEndIndex: number;
}

export interface SourceOwnedListSuffixCandidate extends SourceOwnedSuffixBase {
    kind: 'list';
    sourceLine: NativeListSourceLine;
}

interface SourceOwnedBlockQuoteSuffixCandidate extends SourceOwnedSuffixBase {
    kind: 'blockquote';
}

export type SourceOwnedSuffixCandidate = SourceOwnedListSuffixCandidate |
    SourceOwnedBlockQuoteSuffixCandidate;

export type SourceOwnedSuffixMatch = SourceOwnedSuffixCandidate & {
    expectedLeadText: string;
};

export interface SourceOwnedBlockSuffix {
    blocks: HTMLElement[];
    ownerItem: HTMLLIElement;
    mergeRemainingItems: boolean;
}

interface SourceListGroup {
    kind: Extract<PandocListMarkerKind, 'bullet' | 'ordered'>;
    orderedGroup?: string;
}

export function getSourceOwnedSuffixCandidate(
    sourceLines: string[],
    invalidLines: Set<number>,
    paragraph: InterruptedListParagraph,
    rootLines: NativeListSourceLine[]
): SourceOwnedSuffixCandidate | null {
    const finalInterruptedLine = rootLines[rootLines.length - 1];
    if (!finalInterruptedLine) {
        return null;
    }
    const subtreeEndIndex = findSourceItemSubtreeEnd(
        finalInterruptedLine.index,
        rootLines[0].indentColumns,
        sourceLines
    );
    let index = paragraph.endIndex + 1;
    while (index <= subtreeEndIndex && !sourceLines[index].trim()) {
        index++;
    }
    if (index > subtreeEndIndex || invalidLines.has(index)) {
        return null;
    }

    const parsed = parseNativeListLine(sourceLines[index]);
    if (parsed) {
        return {
            kind: 'list',
            index,
            source: sourceLines[index],
            subtreeEndIndex,
            sourceLine: { ...parsed, index, source: sourceLines[index] }
        };
    }

    return getBlockQuoteDepth(sourceLines[index]) >
        getBlockQuoteDepth(finalInterruptedLine.source)
        ? {
            kind: 'blockquote',
            index,
            source: sourceLines[index],
            subtreeEndIndex
        }
        : null;
}

export function createSourceOwnedSuffixMatch(
    candidate: SourceOwnedSuffixCandidate | null
): SourceOwnedSuffixMatch | null {
    if (!candidate) {
        return null;
    }
    return {
        ...candidate,
        expectedLeadText: normalizeNativeListText(
            getComparableNativeListText(candidate.kind === 'list'
                ? candidate.sourceLine.itemText
                : stripBlockQuotePrefix(candidate.source))
        )
    };
}

export function matchSourceOwnedBlockSuffix(
    match: NativeListGroupMatch,
    suffix: SourceOwnedSuffixMatch | null,
    sourceLines: string[],
    root: HTMLElement,
    rootIndentColumns: number
): SourceOwnedBlockSuffix | undefined {
    if (!suffix) {
        return undefined;
    }
    const finalSegment = match.segments[match.segments.length - 1];
    const ownerItem = finalSegment
        ? getDirectListItems(finalSegment.list)[finalSegment.itemCount - 1]
        : null;
    if (!ownerItem) {
        return undefined;
    }

    const anchor = suffix.kind === 'list'
        ? findOwnedListSuffixAnchor(ownerItem, suffix, root, sourceLines)
        : findOwnedBlockQuoteSuffixAnchor(ownerItem, suffix.expectedLeadText);
    if (!anchor) {
        return undefined;
    }

    const firstBlock = getDirectOwnedBlock(ownerItem, anchor);
    const blocks = firstBlock ? getPromotableSuffixBlocks(ownerItem, firstBlock) : null;
    if (!blocks?.length) {
        return undefined;
    }

    return {
        blocks,
        ownerItem,
        mergeRemainingItems: canMergeRemainingItems(
            match,
            suffix,
            blocks,
            sourceLines,
            rootIndentColumns
        )
    };
}

function findOwnedListSuffixAnchor(
    ownerItem: HTMLLIElement,
    suffix: SourceOwnedListSuffixCandidate & { expectedLeadText: string },
    root: HTMLElement,
    sourceLines: string[]
): HTMLElement | null {
    const suffixMatch = findNativeListItem(root, {
        sourceLine: suffix.sourceLine,
        expectedLeadText: suffix.expectedLeadText
    }, sourceLines);
    if (!suffixMatch || suffixMatch.item === ownerItem ||
        !ownerItem.contains(suffixMatch.list) ||
        getDirectListItems(suffixMatch.list)[0] !== suffixMatch.item) {
        return null;
    }
    return suffixMatch.list;
}

function findOwnedBlockQuoteSuffixAnchor(
    ownerItem: HTMLLIElement,
    expectedLeadText: string
): HTMLElement | null {
    for (const quote of Array.from(ownerItem.querySelectorAll<HTMLElement>('blockquote'))) {
        const paragraph = Array.from(quote.children).find(child => child.matches('p'));
        if (paragraph && normalizeNativeListText(paragraph.textContent ?? '') === expectedLeadText) {
            return quote;
        }
    }
    return null;
}

function getDirectOwnedBlock(
    ownerItem: HTMLLIElement,
    descendant: HTMLElement
): HTMLElement | null {
    let current = descendant;
    while (current.parentElement && current.parentElement !== ownerItem) {
        current = current.parentElement;
    }
    return current.parentElement === ownerItem ? current : null;
}

function getPromotableSuffixBlocks(
    ownerItem: HTMLLIElement,
    firstBlock: HTMLElement
): HTMLElement[] | null {
    const nodes = Array.from(ownerItem.childNodes);
    const startIndex = nodes.indexOf(firstBlock);
    if (startIndex < 0) {
        return null;
    }

    const blocks: HTMLElement[] = [];
    for (const node of nodes.slice(startIndex)) {
        if (node.nodeType === Node.TEXT_NODE) {
            if (node.textContent?.trim()) {
                return null;
            }
            continue;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) {
            continue;
        }
        const element = node as HTMLElement;
        if (element.matches('a.footnote-back, a.footnote-backref')) {
            continue;
        }
        if (!element.matches('ul, ol, blockquote, pre, p, table, dl, hr, div')) {
            return null;
        }
        blocks.push(element);
    }
    return blocks;
}

function canMergeRemainingItems(
    match: NativeListGroupMatch,
    suffix: SourceOwnedSuffixMatch,
    blocks: HTMLElement[],
    sourceLines: string[],
    rootIndentColumns: number
): boolean {
    const finalSegment = match.segments[match.segments.length - 1];
    if (!finalSegment || finalSegment.itemCount >= getDirectListItems(finalSegment.list).length ||
        !getTrailingPromotedList(blocks)) {
        return false;
    }

    const suffixGroup = getFinalSuffixListGroup(suffix, sourceLines);
    const ownerLine = match.lines[match.lines.length - 1]?.sourceLine;
    const remainingGroup = ownerLine
        ? getFollowingRootListGroup(
            suffix.subtreeEndIndex,
            rootIndentColumns,
            getBlockQuoteDepth(ownerLine.source),
            sourceLines
        )
        : null;
    return areCompatibleListGroups(suffixGroup, remainingGroup);
}

function getTrailingPromotedList(blocks: HTMLElement[]): HTMLElement | null {
    const block = blocks[blocks.length - 1];
    if (!block) {
        return null;
    }
    if (block.matches('ul, ol')) {
        return block;
    }
    if (!block.matches('.el-ul, .el-ol')) {
        return null;
    }
    return Array.from(block.children).find(
        (child): child is HTMLElement => child.matches('ul, ol')
    ) ?? null;
}

function getFinalSuffixListGroup(
    suffix: SourceOwnedSuffixMatch,
    sourceLines: string[]
): SourceListGroup | null {
    const quoteDepth = getBlockQuoteDepth(suffix.source);
    const markers = sourceLines
        .slice(suffix.index, suffix.subtreeEndIndex + 1)
        .map((line, offset) => ({
            index: suffix.index + offset,
            marker: getSourceListGroup(line),
            parsed: parsePandocListMarker(line, true)
        }))
        .filter(entry => entry.marker && entry.parsed &&
            getBlockQuoteDepth(sourceLines[entry.index]) === quoteDepth);
    if (markers.length === 0) {
        return null;
    }
    const topIndent = Math.min(...markers.map(entry => entry.parsed!.indentColumns));
    return markers.filter(entry => entry.parsed!.indentColumns === topIndent).pop()?.marker ?? null;
}

function getFollowingRootListGroup(
    subtreeEndIndex: number,
    rootIndentColumns: number,
    quoteDepth: number,
    sourceLines: string[]
): SourceListGroup | null {
    for (let index = subtreeEndIndex + 1; index < sourceLines.length; index++) {
        if (!sourceLines[index].trim()) {
            continue;
        }
        const parsed = parsePandocListMarker(sourceLines[index], true);
        if (!parsed || parsed.indentColumns !== rootIndentColumns ||
            getBlockQuoteDepth(sourceLines[index]) !== quoteDepth) {
            return null;
        }
        return getSourceListGroup(sourceLines[index]);
    }
    return null;
}

function getSourceListGroup(line: string): SourceListGroup | null {
    const marker = parsePandocListMarker(line, true);
    if (!marker || marker.kind === 'definition') {
        return null;
    }
    return {
        kind: marker.kind,
        orderedGroup: marker.orderedGroup
    };
}

function areCompatibleListGroups(
    left: SourceListGroup | null,
    right: SourceListGroup | null
): boolean {
    if (!left || !right || left.kind !== right.kind) {
        return false;
    }
    return left.kind === 'bullet' || left.orderedGroup === right.orderedGroup;
}
