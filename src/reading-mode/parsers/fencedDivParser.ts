import { setTooltip } from 'obsidian';

import { CSS_CLASSES, DECORATION_STYLES } from '../../core/constants';
import { pluginStateManager } from '../../core/state/pluginStateManager';
import { FencedDivAttributes, FencedDivReference } from '../../shared/types/fencedDivTypes';
import { ProcessorConfig } from '../../shared/types/processorConfig';
import { processInlineTextNodes } from '../pipeline/inline/textReplacementEngine';
import { FencedDivReferenceInlineProcessor } from '../pipeline/inline/fencedDivReferenceInlineProcessor';
import { ReadingModeContext } from '../pipeline/types';
import {
    allowsFencedDivOpeningAfterLine,
    getFencedDivCssClasses,
    isFencedDivClosing,
    parseFencedDivOpening
} from '../../live-preview/pipeline/structural/fencedDiv/parser';
import {
    FencedDivTypeCounters,
    createFencedDivReference,
    createFencedDivTypeCounters,
    createFencedDivReferenceMetadata,
    createFencedDivReferenceFromMetadata,
    getFencedDivTitle
} from '../../shared/utils/fencedDivReferenceMetadata';

const MAX_DEPTH_CLASS = 6;
const pendingSectionProcessing = new WeakMap<HTMLElement, number>();
const chunkStacks = new Map<string, ActiveFencedDiv[]>();
const documentTypeCounters = new Map<string, FencedDivTypeCounters>();

interface ActiveFencedDiv {
    contentElement: HTMLElement;
    contentLines: string[];
    reference: FencedDivReference;
}

interface PreparedFencedDiv {
    block: HTMLElement;
    contentElement: HTMLElement;
    reference: FencedDivReference;
}

interface CandidateLine {
    text: string;
    nodes: Node[];
}

interface MultilineCandidateResult {
    processed: boolean;
    canOpenAtNextLine: boolean;
}

interface SourceOpeningState {
    openings: SourceOpeningEligibility[];
    index: number;
}

interface SourceOpeningEligibility {
    text: string;
    allowed: boolean;
}

export function scheduleFencedDivProcessing(
    element: HTMLElement,
    docPath: string,
    config: ProcessorConfig,
    sourceText?: string
): void {
    if (config.enableFencedDivs === false) {
        return;
    }

    const section = element.closest('.markdown-preview-section');
    if (!section) {
        processFencedDivs(element, docPath, config, true, sourceText);
        scheduleFencedDivLabelHydration(element, docPath, config);
        return;
    }

    const pending = pendingSectionProcessing.get(section);
    if (pending !== undefined) {
        window.clearTimeout(pending);
    }

    const timeout = window.setTimeout(() => {
        pendingSectionProcessing.delete(section);
        processFencedDivs(section, docPath, config, false, sourceText);
        scheduleFencedDivLabelHydration(section, docPath, config);
    }, 0);

    pendingSectionProcessing.set(section, timeout);
}

