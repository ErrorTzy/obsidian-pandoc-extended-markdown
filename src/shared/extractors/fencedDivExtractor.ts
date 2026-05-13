import { Text } from '@codemirror/state';

import { PandocExtendedMarkdownSettings } from '../../core/settings';
import {
    isFencedDivExtrasEnabled,
    isSyntaxFeatureEnabled
} from '../types/settingsTypes';
import { CodeRegion } from '../types/codeTypes';
import {
    allowsFencedDivOpeningAfterLine,
    isFencedDivClosing,
    parseFencedDivOpening
} from '../../live-preview/pipeline/structural/fencedDiv/parser';
import {
    getMarkdownCodeFenceMarker,
    isLineInCodeRegion,
    isMarkdownCodeFenceClosing
} from '../../live-preview/pipeline/utils/codeDetection';
import {
    FencedDivTypeCounters,
    createFencedDivReferenceMetadata,
    getFencedDivTitle
} from '../utils/fencedDivReferenceMetadata';

export interface FencedDivPanelItem {
    title: string;
    label: string;
    content: string;
    classes: string[];
    typeLabel: string;
    typeKey: string;
    number: number;
    numberParts: number[];
    numberingEnabled: boolean;
    referenceText: string;
    blockTitleText: string;
    lineNumber: number;
    contentLineNumber: number;
    position: { line: number; ch: number };
    contentPosition: { line: number; ch: number };
}

interface ActiveFencedDiv extends FencedDivPanelItem {
    contentLines: string[];
    firstContentLineNumber?: number;
}

export function extractFencedDivs(
    content: string,
    settings: PandocExtendedMarkdownSettings
): FencedDivPanelItem[] {
    return extractFencedDivsFromDoc(Text.of(content.split('\n')), settings);
}

export function extractFencedDivsFromDoc(
    doc: Text,
    settings: PandocExtendedMarkdownSettings,
    codeRegions?: CodeRegion[]
): FencedDivPanelItem[] {
    const items: FencedDivPanelItem[] = [];
    if (!isSyntaxFeatureEnabled(settings, 'enableFencedDivs')) {
        return items;
    }

    const stack: ActiveFencedDiv[] = [];
    let canOpenAtCurrentLine = true;
    let fallbackCodeFenceMarker: string | undefined;
    const typeCounters: FencedDivTypeCounters = new Map();
    const includeExtras = isFencedDivExtrasEnabled(settings);

    for (let lineNum = 1; lineNum <= doc.lines; lineNum++) {
        const line = doc.line(lineNum);

        if (codeRegions && isLineInCodeRegion(lineNum, doc, codeRegions)) {
            canOpenAtCurrentLine = isCodeRegionEndLine(line, codeRegions);
            continue;
        }

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
            ? parseFencedDivOpening(line.text, settings)
            : null;

        if (opening) {
            const title = includeExtras ? getFencedDivTitle(opening) : '';
            const metadata = createFencedDivReferenceMetadata(
                title,
                includeExtras ? opening.classes : [],
                typeCounters
            );
            const activeDiv: ActiveFencedDiv = {
                title: metadata.title,
                label: opening.id || '',
                content: '',
                classes: opening.classes,
                typeLabel: metadata.typeLabel,
                typeKey: metadata.typeKey,
                number: metadata.number,
                numberParts: metadata.numberParts,
                numberingEnabled: metadata.numberingEnabled,
                referenceText: metadata.referenceText,
                blockTitleText: metadata.blockTitleText,
                lineNumber: lineNum - 1,
                contentLineNumber: lineNum - 1,
                position: { line: lineNum - 1, ch: 0 },
                contentPosition: { line: lineNum - 1, ch: 0 },
                contentLines: []
            };

            items.push(activeDiv);
            stack.push(activeDiv);
            canOpenAtCurrentLine = true;
            continue;
        }

        if (isFencedDivClosing(line.text) && stack.length > 0) {
            closeActiveDiv(stack.pop());
            canOpenAtCurrentLine = true;
            continue;
        }

        for (const activeDiv of stack) {
            if (activeDiv.firstContentLineNumber === undefined) {
                activeDiv.firstContentLineNumber = lineNum - 1;
            }
            activeDiv.contentLines.push(line.text);
        }
        canOpenAtCurrentLine = allowsFencedDivOpeningAfterLine(line.text);
    }

    while (stack.length > 0) {
        closeActiveDiv(stack.pop());
    }

    return items;
}

function closeActiveDiv(activeDiv?: ActiveFencedDiv): void {
    if (!activeDiv) {
        return;
    }

    activeDiv.content = activeDiv.contentLines.join('\n').trim();
    if (activeDiv.firstContentLineNumber !== undefined && activeDiv.content) {
        activeDiv.contentLineNumber = activeDiv.firstContentLineNumber;
        activeDiv.contentPosition = { line: activeDiv.firstContentLineNumber, ch: 0 };
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
