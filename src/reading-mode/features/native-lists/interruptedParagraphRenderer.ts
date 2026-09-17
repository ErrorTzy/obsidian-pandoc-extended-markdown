import { MarkdownRenderChild, MarkdownRenderer } from 'obsidian';

import { CSS_CLASSES } from '../../../core/constants';
import {
    getBlockQuoteDepth,
    stripBlockQuoteDepth
} from '../../../shared/utils/pandocBlockBoundaries';

import { ReadingModeContext } from '../../pipeline/types';
import { renderMarkdownFragment } from '../../utils/fragmentRenderer';
import { findNativeListDomAnchor } from './sourceDomMatcher';
import {
    getDirectListItems,
    getNativeListBlock,
    getOrderedListItemNumber
} from './nativeListDom';
import { SourceOwnedBlockSuffix } from './sourceOwnedBlockSuffix';

interface InterruptedParagraphReplacement {
    listSegments: Array<{
        list: HTMLElement;
        itemCount: number;
    }>;
    sourceLines: string[];
    listStartOffset: number;
    transformedParagraphSource: string;
    remainingListStart?: number;
    sourceOwnedBlockSuffix?: SourceOwnedBlockSuffix;
    root: HTMLElement;
    context: ReadingModeContext;
    isCurrent: () => boolean;
}

export function replaceInterruptedListParagraph(
    replacement: InterruptedParagraphReplacement
): boolean {
    if (!replacement.isCurrent()) {
        return false;
    }
    const firstList = replacement.listSegments[0]?.list;
    if (!firstList) {
        return false;
    }
    replacement = guardMatchedItemIdentities(replacement);

    const canRenderMarkdown = replacement.context.app &&
        typeof MarkdownRenderer?.render === 'function';

    if (!canRenderMarkdown) {
        return replaceWithSourceText(replacement);
    }

    if (!findNativeListDomAnchor(firstList, replacement.root)) {
        return false;
    }

    void renderAndReplace(replacement).catch(() => {
        if (replacement.isCurrent() && replacement.root.contains(firstList)) {
            replaceWithSourceText(replacement);
        }
    });
    return true;
}

function guardMatchedItemIdentities(
    replacement: InterruptedParagraphReplacement
): InterruptedParagraphReplacement {
    const matchedItems = replacement.listSegments.map(segment => ({
        ...segment,
        items: getDirectListItems(segment.list).slice(0, segment.itemCount)
    }));
    const suffix = replacement.sourceOwnedBlockSuffix;
    const suffixBlocks = suffix ? [...suffix.blocks] : [];
    const suffixLists = suffixBlocks.flatMap(getOwnedLists).map(list => ({
        list,
        items: getDirectListItems(list)
    }));
    return {
        ...replacement,
        isCurrent: () => replacement.isCurrent() && matchedItems.every(segment => {
            const currentItems = getDirectListItems(segment.list);
            return replacement.root.contains(segment.list) && segment.items.length === segment.itemCount &&
                segment.items.every((item, index) => currentItems[index] === item);
        }) && (!suffix || Boolean(
            suffixBlocks.length > 0 &&
            suffixBlocks.every(block => block.parentElement === suffix.ownerItem) &&
            suffixLists.every(snapshot => {
                const currentItems = getDirectListItems(snapshot.list);
                return currentItems.length === snapshot.items.length &&
                    snapshot.items.every((item, index) => currentItems[index] === item);
            })
        ))
    };
}

async function renderAndReplace(replacement: InterruptedParagraphReplacement): Promise<void> {
    if (!replacement.isCurrent()) {
        return;
    }
    const { context, listSegments } = replacement;
    const firstList = listSegments[0].list;
    const { root } = replacement;
    const anchor = findNativeListDomAnchor(firstList, root);
    if (!anchor) {
        return;
    }

    const renderTarget = document.createElement('div');
    renderTarget.classList.add(CSS_CLASSES.PANDOC_INVALID_NATIVE_LIST);
    const renderChild = new MarkdownRenderChild(renderTarget);
    context.postProcessorContext.addChild?.(renderChild);
    await renderMarkdownFragment(
        stripMaterializedBlockQuotePrefixes(
            replacement.transformedParagraphSource,
            firstList,
            anchor.precedingParagraph,
            root
        ),
        renderTarget,
        context,
        renderChild
    );

    if (!replacement.isCurrent() ||
        !root.contains(anchor.precedingBlock) ||
        !root.contains(anchor.precedingParagraph) ||
        !root.contains(anchor.replacementBlock) ||
        listSegments.some(segment => !root.contains(segment.list))) {
        return;
    }

    const renderedNodes = Array.from(renderTarget.childNodes);
    if (renderedNodes.length === 0) {
        throw new Error('MarkdownRenderer returned no nodes for an interrupted list paragraph');
    }

    markInvalidParagraphs(renderTarget);
    const retainedBacklinks = getFootnoteBacklinks(
        anchor.precedingParagraph,
        listSegments,
        replacement.sourceOwnedBlockSuffix
    );
    promoteSourceOwnedBlockSuffix(replacement);
    anchor.precedingParagraph.replaceWith(...renderedNodes);
    retainFootnoteBacklinks(renderedNodes, retainedBacklinks);
    consumeListSegments(listSegments, anchor.replacementBlock, replacement.remainingListStart);
}

