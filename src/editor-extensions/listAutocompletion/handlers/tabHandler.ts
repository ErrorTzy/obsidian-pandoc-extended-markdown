import { EditorView, KeyBinding } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import { ListPatterns } from '../../../shared/patterns';
import { INDENTATION } from '../../../core/constants';
import { removeIndentLevel } from '../utils/indentation';

/**
 * Creates the Tab key handler for nested lists.
 *
 * @returns KeyBinding for Tab key
 */
export function createTabHandler(): KeyBinding {
    return {
        key: 'Tab',
        run: (view: EditorView): boolean => {
            const state = view.state;
            const selection = state.selection.main;

            // Get the current line
            const line = state.doc.lineAt(selection.from);
            const lineText = line.text;

            // Check if we're at the start of a list item (after the marker)
            const listMatch = lineText.match(ListPatterns.ANY_LIST_MARKER_WITH_SPACE);
            if (listMatch) {
                const currentIndent = listMatch[1];
                const marker = listMatch[2];
                const space = listMatch[3];
                const markerEnd = currentIndent.length + marker.length + space.length;

                // Only handle Tab if cursor is at the beginning of the content (right after marker)
                if (selection.from === line.from + markerEnd && selection.to === selection.from) {
                    // Add indentation (4 spaces or 1 tab based on user preference)
                    const newIndent = currentIndent + INDENTATION.FOUR_SPACES; // Using 4 spaces
                    const newLine = newIndent + marker + space + lineText.substring(markerEnd);

                    const changes = {
                        from: line.from,
                        to: line.to,
                        insert: newLine
                    };

                    const transaction = state.update({
                        changes,
                        selection: EditorSelection.cursor(line.from + newIndent.length + marker.length + space.length)
                    });

                    view.dispatch(transaction);
                    return true;
                }
            }

            return false; // Let default Tab handling take over
        }
    };
}

/**
 * Creates the Shift+Tab key handler for dedenting.
 *
 * @returns KeyBinding for Shift+Tab key
 */
export function createShiftTabHandler(): KeyBinding {
    return {
        key: 'Shift-Tab',
        run: (view: EditorView): boolean => {
            const state = view.state;
            const selection = state.selection.main;

            // Get the current line
            const line = state.doc.lineAt(selection.from);
            const lineText = line.text;

            // Check if we're in a list item with indentation
            const listMatch = lineText.match(ListPatterns.ANY_LIST_MARKER_WITH_INDENT_AND_SPACE);
            if (listMatch && listMatch[1].length > 0) {
                const currentIndent = listMatch[1];
                const marker = listMatch[2];
                const space = listMatch[3];
                const markerEnd = currentIndent.length + marker.length + space.length;

                // Remove indentation level
                const newIndent = removeIndentLevel(currentIndent);
                const newLine = newIndent + marker + space + lineText.substring(markerEnd);

                const changes = {
                    from: line.from,
                    to: line.to,
                    insert: newLine
                };

                // Calculate new cursor position
                const oldCursorOffset = selection.from - line.from;
                const indentDiff = currentIndent.length - newIndent.length;
                const newCursorOffset = Math.max(newIndent.length + marker.length + space.length, oldCursorOffset - indentDiff);

                const transaction = state.update({
                    changes,
                    selection: EditorSelection.cursor(line.from + newCursorOffset)
                });

                view.dispatch(transaction);
                return true;
            }

            return false; // Let default Shift+Tab handling take over
        }
    };
}