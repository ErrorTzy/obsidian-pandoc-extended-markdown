export type UnorderedListMarker = '-' | '+' | '*';

export interface UnorderedListMarkerInfo {
    id: UnorderedListMarker;
    displayName: string;
    marker: UnorderedListMarker;
    description: string;
}

export const UNORDERED_LIST_MARKERS: UnorderedListMarkerInfo[] = [
    {
        id: '-',
        displayName: 'Dash',
        marker: '-',
        description: 'Dash unordered list marker.'
    },
    {
        id: '+',
        displayName: 'Plus',
        marker: '+',
        description: 'Plus unordered list marker.'
    },
    {
        id: '*',
        displayName: 'Asterisk',
        marker: '*',
        description: 'Asterisk unordered list marker.'
    }
];

export const DEFAULT_UNORDERED_LIST_MARKER_ORDER: UnorderedListMarker[] =
    UNORDERED_LIST_MARKERS.map(marker => marker.id);

const UNORDERED_LIST_MARKER_IDS = new Set<UnorderedListMarker>(
    DEFAULT_UNORDERED_LIST_MARKER_ORDER
);

export function normalizeUnorderedListMarkerOrder(
    order?: readonly string[]
): UnorderedListMarker[] {
    const sourceOrder = order ?? DEFAULT_UNORDERED_LIST_MARKER_ORDER;
    const normalizedOrder = sourceOrder.filter(
        (marker): marker is UnorderedListMarker =>
            UNORDERED_LIST_MARKER_IDS.has(marker as UnorderedListMarker)
    );

    return normalizedOrder.length > 0
        ? [...normalizedOrder]
        : [...DEFAULT_UNORDERED_LIST_MARKER_ORDER];
}
