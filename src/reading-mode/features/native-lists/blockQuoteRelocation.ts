import {
    getBlockQuoteDepth,
    getFenceOpening,
    isFenceClosing
} from '../../../shared/utils/pandocBlockBoundaries';

import { NativeListItemMatch, NativeListSourceLine } from './sourceDomMatcher';
import {
    getRenderableNativeListLineIndices,
    parseNativeListLine,
    stripBlockQuotePrefix
} from './sourceLine';

export interface LazyBlockQuoteListRelocation {
    sourceLine: NativeListSourceLine;
    targetBlockQuoteDepth: number;
}

export interface MatchedLazyBlockQuoteRelocation extends LazyBlockQuoteListRelocation {
    match: NativeListItemMatch;
}

export function findLazyBlockQuoteListRelocations(
    lines: string[],
    invalidLines: Set<number>,
    enableListsWithoutPrecedingBlankline: boolean
): LazyBlockQuoteListRelocation[] {
    if (enableListsWithoutPrecedingBlankline) {
        return [];
    }

    const visibleListLines = getRenderableNativeListLineIndices(lines);
    const relocations: LazyBlockQuoteListRelocation[] = [];
    let lazyBlockQuoteDepth = 0;
    let fence: ReturnType<typeof getFenceOpening> = null;

    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        const content = stripBlockQuotePrefix(line);
        const explicitDepth = getBlockQuoteDepth(line);

        if (fence) {
            if (isFenceClosing(content, fence)) {
                fence = null;
            }
            continue;
        }
        if (/^[ \t]*$/.test(line)) {
            lazyBlockQuoteDepth = 0;
            continue;
        }

        const openingFence = getFenceOpening(lines, index, content);
        if (openingFence) {
            if (openingFence.character === '`' && explicitDepth < lazyBlockQuoteDepth) {
                lazyBlockQuoteDepth = explicitDepth;
            }
            fence = openingFence;
            continue;
        }
        if (/^ {0,3}(?:=+|-+)[ \t]*$/.test(content) &&
            explicitDepth < lazyBlockQuoteDepth) {
            lazyBlockQuoteDepth = explicitDepth;
        }

        if (explicitDepth > lazyBlockQuoteDepth) {
            lazyBlockQuoteDepth = explicitDepth;
        }

        const parsed = visibleListLines.has(index) ? parseNativeListLine(line) : null;
        if (parsed && explicitDepth < lazyBlockQuoteDepth && !invalidLines.has(index)) {
            relocations.push({
                sourceLine: { ...parsed, source: line, index },
                targetBlockQuoteDepth: lazyBlockQuoteDepth
            });
        }
    }

    return relocations;
}

export function relocateLazyBlockQuoteListItems(
    root: HTMLElement,
    relocations: MatchedLazyBlockQuoteRelocation[]
): boolean {
    if (relocations.some(({ match }) => !root.contains(match.list) ||
        match.item.parentElement !== match.list)) {
        return false;
    }
    const prepared = relocations.map(relocation => ({
        ...relocation,
        destination: findDestinationBlockQuote(
            root,
            relocation.match.list,
            relocation.targetBlockQuoteDepth
        )
    }));
    if (prepared.some(({ destination, match }) => !destination ||
        !root.contains(destination) || match.item.contains(destination))) {
        return false;
    }

    prepared.forEach(relocation => moveItem(
        relocation.match,
        relocation.destination as HTMLElement
    ));
    return true;
}

function findDestinationBlockQuote(
    root: HTMLElement,
    list: HTMLElement,
    targetDepth: number
): HTMLElement | null {
    const topList = getTopList(list);
    const block = getListBlock(topList);
    const preceding = block.previousElementSibling;
    if (!preceding) {
        return null;
    }

    const candidates = [
        ...(preceding.matches('blockquote') ? [preceding] : []),
        ...Array.from(preceding.querySelectorAll('blockquote'))
    ].filter((candidate): candidate is HTMLElement => candidate.instanceOf(HTMLElement));
    return candidates.reverse().find(candidate =>
        getBlockQuoteDomDepth(candidate, root) === targetDepth
    ) ?? null;
}

