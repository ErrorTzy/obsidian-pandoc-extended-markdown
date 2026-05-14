import { FencedDivAttributes } from '../../../shared/types/fencedDivTypes';
import { ProcessorConfig } from '../../../shared/types/processorConfig';
import {
    allowsFencedDivOpeningAfterLine,
    isFencedDivClosing,
    parseFencedDivOpening
} from '../../../live-preview/pipeline/structural/fencedDiv/parser';

import { SourceOpeningState, SourceOpeningEligibility } from './types';

export function getAllowedFencedDivOpening(
    lineText: string,
    config: ProcessorConfig,
    canOpenAtCurrentLine: boolean,
    sourceOpeningState?: SourceOpeningState,
    consumeSourceOpening: boolean = true,
    allowNonStrictNestedOpening: boolean = false
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

    return isOpeningAllowedBySource(
        lineText,
        sourceOpeningState,
        consumeSourceOpening,
        allowNonStrictNestedOpening && !config.strictPandocMode
    )
        ? opening
        : null;
}

export function createSourceOpeningState(
    sourceText: string,
    config: ProcessorConfig
): SourceOpeningState {
    const openings: SourceOpeningEligibility[] = [];
    const sourceLines = sourceText.split('\n');
    let canOpenAtCurrentLine = true;
    let stackDepth = 0;

    for (const [lineIndex, sourceLine] of sourceLines.entries()) {
        const syntacticOpening = parseFencedDivOpening(sourceLine, config);
        const allowedOpening = canOpenAtCurrentLine
            ? syntacticOpening
            : null;
        const stackOpening = allowedOpening ||
            (!config.strictPandocMode && stackDepth > 0 ? syntacticOpening : null);

        if (syntacticOpening) {
            openings.push({
                text: sourceLine.trim(),
                allowed: Boolean(allowedOpening),
                depth: stackDepth,
                lineIndex
            });
        }

        if (stackOpening) {
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
        index: 0,
        sourceLines,
        lineIndex: 0,
        inObsidianComment: false
    };
}

function isOpeningAllowedBySource(
    lineText: string,
    sourceOpeningState: SourceOpeningState,
    consume: boolean,
    allowNonStrictNestedOpening: boolean = false
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
            sourceOpeningState.currentOpeningDepth = opening.depth;
            sourceOpeningState.lineIndex = Math.max(
                sourceOpeningState.lineIndex,
                opening.lineIndex + 1
            );
        }
        return opening.allowed || allowNonStrictNestedOpening;
    }

    return false;
}