function replaceWithSourceText(replacement: InterruptedParagraphReplacement): boolean {
    if (!replacement.isCurrent()) {
        return false;
    }
    const { listSegments, sourceLines } = replacement;
    const firstList = listSegments[0].list;
    const anchor = findNativeListDomAnchor(firstList, replacement.root);
    if (!anchor) {
        return false;
    }
    const precedingParagraph = anchor.precedingParagraph;
    const paragraphSource = stripMaterializedBlockQuotePrefixes(
        sourceLines.join('\n'),
        firstList,
        precedingParagraph,
        replacement.root
    ).split('\n');

    const retainedBacklinks = getFootnoteBacklinks(
        precedingParagraph,
        listSegments,
        replacement.sourceOwnedBlockSuffix
    );
    promoteSourceOwnedBlockSuffix(replacement);
    precedingParagraph.classList.add(CSS_CLASSES.PANDOC_INVALID_NATIVE_LIST);
    const continuation = getFallbackContinuation(paragraphSource, replacement.listStartOffset);
    if (continuation) {
        precedingParagraph.appendChild(document.createTextNode(`\n${continuation}`));
    }
    retainFootnoteBacklinks([precedingParagraph], retainedBacklinks);
    consumeListSegments(
        listSegments,
        anchor.replacementBlock,
        replacement.remainingListStart
    );
    return true;
}

function getFallbackContinuation(sourceLines: string[], listStartOffset: number): string {
    const paragraphDepth = getBlockQuoteDepth(sourceLines[0]);
    // A deeper quote is a separate native container, not part of the existing lead
    // paragraph. Preserve its literal source along with the list-source suffix.
    const unmaterializedPrefix = sourceLines.slice(0, listStartOffset)
        .filter(line => getBlockQuoteDepth(line) > paragraphDepth);
    return [...unmaterializedPrefix, ...sourceLines.slice(listStartOffset)].join('\n');
}

function consumeListSegments(
    segments: InterruptedParagraphReplacement['listSegments'],
    firstReplacementBlock: HTMLElement,
    remainingListStart?: number
): void {
    segments.forEach((segment, index) => {
        const block = index === 0
            ? firstReplacementBlock
            : getNativeListBlock(segment.list);
        consumeListItems(
            segment,
            index === segments.length - 1 ? remainingListStart : undefined
        );
        removeEmptyListContainers(segment.list, block);
    });
}

function markInvalidParagraphs(root: HTMLElement): void {
    if (root.matches('p')) {
        root.classList.add(CSS_CLASSES.PANDOC_INVALID_NATIVE_LIST);
    }
    root.querySelectorAll('p').forEach(paragraph => {
        paragraph.classList.add(CSS_CLASSES.PANDOC_INVALID_NATIVE_LIST);
    });
}

function getFootnoteBacklinks(
    precedingParagraph: HTMLParagraphElement,
    segments: InterruptedParagraphReplacement['listSegments'],
    sourceOwnedBlockSuffix?: SourceOwnedBlockSuffix
): HTMLAnchorElement[] {
    const footnoteItem = getFootnoteItem(segments[0].list);
    if (!footnoteItem || !footnoteItem.contains(precedingParagraph)) {
        return [];
    }
    const removedNodes = [precedingParagraph, ...segments.flatMap(segment =>
        getDirectListItems(segment.list).slice(0, segment.itemCount))];
    return Array.from(new Set(removedNodes.filter(node => footnoteItem.contains(node))
        .flatMap(node => Array.from(node.querySelectorAll<HTMLAnchorElement>(
            'a.footnote-back, a.footnote-backref'
    ))))).filter(backlink => !sourceOwnedBlockSuffix?.blocks.some(block =>
        block.contains(backlink)
    ));
}

/**
 * Promotes the host-nested block suffix which source analysis proved begins
 * after the interrupted paragraph. Existing blocks move intact; only a shallow
 * preview wrapper may be created when a direct list changes container depth.
 */
function promoteSourceOwnedBlockSuffix(replacement: InterruptedParagraphReplacement): void {
    const suffix = replacement.sourceOwnedBlockSuffix;
    if (!suffix) {
        return;
    }
    const ownerSegment = replacement.listSegments.find(segment =>
        getDirectListItems(segment.list).slice(0, segment.itemCount).includes(suffix.ownerItem)
    );
    if (!ownerSegment) {
        return;
    }

    const ownerList = ownerSegment.list;
    const ownerBlock = getNativeListBlock(ownerList);
    const remainingOwnerItems = getDirectListItems(ownerList).slice(ownerSegment.itemCount);
    const trailingList = getTrailingOwnedList(suffix.blocks);
    if (suffix.mergeRemainingItems && trailingList?.tagName === ownerList.tagName) {
        remainingOwnerItems.forEach(item => trailingList.appendChild(item));
    }

    const promotedBlocks = suffix.blocks.map(block =>
        createPromotedBlock(block, ownerList, ownerBlock)
    );
    const ownerWillRetainItems = getDirectListItems(ownerList).length > ownerSegment.itemCount;
    if (ownerWillRetainItems) {
        ownerBlock.before(...promotedBlocks);
    } else {
        ownerBlock.after(...promotedBlocks);
    }
}

