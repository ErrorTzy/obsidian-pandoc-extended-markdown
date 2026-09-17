import { CSS_CLASSES } from '../../../core/constants';

import {
    type DefinitionDomSignature,
    getDefinitionListSequence,
    normalizeCandidateText
} from './definitionSignature';
import {
    getTextFromNodes,
    getTextWithLineBreaks,
    getRawDefinitionDescriptions,
    matchesCompleteRawDefinitionText,
    matchesDefinitionBlockText,
    matchesDefinitionMarkerText,
    matchesLiteralMarkerTermText,
    matchesRawDefinitionParagraphText
} from './definitionTextMatcher';
import type { PandocDefinitionListBlock } from './sourceParser';

export function getDefinitionLists(element: HTMLElement): HTMLElement[] {
    const lists = Array.from(
        element.querySelectorAll<HTMLElement>(`dl.${CSS_CLASSES.DEFINITION_LIST}`)
    );
    if (element.matches(`dl.${CSS_CLASSES.DEFINITION_LIST}`)) {
        lists.unshift(element);
    }
    return Array.from(new Set(lists));
}

// Candidate discovery is kept separate from the replacement operations above.
export function getDefinitionListBlockCandidates(
    root: HTMLElement,
    block: PandocDefinitionListBlock,
    usedCandidates: Set<HTMLElement>,
    signature: DefinitionDomSignature
): HTMLElement[] {
    if (block.joinsLazyContainer) {
        const structuralCandidates = getLazyDefinitionListBlockCandidates(
            root,
            block,
            usedCandidates,
            signature
        );
        if (structuralCandidates.length > 0) {
            return structuralCandidates;
        }
        const existingLists = sortCandidatesByDocumentOrder(
            getDefinitionListCandidates(root, block, signature)
                .filter(candidate => !usedCandidates.has(candidate))
        );
        return existingLists.length > 0 ? [existingLists[0]] : [];
    }

    const candidates = getDefinitionCandidateElements(root, block, signature)
        .filter(candidate => !usedCandidates.has(candidate));
    if (candidates.length === 0) {
        return [];
    }
    const group: HTMLElement[] = [candidates[0]];
    for (let index = 1; index < candidates.length; index++) {
        if (!hasOnlyIgnorableContentBetween(group[group.length - 1], candidates[index])) {
            break;
        }
        group.push(candidates[index]);
    }
    return group;
}

function getLazyDefinitionListBlockCandidates(
    root: HTMLElement,
    block: PandocDefinitionListBlock,
    usedCandidates: Set<HTMLElement>,
    signature: DefinitionDomSignature
): HTMLElement[] {
    const combinedCandidates = getCombinedLazyDefinitionCandidates(root, block, signature)
        .filter(candidate => !usedCandidates.has(candidate));
    if (combinedCandidates.length > 0) {
        return [sortCandidatesByDocumentOrder(combinedCandidates)[0]];
    }

    const markerCandidates = sortCandidatesByDocumentOrder(
        getLazyDefinitionMarkerCandidates(root, block, signature)
            .filter(candidate => !usedCandidates.has(candidate))
    );
    for (const marker of markerCandidates) {
        const markerContainer = getBlockQuoteContainer(
            root,
            marker,
            block.definitionContainerDepth
        );
        const markerLayout = markerContainer
            ? getDirectLayoutChild(markerContainer, marker)
            : null;
        const quoteLayout = markerLayout
            ? getPreviousNonEmptyLayoutSibling(markerLayout)
            : null;
        if (!markerContainer || !markerLayout || !quoteLayout ||
            (!quoteLayout.matches('blockquote') && !quoteLayout.querySelector('blockquote'))) {
            continue;
        }

        const term = getUniqueLazyTermCandidate(root, quoteLayout, block, signature);
        if (!term || usedCandidates.has(term)) {
            continue;
        }

        const trailing = [marker];
        let sibling = getNextNonEmptyLayoutSibling(markerLayout);
        while (sibling) {
            const nextMarker = markerCandidates.find(candidate =>
                getBlockQuoteContainer(root, candidate, block.definitionContainerDepth) ===
                    markerContainer &&
                getDirectLayoutChild(markerContainer, candidate) === sibling
            );
            if (!nextMarker || trailing.includes(nextMarker)) {
                break;
            }
            trailing.push(nextMarker);
            sibling = getNextNonEmptyLayoutSibling(sibling);
        }

        const candidates = [term, ...trailing];
        if (matchesLazyDefinitionCandidates(candidates, signature)) {
            return candidates;
        }
    }

    return [];
}

