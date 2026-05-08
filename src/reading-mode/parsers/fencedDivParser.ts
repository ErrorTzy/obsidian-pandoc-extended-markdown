import { setTooltip } from 'obsidian';

import { CSS_CLASSES, DECORATION_STYLES } from '../../core/constants';
import { pluginStateManager } from '../../core/state/pluginStateManager';
import { FencedDivAttributes, FencedDivReference } from '../../shared/types/fencedDivTypes';
import { ProcessorConfig } from '../../shared/types/processorConfig';
import { processInlineTextNodes } from '../pipeline/inline/textReplacementEngine';
import { FencedDivReferenceInlineProcessor } from '../pipeline/inline/fencedDivReferenceInlineProcessor';
import { ReadingModeContext } from '../pipeline/types';
import {
    getFencedDivCssClass,
    isFencedDivClosing,
    parseFencedDivOpening
} from '../../live-preview/pipeline/structural/fencedDiv/parser';
import {
    FencedDivTypeCounters,
    createFencedDivReference,
    createFencedDivTypeCounters,
    createFencedDivReferenceMetadata,
    FencedDivReferenceMetadata,
    getFencedDivTitle
} from '../../shared/utils/fencedDivReferenceMetadata';

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
        scheduleFencedDivLabelHydration(element, docPath);
        return;
    }

    const pending = pendingSectionProcessing.get(section);
    if (pending !== undefined) {
        window.clearTimeout(pending);
    }

    const timeout = window.setTimeout(() => {
        pendingSectionProcessing.delete(section);
        processFencedDivs(section, docPath, config);
        scheduleFencedDivLabelHydration(section, docPath);
    }, 0);

    pendingSectionProcessing.set(section, timeout);
}

