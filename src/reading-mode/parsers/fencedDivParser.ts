import { setTooltip } from 'obsidian';

import { CSS_CLASSES, DECORATION_STYLES } from '../../core/constants';
import { pluginStateManager } from '../../core/state/pluginStateManager';
import { FencedDivReference } from '../../shared/types/fencedDivTypes';
import { ProcessorConfig } from '../../shared/types/processorConfig';
import {
    getFencedDivCssClass,
    getFencedDivDisplayName,
    isFencedDivClosing,
    parseFencedDivOpening
} from '../../live-preview/pipeline/structural/fencedDiv/parser';

const PANDOC_CITATION_REFERENCE = /@([^\s,;)\]}]+)/g;
const TRAILING_REFERENCE_PUNCTUATION = /[.!?]+$/;
const MAX_DEPTH_CLASS = 6;
const pendingSectionProcessing = new WeakMap<HTMLElement, number>();
const chunkStacks = new Map<string, ActiveFencedDiv[]>();

interface ActiveFencedDiv {
    contentElement: HTMLElement;
    contentLines: string[];
    reference: FencedDivReference;
}

export function scheduleFencedDivProcessing(
    element: HTMLElement,
    docPath: string,
    config: ProcessorConfig
): void {
    if (config.enableFencedDivs === false) {
        return;
    }

    const section = element.closest('.markdown-preview-section');
    if (!section) {
        processFencedDivs(element, docPath, config, true);
        return;
    }

    const pending = pendingSectionProcessing.get(section);
    if (pending !== undefined) {
        window.clearTimeout(pending);
    }

    const timeout = window.setTimeout(() => {
        pendingSectionProcessing.delete(section);
        processFencedDivs(section, docPath, config);
    }, 0);

    pendingSectionProcessing.set(section, timeout);
}

export function processFencedDivs(
    element: HTMLElement,
    docPath: string,
    config: ProcessorConfig,
    preserveStack: boolean = false
): void {
    if (config.enableFencedDivs === false) {
        return;
    }

    const labels = pluginStateManager.getDocumentCounters(docPath).fencedDivLabels;
    const stack = preserveStack
        ? getChunkStack(docPath)
        : [];
    const candidates = Array.from(element.querySelectorAll('p, li'));

    for (const candidate of candidates) {
        if (shouldSkipElement(candidate)) {
            continue;
        }

        const lineText = getTextWithLineBreaks(candidate);
        if (processMultilineCandidate(candidate, lineText, stack, labels)) {
            continue;
        }

        const opening = parseFencedDivOpening(lineText);
        if (opening) {
            const displayName = getFencedDivDisplayName(opening.classes);
            const reference: FencedDivReference = {
                label: opening.id || '',
                displayName,
                lineNumber: 0,
                classes: opening.classes,
                content: ''
            };
            const fencedDiv = createFencedDivElement(displayName, opening.id, opening.classes, stack.length + 1);

            if (opening.id && !labels.has(opening.id)) {
                labels.set(opening.id, reference);
            }

            insertFencedDiv(candidate, fencedDiv.block, stack);
            stack.push({
                contentElement: fencedDiv.content,
                contentLines: [],
                reference
            });
            continue;
        }

        if (isFencedDivClosing(lineText) && stack.length > 0) {
            const closed = stack.pop();
            if (closed) {
                closed.reference.content = closed.contentLines.join('\n').trim();
            }
            candidate.remove();
            continue;
        }

        if (stack.length > 0) {
            for (const active of stack) {
                active.contentLines.push(lineText);
                active.reference.content = active.contentLines.join('\n').trim();
            }
            stack[stack.length - 1].contentElement.appendChild(candidate);
        }
    }

    processFencedDivReferences(element, labels);

    if (preserveStack && stack.length === 0) {
        chunkStacks.delete(docPath);
    }
}

