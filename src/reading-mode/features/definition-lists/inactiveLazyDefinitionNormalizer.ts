import { CSS_CLASSES } from '../../../core/constants';

import {
    getBlockQuoteContainer,
    getBlockQuoteDepthInRoot,
    getDefinitionListBlockCandidate,
    getDefinitionListCandidates,
    getDefinitionLists,
    getDirectLayoutChild,
    getRequiredDefinitionBlockTexts,
    getSingleDefinitionList,
    sortCandidatesByDocumentOrder
} from './definitionCandidateMatcher';
import {
    type DefinitionDomSignature,
    getDefinitionBlockSequence,
    getDefinitionDomSignature,
    getDefinitionListItemSignatures,
    getDefinitionListSequence,
    normalizeCandidateText
} from './definitionSignature';
import {
    getTextWithLineBreaks,
    matchesRawDefinitionParagraphText
} from './definitionTextMatcher';
import {
    type InactiveDefinitionMarkerPlan,
    createInactiveDefinitionMarkerPlan,
    detachMarkerNodes,
    findParagraphSplitBoundary,
    getColdListReplacementTarget,
    getInlineContentNodes,
    hasNestedListContainer,
    preflightInactiveDefinitionSplit
} from './inactiveLazyDefinitionDom';
import {
    type PandocDefinitionListBlock
} from './sourceParser';

const LAZY_CONTAINER_DEFINITION_CLASS = 'pem-lazy-container-definition';
const INACTIVE_LAZY_TERM_CLASS = 'pem-inactive-lazy-definition-term';

interface LazyDefinitionRestoration {
    blockKey: string;
    requiredTexts: string[];
    term: HTMLElement;
    trailing: Array<{
        node: HTMLElement;
        parent: Node;
        nextSibling: Node | null;
    }>;
}

export type DefinitionBlockRenderer = (block: PandocDefinitionListBlock) => HTMLElement;

const lazyDefinitionRestorations = new WeakMap<HTMLElement, LazyDefinitionRestoration>();
const inactiveLazySplits = new WeakMap<HTMLElement, {
    blockKey: string;
    markerBlocks: HTMLElement[];
}>();

export function replaceLazyContainerDefinition(
    candidates: HTMLElement[],
    replacementNodes: Node[],
    block: PandocDefinitionListBlock,
    signature: DefinitionDomSignature,
    usedCandidates: Set<HTMLElement>
): boolean {
    const [term, ...trailing] = candidates;
    const list = replacementNodes.length === 1 &&
        isHtmlElement(replacementNodes[0]) &&
        replacementNodes[0].matches(`dl.${CSS_CLASSES.DEFINITION_LIST}`)
        ? replacementNodes[0]
        : null;
    const isCombinedCandidate = term
        ? matchesRawDefinitionParagraphText(getTextWithLineBreaks(term), signature)
        : false;
    if (!term?.parentNode || !list || (!isCombinedCandidate && trailing.length === 0) ||
        trailing.some(candidate => !candidate.parentNode)) {
        return false;
    }

    const restoration: LazyDefinitionRestoration = {
        blockKey: getDefinitionBlockKey(block),
        requiredTexts: getRequiredDefinitionBlockTexts(block),
        term,
        trailing: trailing.map(node => ({
            node,
            parent: node.parentNode as Node,
            nextSibling: node.nextSibling
        }))
    };
    candidates.forEach(candidate => usedCandidates.add(candidate));
    list.classList.add(LAZY_CONTAINER_DEFINITION_CLASS);
    term.replaceWith(list);
    trailing.forEach(candidate => candidate.remove());
    lazyDefinitionRestorations.set(list, restoration);
    return true;
}

// Reversible handling for markers Pandoc keeps inside lazy container paragraphs.
export function restoreInactiveLazyDefinitions(
    root: HTMLElement,
    sourceText: string,
    inactiveBlocks: PandocDefinitionListBlock[]
): void {
    const normalizedSource = normalizeCandidateText(sourceText);
    const inactiveBlockKeys = new Set(inactiveBlocks.map(getDefinitionBlockKey));
    root.querySelectorAll<HTMLElement>(`dl.${LAZY_CONTAINER_DEFINITION_CLASS}`)
        .forEach(list => {
            const restoration = lazyDefinitionRestorations.get(list);
            if (!restoration || !list.parentNode ||
                !inactiveBlockKeys.has(restoration.blockKey) ||
                !restoration.requiredTexts.every(text => normalizedSource.includes(text)) ||
                restoration.trailing.some(({ parent }) =>
                    !root.contains(parent) && parent !== root
                )) {
                return;
            }
            list.replaceWith(restoration.term);
            restoration.trailing.forEach(({ node, parent, nextSibling }) => {
                parent.insertBefore(
                    node,
                    nextSibling?.parentNode === parent ? nextSibling : null
                );
            });
            lazyDefinitionRestorations.delete(list);
        });
}