function createPromotedBlock(
    block: HTMLElement,
    ownerList: HTMLElement,
    ownerBlock: HTMLElement
): HTMLElement {
    if (ownerBlock === ownerList || !block.matches('ul, ol')) {
        return block;
    }

    const wrapper = ownerBlock.cloneNode(false) as HTMLElement;
    if (wrapper.matches('.el-ul, .el-ol')) {
        wrapper.classList.remove('el-ul', 'el-ol');
        wrapper.classList.add(block.tagName === 'OL' ? 'el-ol' : 'el-ul');
    }
    wrapper.appendChild(block);
    return wrapper;
}

function getTrailingOwnedList(blocks: HTMLElement[]): HTMLElement | null {
    const finalBlock = blocks[blocks.length - 1];
    if (!finalBlock) {
        return null;
    }
    if (finalBlock.matches('ul, ol')) {
        return finalBlock;
    }
    if (!finalBlock.matches('.el-ul, .el-ol')) {
        return null;
    }
    return Array.from(finalBlock.children).find(
        (child): child is HTMLElement => child.matches('ul, ol')
    ) ?? null;
}

function getOwnedLists(block: HTMLElement): HTMLElement[] {
    const lists = Array.from(block.querySelectorAll<HTMLElement>('ul, ol'));
    return block.matches('ul, ol') ? [block, ...lists] : lists;
}

function getFootnoteItem(element: HTMLElement): HTMLLIElement | null {
    const section = element.closest('section.footnotes');
    const indexList = section?.querySelector(':scope > ol');
    const item = Array.from(indexList?.children ?? []).find((child): child is HTMLLIElement =>
        child.instanceOf(HTMLLIElement) && child.contains(element)
    );
    return item ?? null;
}

function retainFootnoteBacklinks(nodes: Node[], backlinks: HTMLAnchorElement[]): void {
    if (backlinks.length === 0) {
        return;
    }
    const finalParagraph = nodes.flatMap(node => {
        if (!node.instanceOf(HTMLElement)) {
            return [];
        }
        const paragraphs = Array.from(node.querySelectorAll<HTMLParagraphElement>('p'));
        return node.matches('p') ? [node as HTMLParagraphElement, ...paragraphs] : paragraphs;
    }).pop();
    if (finalParagraph) {
        finalParagraph.append(...backlinks);
    }
}

function removeEmptyListContainers(list: HTMLElement, boundary: HTMLElement): void {
    let current: HTMLElement | null = list;
    while (current && current.childElementCount === 0 && !current.textContent?.trim()) {
        const parent: HTMLElement | null = current.parentElement;
        const reachedBoundary = current === boundary;
        current.remove();
        if (reachedBoundary || !parent || !boundary.contains(parent)) {
            break;
        }
        current = parent;
    }
}

function consumeListItems(
    segment: InterruptedParagraphReplacement['listSegments'][number],
    remainingListStart?: number
): void {
    const items = getDirectListItems(segment.list);
    if (segment.itemCount < items.length && segment.list.tagName === 'OL') {
        const orderedList = segment.list as HTMLOListElement;
        orderedList.start = remainingListStart ??
            getOrderedListItemNumber(orderedList, items, segment.itemCount);
    }
    items.slice(0, segment.itemCount).forEach(item => item.remove());
}

function stripMaterializedBlockQuotePrefixes(
    source: string,
    list: HTMLElement,
    precedingBlock: HTMLElement,
    root: HTMLElement
): string {
    const depth = getSharedBlockQuoteDepth(list, precedingBlock, root);

    if (depth === 0) {
        return source;
    }
    return source.split('\n')
        .map(line => stripBlockQuoteDepth(line, depth))
        .join('\n');
}

function getSharedBlockQuoteDepth(
    list: HTMLElement,
    precedingBlock: HTMLElement,
    root: HTMLElement
): number {
    const listQuotes = getBlockQuoteAncestors(list, root);
    const precedingQuotes = new Set(getBlockQuoteAncestors(precedingBlock, root));
    return listQuotes.filter(quote => precedingQuotes.has(quote)).length;
}

function getBlockQuoteAncestors(element: HTMLElement, root: HTMLElement): HTMLElement[] {
    const ancestors: HTMLElement[] = [];
    let current = element.parentElement;
    while (current && current !== root) {
        if (current.matches('blockquote')) {
            ancestors.push(current);
        }
        current = current.parentElement;
    }
    return ancestors;
}