function getChunkStack(docPath: string): ActiveFencedDiv[] {
    let stack = chunkStacks.get(docPath);
    if (!stack) {
        stack = [];
        chunkStacks.set(docPath, stack);
    }

    return stack;
}

function processMultilineCandidate(
    candidate: Element,
    text: string,
    stack: ActiveFencedDiv[],
    labels: Map<string, FencedDivReference>
): boolean {
    if (!text.includes('\n')) {
        return false;
    }

    const lines = text.split('\n');
    if (!lines.some(line => parseFencedDivOpening(line) || isFencedDivClosing(line))) {
        return false;
    }

    const fragments: Node[] = [];
    for (const line of lines) {
        const opening = parseFencedDivOpening(line);
        if (opening) {
            const displayName = getFencedDivDisplayName(opening.classes);
            const reference: FencedDivReference = {
                label: opening.id || '',
                displayName,
                lineNumber: 0,
                classes: opening.classes,
                content: ''
            };
            const fencedDiv = createFencedDivElement(displayName, opening.id, opening.classes, stack.length + 1);

            if (opening.id && !labels.has(opening.id)) {
                labels.set(opening.id, reference);
            }

            appendRenderedLineNode(fencedDiv.block, fragments, stack);
            stack.push({
                contentElement: fencedDiv.content,
                contentLines: [],
                reference
            });
            continue;
        }

        if (isFencedDivClosing(line) && stack.length > 0) {
            const closed = stack.pop();
            if (closed) {
                closed.reference.content = closed.contentLines.join('\n').trim();
            }
            continue;
        }

        appendContentLine(line, fragments, stack);
    }

    if (stack.length > 0) {
        for (const active of stack) {
            active.reference.content = active.contentLines.join('\n').trim();
        }
    }

    replaceCandidateWithFragments(candidate, fragments);
    return true;
}

function createFencedDivElement(
    displayName: string,
    label: string | undefined,
    classes: string[],
    depth: number
): { block: HTMLElement, content: HTMLElement } {
    const block = document.createElement('div');
    const primaryClass = getFencedDivCssClass(classes);
    const depthClass = Math.min(depth, MAX_DEPTH_CLASS);
    block.className = [
        'pem-fenced-div',
        depth > 1 ? 'pem-fenced-div-inner' : undefined,
        depth > 1 ? `pem-fenced-div-depth-${depthClass}` : undefined,
        primaryClass ? `pem-fenced-div-${primaryClass}` : undefined
    ].filter(Boolean).join(' ');

    if (label) {
        block.dataset.pandocDivId = label;
    }

    const header = document.createElement('div');
    header.className = CSS_CLASSES.FENCED_DIV_HEADER;
    if (label) {
        header.dataset.pandocDivId = label;
        setTooltip(header, `#${label}`, { delay: DECORATION_STYLES.TOOLTIP_DELAY_MS });
    }

    const title = document.createElement('span');
    title.className = 'pem-fenced-div-title';
    title.textContent = `${displayName}:`;
    header.appendChild(title);

    const content = document.createElement('div');
    content.className = 'pem-fenced-div-content';

    block.appendChild(header);
    block.appendChild(content);

    return { block, content };
}

function appendContentLine(
    line: string,
    fragments: Node[],
    stack: ActiveFencedDiv[]
): void {
    const paragraph = document.createElement('p');
    paragraph.textContent = line;

    if (stack.length > 0) {
        for (const active of stack) {
            active.contentLines.push(line);
            active.reference.content = active.contentLines.join('\n').trim();
        }
    }

    appendRenderedLineNode(paragraph, fragments, stack);
}

function appendRenderedLineNode(
    node: Node,
    fragments: Node[],
    stack: ActiveFencedDiv[]
): void {
    const active = stack[stack.length - 1];
    if (active) {
        active.contentElement.appendChild(node);
        return;
    }

    fragments.push(node);
}

