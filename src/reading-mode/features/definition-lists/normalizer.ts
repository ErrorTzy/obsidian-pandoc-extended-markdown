import { MarkdownPostProcessorContext } from 'obsidian';

import { CSS_CLASSES } from '../../../core/constants';
import { getSectionInfo } from '../../../shared/types/obsidian-extended';
import { ProcessorConfig } from '../../../shared/types/processorConfig';

import { ReadingModeRenderer, RenderContext } from '../extended-lists/lineRenderer';
import {
    findPandocDefinitionListBlocks,
    isStandalonePandocDefinitionList,
    PandocDefinitionListBlock
} from './sourceParser';
import {
    renderPandocDefinitionListBlock
} from './sourceRenderer';

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

    const blocks = findPandocDefinitionListBlocks(sourceText);
    if (blocks.length === 0) {
        return true;
    }

    const renderer = new ReadingModeRenderer();
    const replacement = getReplacementRoot(element);
    const effectiveRenderContext = renderContext ?? {
        strictLineBreaks: config.strictLineBreaks
    };

    if (
        fullSourceText &&
        isStandalonePandocDefinitionList(sourceText, blocks)
    ) {
        const rendered = blocks.map(block => renderPandocDefinitionListBlock(
            block,
            effectiveRenderContext,
            (target, content, context) => renderer.appendContent(target, content, context)
        ));
        replacement.replaceChildren(...rendered);
        return true;
    }

    if (fullSourceText || sectionInfo?.text) {
        const usedCandidates = new Set<HTMLElement>();
        blocks.forEach(block => {
            if (!containsCompleteDefinitionBlockText(replacement, block)) {
                return;
            }

            const rendered = [renderPandocDefinitionListBlock(
                block,
                effectiveRenderContext,
                (target, content, context) => renderer.appendContent(target, content, context)
            )];
            replaceDefinitionListContent(replacement, rendered, block, usedCandidates);
        });
    }
    return true;
}

function containsCompleteDefinitionBlockText(
    element: HTMLElement,
    block: PandocDefinitionListBlock
): boolean {
    return containsRequiredDefinitionBlockText(element.textContent ?? '', block);
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
    const candidates = getDefinitionListBlockCandidates(root, block, usedCandidates);
    if (candidates.length === 0) {
        return;
    }

    if (!containsCompleteDefinitionBlockCandidateText(candidates, block)) {
        return;
    }

    if (isCanonicalDefinitionBlockCandidate(candidates, block)) {
        candidates.forEach(candidate => usedCandidates.add(candidate));
        return;
    }

    if (candidates[0] === root) {
        candidates.forEach(candidate => usedCandidates.add(candidate));
        root.replaceChildren(...replacementNodes);
        return;
    }

    const [firstCandidate, ...extraCandidates] = candidates;
    candidates.forEach(candidate => usedCandidates.add(candidate));
    replaceDefinitionListCandidate(firstCandidate, replacementNodes);
    extraCandidates.forEach(candidate => candidate.remove());
}

