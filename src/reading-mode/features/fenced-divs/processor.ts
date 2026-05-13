import { pluginStateManager } from '../../../core/state/pluginStateManager';
import { FencedDivAttributes, FencedDivReference } from '../../../shared/types/fencedDivTypes';
import { ProcessorConfig } from '../../../shared/types/processorConfig';
import { allowsFencedDivOpeningAfterLine, isFencedDivClosing } from '../../../live-preview/pipeline/structural/fencedDiv/parser';
import {
    FencedDivTypeCounters,
    createFencedDivReferenceMetadata,
    createFencedDivReferenceFromMetadata,
    getFencedDivTitle
} from '../../../shared/utils/fencedDivReferenceMetadata';

import {
    appendContentLine,
    appendRenderedLineNode,
    getTextWithLineBreaks,
    insertFencedDiv,
    replaceCandidateWithFragments,
    shouldSkipElement,
    splitCandidateIntoLines
} from './candidateDom';
import {
    createFencedDivElement,
    hydrateRenderedFencedDivLabels,
    processHydratedFencedDivReferences
} from './rendering';
import {
    createSourceOpeningState,
    getAllowedFencedDivOpening
} from './sourceOpenings';
import {
    ActiveFencedDiv,
    CandidateLine,
    MultilineCandidateResult,
    PreparedFencedDiv,
    SourceOpeningState
} from './types';

const pendingSectionProcessing = new WeakMap<HTMLElement, number>();
const chunkStacks = new Map<string, ActiveFencedDiv[]>();
const documentTypeCounters = new Map<string, FencedDivTypeCounters>();

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
    if (config.enableFencedDivExtras === false) {
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

    const stack = preserveStack ? getChunkStack(docPath) : [];
    const labels = pluginStateManager.getDocumentCounters(docPath).fencedDivLabels;
    if (shouldResetDocumentCounters(element, preserveStack, stack)) {
        labels.clear();
        documentTypeCounters.set(docPath, new Map());
    }
    const typeCounters = getDocumentTypeCounters(docPath);
    const candidates = Array.from(element.querySelectorAll('p, li'));
    const sourceOpeningState = sourceText ? createSourceOpeningState(sourceText, config) : undefined;
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
            sourceOpeningState,
            true,
            stack.length > 0
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
        canOpenAtCurrentLine = nextOpeningEligibility(sourceOpeningState, lineText);
    }

    if (config.enableFencedDivExtras !== false) {
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
            sourceOpeningState,
            true,
            stack.length > 0
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
        canOpenAtCurrentLine = nextOpeningEligibility(sourceOpeningState, line.text);
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
            false,
            stackDepth > 0
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

        canOpenAtCurrentLine = nextOpeningEligibility(sourceOpeningState, line.text);
    }

    return false;
}

function nextOpeningEligibility(
    sourceOpeningState: SourceOpeningState | undefined,
    lineText: string
): boolean {
    return sourceOpeningState ? allowsFencedDivOpeningAfterLine(lineText) : true;
}

function prepareFencedDivOpening(
    opening: FencedDivAttributes,
    stack: ActiveFencedDiv[],
    labels: Map<string, FencedDivReference>,
    typeCounters: FencedDivTypeCounters,
    config: ProcessorConfig
): PreparedFencedDiv {
    const renderExtendedTitle = config.enableFencedDivExtras !== false;
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
        renderExtendedTitle ? title : '',
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
