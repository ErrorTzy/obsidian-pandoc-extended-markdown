import type { PandocExtendedMarkdownSettings } from '../../../core/settings';
import {
    formatOrderedListMarker,
    parseOrderedListMarker
} from '../../../shared/utils/orderedListMarkers';
import {
    markerTypesEqual,
    StandardListMarkerType
} from '../../../shared/utils/standardListMarkerResolution';
import { parseStandardListChunk } from './standardListStructure';

export interface OrderedGroupSignature {
    depth: number;
    parentLineIndex: number | null;
    markerType: StandardListMarkerType;
}

export function renumberOrderedGroup(
    lines: string[],
    aroundLineIndex: number,
    signature: OrderedGroupSignature,
    settings: PandocExtendedMarkdownSettings
): void {
    if (signature.markerType.kind !== 'ordered') {
        return;
    }

    const chunk = parseStandardListChunk(lines, aroundLineIndex, settings);
    const siblings = chunk.nodes.filter(node =>
        node.depth === signature.depth &&
        node.parentLineIndex === signature.parentLineIndex &&
        markerTypesEqual(node.markerType, signature.markerType)
    );

    siblings.forEach((node, index) => {
        const parsed = parseOrderedListMarker(lines[node.lineIndex], lines, node.lineIndex);
        if (!parsed || signature.markerType.kind !== 'ordered') {
            return;
        }

        lines[node.lineIndex] = `${parsed.indent}${formatOrderedListMarker(
            signature.markerType.style,
            index + 1
        )}${parsed.spaces}${parsed.content}`;
    });
}
