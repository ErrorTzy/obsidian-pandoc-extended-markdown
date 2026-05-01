import { Text } from '@codemirror/state';
import { CodeRegion } from '../../shared/types/codeTypes';
import { FencedDivReference } from '../../shared/types/fencedDivTypes';
import { PandocExtendedMarkdownSettings } from '../../core/settings';
import { isSyntaxFeatureEnabled } from '../../shared/types/settingsTypes';
import {
    getMarkdownCodeFenceMarker,
    isLineInCodeRegion,
    isMarkdownCodeFenceClosing
} from '../pipeline/utils/codeDetection';
import {
    allowsFencedDivOpeningAfterLine,
    getFencedDivDisplayName,
    isFencedDivClosing,
    parseFencedDivOpening
} from '../pipeline/structural/fencedDiv/parser';

interface ActiveFencedDiv extends FencedDivReference {
    contentLines: string[];
}

export function scanFencedDivs(
    doc: Text,
    settings: PandocExtendedMarkdownSettings,
    codeRegions?: CodeRegion[]
): Map<string, FencedDivReference> {
    const labels = new Map<string, FencedDivReference>();
    if (!isSyntaxFeatureEnabled(settings, 'enableFencedDivs')) {
        return labels;
    }

    const counters = new Map<string, number>();
    const stack: ActiveFencedDiv[] = [];
    let canOpenAtCurrentLine = true;
    let fallbackCodeFenceMarker: string | undefined;

    for (let lineNum = 1; lineNum <= doc.lines; lineNum++) {
        if (codeRegions && isLineInCodeRegion(lineNum, doc, codeRegions)) {
            const line = doc.line(lineNum);
            canOpenAtCurrentLine = isCodeRegionEndLine(line, codeRegions);
            continue;
        }

        const line = doc.line(lineNum);

        if (fallbackCodeFenceMarker) {
            if (isMarkdownCodeFenceClosing(line.text, fallbackCodeFenceMarker)) {
                fallbackCodeFenceMarker = undefined;
                canOpenAtCurrentLine = true;
            } else {
                canOpenAtCurrentLine = false;
            }
            continue;
        }

        const openingCodeFenceMarker = getMarkdownCodeFenceMarker(line.text);
        if (openingCodeFenceMarker) {
            fallbackCodeFenceMarker = openingCodeFenceMarker;
            canOpenAtCurrentLine = false;
            continue;
        }

        const opening = canOpenAtCurrentLine
            ? parseFencedDivOpening(line.text)
            : null;

        if (opening) {
            const displayName = getFencedDivDisplayName(opening.classes);
            const number = (counters.get(displayName) || 0) + 1;
            counters.set(displayName, number);

            const activeDiv: ActiveFencedDiv = {
                label: opening.id || '',
                displayName,
                number,
                lineNumber: lineNum,
                classes: opening.classes,
                content: '',
                contentLines: []
            };

            if (opening.id && !labels.has(opening.id)) {
                labels.set(opening.id, activeDiv);
            }

            stack.push(activeDiv);
            canOpenAtCurrentLine = true;
            continue;
        }

        if (isFencedDivClosing(line.text) && stack.length > 0) {
            const closed = stack.pop();
            if (closed) {
                closed.content = closed.contentLines.join('\n').trim();
            }
            canOpenAtCurrentLine = true;
            continue;
        }

        for (const activeDiv of stack) {
            activeDiv.contentLines.push(line.text);
        }
        canOpenAtCurrentLine = allowsFencedDivOpeningAfterLine(line.text);
    }

    for (const activeDiv of stack) {
        activeDiv.content = activeDiv.contentLines.join('\n').trim();
    }

    return labels;
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
