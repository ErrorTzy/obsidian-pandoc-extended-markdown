import { Text } from '@codemirror/state';

import { PandocExtendedMarkdownSettings } from '../../core/settings';
import { extractFencedDivsFromDoc } from '../../shared/extractors/fencedDivExtractor';
import { CodeRegion } from '../../shared/types/codeTypes';
import { FencedDivReference } from '../../shared/types/fencedDivTypes';
import { FencedDivTypeCounters, createFencedDivReference } from '../../shared/utils/fencedDivReferenceMetadata';

export function scanFencedDivs(
    doc: Text,
    settings: PandocExtendedMarkdownSettings,
    codeRegions?: CodeRegion[]
): Map<string, FencedDivReference> {
    const labels = new Map<string, FencedDivReference>();
    const items = extractFencedDivsFromDoc(doc, settings, codeRegions);
    const typeCounters: FencedDivTypeCounters = new Map();

    for (const item of items) {
        if (!item.label || labels.has(item.label)) {
            continue;
        }

        labels.set(
            item.label,
            createFencedDivReference(
                item.label,
                item.title,
                item.classes,
                item.lineNumber + 1,
                item.content,
                typeCounters
            )
        );
    }

    return labels;
}