function getCombinedLazyDefinitionCandidates(
    root: HTMLElement,
    block: PandocDefinitionListBlock,
    signature: DefinitionDomSignature
): HTMLElement[] {
    const candidates: HTMLElement[] = [];
    root.querySelectorAll<HTMLElement>('blockquote p, blockquote li').forEach(element => {
        if (getBlockQuoteDepthInRoot(root, element) !== block.termContainerDepth ||
            !matchesRawDefinitionParagraphText(getTextWithLineBreaks(element), signature)) {
            return;
        }
        addUniqueCandidate(candidates, getDefinitionListBlockCandidate(element, root));
    });
    return candidates;
}

function getLazyDefinitionMarkerCandidates(
    root: HTMLElement,
    block: PandocDefinitionListBlock,
    signature: DefinitionDomSignature
): HTMLElement[] {
    const candidates: HTMLElement[] = [];
    root.querySelectorAll<HTMLElement>('.el-p, p, li').forEach(element => {
        if (element.querySelector(`dl.${CSS_CLASSES.DEFINITION_LIST}`) ||
            getBlockQuoteDepthInRoot(root, element) !== block.definitionContainerDepth) {
            return;
        }
        const text = getTextWithLineBreaks(element);
        if (matchesDefinitionMarkerText(text, signature.definitionTexts) ||
            matchesRawDefinitionParagraphText(text, signature)) {
            addUniqueCandidate(candidates, getDefinitionListBlockCandidate(element, root));
        }
    });
    return candidates;
}

function matchesLazyDefinitionCandidates(
    candidates: HTMLElement[],
    signature: DefinitionDomSignature
): boolean {
    if (candidates.length === 1) {
        return matchesRawDefinitionParagraphText(
            getTextWithLineBreaks(candidates[0]),
            signature
        );
    }
    if (candidates.length < 2 || signature.termTexts.length !== 1) {
        return false;
    }

    const term = normalizeCandidateText(candidates[0].textContent ?? '');
    const definitions = candidates.slice(1).flatMap(candidate =>
        getRawDefinitionDescriptions(getTextWithLineBreaks(candidate)) ?? []
    );
    return term === normalizeCandidateText(signature.termTexts[0]) &&
        definitions.length === signature.definitionTexts.length &&
        definitions.every((definition, index) =>
            definition === normalizeCandidateText(signature.definitionTexts[index])
        );
}

function getUniqueLazyTermCandidate(
    root: HTMLElement,
    quoteLayout: HTMLElement,
    block: PandocDefinitionListBlock,
    signature: DefinitionDomSignature
): HTMLElement | null {
    const terms = new Set(signature.termTexts.map(normalizeCandidateText));
    const matches = Array.from(quoteLayout.querySelectorAll<HTMLElement>('p, li'))
        .filter(element =>
            !element.querySelector(`dl.${CSS_CLASSES.DEFINITION_LIST}`) &&
            getBlockQuoteDepthInRoot(root, element) === block.termContainerDepth &&
            terms.has(normalizeCandidateText(element.textContent ?? ''))
        );
    if (matches.length !== 1) {
        return null;
    }
    return getDefinitionListBlockCandidate(matches[0], quoteLayout);
}

export function getDirectLayoutChild(root: HTMLElement, candidate: HTMLElement): HTMLElement | null {
    let current: HTMLElement | null = candidate;
    while (current?.parentElement && current.parentElement !== root) {
        current = current.parentElement;
    }
    return current?.parentElement === root ? current : null;
}

export function getBlockQuoteDepthInRoot(root: HTMLElement, element: HTMLElement): number {
    return getBlockQuoteAncestors(root, element).length;
}

