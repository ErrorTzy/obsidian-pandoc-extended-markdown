import { EditorView } from '@codemirror/view';
import { ListMarkerInfo } from '../../shared/types/listTypes';
import { PandocExtendedMarkdownSettings } from '../../core/settings';

/**
 * Information about the current line and cursor position.
 */
export interface CurrentLineInfo {
    line: { from: number; to: number; number: number; text: string };
    lineText: string;
    selection: { from: number; to: number };
    isAtEndOfLine: boolean;
    distanceFromEnd: number;
}

/**
 * Result of list marker detection and validation.
 */
export interface ListMarkerDetectionResult {
    isListItem: boolean;
    shouldHandleEnter: boolean;
    isEmptyExampleListSpecial: boolean;
    isEmptyCustomLabelSpecial: boolean;
}

/**
 * Configuration for handling empty list items.
 */
export interface EmptyListHandlingConfig {
    view: EditorView;
    currentLine: CurrentLineInfo;
    beforeCursor: string;
    afterCursor: string;
}

/**
 * Configuration for inserting new list items.
 */
export interface NewListItemConfig {
    view: EditorView;
    currentLine: CurrentLineInfo;
    markerInfo: ListMarkerInfo;
    settings: PandocExtendedMarkdownSettings;
}

/**
 * Configuration for handling continuation lines.
 */
export interface ContinuationLineConfig {
    view: EditorView;
    currentLine: CurrentLineInfo;
    settings: PandocExtendedMarkdownSettings;
}