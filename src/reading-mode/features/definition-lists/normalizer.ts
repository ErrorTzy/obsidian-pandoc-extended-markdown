import { MarkdownPostProcessorContext } from 'obsidian';

import { CSS_CLASSES } from '../../../core/constants';
import { getSectionInfo } from '../../../shared/types/obsidian-extended';
import { ProcessorConfig } from '../../../shared/types/processorConfig';
import { parsePandocListMarker } from '../../../shared/utils/pandocListMarkers';

import { ReadingModeRenderer, RenderContext } from '../extended-lists/lineRenderer';
import { ReadingModeContext } from '../../pipeline/types';
import { renderDefinitionBlockWithHost } from './hostRenderer';
import { reconcileNativeListDefinition } from './nativeListReconciler';
import {
    findPandocDefinitionListBlocks,
    isStandalonePandocDefinitionList,
    PandocDefinitionDescription,
    PandocDefinitionListBlock,
    parseMarkdownListItem,
    trimOuterBlankLines
} from './sourceParser';
import {
    renderPandocDefinitionListBlock
} from './sourceRenderer';

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

interface DefinitionDomSignature {
    termTexts: string[];
    definitionTexts: string[];
    sequence: string[];
    items: Array<{
        termText: string;
        definitionTexts: string[];
    }>;
}

interface ParagraphSplitBoundary {
    nodeIndex: number;
    textOffset?: number;
}

interface InactiveDefinitionMarkerPlan {
    block: HTMLElement;
    paragraph: HTMLElement;
    movableNodes: Node[];
}

interface DefinitionBlockSets {
    active: PandocDefinitionListBlock[];
    inactiveLazy: PandocDefinitionListBlock[];
}

type DefinitionBlockRenderer = (block: PandocDefinitionListBlock) => HTMLElement;

const BLOCK_CONTENT_TAGS = new Set([
    'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DETAILS', 'DIV', 'DL',
    'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2',
    'H3', 'H4', 'H5', 'H6', 'HEADER', 'HGROUP', 'HR', 'LI', 'MAIN',
    'MENU', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'UL'
]);

const lazyDefinitionRestorations = new WeakMap<HTMLElement, LazyDefinitionRestoration>();
const inactiveLazySplits = new WeakMap<HTMLElement, {
    blockKey: string;
    markerBlocks: HTMLElement[];
}>();

export function normalizeExistingDefinitionLists(
    element: HTMLElement,
    context?: MarkdownPostProcessorContext,
    config?: ProcessorConfig,
    renderContext?: RenderContext,
    fullSourceText?: string
): void {
    if (context && config && normalizeDefinitionListsFromSource(element, context, config, renderContext, fullSourceText)) {
        return;
    }

    normalizeDefinitionListsFromDom(element);
}

export async function normalizeExistingDefinitionListsWithHost(
    element: HTMLElement,
    context: ReadingModeContext,
    fullSourceText: string,
    isCurrent: () => boolean = () => true
): Promise<void> {
    const blocks = getDefinitionBlockSets(fullSourceText, context.config);
    const rendered = await renderDefinitionBlocksWithHost(blocks, context, isCurrent);
    if (!rendered || !isCurrent()) {
        return;
    }

    normalizePreparedDefinitionLists(
        getReplacementRoot(element),
        fullSourceText,
        true,
        blocks,
        block => rendered.get(block) as HTMLElement
    );
}

function normalizeDefinitionListsFromSource(
    element: HTMLElement,
    context: MarkdownPostProcessorContext,
    config: ProcessorConfig,
    renderContext?: RenderContext,
    fullSourceText?: string
): boolean {
    const sectionInfo = fullSourceText ? null : getSourceSectionInfo(element, context);
    const sourceText = fullSourceText ?? sectionInfo?.text;
    if (!sourceText) {
        return false;
    }

    const replacement = getReplacementRoot(element);
    const blocks = getDefinitionBlockSets(sourceText, config);
    const renderer = new ReadingModeRenderer();
    const effectiveRenderContext = renderContext ?? {
        strictLineBreaks: config.strictLineBreaks
    };
    const renderBlock: DefinitionBlockRenderer = block =>
        renderPandocDefinitionListBlock(
            block,
            effectiveRenderContext,
            (target, content, context) => renderer.appendContent(target, content, context)
        );
    normalizePreparedDefinitionLists(
        replacement,
        sourceText,
        Boolean(fullSourceText),
        blocks,
        renderBlock
    );
    return true;
}