export function getBlockQuoteContainer(
    root: HTMLElement,
    element: HTMLElement,
    depth: number
): HTMLElement | null {
    if (depth === 0) {
        return root;
    }
    return getBlockQuoteAncestors(root, element)[depth - 1] ?? null;
}

function getBlockQuoteAncestors(root: HTMLElement, element: HTMLElement): HTMLElement[] {
    const ancestors: HTMLElement[] = [];
    let current = element.parentElement;
    while (current) {
        if (current.tagName === 'BLOCKQUOTE') {
            ancestors.unshift(current);
        }
        if (current === root) {
            break;
        }
        current = current.parentElement;
    }
    return ancestors;
}

function getPreviousNonEmptyLayoutSibling(element: HTMLElement): HTMLElement | null {
    let sibling = element.previousElementSibling as HTMLElement | null;
    while (sibling && (sibling.textContent ?? '').trim().length === 0) {
        sibling = sibling.previousElementSibling as HTMLElement | null;
    }
    return sibling;
}

function getNextNonEmptyLayoutSibling(element: HTMLElement): HTMLElement | null {
    let sibling = element.nextElementSibling as HTMLElement | null;
    while (sibling && (sibling.textContent ?? '').trim().length === 0) {
        sibling = sibling.nextElementSibling as HTMLElement | null;
    }
    return sibling;
}

export function containsCompleteDefinitionBlockCandidateText(
    candidates: HTMLElement[],
    signature: DefinitionDomSignature
): boolean {
    if (candidates.length === 1 && matchesCompleteRawDefinitionText(
        getTextWithLineBreaks(candidates[0]),
        signature
    )) {
        return true;
    }

    const normalizedText = normalizeCandidateText(
        candidates.map(candidate => candidate.textContent ?? '').join('\n')
    );
    let cursor = 0;
    return signature.sequence.every(requiredText => {
        const normalizedRequired = normalizeCandidateText(requiredText);
        const index = normalizedText.indexOf(normalizedRequired, cursor);
        if (index < 0) {
            return false;
        }
        cursor = index + normalizedRequired.length;
        return true;
    });
}

export function getRequiredDefinitionBlockTexts(block: PandocDefinitionListBlock): string[] {
    return [...block.termTexts, ...block.definitionTexts]
        .map(normalizeCandidateText)
        .filter(text => text.length > 0);
}

export function isCanonicalDefinitionBlockCandidate(
    candidates: HTMLElement[],
    signature: DefinitionDomSignature
): boolean {
    if (candidates.length !== 1) {
        return false;
    }

    const list = getSingleDefinitionList(candidates[0]);
    if (!list || hasRawDefinitionMarkerText(candidates[0])) {
        return false;
    }

    return getDefinitionListSequence(list).join('\n') === signature.sequence.join('\n');
}

export function getSingleDefinitionList(candidate: HTMLElement): HTMLElement | null {
    const lists = Array.from(candidate.querySelectorAll<HTMLElement>(`dl.${CSS_CLASSES.DEFINITION_LIST}`));
    if (candidate.matches(`dl.${CSS_CLASSES.DEFINITION_LIST}`)) {
        lists.unshift(candidate);
    }

    const uniqueLists = Array.from(new Set(lists));
    return uniqueLists.length === 1 ? uniqueLists[0] : null;
}

function hasRawDefinitionMarkerText(candidate: HTMLElement): boolean {
    return Array.from(candidate.querySelectorAll<HTMLElement>('p, li'))
        .some(element => /^[:~]\s+\S/.test(normalizeCandidateText(getTextWithLineBreaks(element))));
}

function getDefinitionCandidateElements(
    root: HTMLElement,
    block: PandocDefinitionListBlock,
    signature: DefinitionDomSignature
): HTMLElement[] {
    const candidates = getDefinitionListCandidates(root, block, signature);
    getDefinitionMarkerCandidates(root, block, signature).forEach(candidate => {
        addUniqueCandidate(candidates, candidate);
    });
    return sortCandidatesByDocumentOrder(candidates);
}

