import { INDENTATION, LIST_MARKERS } from '../../../core/constants';
import {
    PandocExtendedMarkdownSettings,
    isSyntaxFeatureEnabled
} from '../../../shared/types/settingsTypes';

const UNORDERED_MARKER_CYCLE = [
    LIST_MARKERS.UNORDERED_DASH,
    LIST_MARKERS.UNORDERED_PLUS,
    LIST_MARKERS.UNORDERED_STAR
];

function isUnorderedMarker(marker: string): boolean {
    return UNORDERED_MARKER_CYCLE.includes(marker);
}

function getIndentDepth(indent: string): number {
    const visualLength = Array.from(indent).reduce((length, character) => {
        return length + (character === INDENTATION.TAB ? INDENTATION.TAB_SIZE : 1);
    }, 0);

    return Math.floor(visualLength / INDENTATION.TAB_SIZE);
}

export function getUnorderedMarkerForIndent(indent: string): string {
    return UNORDERED_MARKER_CYCLE[getIndentDepth(indent) % UNORDERED_MARKER_CYCLE.length];
}

export function getMarkerForIndent(
    marker: string,
    indent: string,
    settings: Partial<PandocExtendedMarkdownSettings>
): string {
    if (!isUnorderedMarker(marker)) {
        return marker;
    }

    if (!isSyntaxFeatureEnabled(settings, 'enableUnorderedListMarkerCycling')) {
        return marker;
    }

    return getUnorderedMarkerForIndent(indent);
}
