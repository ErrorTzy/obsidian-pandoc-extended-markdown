import { getNativeListItemLeadText } from './sourceSignature';
import { getDirectListItems, getNativeListBlock } from './nativeListDom';
import {
    getNativeListSourceOccurrence,
    getNativeListSourceTextOccurrence,
    normalizeNativeListText,
    ParsedNativeListLine
} from './sourceLine';

export interface NativeListSourceLine extends ParsedNativeListLine {
    index: number;
    source: string;
}

export interface NativeListReplacementLine {
    sourceLine: NativeListSourceLine;
    expectedLeadText: string;
}

export interface NativeListSegmentMatch {
    list: HTMLElement;
    itemCount: number;
}

export interface NativeListGroupMatch {
    segments: NativeListSegmentMatch[];
    lines: NativeListReplacementLine[];
}

export interface NativeListItemMatch {
    item: HTMLLIElement;
    list: HTMLElement;
}

export interface NativeListDomAnchor {
    precedingBlock: HTMLElement;
    precedingParagraph: HTMLParagraphElement;
    replacementBlock: HTMLElement;
}

const scheduledLists = new WeakMap<HTMLElement, () => boolean>();

export function getRootNativeListElements(
    root: HTMLElement,
    contextElement: HTMLElement
): HTMLElement[] {
    const lists = Array.from(root.querySelectorAll<HTMLElement>('ul, ol'));
    if (contextElement.matches('ul, ol') && root.contains(contextElement)) {
        lists.unshift(contextElement);
    }

    return Array.from(new Set(lists)).filter(isRootContentList);
}

function isRootContentList(list: HTMLElement): boolean {
    const parentList = list.parentElement?.closest<HTMLElement>('ul, ol');
    if (!parentList) {
        return !isFootnoteIndexList(list);
    }
    return isFootnoteIndexList(parentList);
}

function isFootnoteIndexList(list: HTMLElement): boolean {
    return Boolean(list.closest('.footnotes') && !list.parentElement?.closest('li'));
}

export function findNativeListGroup(
    lists: HTMLElement[],
    sourceLines: NativeListReplacementLine[],
    documentLines: string[],
    paragraphText: string,
    root: HTMLElement,
    preferredList?: HTMLElement
): NativeListGroupMatch | null {
    if (sourceLines.length === 0) {
        return null;
    }

    if (preferredList) {
        return findPreferredListGroup(
            lists,
            preferredList,
            sourceLines,
            paragraphText,
            root
        );
    }

    const sourceOccurrence = getNativeListSourceOccurrence(
        documentLines,
        sourceLines[0].sourceLine
    );
    let domOccurrence = -1;
    for (let startIndex = 0; startIndex < lists.length; startIndex++) {
        let firstItemOccurrence: number | null = null;
        getDirectListItems(lists[startIndex]).forEach((item, itemIndex) => {
            if (matchesSourceItem(lists[startIndex], item, sourceLines[0])) {
                domOccurrence++;
                if (itemIndex === 0) {
                    firstItemOccurrence = domOccurrence;
                }
            }
        });
        if (firstItemOccurrence !== sourceOccurrence) {
            continue;
        }
        if (getPrecedingParagraphText(lists[startIndex], root) !== paragraphText) {
            return null;
        }

        const match = matchNativeListGroup(lists, startIndex, sourceLines);
        if (match) {
            return match;
        }
    }

    return null;
}

function findPreferredListGroup(
    lists: HTMLElement[],
    preferredList: HTMLElement,
    sourceLines: NativeListReplacementLine[],
    paragraphText: string,
    root: HTMLElement
): NativeListGroupMatch | null {
    const startIndex = lists.indexOf(preferredList);
    if (startIndex < 0 || isListScheduled(preferredList) ||
        getPrecedingParagraphText(preferredList, root) !== paragraphText) {
        return null;
    }
    return matchNativeListGroup(lists, startIndex, sourceLines);
}

export function findNativeListDomAnchor(
    list: HTMLElement,
    root: HTMLElement
): NativeListDomAnchor | null {
    let replacementBlock = getNativeListBlock(list);
    while (replacementBlock !== root) {
        const precedingBlock = replacementBlock.previousElementSibling;
        if (precedingBlock?.instanceOf(HTMLElement)) {
            const precedingParagraph = findFinalParagraph(precedingBlock);
            return precedingParagraph ? { precedingBlock, precedingParagraph, replacementBlock } : null;
        }

        const parent = replacementBlock.parentElement;
        if (!parent || parent === root || !isExclusiveQuoteContainer(
            parent,
            replacementBlock
        )) {
            return null;
        }
        replacementBlock = parent;
    }
    return null;
}

export function markNativeListGroupScheduled(
    match: NativeListGroupMatch,
    isCurrent: () => boolean
): void {
    match.segments.forEach(segment => scheduledLists.set(segment.list, isCurrent));
}

