import { MarkdownPostProcessorContext } from 'obsidian';

import { CSS_CLASSES } from '../../../core/constants';
import { getSectionInfo } from '../../../shared/types/obsidian-extended';
import { ProcessorConfig } from '../../../shared/types/processorConfig';

import { ReadingModeRenderer, RenderContext } from '../extended-lists/lineRenderer';
import { ReadingModeContext } from '../../pipeline/types';
import {
    containsCompleteDefinitionBlockCandidateText,
    extractDroppedDefinitionTerm,
    getDefinitionListBlockCandidate,
    getDefinitionListBlockCandidates,
    getDefinitionLists,
    isCanonicalDefinitionBlockCandidate
} from './definitionCandidateMatcher';
import {
    type DefinitionDomSignature,
    getDefinitionDomSignature,
    getDefinitionListSequence
} from './definitionSignature';
import {
    getTextFromNodes,
    matchesCompleteRawDefinitionText
} from './definitionTextMatcher';
import { renderDefinitionBlockWithHost } from './hostRenderer';
import {
    type DefinitionBlockRenderer,
    normalizeInactiveLazyDefinitions,
    replaceLazyContainerDefinition,
    restoreInactiveLazyDefinitions
} from './inactiveLazyDefinitionNormalizer';
import { reconcileNativeListDefinition } from './nativeListReconciler';
import {
    findPandocDefinitionListBlocks,
    isStandalonePandocDefinitionList,
    PandocDefinitionListBlock
} from './sourceParser';
import {
    renderPandocDefinitionListBlock
} from './sourceRenderer';

interface DefinitionBlockSets {
    active: PandocDefinitionListBlock[];
    inactiveLazy: PandocDefinitionListBlock[];
}

// Public orchestration: prefer source-backed reconstruction when source is available.
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

// DOM-only compatibility path used when the host cannot provide source text.
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

// Source-backed active definition-list replacement.
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

function isHtmlElement(node: Node): node is HTMLElement {
    return node.instanceOf(HTMLElement);
}
