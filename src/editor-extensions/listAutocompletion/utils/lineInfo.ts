import { EditorView } from '@codemirror/view';
import { CurrentLineInfo } from '../types';

/**
 * Gets current line information and cursor position details.
 *
 * @param view - The CodeMirror editor view
 * @returns Object containing line and cursor information
 */
export function getCurrentLineInfo(view: EditorView): CurrentLineInfo {
    const state = view.state;
    const selection = state.selection.main;
    const line = state.doc.lineAt(selection.from);
    const lineText = line.text;
    const isAtEndOfLine = selection.from === line.to;
    const distanceFromEnd = line.to - selection.from;

    return {
        line,
        lineText,
        selection,
        isAtEndOfLine,
        distanceFromEnd
    };
}