function getTopList(list: HTMLElement): HTMLElement {
    let top = list;
    let ancestor = top.parentElement?.closest<HTMLElement>('ul, ol');
    while (ancestor) {
        top = ancestor;
        ancestor = top.parentElement?.closest<HTMLElement>('ul, ol');
    }
    return top;
}

function getBlockQuoteDomDepth(element: HTMLElement, root: HTMLElement): number {
    let depth = 1;
    let ancestor = element.parentElement;
    while (ancestor && ancestor !== root) {
        if (ancestor.matches('blockquote')) {
            depth++;
        }
        ancestor = ancestor.parentElement;
    }
    return depth;
}

function moveItem(match: NativeListItemMatch, destination: HTMLElement): void {
    const sourceList = match.list;
    const sourceItems = getDirectItems(sourceList);
    const sourceIndex = sourceItems.indexOf(match.item);
    if (sourceIndex < 0) {
        return;
    }

    const nextOrderedStart = sourceList.instanceOf(HTMLOListElement) && sourceIndex === 0
        ? getOrderedItemNumber(sourceList, sourceItems, 1)
        : null;
    const destinationList = getOrCreateDestinationList(
        destination,
        sourceList,
        sourceItems,
        sourceIndex
    );
    destinationList.appendChild(match.item);

    if (getDirectItems(sourceList).length === 0) {
        removeEmptyListBlock(sourceList);
    } else if (nextOrderedStart !== null && sourceList.instanceOf(HTMLOListElement)) {
        sourceList.start = nextOrderedStart;
    }
}

function getOrCreateDestinationList(
    destination: HTMLElement,
    sourceList: HTMLElement,
    sourceItems: HTMLLIElement[],
    sourceIndex: number
): HTMLElement {
    const trailingList = getTrailingDirectList(destination);
    if (trailingList?.tagName === sourceList.tagName) {
        sourceList.classList.forEach(className => trailingList.classList.add(className));
        return trailingList;
    }

    const list = sourceList.cloneNode(false) as HTMLElement;
    if (list.instanceOf(HTMLOListElement)) {
        list.start = getOrderedItemNumber(sourceList as HTMLOListElement, sourceItems, sourceIndex);
    }
    const sourceBlock = getListBlock(sourceList);
    if (sourceBlock !== sourceList) {
        const wrapper = sourceBlock.cloneNode(false) as HTMLElement;
        wrapper.appendChild(list);
        destination.appendChild(wrapper);
    } else {
        destination.appendChild(list);
    }
    return list;
}

function getTrailingDirectList(destination: HTMLElement): HTMLElement | null {
    const finalChild = destination.lastElementChild;
    if (!finalChild) {
        return null;
    }
    if (finalChild.matches('ul, ol')) {
        return finalChild as HTMLElement;
    }
    return finalChild.matches('.el-ul, .el-ol')
        ? finalChild.querySelector<HTMLElement>(':scope > ul, :scope > ol')
        : null;
}

function removeEmptyListBlock(list: HTMLElement): void {
    const block = getListBlock(list);
    list.remove();
    if (block !== list && block.childElementCount === 0 && !block.textContent?.trim()) {
        block.remove();
    }
}

function getListBlock(list: HTMLElement): HTMLElement {
    const parent = list.parentElement;
    return parent?.matches('.el-ul, .el-ol') ? parent : list;
}

function getDirectItems(list: HTMLElement): HTMLLIElement[] {
    return Array.from(list.children)
        .filter((child): child is HTMLLIElement => child.instanceOf(HTMLLIElement));
}

function getOrderedItemNumber(
    list: HTMLOListElement,
    items: HTMLLIElement[],
    itemIndex: number
): number {
    let number = list.start;
    for (let index = 0; index <= itemIndex; index++) {
        const item = items[index];
        if (!item) {
            break;
        }
        const explicitValue = Number(item.getAttribute('value'));
        if (item.hasAttribute('value') && Number.isFinite(explicitValue)) {
            number = explicitValue;
        }
        if (index < itemIndex) {
            number++;
        }
    }
    return number;
}
