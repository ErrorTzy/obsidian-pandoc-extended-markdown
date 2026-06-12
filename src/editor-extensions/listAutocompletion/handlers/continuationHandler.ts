import { EditorSelection } from '@codemirror/state';
import { ContinuationLineConfig } from '../types';
import { getLineIndent, resolveListOwnerAtLine } from '../utils/standardListStructure';
import {
    hasEnabledStandardListOwnerCandidate,
    isEnabledStandardListLine,
    showListAutocompletionError
} from '../utils/debugNotice';

/**
 * Handles Enter key in continuation lines (indented lines within a list).
 *
 * @param config - Configuration for continuation line handling
 * @returns True if handled, false otherwise
 */
export function handleContinuationLine(config: ContinuationLineConfig): boolean {
    const { view, currentLine, settings } = config;
    const state = view.state;
    const { lineText } = currentLine;
    const allLines = state.doc.toString().split('\n');
    const lineIndex = currentLine.line.number - 1;
    const ownerContext = resolveListOwnerAtLine(allLines, lineIndex, settings);
    if (ownerContext && ownerContext.owner.lineIndex !== lineIndex) {
        const insertPos = currentLine.selection.from;
        const indent = getLineIndent(lineText);
        view.dispatch(state.update({
            changes: {
                from: insertPos,
                to: insertPos,
                insert: `\n${indent}`
            },
            selection: EditorSelection.cursor(insertPos + 1 + indent.length)
        }));
        return true;
    }

    const indent = getLineIndent(lineText);
    if (
        indent.length > 0 &&
        !isEnabledStandardListLine(lineText, allLines, lineIndex, settings) &&
        hasEnabledStandardListOwnerCandidate(allLines, lineIndex, settings)
    ) {
        return showListAutocompletionError(
            'The continuation line could not be associated with a structural list owner.',
            currentLine.line.number
        );
    }

    return false;
}
