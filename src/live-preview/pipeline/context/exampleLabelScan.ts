// External libraries
import { Text } from '@codemirror/state';

// Types
import { CodeRegion } from '../../../shared/types/codeTypes';
import { PandocExtendedMarkdownSettings } from '../../../core/settings';

// Patterns
import { ListPatterns } from '../../../shared/patterns';

// Utils
import { parseTaskCheckboxPrefix } from '../../../shared/utils/listContext';
import { isSyntaxFeatureEnabled } from '../../../shared/types/settingsTypes';
import { validateListBlocks } from '../../validators/listBlockValidator';
import { isLineInCodeRegion } from '../utils/codeDetection';

export function createExampleScanResult() {
    return {
        exampleLabels: new Map<string, number>(),
        exampleContent: new Map<string, string>(),
        exampleLineNumbers: new Map<number, number>(),
        duplicateLabels: new Map<string, number>(),
        duplicateLabelContent: new Map<string, string>()
    };
}

export function scanExampleLabelsFromDoc(
    doc: Text,
    settings: PandocExtendedMarkdownSettings,
    codeRegions?: CodeRegion[]
) {
    const result = createExampleScanResult();
    if (!isSyntaxFeatureEnabled(settings, 'enableExampleLists')) {
        return { ...result, duplicateLineNumbers: new Set<number>() };
    }

    const counter = { value: 1 };
    const lines = doc.toString().split('\n');
    const invalidLines = settings.enforcePandocListSpacing ? validateListBlocks(doc) : new Set<number>();
    const duplicateLineNumbers = new Set<number>();

    for (let i = 0; i < lines.length; i++) {
        if (codeRegions && isLineInCodeRegion(i + 1, doc, codeRegions)) {
            continue;
        }

        if (!invalidLines.has(i + 1)) {
            processExampleLine(lines[i], i + 1, counter, result, duplicateLineNumbers);
        }
    }

    return { ...result, duplicateLineNumbers };
}

function processExampleLine(
    line: string,
    lineNum: number,
    counter: { value: number },
    result: ReturnType<typeof createExampleScanResult>,
    duplicateLineNumbers: Set<number>
): void {
    const exampleMatch = ListPatterns.isExampleList(line);

    if (exampleMatch && exampleMatch.length >= 5) {
        const indent = exampleMatch[1] || '';
        const fullMarker = exampleMatch[2] || '';
        const label = exampleMatch[3] || '';
        const space = exampleMatch[4] || '';
        const rawContent = line.substring(
            indent.length + fullMarker.length + space.length
        );
        const content = parseTaskCheckboxPrefix(space, rawContent)?.content ?? rawContent;

        if (label && result.exampleLabels.has(label)) {
            duplicateLineNumbers.add(lineNum);
            if (!result.duplicateLabels.has(label)) {
                const firstOccurrenceNumber = result.exampleLabels.get(label)!;
                const firstLine = Array.from(result.exampleLineNumbers.entries())
                    .find(([, num]) => num === firstOccurrenceNumber)?.[0] || 0;
                result.duplicateLabels.set(label, firstLine);
                result.duplicateLabelContent.set(label, result.exampleContent.get(label) || '');
            }
        } else if (label) {
            result.exampleLabels.set(label, counter.value);
            result.exampleContent.set(label, content);
        }

        result.exampleLineNumbers.set(lineNum, counter.value);
        counter.value++;
    }
}
