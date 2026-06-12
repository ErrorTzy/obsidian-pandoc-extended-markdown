import { Notice } from 'obsidian';
import type { PandocExtendedMarkdownSettings } from '../../../core/settings';
import {
    isOrderedMarkerStyleAvailable,
    parseOrderedListMarker
} from '../../../shared/utils/orderedListMarkers';
import { parseStructuralListItem } from './standardListStructure';

const NOTICE_TIMEOUT_MS = 8000;

export function showListAutocompletionError(context: string, lineNumber?: number): boolean {
    const lineSuffix = lineNumber === undefined ? '' : ` at line ${lineNumber}`;
    new Notice(
        `Pandoc Extended Markdown: list autocompletion failed${lineSuffix}. ${context}`,
        NOTICE_TIMEOUT_MS
    );

    return true;
}

export function isEnabledStandardListLine(
    lineText: string,
    lines: string[],
    lineIndex: number,
    settings: PandocExtendedMarkdownSettings
): boolean {
    const item = parseStructuralListItem(lineText, settings);
    if (!item) {
        return false;
    }

    if (item.kind !== 'ordered') {
        return true;
    }

    const ordered = parseOrderedListMarker(lineText, lines, lineIndex);
    return !!ordered && isOrderedMarkerStyleAvailable(ordered.style, settings);
}

export function hasEnabledStandardListOwnerCandidate(
    lines: string[],
    lineIndex: number,
    settings: PandocExtendedMarkdownSettings
): boolean {
    if (isEnabledStandardListLine(lines[lineIndex] ?? '', lines, lineIndex, settings)) {
        return true;
    }

    const line = lines[lineIndex] ?? '';
    const indent = line.match(/^(\s*)/)?.[1] ?? '';
    if (!line.trim() || indent.length === 0) {
        return false;
    }

    for (let index = lineIndex - 1; index >= 0; index--) {
        if (!lines[index].trim()) {
            break;
        }

        if (isEnabledStandardListLine(lines[index], lines, index, settings)) {
            return true;
        }
    }

    return false;
}
