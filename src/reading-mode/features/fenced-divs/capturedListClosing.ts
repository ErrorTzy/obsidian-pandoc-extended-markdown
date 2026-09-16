import { isFencedDivClosing } from '../../../live-preview/pipeline/structural/fencedDiv/parser';
import { parsePandocListMarker } from '../../../shared/utils/pandocListMarkers';

import { getCandidateBlock, getTextWithLineBreaks, removeTrailingFencedDivClosing } from './candidateDom';
import { ActiveFencedDiv, SourceOpeningState } from './types';

export interface CapturedListClosing {
    owner: Element;
    rootItem: Element;
    marker: string;
    signature: string;
}

/** Reconcile a source closing that the host included in native list content. */
export function processListWithCapturedClosing(
    candidate: Element,
    stack: ActiveFencedDiv[],
    sourceState?: SourceOpeningState
): boolean {
    if (!sourceState) {
        return false;
    }
    const block = getCandidateBlock(candidate);
    const list = block.matches('ul, ol') ? block : block.querySelector('ul, ol');
    if (!list) {
        return false;
    }
    const capture = inspectCapturedListClosing(list);
    if (!capture) {
        return false;
    }
    const closingIndex = findSourceClosing(capture, sourceState);
    if (closingIndex === null || removeTrailingFencedDivClosing(capture.owner) === null) {
        return false;
    }

    const contentBlock = splitListPrefix(block, list, capture.rootItem);
    const contentText = getTextWithLineBreaks(contentBlock);
    for (const active of stack) {
        active.contentLines.push(contentText);
        active.reference.content = active.contentLines.join('\n').trim();
    }
    stack[stack.length - 1].contentElement.appendChild(contentBlock);
    stack.pop();
    sourceState.lineIndex = closingIndex + 1;
    sourceState.currentOpeningDepth = stack.length;
    return true;
}

function hasDirectClosing(item: Element): boolean {
    const clone = item.cloneNode(true) as Element;
    clone.querySelectorAll('ul, ol').forEach(list => list.remove());
    return /(?:^|\n):{3,}[ \t]*(?:\n[ \t]*)*$/.test(getTextWithLineBreaks(clone));
}

function getRootItem(owner: Element, list: Element): Element | null {
    let item = owner;
    while (item.parentElement !== list) {
        const parentItem = item.parentElement?.closest('li');
        if (!parentItem) {
            return null;
        }
        item = parentItem;
    }
    return item;
}

function endsSubtree(owner: Element, rootItem: Element): boolean {
    let node: Node = owner;
    while (node !== rootItem) {
        for (let sibling = node.nextSibling; sibling; sibling = sibling.nextSibling) {
            if (sibling.nodeType === Node.ELEMENT_NODE || sibling.textContent?.trim()) {
                return false;
            }
        }
        if (!node.parentNode) {
            return false;
        }
        node = node.parentNode;
    }
    return true;
}

export function inspectCapturedListClosing(list: Element): CapturedListClosing | null {
    const owner = Array.from(list.querySelectorAll('li')).find(hasDirectClosing);
    const rootItem = owner ? getRootItem(owner, list) : null;
    // The source closing ends the whole list, not part of an item subtree.
    if (!owner || !rootItem || !endsSubtree(owner, rootItem)) {
        return null;
    }
    const range = document.createRange();
    range.setStart(list, 0);
    range.setEndAfter(owner);
    const prefix = document.createElement('div');
    prefix.appendChild(range.cloneContents());
    separateBlockText(prefix);
    const text = getTextWithLineBreaks(prefix);
    const closing = text.match(/(?:^|\n)(:{3,})[ \t]*(?:\n[ \t]*)*$/);
    if (!closing || closing.index === undefined) {
        return null;
    }
    return { owner, rootItem, marker: closing[1], signature: comparableWords(text.slice(0, closing.index)) };
}

export function getRenderedListSignature(element: Element): string {
    const clone = element.cloneNode(true) as Element;
    separateBlockText(clone);
    return comparableWords(getTextWithLineBreaks(clone));
}

function separateBlockText(element: Element): void {
    // Block boundaries must not join adjacent words, irrespective of the host's
    // choice of tight-list text or loose-list paragraph wrappers.
    element.querySelectorAll('li, p, div, pre, blockquote')
        .forEach(block => block.prepend(document.createTextNode('\n')));
}

function findSourceClosing(capture: CapturedListClosing, state: SourceOpeningState): number | null {
    let startIndex = state.lineIndex;
    while (startIndex < state.sourceLines.length && !state.sourceLines[startIndex].trim()) {
        startIndex++;
    }
    for (let index = state.lineIndex; index < state.sourceLines.length; index++) {
        if (!isFencedDivClosing(state.sourceLines[index])) {
            continue;
        }
        const sourceSignature = state.capturedListClosingSignatures
            ? state.capturedListClosingSignatures.get(index)?.get(startIndex)
            : comparableWords(state.sourceLines.slice(startIndex, index)
            .map(line => {
                const marker = parsePandocListMarker(line, true);
                return marker ? line.slice(marker.markerEnd) : line;
            }).join('\n'));
        // Ordered, whole-word equality preserves multiplicity and never allows
        // “a b” to authorize a rendered “ab” or repeated/reordered content.
        return state.sourceLines[index].trim() === capture.marker &&
            capture.signature.length > 0 && sourceSignature === capture.signature
            ? index : null;
    }
    return null;
}

function comparableWords(text: string): string {
    return (text.normalize('NFC').match(/[\p{L}\p{N}_]+/gu) ?? []).join('\n');
}

function splitListPrefix(block: Element, list: Element, lastItem: Element): Element {
    if (!lastItem.nextElementSibling) {
        return block;
    }
    const prefix = list.cloneNode(false) as Element;
    const children = Array.from(list.childNodes);
    const lastIndex = children.indexOf(lastItem);
    const firstRemainingItem = lastItem.nextElementSibling;
    if (list.instanceOf(HTMLOListElement)) {
        const items = Array.from(list.children);
        let nextNumber = list.start;
        for (const item of items) {
            if (item.hasAttribute('value')) {
                nextNumber = Number(item.getAttribute('value'));
            }
            if (item === firstRemainingItem) {
                break;
            }
            nextNumber++;
        }
        list.start = nextNumber;
    }
    children.slice(0, lastIndex + 1).forEach(node => prefix.appendChild(node));
    if (block === list) {
        return prefix;
    }
    const prefixBlock = block.cloneNode(false) as Element;
    prefixBlock.appendChild(prefix);
    return prefixBlock;
}
