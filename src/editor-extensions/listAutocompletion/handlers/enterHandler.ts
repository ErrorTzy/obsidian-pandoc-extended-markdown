import { EditorView, KeyBinding } from '@codemirror/view';
import { ListPatterns } from '../../../shared/patterns';
import { PandocExtendedMarkdownSettings } from '../../../core/settings';
import { getCurrentLineInfo } from '../utils/lineInfo';
import { detectListMarker } from '../utils/markerDetection';
import { handleEmptyListSpecialCases, handleEmptyListItem } from './emptyListHandler';
import { handleNonEmptyListItem } from './listItemHandler';
import { handleContinuationLine } from './continuationHandler';
import { EmptyListHandlingConfig, ContinuationLineConfig, NewListItemConfig } from '../types';

/**
 * Creates the Enter key handler for list autocompletion.
 *
 * @param settings - Plugin settings
 * @returns KeyBinding for Enter key
 */
export function createEnterHandler(settings: PandocExtendedMarkdownSettings): KeyBinding {
    return {
        key: 'Enter',
        run: (view: EditorView): boolean => {
            // Get current line information
            const currentLine = getCurrentLineInfo(view);

            // Try to handle continuation line first
            const continuationConfig: ContinuationLineConfig = {
                view,
                currentLine,
                settings
            };

            if (handleContinuationLine(continuationConfig)) {
                return true;
            }

            // Original detection logic for when we're on a list item line
            const detection = detectListMarker(currentLine, view);

            if (!detection.shouldHandleEnter) {
                return false; // Let default Enter handling take over
            }

            // Handle special cases for empty lists with cursor in specific positions
            if (detection.isEmptyExampleListSpecial || detection.isEmptyCustomLabelSpecial) {
                const state = view.state;
                const beforeCursor = state.doc.sliceString(currentLine.line.from, currentLine.selection.from);
                const afterCursor = state.doc.sliceString(currentLine.selection.from, currentLine.line.to);

                const specialConfig: EmptyListHandlingConfig = {
                    view,
                    currentLine,
                    beforeCursor,
                    afterCursor
                };

                return handleEmptyListSpecialCases(specialConfig);
            }

            // Skip regular numbered lists - let Obsidian handle those
            if (currentLine.lineText.match(ListPatterns.NUMBERED_LIST_WITH_SPACE)) {
                return false;
            }

            // Handle empty list items (dedent or remove)
            const emptyListConfig: EmptyListHandlingConfig = {
                view,
                currentLine,
                beforeCursor: '',
                afterCursor: ''
            };

            if (handleEmptyListItem(emptyListConfig)) {
                return true;
            }

            // Handle non-empty list items (create new list item)
            const nonEmptyConfig: Omit<NewListItemConfig, 'markerInfo'> = {
                view,
                currentLine,
                settings
            };

            return handleNonEmptyListItem(nonEmptyConfig);
        }
    };
}