export function findNativeListItem(
    root: HTMLElement,
    sourceLine: NativeListReplacementLine,
    documentLines: string[]
): NativeListItemMatch | null {
    const sourceOccurrence = getNativeListSourceTextOccurrence(
        documentLines,
        sourceLine.sourceLine
    );
    let domOccurrence = -1;
    for (const item of Array.from(root.querySelectorAll<HTMLLIElement>('li'))) {
        const list = item.parentElement;
        if (!list?.matches('ul, ol') ||
            !matchesSourceItem(list, item, sourceLine)) {
            continue;
        }
        domOccurrence++;
        if (domOccurrence === sourceOccurrence) {
            return { item, list };
        }
    }
    return null;
}

export function hasMaterializedTailInsideMatchedItem(match: NativeListGroupMatch): boolean {
    const finalSegment = match.segments[match.segments.length - 1];
    const finalItem = finalSegment
        ? getDirectListItems(finalSegment.list)[finalSegment.itemCount - 1]
        : null;
    if (!finalItem) {
        return false;
    }

    if (finalItem.querySelector('ul, ol, pre, blockquote, table, dl, hr, div')) {
        return true;
    }

    const directParagraphs = Array.from(finalItem.children)
        .filter(child => child.tagName === 'P');
    if (directParagraphs.length > 1) {
        return true;
    }
    if (directParagraphs.length === 0) {
        return false;
    }

    return Array.from(finalItem.childNodes).some(node =>
        node !== directParagraphs[0] && hasVisibleNodeContent(node)
    );
}

function hasVisibleNodeContent(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
        return Boolean(node.textContent?.trim());
    }
    return node.nodeType === Node.ELEMENT_NODE &&
        !(node as Element).matches('input, p') &&
        Boolean(node.textContent?.trim());
}

function matchesSourceItem(
    list: HTMLElement,
    item: HTMLLIElement | undefined,
    sourceLine: NativeListReplacementLine
): boolean {
    if (!item || list.tagName.toLowerCase() !== sourceLine.sourceLine.kind) {
        return false;
    }
    return normalizeNativeListText(getNativeListItemLeadText(item)) ===
        sourceLine.expectedLeadText;
}

function matchNativeListGroup(
    lists: HTMLElement[],
    startIndex: number,
    sourceLines: NativeListReplacementLine[]
): NativeListGroupMatch | null {
    const segments: NativeListSegmentMatch[] = [];
    const lines: NativeListReplacementLine[] = [];
    let sourceIndex = 0;

    for (let listIndex = startIndex; listIndex < lists.length; listIndex++) {
        const list = lists[listIndex];
        if (isListScheduled(list)) {
            break;
        }

        const itemMatch = matchDirectItems(list, sourceLines, sourceIndex);
        if (itemMatch.length === 0) {
            break;
        }

        segments.push({ list, itemCount: itemMatch.length });
        lines.push(...itemMatch);
        sourceIndex += itemMatch.length;
        if (sourceIndex === sourceLines.length) {
            return { segments, lines };
        }

        if (itemMatch.length < getDirectListItems(list).length) {
            break;
        }
    }

    return null;
}

function matchDirectItems(
    list: HTMLElement,
    sourceLines: NativeListReplacementLine[],
    sourceStartIndex: number
): NativeListReplacementLine[] {
    const items = getDirectListItems(list);
    const matches: NativeListReplacementLine[] = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
        const sourceLine = sourceLines[sourceStartIndex + itemIndex];
        if (!sourceLine || sourceLine.sourceLine.kind !== list.tagName.toLowerCase()) {
            break;
        }
        if (!matchesSourceItem(list, items[itemIndex], sourceLine)) {
            break;
        }
        matches.push(sourceLine);
    }

    return matches;
}

function getPrecedingParagraphText(list: HTMLElement, root: HTMLElement): string | null {
    const anchor = findNativeListDomAnchor(list, root);
    if (!anchor) {
        return null;
    }

    return normalizeNativeListText(getParagraphTextWithoutFootnoteBacklinks(anchor.precedingParagraph));
}

function findFinalParagraph(block: HTMLElement): HTMLParagraphElement | null {
    if (block.instanceOf(HTMLParagraphElement)) {
        return block;
    }
    const paragraphs = block.querySelectorAll<HTMLParagraphElement>('p');
    return paragraphs.item(paragraphs.length - 1);
}

function getParagraphTextWithoutFootnoteBacklinks(paragraph: Element): string {
    if (!paragraph.querySelector('a.footnote-back, a.footnote-backref')) {
        return paragraph.textContent ?? '';
    }
    const clone = paragraph.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('a.footnote-back, a.footnote-backref')
        .forEach(backlink => backlink.remove());
    return clone.textContent ?? '';
}

function isExclusiveQuoteContainer(parent: HTMLElement, child: HTMLElement): boolean {
    if (!parent.matches('blockquote, .el-blockquote') ||
        parent.children.length !== 1 || parent.firstElementChild !== child) {
        return false;
    }
    return Array.from(parent.childNodes).every(node =>
        node === child || (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim())
    );
}

function isListScheduled(list: HTMLElement): boolean {
    const isCurrent = scheduledLists.get(list);
    if (!isCurrent) {
        return false;
    }
    if (isCurrent()) {
        return true;
    }
    scheduledLists.delete(list);
    return false;
}
