import { EditorView, KeyBinding } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import { isExtendedList } from '../utils/markerDetection';

/**
 * Creates the Shift+Enter key handler for list continuation.
 *
 * @returns KeyBinding for Shift+Enter key
 */
export function createShiftEnterHandler(): KeyBinding {
    return {
        key: 'Shift-Enter',
        run: (view: EditorView): boolean => {
            const state = view.state;
            const selection = state.selection.main;

            // Get the current line
            const line = state.doc.lineAt(selection.from);
            const lineText = line.text;

            // Check if we're in any kind of extended list
            if (isExtendedList(lineText)) {
                // Insert newline with proper indentation
                // Always use 3 spaces for continuation lines to ensure consistent alignment
                const continuationIndent = '   '; // Exactly 3 spaces
                const insertPos = selection.from;

                const changes = {
                    from: insertPos,
                    to: insertPos,
                    insert: '\n' + continuationIndent
                };

                const transaction = state.update({
                    changes,
                    selection: EditorSelection.cursor(insertPos + 1 + 3) // Cursor after 3 spaces
                });

                view.dispatch(transaction);
                return true;
            }

            return false; // Let default Shift+Enter handling take over for non-extended lists
        }
    };
}