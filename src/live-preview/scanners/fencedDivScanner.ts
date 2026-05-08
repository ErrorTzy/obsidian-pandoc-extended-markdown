import { Text } from '@codemirror/state';

import { PandocExtendedMarkdownSettings } from '../../core/settings';
import { extractFencedDivsFromDoc } from '../../shared/extractors/fencedDivExtractor';
import { CodeRegion } from '../../shared/types/codeTypes';
import { FencedDivReference } from '../../shared/types/fencedDivTypes';

export function scanFencedDivs(
    doc: Text,
    settings: PandocExtendedMarkdownSettings,
    codeRegions?: CodeRegion[]
): Map<string, FencedDivReference> {
    const labels = new Map<string, FencedDivReference>();
    const items = extractFencedDivsFromDoc(doc, settings, codeRegions);

    for (const item of items) {
        if (!item.label || labels.has(item.label)) {
            continue;
        }

        labels.set(item.label, {
            label: item.label,
            title: item.title,
            displayName: item.referenceText,
            typeLabel: item.typeLabel,
            typeKey: item.typeKey,
            number: item.number,
            referenceText: item.referenceText,
            blockTitleText: item.blockTitleText,
            lineNumber: item.lineNumber + 1,
            classes: item.classes,
            content: item.content
        });
    }

    return labels;
}