function replaceDefinitionListCandidate(candidate: HTMLElement, replacementNodes: Node[]): void {
    if (candidate.classList.contains('el-p')) {
        candidate.replaceChildren(...replacementNodes);
        return;
    }

    firstLayoutWrapper(candidate)?.replaceChildren(...replacementNodes);
    if (!candidate.isConnected) {
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
    usedCandidates: Set<HTMLElement>
): HTMLElement[] {
    const candidates = getDefinitionCandidateElements(root, block)
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

function containsCompleteDefinitionBlockCandidateText(
    candidates: HTMLElement[],
    block: PandocDefinitionListBlock
): boolean {
    return containsRequiredDefinitionBlockText(
        candidates.map(candidate => candidate.textContent ?? '').join('\n'),
        block
    );
}

function containsRequiredDefinitionBlockText(
    text: string,
    block: PandocDefinitionListBlock
): boolean {
    const normalizedText = normalizeCandidateText(text);
    return getRequiredDefinitionBlockTexts(block)
        .every(requiredText => normalizedText.includes(requiredText));
}

function getRequiredDefinitionBlockTexts(block: PandocDefinitionListBlock): string[] {
    return [...block.termTexts, ...block.definitionTexts]
        .map(normalizeCandidateText)
        .filter(text => text.length > 0);
}

function isCanonicalDefinitionBlockCandidate(
    candidates: HTMLElement[],
    block: PandocDefinitionListBlock
): boolean {
    if (candidates.length !== 1) {
        return false;
    }

    const list = getSingleDefinitionList(candidates[0]);
    if (!list || hasRawDefinitionMarkerText(candidates[0])) {
        return false;
    }

    return getDefinitionListSequence(list).join('\n') ===
        getDefinitionBlockSequence(block).join('\n');
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
        .map(child => normalizeCandidateText(child.textContent ?? ''));
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

function getDefinitionCandidateElements(root: HTMLElement, block: PandocDefinitionListBlock): HTMLElement[] {
    const candidates = getDefinitionListCandidates(root, block);
    getDefinitionMarkerCandidates(root, block).forEach(candidate => {
        addUniqueCandidate(candidates, candidate);
    });
    return sortCandidatesByDocumentOrder(candidates);
}

function getDefinitionListCandidates(root: HTMLElement, block: PandocDefinitionListBlock): HTMLElement[] {
    const candidates: HTMLElement[] = [];
    getDefinitionLists(root).forEach(list => {
        if (matchesDefinitionBlockText(list, block)) {
            addUniqueCandidate(candidates, getDefinitionListBlockCandidate(list, root));
        }
    });
    return candidates;
}

function getDefinitionMarkerCandidates(root: HTMLElement, block: PandocDefinitionListBlock): HTMLElement[] {
    const candidates: HTMLElement[] = [];
    root.querySelectorAll<HTMLElement>('.el-p, p, li').forEach(element => {
        if (element.querySelector(`dl.${CSS_CLASSES.DEFINITION_LIST}`)) {
            return;
        }
        const text = getTextWithLineBreaks(element);
        if (
            matchesDefinitionMarkerText(text, block.definitionTexts) ||
            matchesRawDefinitionParagraphText(text, block)
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

function matchesDefinitionBlockText(element: HTMLElement, block: PandocDefinitionListBlock): boolean {
    const text = normalizeCandidateText(element.textContent ?? '');
    return block.termTexts.some(term => text.includes(normalizeCandidateText(term))) ||
        block.definitionTexts.some(definition => text.includes(normalizeCandidateText(definition)));
}

function matchesDefinitionMarkerText(text: string, definitionTexts: string[]): boolean {
    const markerMatch = normalizeCandidateText(text).match(/^[:~•]\s*(.*)$/);
    if (!markerMatch) {
        return false;
    }

    const content = normalizeCandidateText(markerMatch[1]);
    return definitionTexts.some(definition => content === normalizeCandidateText(definition));
}

function matchesRawDefinitionParagraphText(text: string, block: PandocDefinitionListBlock): boolean {
    const lines = text.split('\n')
        .map(normalizeCandidateText)
        .filter(line => line.length > 0);
    const hasTerm = block.termTexts.some(term =>
        lines.includes(normalizeCandidateText(term))
    );
    const hasDefinition = lines.some(line =>
        matchesDefinitionMarkerText(line, block.definitionTexts)
    );

    return hasTerm && hasDefinition;
}

function normalizeCandidateText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

function hasOnlyIgnorableContentBetween(previous: HTMLElement, next: HTMLElement): boolean {
    if (previous.parentElement !== next.parentElement) {
        return true;
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

    if (node.nodeType === Node.ELEMENT_NODE && !isCodeElement(node as Element)) {
        node.childNodes.forEach(child => appendNodeText(child, parts));
    }
}

function isCodeElement(element: Element): boolean {
    return element.nodeName === 'CODE' || element.nodeName === 'PRE';
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
