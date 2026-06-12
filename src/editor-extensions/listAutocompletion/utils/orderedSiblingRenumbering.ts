import type { PandocExtendedMarkdownSettings } from '../../../core/settings';
import {
    formatOrderedListMarker,
    parseOrderedListMarker
} from '../../../shared/utils/orderedListMarkers';
import {
    markerTypesEqual,
    parseStandardListChunk,
    StandardListMarkerType
} from './standardListStructure';

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

    const firstOrdinal = getFirstSiblingOrdinal(lines, siblings);

    siblings.forEach((node, index) => {
        const parsed = parseOrderedListMarker(lines[node.lineIndex], lines, node.lineIndex);
        if (!parsed || signature.markerType.kind !== 'ordered') {
            return;
        }

        lines[node.lineIndex] = `${parsed.indent}${formatOrderedListMarker(
            signature.markerType.style,
            firstOrdinal + index
        )}${parsed.spaces}${parsed.content}`;
    });
}

function getFirstSiblingOrdinal(
    lines: string[],
    siblings: ReturnType<typeof parseStandardListChunk>['nodes']
): number {
    const first = siblings[0];
    if (!first) {
        return 1;
    }

    return parseOrderedListMarker(lines[first.lineIndex], lines, first.lineIndex)?.ordinal ?? 1;
}
