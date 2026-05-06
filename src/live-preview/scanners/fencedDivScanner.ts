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
            displayName: item.title || 'Div',
            lineNumber: item.lineNumber + 1,
            classes: item.classes,
            content: item.content
        });
    }

    return labels;
}