function getDefinitionBlockKey(block: PandocDefinitionListBlock): string {
    return [
        block.startLine,
        block.endLine,
        ...getDefinitionBlockSequence(block)
    ].join('\u0000');
}

export function normalizeInactiveLazyDefinitions(
    root: HTMLElement,
    blocks: PandocDefinitionListBlock[],
    renderBlock: (block: PandocDefinitionListBlock) => HTMLElement,
    usedCandidates: Set<HTMLElement>
): void {
    restoreInactiveLazySplitMarkers(root, blocks);
    const usedParagraphs = new Set<HTMLElement>();
    blocks.forEach(block => {
        let signature = getDefinitionDomSignature([renderBlock(block)], block);
        const paragraph = getCombinedLazyDefinitionParagraphs(root, block, signature)
            .find(candidate => !usedParagraphs.has(candidate));
        if (!paragraph || !splitCombinedLazyDefinitionParagraph(
            root,
            paragraph,
            block,
            signature
        )) {
            let existingList = sortCandidatesByDocumentOrder(
                getDefinitionListCandidates(root, block, signature)
                    .filter(candidate => !usedCandidates.has(candidate))
            )[0];
            if (!existingList) {
                existingList = getSourceOwnedColdDefinitionCandidate(
                    root,
                    block,
                    usedCandidates
                );
            }
            const sourceOwnedList = existingList
                ? getSingleDefinitionList(existingList)
                : null;
            if (sourceOwnedList?.classList.contains(LAZY_CONTAINER_DEFINITION_CLASS) &&
                matchesDefinitionListCardinality(sourceOwnedList, block)) {
                signature = getDefinitionDomSignature([sourceOwnedList], block);
            }
            if (existingList && splitInactiveLazyDefinitionList(
                root,
                existingList,
                block,
                signature
            )) {
                usedCandidates.add(existingList);
            }
            return;
        }
        usedParagraphs.add(paragraph);
        usedCandidates.add(paragraph);
    });
}

function getSourceOwnedColdDefinitionCandidate(
    root: HTMLElement,
    block: PandocDefinitionListBlock,
    usedCandidates: Set<HTMLElement>
): HTMLElement | undefined {
    return sortCandidatesByDocumentOrder(getDefinitionLists(root)
        .filter(list =>
            list.classList.contains(LAZY_CONTAINER_DEFINITION_CLASS) &&
            getBlockQuoteDepthInRoot(root, list) === block.termContainerDepth &&
            matchesDefinitionListCardinality(list, block)
        )
        .map(list => getDefinitionListBlockCandidate(list, root))
        .filter(candidate => !usedCandidates.has(candidate)))[0];
}

function matchesDefinitionListCardinality(
    list: HTMLElement,
    block: PandocDefinitionListBlock
): boolean {
    const renderedItems = getDefinitionListItemSignatures(list);
    return renderedItems.length === block.items.length && renderedItems.every((item, index) =>
        item.definitionTexts.length === block.items[index]?.definitions.length
    );
}

function getCombinedLazyDefinitionParagraphs(
    root: HTMLElement,
    block: PandocDefinitionListBlock,
    signature: DefinitionDomSignature
): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>('blockquote p'))
        .filter(paragraph =>
            getBlockQuoteDepthInRoot(root, paragraph) === block.termContainerDepth &&
            matchesRawDefinitionParagraphText(getTextWithLineBreaks(paragraph), signature)
        );
}

function splitCombinedLazyDefinitionParagraph(
    root: HTMLElement,
    paragraph: HTMLElement,
    block: PandocDefinitionListBlock,
    signature: DefinitionDomSignature
): boolean {
    const markerContainer = getBlockQuoteContainer(
        root,
        paragraph,
        block.definitionContainerDepth
    );
    const layout = markerContainer
        ? getDirectLayoutChild(markerContainer, paragraph)
        : null;
    if (!markerContainer || !layout ||
        (!layout.matches('blockquote') && !layout.querySelector('blockquote')) ||
        getBlockQuoteDepthInRoot(root, paragraph) !== block.termContainerDepth) {
        return false;
    }

    const nodes = Array.from(paragraph.childNodes);
    const boundary = findParagraphSplitBoundary(nodes, signature);
    if (!boundary || !layout.parentNode) {
        return false;
    }

    const markerNodes = detachMarkerNodes(nodes, boundary);
    if (markerNodes.length === 0) {
        return false;
    }

    const markerParagraph = paragraph.ownerDocument.createElement('p');
    markerParagraph.setAttribute('dir', paragraph.getAttribute('dir') ?? 'auto');
    const markerBlock = block.definitionContainerDepth === 0
        ? paragraph.ownerDocument.createElement('div')
        : markerParagraph;
    if (markerBlock !== markerParagraph) {
        markerBlock.className = 'el-p';
        markerBlock.appendChild(markerParagraph);
    }

    markerNodes.forEach(node => markerParagraph.appendChild(node));
    paragraph.classList.add(INACTIVE_LAZY_TERM_CLASS);
    inactiveLazySplits.set(paragraph, {
        blockKey: getDefinitionBlockKey(block),
        markerBlocks: [markerBlock]
    });
    markerContainer.insertBefore(markerBlock, layout.nextSibling);
    return true;
}