function normalizePreparedDefinitionLists(
    replacement: HTMLElement,
    sourceText: string,
    hasFullSource: boolean,
    blocks: DefinitionBlockSets,
    renderBlock: DefinitionBlockRenderer
): void {
    const usedCandidates = new Set<HTMLElement>();
    restoreInactiveLazyDefinitions(replacement, sourceText, blocks.inactiveLazy);
    normalizeInactiveLazyDefinitions(
        replacement,
        blocks.inactiveLazy,
        renderBlock,
        usedCandidates
    );
    if (blocks.active.length === 0) {
        return;
    }

    if (
        hasFullSource &&
        isStandalonePandocDefinitionList(sourceText, blocks.active) &&
        blocks.active.every(block => !block.joinsLazyContainer)
    ) {
        const rendered = blocks.active.map(renderBlock);
        replacement.replaceChildren(...rendered);
        return;
    }

    blocks.active.forEach(block => {
        const rendered = [renderBlock(block)];
        replaceDefinitionListContent(replacement, rendered, block, usedCandidates);
    });
}

function getDefinitionBlockSets(
    sourceText: string,
    config: ProcessorConfig
): DefinitionBlockSets {
    return {
        active: findPandocDefinitionListBlocks(sourceText, config),
        inactiveLazy: config.enableListsWithoutPrecedingBlankline
            ? findPandocDefinitionListBlocks(sourceText, {
                enableListsWithoutPrecedingBlankline: false
            }).filter(block => block.joinsLazyContainer)
            : []
    };
}

async function renderDefinitionBlocksWithHost(
    blocks: DefinitionBlockSets,
    context: ReadingModeContext,
    isCurrent: () => boolean
): Promise<Map<PandocDefinitionListBlock, HTMLElement> | null> {
    const sourceBlocks = [...blocks.inactiveLazy, ...blocks.active];
    if (!isCurrent()) {
        return null;
    }
    const lists = await Promise.all(sourceBlocks.map(block =>
        renderDefinitionBlockWithHost(block, context)
    ));
    if (!isCurrent() || lists.some(list => list === null)) {
        return null;
    }
    return new Map(sourceBlocks.map((block, index) => [
        block,
        lists[index] as HTMLElement
    ]));
}

function normalizeDefinitionListsFromDom(element: HTMLElement): void {
    const lists = getDefinitionLists(element);
    lists.forEach(list => {
        const firstTerm = list.querySelector('dt');
        if (!firstTerm || firstTerm.textContent?.trim()) {
            return;
        }

        const termText = extractDroppedDefinitionTerm(list);
        if (termText) {
            firstTerm.textContent = termText;
        }
    });
}

function getSourceSectionInfo(
    element: HTMLElement,
    context: MarkdownPostProcessorContext
): ReturnType<MarkdownPostProcessorContext['getSectionInfo']> {
    const section = getMarkdownSection(element);
    return safeGetContextSectionInfo(context, element) ??
        safeGetContextSectionInfo(context, section) ??
        safeGetDomSectionInfo(section);
}

function safeGetContextSectionInfo(
    context: MarkdownPostProcessorContext,
    element: HTMLElement | null
): ReturnType<MarkdownPostProcessorContext['getSectionInfo']> {
    if (!element || typeof context.getSectionInfo !== 'function') {
        return null;
    }

    try {
        return context.getSectionInfo(element);
    } catch {
        return null;
    }
}

function safeGetDomSectionInfo(
    section: HTMLElement | null
): ReturnType<MarkdownPostProcessorContext['getSectionInfo']> {
    if (!section || typeof getSectionInfo !== 'function') {
        return null;
    }

    return getSectionInfo(section);
}

function getReplacementRoot(element: HTMLElement): HTMLElement {
    return getMarkdownSection(element) ?? element;
}

function getMarkdownSection(element: HTMLElement): HTMLElement | null {
    if (element.classList.contains('markdown-preview-section')) {
        return element;
    }

    return element.closest('.markdown-preview-section');
}

function getDefinitionLists(element: HTMLElement): HTMLElement[] {
    const lists = Array.from(
        element.querySelectorAll<HTMLElement>(`dl.${CSS_CLASSES.DEFINITION_LIST}`)
    );
    if (element.matches(`dl.${CSS_CLASSES.DEFINITION_LIST}`)) {
        return [element, ...lists];
    }
    return lists;
}

