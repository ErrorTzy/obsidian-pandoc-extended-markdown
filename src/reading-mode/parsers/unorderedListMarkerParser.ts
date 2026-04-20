import { MarkdownPostProcessorContext } from 'obsidian';

import { CSS_CLASSES } from '../../core/constants';

import { ListPatterns } from '../../shared/patterns';

import {
    getAllUnorderedMarkerClasses,
    getUnorderedMarkerClass
} from '../../shared/utils/unorderedListMarkers';

function getSourceMarkers(sectionText: string): string[] {
    return sectionText
        .split('\n')
        .map(line => line.match(ListPatterns.UNORDERED_LIST_MARKER_WITH_SPACE)?.[2])
        .filter((marker): marker is string => marker !== undefined);
}

function getUnorderedListItems(element: HTMLElement): HTMLElement[] {
    return Array.from(element.querySelectorAll('li'))
        .filter((item): item is HTMLElement => item.parentElement?.tagName === 'UL');
}

function clearMarkerClasses(item: HTMLElement): void {
    item.classList.remove(...getAllUnorderedMarkerClasses());
}

export function clearUnorderedListMarkerClasses(element: HTMLElement): void {
    getUnorderedListItems(element).forEach(clearMarkerClasses);
}

export function applyUnorderedListMarkerClasses(
    element: HTMLElement,
    context: MarkdownPostProcessorContext
): void {
    const section = element.closest('.markdown-preview-section');
    const sectionInfo = context.getSectionInfo(element) ??
        (section ? context.getSectionInfo(section) : null);

    if (!sectionInfo?.text) {
        return;
    }

    const markers = getSourceMarkers(sectionInfo.text);
    const items = getUnorderedListItems(element);

    items.forEach((item, index) => {
        clearMarkerClasses(item);

        const marker = markers[index];
        const markerClass = marker ? getUnorderedMarkerClass(marker) : null;
        if (markerClass) {
            item.classList.add(CSS_CLASSES.UNORDERED_LIST_MARKER, markerClass);
        }
    });
}
