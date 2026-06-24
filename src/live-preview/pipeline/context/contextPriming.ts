// Types
import { CodeRegion } from '../../../shared/types/codeTypes';
import { ProcessingContext } from '../types';

// Patterns
import { ListPatterns } from '../../../shared/patterns';

// Utils
import { isFencedDivExtrasEnabled, isSyntaxFeatureEnabled } from '../../../shared/types/settingsTypes';
import {
    getMarkdownCodeFenceMarker,
    isLineInCodeRegion,
    isMarkdownCodeFenceClosing
} from '../utils/codeDetection';
import {
    createFencedDivReferenceMetadata,
    getFencedDivTitle
} from '../../../shared/utils/fencedDivReferenceMetadata';
import {
    allowsFencedDivOpeningAfterLine,
    isFencedDivClosing,
    parseFencedDivOpening
} from '../structural/fencedDiv/parser';

export function primeContextBeforeRange(
    context: ProcessingContext,
    startLine: number,
    codeRegions: CodeRegion[]
): void {
    if (startLine <= 1) {
        return;
    }

    const doc = context.document;
    const lines = context.documentLines || doc.toString().split('\n');
    let fencedDivCanOpenAtCurrentLine = true;
    let fallbackCodeFenceMarker: string | undefined;

    for (let lineNum = 1; lineNum < startLine; lineNum++) {
        const lineText = lines[lineNum - 1] || '';
        const line = doc.line(lineNum);

        if (context.invalidLines.has(lineNum)) {
            fencedDivCanOpenAtCurrentLine = false;
            continue;
        }

        if (isLineInCodeRegion(lineNum, doc, codeRegions)) {
            fencedDivCanOpenAtCurrentLine = isCodeRegionEndLine(line, codeRegions);
            continue;
        }

        if (fallbackCodeFenceMarker) {
            if (isMarkdownCodeFenceClosing(lineText, fallbackCodeFenceMarker)) {
                fallbackCodeFenceMarker = undefined;
                fencedDivCanOpenAtCurrentLine = true;
            } else {
                fencedDivCanOpenAtCurrentLine = false;
            }
            continue;
        }

        const openingCodeFenceMarker = getMarkdownCodeFenceMarker(lineText);
        if (openingCodeFenceMarker) {
            fallbackCodeFenceMarker = openingCodeFenceMarker;
            fencedDivCanOpenAtCurrentLine = false;
            continue;
        }

        if (lineText.trim() === '') {
            context.listContext = undefined;
        }

        primeHashCounter(lineText, context);
        primeFencedDivState(lineText, lineNum, fencedDivCanOpenAtCurrentLine, context);

        fencedDivCanOpenAtCurrentLine = allowsFencedDivOpeningAfterLine(lineText) ||
            context.fencedDivBoundaryLine === lineNum;
    }

    context.fencedDivCanOpenAtCurrentLine = fencedDivCanOpenAtCurrentLine;
}

function primeHashCounter(lineText: string, context: ProcessingContext): void {
    if (
        isSyntaxFeatureEnabled(context.settings, 'enableHashAutoNumber') &&
        ListPatterns.isHashList(lineText)
    ) {
        context.hashCounter.value++;
    }
}

function primeFencedDivState(
    lineText: string,
    lineNumber: number,
    canOpenAtCurrentLine: boolean,
    context: ProcessingContext
): void {
    if (!isSyntaxFeatureEnabled(context.settings, 'enableFencedDivs')) {
        return;
    }

    if (canOpenAtCurrentLine) {
        const opening = parseFencedDivOpening(lineText, context.settings);
        if (opening) {
            const renderExtendedTitle = isFencedDivExtrasEnabled(context.settings);
            const title = renderExtendedTitle ? getFencedDivTitle(opening) : '';
            if (renderExtendedTitle && (opening.id || title || opening.classes.length > 0)) {
                context.fencedDivTypeCounters = context.fencedDivTypeCounters || new Map();
                createFencedDivReferenceMetadata(
                    title,
                    opening.classes,
                    context.fencedDivTypeCounters
                );
            }
            context.fencedDivStack = context.fencedDivStack || [];
            context.fencedDivStack.push({
                label: opening.id,
                classes: opening.classes,
                openingLine: lineNumber
            });
            context.fencedDivBoundaryLine = lineNumber;
            return;
        }
    }

    if (isFencedDivClosing(lineText) && (context.fencedDivStack?.length || 0) > 0) {
        context.fencedDivStack?.pop();
        context.fencedDivBoundaryLine = lineNumber;
    }
}

function isCodeRegionEndLine(
    line: { from: number; to: number },
    codeRegions: CodeRegion[]
): boolean {
    return codeRegions.some(region =>
        region.type === 'codeblock' &&
        line.from >= region.from &&
        line.to === region.to
    );
}
