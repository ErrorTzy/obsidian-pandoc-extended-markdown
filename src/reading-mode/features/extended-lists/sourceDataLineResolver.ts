import { ListBlockValidator } from '../../../shared/utils/listBlockValidator';
import { parsePandocListMarker } from '../../../shared/utils/pandocListMarkers';

import { ReadingModeContext } from '../../pipeline/types';
import {
    findSourceItemSubtreeEnd,
    parseNativeListLine
} from '../native-lists/sourceLine';

/** Match rendered list lines to source coordinates without mutating either representation. */
export function resolveSourceDataLines(
    lines: string[],
    context: ReadingModeContext,
    element?: Element,
    minimumSourceLine: number = 0,
    knownCandidateListLines?: Set<number>
): Array<number | undefined> {
    if (context.validationLines.length === 0) {
        return lines.map(() => undefined);
    }

    const sourceLines = context.validationLines;
    const candidateListLines = knownCandidateListLines ??
        ListBlockValidator.getListMarkerCandidateLines(sourceLines, {
            enableListsWithoutPrecedingBlankline:
                context.config.enableListsWithoutPrecedingBlankline
        });
    const bounds = getElementSourceBounds(element, context, sourceLines.length);
    const startLine = Math.max(bounds.startLine, minimumSourceLine);
    const endLine = getCandidateSourceEndLine(
        element,
        sourceLines,
        startLine,
        bounds.endLine
    );
    const dataLines: Array<number | undefined> = [];
    let sourceIndex = startLine;

    for (const line of lines) {
        let matchIndex = sourceIndex;
        while (
            matchIndex <= endLine &&
            !sourceLinesCorrespond(
                line,
                sourceLines[matchIndex],
                matchIndex,
                candidateListLines
            )
        ) {
            matchIndex++;
        }

        if (matchIndex > endLine) {
            dataLines.push(undefined);
            continue;
        }

        dataLines.push(matchIndex);
        sourceIndex = matchIndex + 1;
    }

    return dataLines;
}

function getCandidateSourceEndLine(
    element: Element | undefined,
    sourceLines: string[],
    startLine: number,
    reportedEndLine: number
): number {
    if (!element?.instanceOf(HTMLLIElement)) {
        return reportedEndLine;
    }

    const owner = parseNativeListLine(sourceLines[startLine] ?? '');
    if (!owner) {
        return reportedEndLine >= startLine
            ? reportedEndLine
            : sourceLines.length - 1;
    }

    return Math.max(
        reportedEndLine,
        findSourceItemSubtreeEnd(startLine, owner.indentColumns, sourceLines)
    );
}

function getElementSourceBounds(
    element: Element | undefined,
    context: ReadingModeContext,
    sourceLineCount: number
): { startLine: number; endLine: number } {
    const fallback = { startLine: 0, endLine: sourceLineCount - 1 };
    if (!element || !context.sectionInfo) {
        return fallback;
    }

    const elementInfo = context.postProcessorContext.getSectionInfo?.(element);
    if (!elementInfo) {
        return fallback;
    }

    const absoluteBounds = {
        startLine: elementInfo.lineStart,
        endLine: elementInfo.lineEnd
    };
    if (areValidSourceBounds(absoluteBounds, sourceLineCount)) {
        return absoluteBounds;
    }

    const sectionRelativeBounds = {
        startLine: elementInfo.lineStart - context.sectionInfo.lineStart,
        endLine: elementInfo.lineEnd - context.sectionInfo.lineStart
    };
    return areValidSourceBounds(sectionRelativeBounds, sourceLineCount)
        ? sectionRelativeBounds
        : fallback;
}

function areValidSourceBounds(
    bounds: { startLine: number; endLine: number },
    sourceLineCount: number
): boolean {
    return bounds.startLine >= 0 &&
        bounds.endLine >= bounds.startLine &&
        bounds.endLine < sourceLineCount;
}

function sourceLinesCorrespond(
    renderedLine: string,
    sourceLine: string,
    sourceIndex: number,
    candidateListLines: Set<number>
): boolean {
    const renderedMarker = parsePandocListMarker(renderedLine, true);
    const sourceMarker = parsePandocListMarker(sourceLine, true);
    if (!renderedMarker && !sourceMarker) {
        return renderedLine.trim() === sourceLine.trim();
    }
    if (!renderedMarker || !sourceMarker || renderedMarker.kind !== sourceMarker.kind) {
        return false;
    }
    if (!candidateListLines.has(sourceIndex)) {
        return false;
    }

    const renderedMarkerText = renderedLine.slice(
        renderedMarker.markerStart,
        renderedMarker.markerEnd
    );
    const sourceMarkerText = sourceLine.slice(sourceMarker.markerStart, sourceMarker.markerEnd);
    return renderedMarkerText === sourceMarkerText &&
        renderedMarker.orderedGroup === sourceMarker.orderedGroup;
}