function scheduleFencedDivLabelHydration(
    element: HTMLElement,
    docPath: string,
    config: ProcessorConfig
): void {
    if (config.strictPandocMode) {
        return;
    }

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
    preserveStack: boolean = false,
    sourceText?: string
): void {
    if (config.enableFencedDivs === false) {
        return;
    }

    const stack = preserveStack
        ? getChunkStack(docPath)
        : [];
    const labels = pluginStateManager.getDocumentCounters(docPath).fencedDivLabels;
    if (shouldResetDocumentCounters(element, preserveStack, stack)) {
        labels.clear();
        documentTypeCounters.set(docPath, new Map());
    }
    const typeCounters = getDocumentTypeCounters(docPath);
    const candidates = Array.from(element.querySelectorAll('p, li'));
    const sourceOpeningState = sourceText
        ? createSourceOpeningState(sourceText, config)
        : undefined;
    let canOpenAtCurrentLine = true;

    for (const candidate of candidates) {
        if (shouldSkipElement(candidate)) {
            continue;
        }

        const lineText = getTextWithLineBreaks(candidate);
        const multilineResult = processMultilineCandidate(
            candidate,
            lineText,
            stack,
            labels,
            config,
            typeCounters,
            canOpenAtCurrentLine,
            sourceOpeningState
        );
        if (multilineResult.processed) {
            canOpenAtCurrentLine = multilineResult.canOpenAtNextLine;
            continue;
        }

        const opening = getAllowedFencedDivOpening(
            lineText,
            config,
            canOpenAtCurrentLine,
            sourceOpeningState
        );
        if (opening) {
            const fencedDiv = prepareFencedDivOpening(opening, stack, labels, typeCounters, config);

            insertFencedDiv(candidate, fencedDiv.block, stack);
            stack.push({
                contentElement: fencedDiv.contentElement,
                contentLines: [],
                reference: fencedDiv.reference
            });
            canOpenAtCurrentLine = true;
            continue;
        }

        if (isFencedDivClosing(lineText) && stack.length > 0) {
            const closed = stack.pop();
            if (closed) {
                closed.reference.content = closed.contentLines.join('\n').trim();
            }
            candidate.remove();
            canOpenAtCurrentLine = true;
            continue;
        }

        if (stack.length > 0) {
            for (const active of stack) {
                active.contentLines.push(lineText);
                active.reference.content = active.contentLines.join('\n').trim();
            }
            stack[stack.length - 1].contentElement.appendChild(candidate);
        }
        canOpenAtCurrentLine = sourceOpeningState
            ? allowsFencedDivOpeningAfterLine(lineText)
            : true;
    }

    if (!config.strictPandocMode) {
        hydrateRenderedFencedDivLabels(element, labels);
    }

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

function getDocumentTypeCounters(docPath: string): FencedDivTypeCounters {
    let counters = documentTypeCounters.get(docPath);
    if (!counters) {
        counters = new Map();
        documentTypeCounters.set(docPath, counters);
    }

    return counters;
}

function shouldResetDocumentCounters(
    element: HTMLElement,
    preserveStack: boolean,
    stack: ActiveFencedDiv[]
): boolean {
    if (preserveStack || stack.length > 0) {
        return false;
    }

    const section = element.classList.contains('markdown-preview-section')
        ? element
        : element.closest<HTMLElement>('.markdown-preview-section');
    if (!section) {
        return true;
    }

    const previousSection = section.previousElementSibling;
    return !previousSection?.classList.contains('markdown-preview-section');
}

function processMultilineCandidate(
    candidate: Element,
    text: string,
    stack: ActiveFencedDiv[],
    labels: Map<string, FencedDivReference>,
    config: ProcessorConfig,
    typeCounters: FencedDivTypeCounters,
    initialCanOpenAtCurrentLine: boolean,
    sourceOpeningState?: SourceOpeningState
): MultilineCandidateResult {
    if (!text.includes('\n')) {
        return {
            processed: false,
            canOpenAtNextLine: initialCanOpenAtCurrentLine
        };
    }

    const lines = splitCandidateIntoLines(candidate);
    if (!multilineCandidateHasProcessableFence(
        lines,
        config,
        initialCanOpenAtCurrentLine,
        stack.length,
        sourceOpeningState
    )) {
        return {
            processed: false,
            canOpenAtNextLine: initialCanOpenAtCurrentLine
        };
    }

    const fragments: Node[] = [];
    let canOpenAtCurrentLine = initialCanOpenAtCurrentLine;
    let processedFence = false;

    for (const line of lines) {
        const opening = getAllowedFencedDivOpening(
            line.text,
            config,
            canOpenAtCurrentLine,
            sourceOpeningState
        );
        if (opening) {
            const fencedDiv = prepareFencedDivOpening(opening, stack, labels, typeCounters, config);

            appendRenderedLineNode(fencedDiv.block, fragments, stack);
            stack.push({
                contentElement: fencedDiv.contentElement,
                contentLines: [],
                reference: fencedDiv.reference
            });
            canOpenAtCurrentLine = true;
            processedFence = true;
            continue;
        }

        if (isFencedDivClosing(line.text) && stack.length > 0) {
            const closed = stack.pop();
            if (closed) {
                closed.reference.content = closed.contentLines.join('\n').trim();
            }
            canOpenAtCurrentLine = true;
            processedFence = true;
            continue;
        }

        appendContentLine(line, fragments, stack);
        canOpenAtCurrentLine = sourceOpeningState
            ? allowsFencedDivOpeningAfterLine(line.text)
            : true;
    }

    if (!processedFence) {
        return {
            processed: false,
            canOpenAtNextLine: canOpenAtCurrentLine
        };
    }

    if (stack.length > 0) {
        for (const active of stack) {
            active.reference.content = active.contentLines.join('\n').trim();
        }
    }

    replaceCandidateWithFragments(candidate, fragments);
    return {
        processed: true,
        canOpenAtNextLine: canOpenAtCurrentLine
    };
}

function multilineCandidateHasProcessableFence(
    lines: CandidateLine[],
    config: ProcessorConfig,
    initialCanOpenAtCurrentLine: boolean,
    initialStackDepth: number,
    sourceOpeningState?: SourceOpeningState
): boolean {
    let canOpenAtCurrentLine = initialCanOpenAtCurrentLine;
    let stackDepth = initialStackDepth;

    for (const line of lines) {
        const opening = getAllowedFencedDivOpening(
            line.text,
            config,
            canOpenAtCurrentLine,
            sourceOpeningState,
            false
        );
        if (opening) {
            stackDepth++;
            canOpenAtCurrentLine = true;
            return true;
        }

        if (isFencedDivClosing(line.text) && stackDepth > 0) {
            stackDepth--;
            canOpenAtCurrentLine = true;
            return true;
        }

        canOpenAtCurrentLine = sourceOpeningState
            ? allowsFencedDivOpeningAfterLine(line.text)
            : true;
    }

    return false;
}

function getAllowedFencedDivOpening(
    lineText: string,
    config: ProcessorConfig,
    canOpenAtCurrentLine: boolean,
    sourceOpeningState?: SourceOpeningState,
    consumeSourceOpening: boolean = true
): FencedDivAttributes | null {
    const opening = (sourceOpeningState || canOpenAtCurrentLine)
        ? parseFencedDivOpening(lineText, config)
        : null;
    if (!opening) {
        return null;
    }

    if (!sourceOpeningState) {
        return opening;
    }

    return isOpeningAllowedBySource(lineText, sourceOpeningState, consumeSourceOpening)
        ? opening
        : null;
}

function createSourceOpeningState(
    sourceText: string,
    config: ProcessorConfig
): SourceOpeningState {
    const openings: SourceOpeningEligibility[] = [];
    const sourceLines = sourceText.split('\n');
    let canOpenAtCurrentLine = true;
    let stackDepth = 0;

    for (const sourceLine of sourceLines) {
        const syntacticOpening = parseFencedDivOpening(sourceLine, config);
        const allowedOpening = canOpenAtCurrentLine
            ? syntacticOpening
            : null;

        if (syntacticOpening) {
            openings.push({
                text: sourceLine.trim(),
                allowed: Boolean(allowedOpening)
            });
        }

        if (allowedOpening) {
            stackDepth++;
            canOpenAtCurrentLine = true;
            continue;
        }

        if (isFencedDivClosing(sourceLine) && stackDepth > 0) {
            stackDepth--;
            canOpenAtCurrentLine = true;
            continue;
        }

        canOpenAtCurrentLine = allowsFencedDivOpeningAfterLine(sourceLine);
    }

    return {
        openings,
        index: 0
    };
}

function isOpeningAllowedBySource(
    lineText: string,
    sourceOpeningState: SourceOpeningState,
    consume: boolean
): boolean {
    const normalizedLine = lineText.trim();
    const startIndex = sourceOpeningState.index;

    for (let index = startIndex; index < sourceOpeningState.openings.length; index++) {
        const opening = sourceOpeningState.openings[index];
        if (opening.text !== normalizedLine) {
            continue;
        }

        if (consume) {
            sourceOpeningState.index = index + 1;
        }
        return opening.allowed;
    }

    return false;
}

function prepareFencedDivOpening(
    opening: FencedDivAttributes,
    stack: ActiveFencedDiv[],
    labels: Map<string, FencedDivReference>,
    typeCounters: FencedDivTypeCounters,
    config: ProcessorConfig
): PreparedFencedDiv {
    const renderExtendedTitle = !config.strictPandocMode;
    const title = getFencedDivTitle(opening);
    const metadata = createFencedDivReferenceMetadata(
        renderExtendedTitle ? title : '',
        renderExtendedTitle ? opening.classes : [],
        typeCounters
    );
    const existingReference = opening.id
        ? labels.get(opening.id)
        : undefined;
    const reference = existingReference || createFencedDivReferenceFromMetadata(
        opening.id || '',
        opening.classes,
        0,
        '',
        metadata
    );
    const fencedDiv = createFencedDivElement(
        opening.id,
        opening.classes,
        stack.length + 1,
        title,
        renderExtendedTitle ? reference.blockTitleText : ''
    );

    if (opening.id && !existingReference) {
        labels.set(opening.id, reference);
    }

    return {
        block: fencedDiv.block,
        contentElement: fencedDiv.content,
        reference
    };
}

function createFencedDivElement(
    label: string | undefined,
    classes: string[],
    depth: number,
    title: string = '',
    blockTitleText: string = ''
): { block: HTMLElement, content: HTMLElement } {
    const block = document.createElement('div');
    const sourceClasses = getFencedDivSourceClasses(classes);
    const semanticClasses = getFencedDivCssClasses(classes)
        .map(className => `pem-fenced-div-${className}`);
    const depthClass = Math.min(depth, MAX_DEPTH_CLASS);
    block.className = [
        'pem-fenced-div',
        ...sourceClasses,
        depth > 1 ? 'pem-fenced-div-inner' : undefined,
        depth > 1 ? `pem-fenced-div-depth-${depthClass}` : undefined,
        ...semanticClasses
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

function getFencedDivSourceClasses(classes: string[]): string[] {
    const sourceClasses: string[] = [];
    const seen = new Set<string>();

    for (const className of classes) {
        if (!className || /\s/.test(className) || seen.has(className)) {
            continue;
        }

        seen.add(className);
        sourceClasses.push(className);
    }

    return sourceClasses;
}

function appendContentLine(
    line: string | CandidateLine,
    fragments: Node[],
    stack: ActiveFencedDiv[]
): void {
    const paragraph = document.createElement('p');
    const text = typeof line === 'string' ? line : line.text;
    if (typeof line === 'string') {
        paragraph.textContent = line;
    } else {
        paragraph.append(...line.nodes);
    }

    if (stack.length > 0) {
        for (const active of stack) {
            active.contentLines.push(text);
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

function splitCandidateIntoLines(candidate: Element): CandidateLine[] {
    const lines: CandidateLine[] = [createCandidateLine()];

    Array.from(candidate.childNodes).forEach(node => appendNodeToCandidateLines(node, lines));

    return lines;
}

function appendNodeToCandidateLines(node: Node, lines: CandidateLine[]): void {
    if (node.nodeName === 'BR') {
        lines.push(createCandidateLine());
        return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
        appendTextToCandidateLines(node.textContent || '', lines);
        return;
    }

    const currentLine = lines[lines.length - 1];
    currentLine.text += getTextWithLineBreaks(node as Element);
    currentLine.nodes.push(node);
}

function appendTextToCandidateLines(text: string, lines: CandidateLine[]): void {
    const parts = text.split('\n');
    for (const [index, part] of parts.entries()) {
        if (index > 0) {
            lines.push(createCandidateLine());
        }
        if (!part) {
            continue;
        }

        const currentLine = lines[lines.length - 1];
        currentLine.text += part;
        currentLine.nodes.push(document.createTextNode(part));
    }
}

function createCandidateLine(): CandidateLine {
    return {
        text: '',
        nodes: []
    };
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
