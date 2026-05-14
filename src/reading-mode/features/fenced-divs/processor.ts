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
const chunkLastProcessedFenceWasClosing = new Map<string, boolean>();
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
        processFencedDivs(section, docPath, config, true, sourceText);
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
    let lastProcessedFenceWasClosing = preserveStack
        ? chunkLastProcessedFenceWasClosing.get(docPath) ?? false
        : false;

    for (const candidate of candidates) {
        if (shouldSkipElement(candidate)) {
            continue;
        }

        const lineText = getTextWithLineBreaks(candidate);
        if (!lineText.includes('\n')) {
            synchronizeSourceClosingsBeforeRenderedLine(
                stack,
                sourceOpeningState,
                lineText,
                lastProcessedFenceWasClosing || previousRenderedCandidateWasClosing(candidate)
            );
        }
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
            lastProcessedFenceWasClosing = multilineResult.lastProcessedFenceWasClosing;
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
            if (!lastProcessedFenceWasClosing) {
                synchronizeStackToSourceOpeningDepth(stack, sourceOpeningState);
            }
            const fencedDiv = prepareFencedDivOpening(opening, stack, labels, typeCounters, config);

            insertFencedDiv(candidate, fencedDiv.block, stack);
            stack.push({
                contentElement: fencedDiv.contentElement,
                contentLines: [],
                reference: fencedDiv.reference
            });
            canOpenAtCurrentLine = true;
            lastProcessedFenceWasClosing = false;
            continue;
        }

        if (isFencedDivClosing(lineText) && stack.length > 0) {
            const closed = stack.pop();
            if (closed) {
                closed.reference.content = closed.contentLines.join('\n').trim();
            }
            candidate.remove();
            advanceSourcePastRenderedLine(sourceOpeningState, lineText);
            canOpenAtCurrentLine = true;
            lastProcessedFenceWasClosing = true;
            continue;
        }

        if (stack.length > 0) {
            for (const active of stack) {
                active.contentLines.push(lineText);
                active.reference.content = active.contentLines.join('\n').trim();
            }
            stack[stack.length - 1].contentElement.appendChild(candidate);
        }
        if (lineText.trim()) {
            lastProcessedFenceWasClosing = false;
        }
        advanceSourcePastRenderedLine(sourceOpeningState, lineText);
        canOpenAtCurrentLine = nextOpeningEligibility(sourceOpeningState, lineText);
    }

    if (config.enableFencedDivExtras !== false) {
        hydrateRenderedFencedDivLabels(element, labels);
    }

    if (preserveStack) {
        if (stack.length === 0) {
            chunkStacks.delete(docPath);
            chunkLastProcessedFenceWasClosing.delete(docPath);
        } else {
            chunkLastProcessedFenceWasClosing.set(docPath, lastProcessedFenceWasClosing);
        }
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
    if (stack.length > 0) {
        return false;
    }

    const section = element.classList.contains('markdown-preview-section')
        ? element
        : element.closest<HTMLElement>('.markdown-preview-section');
    if (!section) {
        return true;
    }

    const previousSection = section.previousElementSibling;
    if (preserveStack && previousSection?.classList.contains('markdown-preview-section')) {
        return false;
    }

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
            canOpenAtNextLine: initialCanOpenAtCurrentLine,
            lastProcessedFenceWasClosing: false
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
            canOpenAtNextLine: initialCanOpenAtCurrentLine,
            lastProcessedFenceWasClosing: false
        };
    }

    const fragments: Node[] = [];
    let canOpenAtCurrentLine = initialCanOpenAtCurrentLine;
    let processedFence = false;
    let lastProcessedFenceWasClosing = false;

    for (const line of lines) {
        synchronizeSourceClosingsBeforeRenderedLine(
            stack,
            sourceOpeningState,
            line.text,
            lastProcessedFenceWasClosing
        );
        const opening = getAllowedFencedDivOpening(
            line.text,
            config,
            canOpenAtCurrentLine,
            sourceOpeningState,
            true,
            stack.length > 0
        );
        if (opening) {
            if (!lastProcessedFenceWasClosing) {
                synchronizeStackToSourceOpeningDepth(stack, sourceOpeningState);
            }
            const fencedDiv = prepareFencedDivOpening(opening, stack, labels, typeCounters, config);

            appendRenderedLineNode(fencedDiv.block, fragments, stack);
            stack.push({
                contentElement: fencedDiv.contentElement,
                contentLines: [],
                reference: fencedDiv.reference
            });
            canOpenAtCurrentLine = true;
            processedFence = true;
            lastProcessedFenceWasClosing = false;
            continue;
        }

        if (isFencedDivClosing(line.text) && stack.length > 0) {
            const closed = stack.pop();
            if (closed) {
                closed.reference.content = closed.contentLines.join('\n').trim();
            }
            advanceSourcePastRenderedLine(sourceOpeningState, line.text);
            canOpenAtCurrentLine = true;
            processedFence = true;
            lastProcessedFenceWasClosing = true;
            continue;
        }

        appendContentLine(line, fragments, stack);
        if (line.text.trim()) {
            lastProcessedFenceWasClosing = false;
        }
        advanceSourcePastRenderedLine(sourceOpeningState, line.text);
        canOpenAtCurrentLine = nextOpeningEligibility(sourceOpeningState, line.text);
    }

    if (!processedFence) {
        return {
            processed: false,
            canOpenAtNextLine: canOpenAtCurrentLine,
            lastProcessedFenceWasClosing
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
        canOpenAtNextLine: canOpenAtCurrentLine,
        lastProcessedFenceWasClosing
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

function synchronizeSourceClosingsBeforeRenderedLine(
    stack: ActiveFencedDiv[],
    sourceOpeningState: SourceOpeningState | undefined,
    renderedLine: string,
    lastProcessedFenceWasClosing: boolean
): void {
    if (!sourceOpeningState || lastProcessedFenceWasClosing || isFencedDivClosing(renderedLine)) {
        return;
    }

    while (sourceOpeningState.lineIndex < sourceOpeningState.sourceLines.length) {
        const sourceLine = sourceOpeningState.sourceLines[sourceOpeningState.lineIndex];
        const trimmedSourceLine = sourceLine.trim();

        if (isObsidianCommentDelimiter(trimmedSourceLine)) {
            sourceOpeningState.inObsidianComment = !sourceOpeningState.inObsidianComment;
            sourceOpeningState.lineIndex++;
            continue;
        }

        if (sourceOpeningState.inObsidianComment) {
            closeSourceFence(stack, sourceOpeningState, sourceLine);
            sourceOpeningState.lineIndex++;
            continue;
        }

        if (!trimmedSourceLine) {
            sourceOpeningState.lineIndex++;
            continue;
        }

        if (sourceLineMatchesRenderedLine(sourceLine, renderedLine)) {
            return;
        }

        return;
    }
}

function closeSourceFence(
    stack: ActiveFencedDiv[],
    sourceOpeningState: SourceOpeningState,
    sourceLine: string
): void {
    if (!isFencedDivClosing(sourceLine) || stack.length === 0) {
        return;
    }

    const closed = stack.pop();
    if (closed) {
        closed.reference.content = closed.contentLines.join('\n').trim();
    }
    sourceOpeningState.currentOpeningDepth = stack.length;
}

function advanceSourcePastRenderedLine(
    sourceOpeningState: SourceOpeningState | undefined,
    renderedLine: string
): void {
    if (!sourceOpeningState || !renderedLine.trim()) {
        return;
    }

    while (sourceOpeningState.lineIndex < sourceOpeningState.sourceLines.length) {
        const sourceLine = sourceOpeningState.sourceLines[sourceOpeningState.lineIndex];
        const trimmedSourceLine = sourceLine.trim();

        if (!trimmedSourceLine || isObsidianCommentDelimiter(trimmedSourceLine)) {
            return;
        }

        if (isFencedDivClosing(sourceLine) || sourceLineMatchesRenderedLine(sourceLine, renderedLine)) {
            sourceOpeningState.lineIndex++;
        }
        return;
    }
}

function isObsidianCommentDelimiter(lineText: string): boolean {
    return lineText === '%%';
}

function previousRenderedCandidateWasClosing(candidate: Element): boolean {
    const previous = findPreviousRenderedCandidate(candidate);
    if (!previous) {
        return false;
    }

    return isFencedDivClosing(getTextWithLineBreaks(previous));
}

function findPreviousRenderedCandidate(candidate: Element): Element | null {
    const previousSibling = candidate.previousElementSibling;
    if (previousSibling) {
        return findLastCandidate(previousSibling) || previousSibling;
    }

    const parentPreviousSibling = candidate.parentElement?.previousElementSibling;
    if (!parentPreviousSibling) {
        return null;
    }

    return findLastCandidate(parentPreviousSibling) || parentPreviousSibling;
}

function findLastCandidate(element: Element): Element | null {
    const candidates = element.querySelectorAll('p, li');
    return candidates[candidates.length - 1] ?? null;
}

function sourceLineMatchesRenderedLine(sourceLine: string, renderedLine: string): boolean {
    const sourceWords = getComparableWords(sourceLine);
    const renderedWords = getComparableWords(renderedLine);

    if (renderedWords.length === 0) {
        return sourceWords.length === 0;
    }

    return renderedWords.every(word => sourceWords.includes(word));
}

function getComparableWords(text: string): string[] {
    return text
        .toLowerCase()
        .match(/[a-z0-9]+/g) || [];
}

function synchronizeStackToSourceOpeningDepth(
    stack: ActiveFencedDiv[],
    sourceOpeningState: SourceOpeningState | undefined
): void {
    const sourceDepth = sourceOpeningState?.currentOpeningDepth;
    if (sourceDepth === undefined) {
        return;
    }

    while (stack.length > sourceDepth) {
        const closed = stack.pop();
        if (closed) {
            closed.reference.content = closed.contentLines.join('\n').trim();
        }
    }
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