function splitInactiveLazyDefinitionList(
    root: HTMLElement,
    candidate: HTMLElement,
    block: PandocDefinitionListBlock,
    signature: DefinitionDomSignature
): boolean {
    const list = getSingleDefinitionList(candidate);
    const terms = list
        ? Array.from(list.children).filter((child): child is HTMLElement => child.tagName === 'DT')
        : [];
    const definitions = list
        ? Array.from(list.children).filter((child): child is HTMLElement => child.tagName === 'DD')
        : [];
    const sourceDefinitions = block.items[0]?.definitions ?? [];
    const markerContainer = list
        ? getBlockQuoteContainer(root, list, block.definitionContainerDepth)
        : null;
    const layout = list && markerContainer
        ? getDirectLayoutChild(markerContainer, list)
        : null;
    const replacementTarget = list ? getColdListReplacementTarget(list) : null;
    const termNodes = terms.length === 1 ? getInlineContentNodes(terms[0], false) : null;
    if (!list || !replacementTarget?.parentNode || !termNodes ||
        hasNestedListContainer(list, layout) ||
        terms.length !== 1 ||
        definitions.length !== sourceDefinitions.length ||
        signature.termTexts.length !== 1 ||
        getDefinitionListSequence(list).join('\n') !== signature.sequence.join('\n') ||
        !markerContainer || !layout ||
        layout.parentNode !== markerContainer ||
        (!layout.matches('blockquote') && !layout.querySelector('blockquote'))) {
        return false;
    }

    const term = list.ownerDocument.createElement('p');
    term.setAttribute('dir', 'auto');
    const pendingMarkerPlans = definitions.map((definition, index) =>
        createInactiveDefinitionMarkerPlan(
            definition,
            sourceDefinitions[index],
            block.definitionContainerDepth
        )
    );
    if (!pendingMarkerPlans.every(
        (plan): plan is InactiveDefinitionMarkerPlan => plan !== null
    )) {
        return false;
    }
    const markerPlans = pendingMarkerPlans;
    if (!preflightInactiveDefinitionSplit(
        list,
        replacementTarget,
        markerContainer,
        layout,
        termNodes,
        definitions,
        markerPlans
    )) {
        return false;
    }

    termNodes.forEach(node => term.appendChild(node));
    markerPlans.forEach(plan => {
        plan.movableNodes.forEach(node => plan.paragraph.appendChild(node));
    });
    term.classList.add(INACTIVE_LAZY_TERM_CLASS);
    const markerBlocks = markerPlans.map(plan => plan.block);
    inactiveLazySplits.set(term, {
        blockKey: getDefinitionBlockKey(block),
        markerBlocks
    });
    replacementTarget.replaceWith(term);
    let anchor = layout;
    markerBlocks.forEach(marker => {
        markerContainer.insertBefore(marker, anchor.nextSibling);
        anchor = marker;
    });
    return true;
}


function restoreInactiveLazySplitMarkers(
    root: HTMLElement,
    blocks: PandocDefinitionListBlock[]
): void {
    const activeBlocks = new Map(blocks.map(block => [getDefinitionBlockKey(block), block]));
    root.querySelectorAll<HTMLElement>(`.${INACTIVE_LAZY_TERM_CLASS}`)
        .forEach(term => {
            const split = inactiveLazySplits.get(term);
            const block = split ? activeBlocks.get(split.blockKey) : null;
            const markerContainer = block
                ? getBlockQuoteContainer(root, term, block.definitionContainerDepth)
                : null;
            const layout = markerContainer
                ? getDirectLayoutChild(markerContainer, term)
                : null;
            if (!split || !block || !markerContainer || !layout) {
                return;
            }
            if (split.markerBlocks.every((marker, index) =>
                marker.parentNode === markerContainer &&
                marker.previousElementSibling === (index === 0
                    ? layout
                    : split.markerBlocks[index - 1])
            )) {
                return;
            }
            let anchor = layout;
            split.markerBlocks.forEach(marker => {
                markerContainer.insertBefore(marker, anchor.nextSibling);
                anchor = marker;
            });
        });
}

function isHtmlElement(node: Node): node is HTMLElement {
    return node.nodeType === Node.ELEMENT_NODE;
}
