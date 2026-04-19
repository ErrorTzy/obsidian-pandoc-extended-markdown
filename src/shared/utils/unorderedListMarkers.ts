import { CSS_CLASSES, LIST_MARKERS } from '../../core/constants';

const UNORDERED_MARKER_CLASSES: Record<string, string> = {
    [LIST_MARKERS.UNORDERED_DASH]: CSS_CLASSES.UNORDERED_LIST_MARKER_DASH,
    [LIST_MARKERS.UNORDERED_PLUS]: CSS_CLASSES.UNORDERED_LIST_MARKER_PLUS,
    [LIST_MARKERS.UNORDERED_STAR]: CSS_CLASSES.UNORDERED_LIST_MARKER_STAR
};

export function getUnorderedMarkerClass(marker: string): string | null {
    return UNORDERED_MARKER_CLASSES[marker] ?? null;
}

export function getAllUnorderedMarkerClasses(): string[] {
    return [
        CSS_CLASSES.UNORDERED_LIST_MARKER,
        ...Object.values(UNORDERED_MARKER_CLASSES)
    ];
}