function replaceCandidateWithFragments(
    candidate: Element,
    fragments: Node[]
): void {
    const parent = candidate.parentNode;
    if (!parent) {
        return;
    }

    if (fragments.length === 0) {
        candidate.remove();
        return;
    }

    for (const fragment of fragments) {
        parent.insertBefore(fragment, candidate);
    }
    parent.removeChild(candidate);
}

function insertFencedDiv(
    sourceElement: Element,
    fencedDiv: HTMLElement,
    stack: ActiveFencedDiv[]
): void {
    const active = stack[stack.length - 1];
    if (active) {
        active.contentElement.appendChild(fencedDiv);
        sourceElement.remove();
        return;
    }

    sourceElement.parentNode?.insertBefore(fencedDiv, sourceElement);
    sourceElement.remove();
}

function processFencedDivReferences(
    element: HTMLElement,
    labels: Map<string, FencedDivReference>
): void {
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {
                const parent = node.parentElement;
                if (!parent || isCodeElement(parent) || parent.closest(`.${CSS_CLASSES.FENCED_DIV_REFERENCE}`)) {
                    return NodeFilter.FILTER_REJECT;
                }
                return node.textContent?.includes('@')
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_REJECT;
            }
        }
    );
    const nodes: Text[] = [];

    while (walker.nextNode()) {
        nodes.push(walker.currentNode as Text);
    }

    for (const node of nodes) {
        replaceReferencesInTextNode(node, labels);
    }
}

function replaceReferencesInTextNode(
    node: Text,
    labels: Map<string, FencedDivReference>
): void {
    const text = node.textContent || '';
    const replacements: (Text | HTMLElement)[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    PANDOC_CITATION_REFERENCE.lastIndex = 0;
    while ((match = PANDOC_CITATION_REFERENCE.exec(text)) !== null) {
        const label = resolveLabel(match[1], labels);
        if (!label) {
            continue;
        }

        const startIndex = match.index;
        const endIndex = startIndex + label.length + 1;
        if (startIndex > lastIndex) {
            replacements.push(document.createTextNode(text.substring(lastIndex, startIndex)));
        }
        replacements.push(createReferenceElement(label, labels.get(label)));
        lastIndex = endIndex;
    }

    if (lastIndex === 0) {
        return;
    }

    if (lastIndex < text.length) {
        replacements.push(document.createTextNode(text.substring(lastIndex)));
    }

    const parent = node.parentNode;
    if (!parent) {
        return;
    }

    for (const replacement of replacements) {
        parent.insertBefore(replacement, node);
    }
    parent.removeChild(node);
}

function createReferenceElement(
    label: string,
    reference: FencedDivReference | undefined
): HTMLElement {
    const span = document.createElement('span');
    span.className = CSS_CLASSES.FENCED_DIV_REFERENCE;
    span.dataset.pandocDivRef = label;
    span.textContent = reference?.displayName || 'Div';

    if (reference?.content) {
        setTooltip(span, reference.content, { delay: DECORATION_STYLES.TOOLTIP_DELAY_MS });
    }

    return span;
}

function resolveLabel(
    rawLabel: string | undefined,
    labels: Map<string, FencedDivReference>
): string | undefined {
    if (!rawLabel) {
        return undefined;
    }

    if (labels.has(rawLabel)) {
        return rawLabel;
    }

    const trimmedLabel = rawLabel.replace(TRAILING_REFERENCE_PUNCTUATION, '');
    if (trimmedLabel !== rawLabel && labels.has(trimmedLabel)) {
        return trimmedLabel;
    }

    return undefined;
}

function getTextWithLineBreaks(elem: Element): string {
    const parts: string[] = [];
    elem.childNodes.forEach(node => appendNodeText(node, parts));
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

function shouldSkipElement(element: Element): boolean {
    return Boolean(
        element.closest('h1, h2, h3, h4, h5, h6') ||
        element.closest('pre, code') ||
        element.closest('.pem-fenced-div')
    );
}

function isCodeElement(element: Element): boolean {
    return element.nodeName === 'CODE' || element.nodeName === 'PRE';
}