function scheduleFencedDivLabelHydration(
    element: HTMLElement,
    docPath: string
): void {
    window.setTimeout(() => {
        const labels = pluginStateManager.getDocumentCounters(docPath).fencedDivLabels;
        hydrateRenderedFencedDivLabels(element, labels);
        processHydratedFencedDivReferences(element, docPath);
    }, 0);
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

    const stack = preserveStack
        ? getChunkStack(docPath)
        : [];
    const labels = pluginStateManager.getDocumentCounters(docPath).fencedDivLabels;
    const hasRenderedFencedDivs = Boolean(element.querySelector('.pem-fenced-div'));
    if ((!preserveStack || stack.length === 0) && !hasRenderedFencedDivs) {
        labels.clear();
    }
    const typeCounters: FencedDivTypeCounters = new Map();
    const candidates = Array.from(element.querySelectorAll('p, li'));

    for (const candidate of candidates) {
        if (shouldSkipElement(candidate)) {
            continue;
        }

        const lineText = getTextWithLineBreaks(candidate);
        if (processMultilineCandidate(candidate, lineText, stack, labels, config, typeCounters)) {
            continue;
        }

        const opening = parseFencedDivOpening(lineText, config);
        if (opening) {
            const shouldRegister = Boolean(opening.id && !labels.has(opening.id));
            const metadata = createOpeningMetadata(opening, typeCounters);
            const reference = opening.id && labels.has(opening.id)
                ? labels.get(opening.id) as FencedDivReference
                : createFencedDivReferenceFromMetadata(
                    opening.id || '',
                    opening.classes,
                    metadata
                );
            const fencedDiv = createFencedDivElement(
                opening.id,
                opening.classes,
                stack.length + 1,
                getFencedDivTitle(opening),
                reference.blockTitleText
            );

            if (opening.id && shouldRegister) {
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

    hydrateRenderedFencedDivLabels(element, labels);

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
    labels: Map<string, FencedDivReference>,
    config: ProcessorConfig,
    typeCounters: FencedDivTypeCounters
): boolean {
    if (!text.includes('\n')) {
        return false;
    }

    const lines = text.split('\n');
    if (!lines.some(line => parseFencedDivOpening(line, config) || isFencedDivClosing(line))) {
        return false;
    }

    const fragments: Node[] = [];
    for (const line of lines) {
        const opening = parseFencedDivOpening(line, config);
        if (opening) {
            const shouldRegister = Boolean(opening.id && !labels.has(opening.id));
            const metadata = createOpeningMetadata(opening, typeCounters);
            const reference = opening.id && labels.has(opening.id)
                ? labels.get(opening.id) as FencedDivReference
                : createFencedDivReferenceFromMetadata(
                    opening.id || '',
                    opening.classes,
                    metadata
                );
            const fencedDiv = createFencedDivElement(
                opening.id,
                opening.classes,
                stack.length + 1,
                getFencedDivTitle(opening),
                reference.blockTitleText
            );

            if (opening.id && shouldRegister) {
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
    label: string | undefined,
    classes: string[],
    depth: number,
    title: string = '',
    blockTitleText: string = ''
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
    if (classes.length > 0) {
        block.dataset.pandocDivClasses = classes.join(' ');
    }
    if (title) {
        block.setAttribute('title', title);
    }

    if (blockTitleText) {
        const titleElement = document.createElement('div');
        titleElement.className = CSS_CLASSES.FENCED_DIV_TITLE;
        titleElement.textContent = blockTitleText;
        if (label) {
            titleElement.dataset.pandocDivId = label;
            setTooltip(titleElement, `#${label}`, { delay: DECORATION_STYLES.TOOLTIP_DELAY_MS });
        }
        block.appendChild(titleElement);
    }

    const content = document.createElement('div');
    content.className = 'pem-fenced-div-content';

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

function hydrateRenderedFencedDivLabels(
    element: HTMLElement,
    labels: Map<string, FencedDivReference>
): void {
    const blocks = Array.from(element.querySelectorAll<HTMLElement>('.pem-fenced-div[data-pandoc-div-id]'));
    const typeCounters = createFencedDivTypeCounters(labels.values());
    for (const block of blocks) {
        const label = block.dataset.pandocDivId;
        if (!label) {
            continue;
        }

        const existing = labels.get(label);
        if (existing) {
            ensureFencedDivTitleElement(block, existing);
            continue;
        }

        const content = block.querySelector('.pem-fenced-div-content')?.textContent?.trim() ?? '';
        const reference = createFencedDivReference(
            label,
            block.getAttribute('title') || '',
            getRenderedFencedDivClasses(block),
            0,
            content,
            typeCounters
        );

        labels.set(label, reference);
        ensureFencedDivTitleElement(block, reference);
    }
}

function ensureFencedDivTitleElement(
    block: HTMLElement,
    reference: FencedDivReference
): void {
    if (!reference.blockTitleText) {
        return;
    }

    let titleElement = block.querySelector<HTMLElement>(':scope > .pem-fenced-div-title');
    if (!titleElement) {
        titleElement = document.createElement('div');
        titleElement.className = CSS_CLASSES.FENCED_DIV_TITLE;
        const content = block.querySelector(':scope > .pem-fenced-div-content');
        block.insertBefore(titleElement, content || block.firstChild);
    }

    titleElement.textContent = reference.blockTitleText;
    titleElement.dataset.pandocDivId = reference.label;
    setTooltip(titleElement, `#${reference.label}`, { delay: DECORATION_STYLES.TOOLTIP_DELAY_MS });
}

function createOpeningMetadata(
    opening: FencedDivAttributes,
    typeCounters: FencedDivTypeCounters
): FencedDivReferenceMetadata {
    const title = getFencedDivTitle(opening);
    if (opening.id || title || opening.classes.length > 0) {
        return createFencedDivReferenceMetadata(title, opening.classes, typeCounters);
    }

    return {
        title,
        typeLabel: '',
        typeKey: '',
        number: 0,
        referenceText: '',
        blockTitleText: ''
    };
}

function createFencedDivReferenceFromMetadata(
    label: string,
    classes: string[],
    metadata: FencedDivReferenceMetadata
): FencedDivReference {
    return {
        label,
        title: metadata.title,
        displayName: metadata.referenceText,
        typeLabel: metadata.typeLabel,
        typeKey: metadata.typeKey,
        number: metadata.number,
        referenceText: metadata.referenceText,
        blockTitleText: metadata.blockTitleText,
        lineNumber: 0,
        classes,
        content: ''
    };
}

function processHydratedFencedDivReferences(
    element: HTMLElement,
    docPath: string
): void {
    const counters = pluginStateManager.getDocumentCounters(docPath);
    if (counters.fencedDivLabels.size === 0) {
        return;
    }

    processInlineTextNodes(
        element,
        {
            element,
            postProcessorContext: {} as ReadingModeContext['postProcessorContext'],
            section: element.closest<HTMLElement>('.markdown-preview-section'),
            sectionInfo: null,
            sourcePath: docPath,
            config: { strictLineBreaks: false, strictPandocMode: false, enableFencedDivs: true },
            renderContext: {},
            counters,
            validationLines: []
        },
        [new FencedDivReferenceInlineProcessor()]
    );
}

function getRenderedFencedDivClasses(block: HTMLElement): string[] {
    const storedClasses = block.dataset.pandocDivClasses?.split(/\s+/).filter(Boolean);
    if (storedClasses?.length) {
        return storedClasses;
    }

    return Array.from(block.classList)
        .filter(className =>
            className.startsWith('pem-fenced-div-') &&
            className !== 'pem-fenced-div-inner' &&
            !className.startsWith('pem-fenced-div-depth-')
        )
        .map(className => className.replace('pem-fenced-div-', ''));
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