export function getDefinitionListCandidates(
    root: HTMLElement,
    block: PandocDefinitionListBlock,
    signature: DefinitionDomSignature
): HTMLElement[] {
    const candidates: HTMLElement[] = [];
    getDefinitionLists(root).forEach(list => {
        if (getBlockQuoteDepthInRoot(root, list) === block.termContainerDepth &&
            matchesDefinitionBlockText(list, signature)) {
            addUniqueCandidate(candidates, getDefinitionListBlockCandidate(list, root));
        }
    });
    return candidates;
}

function getDefinitionMarkerCandidates(
    root: HTMLElement,
    block: PandocDefinitionListBlock,
    signature: DefinitionDomSignature
): HTMLElement[] {
    const candidates: HTMLElement[] = [];
    root.querySelectorAll<HTMLElement>('.el-p, p, li').forEach(element => {
        if (element.querySelector(`dl.${CSS_CLASSES.DEFINITION_LIST}`) ||
            getBlockQuoteDepthInRoot(root, element) !== block.termContainerDepth) {
            return;
        }
        const text = getTextWithLineBreaks(element);
        if (
            matchesDefinitionMarkerText(text, signature.definitionTexts) ||
            matchesLiteralMarkerTermText(text, signature.termTexts) ||
            matchesRawDefinitionParagraphText(text, signature)
        ) {
            addUniqueCandidate(candidates, getDefinitionListBlockCandidate(element, root));
        }
    });
    return candidates;
}

export function getDefinitionListBlockCandidate(list: HTMLElement, root: HTMLElement): HTMLElement {
    if (list === root) {
        return root;
    }

    const block = list.closest('.el-p');
    if (block instanceof HTMLElement && root.contains(block)) {
        return block;
    }

    const paragraph = list.closest('p');
    if (paragraph instanceof HTMLElement && root.contains(paragraph)) {
        return paragraph;
    }

    return list;
}

function addUniqueCandidate(candidates: HTMLElement[], candidate: HTMLElement): void {
    if (!candidates.includes(candidate)) {
        candidates.push(candidate);
    }
}

export function sortCandidatesByDocumentOrder(candidates: HTMLElement[]): HTMLElement[] {
    return [...candidates].sort((a, b) => {
        if (a === b) {
            return 0;
        }
        return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING ? 1 : -1;
    });
}


function hasOnlyIgnorableContentBetween(previous: HTMLElement, next: HTMLElement): boolean {
    if (previous.parentElement !== next.parentElement) {
        return false;
    }

    let sibling = previous.nextElementSibling;
    while (sibling && sibling !== next) {
        if ((sibling.textContent ?? '').trim().length > 0) {
            return false;
        }
        sibling = sibling.nextElementSibling;
    }
    return true;
}

// DOM text extraction and cleanup shared by source-backed and fallback paths.
export function extractDroppedDefinitionTerm(list: HTMLElement): string | null {
    const parent = list.parentElement;
    if (parent?.nodeName === 'P') {
        return extractTermBeforeList(parent, list);
    }

    const previous = list.previousElementSibling;
    if (previous?.nodeName === 'P') {
        const termText = getLastNonEmptyLine(getTextWithLineBreaks(previous));
        if (!termText) {
            return null;
        }

        previous.replaceChildren(list);
        removeEmptyParagraphSibling(previous.nextElementSibling);
        return termText;
    }

    return null;
}

function extractTermBeforeList(paragraph: Element, list: HTMLElement): string | null {
    const precedingNodes = getPrecedingSiblingNodes(paragraph, list);
    const termText = getLastNonEmptyLine(getTextFromNodes(precedingNodes));
    if (!termText) {
        return null;
    }

    precedingNodes.forEach(node => node.parentNode?.removeChild(node));
    return termText;
}

function getPrecedingSiblingNodes(parent: Element, target: Node): Node[] {
    const nodes: Node[] = [];
    let current = parent.firstChild;
    while (current && current !== target) {
        nodes.push(current);
        current = current.nextSibling;
    }
    return nodes;
}


function getLastNonEmptyLine(text: string): string | null {
    const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    return lines.length > 0 ? lines[lines.length - 1] : null;
}

function removeEmptyParagraphSibling(element: Element | null): void {
    if (element?.nodeName === 'P' && !element.textContent?.trim()) {
        element.remove();
    }
}