function replaceDefinitionListContent(
    root: HTMLElement,
    replacementNodes: Node[],
    block: PandocDefinitionListBlock,
    usedCandidates: Set<HTMLElement>
): void {
    const signature = getDefinitionDomSignature(replacementNodes, block);
    if (block.nativeListParentIndex !== undefined) {
        replaceNativeListDefinition(
            root,
            replacementNodes,
            block.nativeListParentIndex,
            signature,
            usedCandidates
        );
        markInsertedDefinitionCandidates(root, replacementNodes, usedCandidates);
        return;
    }

    const candidates = getDefinitionListBlockCandidates(
        root,
        block,
        usedCandidates,
        signature
    );
    if (candidates.length === 0) {
        return;
    }

    if (!block.joinsLazyContainer &&
        !containsCompleteDefinitionBlockCandidateText(candidates, signature)) {
        return;
    }

    if (block.joinsLazyContainer && replaceLazyContainerDefinition(
        candidates,
        replacementNodes,
        block,
        signature,
        usedCandidates
    )) {
        markInsertedDefinitionCandidates(root, replacementNodes, usedCandidates);
        return;
    }

    if (isCanonicalDefinitionBlockCandidate(candidates, signature)) {
        candidates.forEach(candidate => usedCandidates.add(candidate));
        return;
    }

    if (candidates[0] === root) {
        candidates.forEach(candidate => usedCandidates.add(candidate));
        root.replaceChildren(...replacementNodes);
        markInsertedDefinitionCandidates(root, replacementNodes, usedCandidates);
        return;
    }

    const [firstCandidate, ...extraCandidates] = candidates;
    candidates.forEach(candidate => usedCandidates.add(candidate));
    replaceDefinitionListCandidate(firstCandidate, replacementNodes);
    extraCandidates.forEach(candidate => candidate.remove());
    markInsertedDefinitionCandidates(root, replacementNodes, usedCandidates);
}

function markInsertedDefinitionCandidates(
    root: HTMLElement,
    replacementNodes: Node[],
    usedCandidates: Set<HTMLElement>
): void {
    replacementNodes.forEach(node => {
        if (isHtmlElement(node) && root.contains(node)) {
            usedCandidates.add(getDefinitionListBlockCandidate(node, root));
        }
    });
}

function replaceNativeListDefinition(
    root: HTMLElement,
    replacementNodes: Node[],
    sourceLine: number,
    signature: DefinitionDomSignature,
    usedCandidates: Set<HTMLElement>
): void {
    const list = replacementNodes.length === 1 &&
        isHtmlElement(replacementNodes[0]) &&
        replacementNodes[0].matches(`dl.${CSS_CLASSES.DEFINITION_LIST}`)
        ? replacementNodes[0]
        : null;
    if (!list) {
        return;
    }
    reconcileNativeListDefinition({
        root,
        replacement: list,
        sourceLine,
        usedCandidates,
        getTextWithLineBreaks: getTextFromNodes,
        matchesCanonicalList: candidate =>
            getDefinitionListSequence(candidate).join('\n') === signature.sequence.join('\n'),
        matchesRawDefinition: text =>
            matchesCompleteRawDefinitionText(text, signature)
    });
}

function replaceLazyContainerDefinition(
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

function restoreInactiveLazyDefinitions(
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

function getDefinitionDomSignature(
    nodes: Node[],
    block: PandocDefinitionListBlock
): DefinitionDomSignature {
    const list = nodes.find((node): node is HTMLElement =>
        isHtmlElement(node) &&
        node.matches(`dl.${CSS_CLASSES.DEFINITION_LIST}`)
    );
    if (!list) {
        const items = block.items.map(item => ({
            termText: normalizeCandidateText(item.term),
            definitionTexts: item.definitions.map(definition =>
                normalizeCandidateText(definition.plainText)
            )
        }));
        return {
            termTexts: items.map(item => item.termText),
            definitionTexts: items.flatMap(item => item.definitionTexts),
            sequence: items.flatMap(item => [item.termText, ...item.definitionTexts]),
            items
        };
    }

    const items = getDefinitionListItemSignatures(list);
    return {
        termTexts: items.map(item => item.termText),
        definitionTexts: items.flatMap(item => item.definitionTexts),
        sequence: items.flatMap(item => [item.termText, ...item.definitionTexts]),
        items
    };
}

function getDefinitionListItemSignatures(list: HTMLElement): DefinitionDomSignature['items'] {
    const items: DefinitionDomSignature['items'] = [];
    Array.from(list.children).forEach(child => {
        if (child.tagName === 'DT') {
            items.push({
                termText: normalizeCandidateText(getComparableElementText(child)),
                definitionTexts: []
            });
            return;
        }
        if (child.tagName === 'DD' && items.length > 0) {
            items[items.length - 1].definitionTexts.push(
                normalizeCandidateText(getComparableElementText(child))
            );
        }
    });
    return items;
}

function normalizeInactiveLazyDefinitions(
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
    if (pendingMarkerPlans.some(plan => plan === null)) {
        return false;
    }
    const markerPlans = pendingMarkerPlans as InactiveDefinitionMarkerPlan[];
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
        plan.movableNodes?.forEach(node => plan.paragraph.appendChild(node));
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

function createInactiveDefinitionMarkerPlan(
    renderedDefinition: HTMLElement,
    sourceDefinition: PandocDefinitionDescription,
    definitionContainerDepth: number
): InactiveDefinitionMarkerPlan | null {
    const paragraph = renderedDefinition.ownerDocument.createElement('p');
    paragraph.setAttribute('dir', 'auto');
    const inlineNodes = getInlineContentNodes(renderedDefinition, true);
    const listItemPlan = inlineNodes
        ? null
        : getSourceOwnedListItemContent(renderedDefinition, sourceDefinition);
    if (!inlineNodes && !listItemPlan) {
        return null;
    }
    const movableNodes = inlineNodes ?? listItemPlan?.nodes ?? [];
    const hasContent = sourceDefinition.lines.some(line => line.trim().length > 0);
    const prefix = listItemPlan?.prefix ??
        (hasContent ? `${sourceDefinition.marker} ` : sourceDefinition.marker);
    paragraph.appendChild(renderedDefinition.ownerDocument.createTextNode(prefix));

    if (definitionContainerDepth > 0) {
        return { block: paragraph, paragraph, movableNodes };
    }
    const wrapper = renderedDefinition.ownerDocument.createElement('div');
    wrapper.className = 'el-p';
    wrapper.appendChild(paragraph);
    return { block: wrapper, paragraph, movableNodes };
}

function getSourceOwnedListItemContent(
    renderedDefinition: HTMLElement,
    sourceDefinition: PandocDefinitionDescription
): { prefix: string, nodes: Node[] } | null {
    const lines = trimOuterBlankLines(sourceDefinition.lines);
    if (lines.length !== 1) {
        return null;
    }
    const sourceItem = parseMarkdownListItem(lines[0]);
    const marker = lines[0].match(/^((?:[-+*]|\d+[.)])[ \t]+)/)?.[1];
    if (!sourceItem || sourceItem.checked !== undefined || !marker) {
        return null;
    }

    const list = getOnlyMeaningfulElementChild(
        renderedDefinition,
        sourceItem.ordered ? 'OL' : 'UL'
    );
    const item = list && list.children.length === 1 && list.children[0].tagName === 'LI'
        ? list.children[0] as HTMLElement
        : null;
    const nodes = item ? getInlineContentNodes(item, false) : null;
    if (!nodes) {
        return null;
    }
    return {
        prefix: `${sourceDefinition.marker} ${marker}`,
        nodes
    };
}

function getOnlyMeaningfulElementChild(
    parent: HTMLElement,
    tagName: string
): HTMLElement | null {
    const meaningful = Array.from(parent.childNodes).filter(node =>
        node.nodeType !== Node.TEXT_NODE || (node.textContent ?? '').trim().length > 0
    );
    return meaningful.length === 1 && isHtmlElement(meaningful[0]) &&
        meaningful[0].tagName === tagName
        ? meaningful[0]
        : null;
}

function getInlineContentNodes(element: HTMLElement, unwrapParagraph: boolean): Node[] | null {
    const children = Array.from(element.childNodes);
    const meaningfulChildren = children.filter(node =>
        node.nodeType !== Node.TEXT_NODE || (node.textContent ?? '').trim().length > 0
    );
    const contentNodes = unwrapParagraph && meaningfulChildren.length === 1 &&
        isHtmlElement(meaningfulChildren[0]) && meaningfulChildren[0].tagName === 'P'
        ? Array.from(meaningfulChildren[0].childNodes)
        : children;
    return contentNodes.every(isInlineContentNode) ? contentNodes : null;
}

function isInlineContentNode(node: Node): boolean {
    if (!isHtmlElement(node)) {
        return true;
    }
    return !BLOCK_CONTENT_TAGS.has(node.tagName) &&
        Array.from(node.childNodes).every(isInlineContentNode);
}

function getColdListReplacementTarget(list: HTMLElement): HTMLElement | null {
    const parent = list.parentElement;
    if (!parent) {
        return null;
    }
    if (parent.tagName !== 'P') {
        return parent.tagName === 'BLOCKQUOTE' || parent.tagName === 'DIV' ? list : null;
    }
    return hasOnlyWhitespaceSiblings(parent, list) ? parent : null;
}

function hasOnlyWhitespaceSiblings(parent: HTMLElement, child: HTMLElement): boolean {
    return Array.from(parent.childNodes).every(node =>
        node === child ||
        (node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim().length === 0)
    );
}

function hasNestedListContainer(
    list: HTMLElement,
    layout: HTMLElement | null
): boolean {
    let current = list.parentElement;
    while (current && current !== layout) {
        if (current.matches('li, dt, dd, dl, ol, ul')) {
            return true;
        }
        current = current.parentElement;
    }
    return !current;
}

function preflightInactiveDefinitionSplit(
    list: HTMLElement,
    replacementTarget: HTMLElement,
    markerContainer: HTMLElement,
    layout: HTMLElement,
    termNodes: Node[],
    definitions: HTMLElement[],
    markerPlans: InactiveDefinitionMarkerPlan[]
): boolean {
    if (!replacementTarget.parentNode || layout.parentNode !== markerContainer ||
        (!replacementTarget.contains(list) && replacementTarget !== list)) {
        return false;
    }
    if (termNodes.some(node => !list.contains(node))) {
        return false;
    }
    return markerPlans.every((plan, index) =>
        plan.movableNodes.every(node => definitions[index]?.contains(node))
    );
}

function isHtmlElement(node: Node): node is HTMLElement {
    return node.nodeType === Node.ELEMENT_NODE;
}

function findParagraphSplitBoundary(
    nodes: Node[],
    signature: DefinitionDomSignature
): ParagraphSplitBoundary | null {
    for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
        const node = nodes[nodeIndex];
        if (node.nodeName === 'BR' && matchesParagraphSplit(
            getTextFromNodes(nodes.slice(0, nodeIndex)),
            getTextFromNodes(nodes.slice(nodeIndex + 1)),
            signature
        )) {
            return { nodeIndex };
        }
        if (node.nodeType !== Node.TEXT_NODE) {
            continue;
        }
        const text = node.textContent ?? '';
        for (let textOffset = 0; textOffset < text.length; textOffset++) {
            if (text[textOffset] !== '\n') {
                continue;
            }
            const before = getTextFromNodes(nodes.slice(0, nodeIndex)) +
                text.slice(0, textOffset);
            const after = text.slice(textOffset + 1) +
                getTextFromNodes(nodes.slice(nodeIndex + 1));
            if (matchesParagraphSplit(before, after, signature)) {
                return { nodeIndex, textOffset };
            }
        }
    }
    return null;
}

function matchesParagraphSplit(
    before: string,
    after: string,
    signature: DefinitionDomSignature
): boolean {
    return signature.termTexts.length === 1 &&
        normalizeCandidateText(before) === normalizeCandidateText(signature.termTexts[0]) &&
        matchesDefinitionDescriptions(after, signature.definitionTexts);
}

function detachMarkerNodes(nodes: Node[], boundary: ParagraphSplitBoundary): Node[] {
    const node = nodes[boundary.nodeIndex];
    if (boundary.textOffset === undefined) {
        node.parentNode?.removeChild(node);
        return nodes.slice(boundary.nodeIndex + 1);
    }

    const text = node as Text;
    const markerText = text.splitText(boundary.textOffset + 1);
    text.deleteData(boundary.textOffset, 1);
    if (text.data.length === 0) {
        text.remove();
    }
    return [markerText, ...nodes.slice(boundary.nodeIndex + 1)];
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

function replaceDefinitionListCandidate(candidate: HTMLElement, replacementNodes: Node[]): void {
    if (candidate.classList.contains('el-p')) {
        candidate.replaceChildren(...replacementNodes);
        return;
    }

    firstLayoutWrapper(candidate)?.replaceChildren(...replacementNodes);
    if (!candidate.parentNode) {
        return;
    }

    candidate.replaceWith(...replacementNodes);
}

function firstLayoutWrapper(candidate: HTMLElement): HTMLElement | null {
    const parent = candidate.parentElement;
    if (!parent?.classList.contains('el-p')) {
        return null;
    }

    return parent;
}

function getDefinitionListBlockCandidates(
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

function getDirectLayoutChild(root: HTMLElement, candidate: HTMLElement): HTMLElement | null {
    let current: HTMLElement | null = candidate;
    while (current?.parentElement && current.parentElement !== root) {
        current = current.parentElement;
    }
    return current?.parentElement === root ? current : null;
}

function getBlockQuoteDepthInRoot(root: HTMLElement, element: HTMLElement): number {
    return getBlockQuoteAncestors(root, element).length;
}

function getBlockQuoteContainer(
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

function containsCompleteDefinitionBlockCandidateText(
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

function getRequiredDefinitionBlockTexts(block: PandocDefinitionListBlock): string[] {
    return [...block.termTexts, ...block.definitionTexts]
        .map(normalizeCandidateText)
        .filter(text => text.length > 0);
}

function isCanonicalDefinitionBlockCandidate(
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

function getSingleDefinitionList(candidate: HTMLElement): HTMLElement | null {
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

function getDefinitionListSequence(list: HTMLElement): string[] {
    return Array.from(list.children)
        .filter(child => child.tagName === 'DT' || child.tagName === 'DD')
        .map(child => normalizeCandidateText(getComparableElementText(child)));
}

function getComparableElementText(element: Element): string {
    const parts: string[] = [];
    element.childNodes.forEach(node => appendComparableNodeText(node, parts));
    return parts.join('');
}

function appendComparableNodeText(node: Node, parts: string[]): void {
    if (node.nodeName === 'BR') {
        parts.push(' ');
        return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.textContent ?? '');
        return;
    }
    if (!isHtmlElement(node)) {
        return;
    }

    const separatesText = BLOCK_CONTENT_TAGS.has(node.tagName);
    if (separatesText) {
        parts.push(' ');
    }
    node.childNodes.forEach(child => appendComparableNodeText(child, parts));
    if (separatesText) {
        parts.push(' ');
    }
}

function getDefinitionBlockSequence(block: PandocDefinitionListBlock): string[] {
    const sequence: string[] = [];
    block.items.forEach(item => {
        sequence.push(normalizeCandidateText(item.term));
        item.definitions.forEach(definition => {
            sequence.push(normalizeCandidateText(definition.plainText));
        });
    });
    return sequence;
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

function getDefinitionListCandidates(
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

function getDefinitionListBlockCandidate(list: HTMLElement, root: HTMLElement): HTMLElement {
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

function sortCandidatesByDocumentOrder(candidates: HTMLElement[]): HTMLElement[] {
    return [...candidates].sort((a, b) => {
        if (a === b) {
            return 0;
        }
        return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING ? 1 : -1;
    });
}

function matchesDefinitionBlockText(
    element: HTMLElement,
    signature: DefinitionDomSignature
): boolean {
    const text = normalizeCandidateText(element.textContent ?? '');
    return signature.termTexts.some(term => text.includes(normalizeCandidateText(term))) ||
        signature.definitionTexts.some(definition => text.includes(normalizeCandidateText(definition)));
}

function matchesDefinitionMarkerText(text: string, definitionTexts: string[]): boolean {
    const markerMatch = normalizeCandidateText(text).match(/^[:~•]\s*(.*)$/);
    if (!markerMatch) {
        return false;
    }

    const content = normalizeCandidateText(markerMatch[1]);
    return definitionTexts.some(definition => content === normalizeCandidateText(definition));
}

function matchesLiteralMarkerTermText(text: string, termTexts: string[]): boolean {
    const normalizedText = normalizeCandidateText(text);
    return /^[:~]\s+\S/.test(normalizedText) && termTexts.some(term =>
        normalizedText === normalizeCandidateText(term)
    );
}

function matchesCompleteRawDefinitionText(
    text: string,
    signature: DefinitionDomSignature
): boolean {
    const lines = text.split('\n')
        .map(normalizeCandidateText)
        .filter(line => line.length > 0);
    return matchRawDefinitionItem(lines, 0, signature.items, 0) === lines.length;
}

function matchRawDefinitionItem(
    lines: string[],
    lineIndex: number,
    items: DefinitionDomSignature['items'],
    itemIndex: number
): number {
    const item = items[itemIndex];
    if (!item || lines[lineIndex] !== normalizeCandidateText(item.termText)) {
        return -1;
    }
    return matchRawDefinitionDescription(
        lines,
        lineIndex + 1,
        items,
        itemIndex,
        0
    );
}

function matchRawDefinitionDescription(
    lines: string[],
    markerLine: number,
    items: DefinitionDomSignature['items'],
    itemIndex: number,
    definitionIndex: number
): number {
    const item = items[itemIndex];
    const expected = item?.definitionTexts[definitionIndex];
    const marker = lines[markerLine]?.match(/^[:~•]\s*(.*)$/);
    if (expected === undefined || !marker) {
        return -1;
    }

    for (let end = markerLine + 1; end <= lines.length; end++) {
        const content = normalizeCandidateText([
            marker[1],
            ...lines.slice(markerLine + 1, end).map(getRenderedBlockContent)
        ].join(' '));
        if (content !== normalizeCandidateText(expected)) {
            continue;
        }

        const next = definitionIndex + 1 < item.definitionTexts.length
            ? matchRawDefinitionDescription(
                lines,
                end,
                items,
                itemIndex,
                definitionIndex + 1
            )
            : itemIndex + 1 < items.length
                ? matchRawDefinitionItem(lines, end, items, itemIndex + 1)
                : end;
        if (next >= 0) {
            return next;
        }
    }
    return -1;
}

function matchesRawDefinitionParagraphText(
    text: string,
    signature: DefinitionDomSignature
): boolean {
    const lines = text.split('\n')
        .map(normalizeCandidateText)
        .filter(line => line.length > 0);
    if (lines.length < 2) {
        return false;
    }
    return signature.items.some(item =>
        lines[0] === normalizeCandidateText(item.termText) &&
        matchesDefinitionDescriptions(
            lines.slice(1).join('\n'),
            item.definitionTexts
        )
    );
}

function matchesDefinitionDescriptions(text: string, expected: string[]): boolean {
    const definitions = getRawDefinitionDescriptions(text);
    return definitions !== null && definitions.length === expected.length &&
        definitions.every((definition, index) =>
            definition === normalizeCandidateText(expected[index])
        );
}

function getRawDefinitionDescriptions(text: string): string[] | null {
    const lines = text.split('\n')
        .map(normalizeCandidateText)
        .filter(line => line.length > 0);
    const definitions: string[] = [];
    let current: string | null = null;
    for (const line of lines) {
        const marker = line.match(/^[:~•]\s*(.*)$/);
        if (marker) {
            if (current !== null) {
                definitions.push(normalizeCandidateText(current));
            }
            current = marker[1];
            continue;
        }
        if (current === null) {
            return null;
        }
        current += ` ${getRenderedBlockContent(line)}`;
    }
    if (current !== null) {
        definitions.push(normalizeCandidateText(current));
    }
    return definitions;
}

function getRenderedBlockContent(line: string): string {
    const listMarker = parsePandocListMarker(line, true);
    if (listMarker && listMarker.kind !== 'definition') {
        return line.slice(listMarker.markerEnd)
            .trimStart()
            .replace(/^\[[ xX]\]\s*/, '');
    }

    let content = line;
    while (/^ {0,3}>[ \t]?/.test(content)) {
        content = content.replace(/^ {0,3}>[ \t]?/, '');
    }
    return content;
}

function normalizeCandidateText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
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

function extractDroppedDefinitionTerm(list: HTMLElement): string | null {
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

function getTextWithLineBreaks(elem: Element): string {
    const parts: string[] = [];
    elem.childNodes.forEach(node => appendNodeText(node, parts));
    return parts.join('');
}

function getTextFromNodes(nodes: Node[]): string {
    const parts: string[] = [];
    nodes.forEach(node => appendNodeText(node, parts));
    return parts.join('');
}

function appendNodeText(node: Node, parts: string[]): void {
    if (node.nodeName === 'BR') {
        parts.push('\n');
        return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.textContent || '');
        return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
    }
    const element = node as Element;
    if (element.nodeName === 'PRE') {
        return;
    }
    if (element.nodeName === 'CODE') {
        parts.push(element.textContent ?? '');
        return;
    }
    node.childNodes.forEach(child => appendNodeText(child, parts));
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
