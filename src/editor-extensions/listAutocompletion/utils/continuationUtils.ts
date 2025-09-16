import { ListPatterns } from '../../../shared/patterns';

/**
 * Finds the last list item before the current continuation line.
 *
 * @param state - Editor state
 * @param currentLineNumber - Current line number (1-based)
 * @returns The last list line and its text, or null if not found
 */
export function findLastListItem(
    state: { doc: { line: (n: number) => { number: number; text: string }; toString: () => string } },
    currentLineNumber: number
): { line: { number: number; text: string }; text: string } | null {
    let lastListLine = null;
    let lastListLineText = '';
    let searchLineNum = currentLineNumber - 1;

    // First, find any list item by searching backwards
    while (searchLineNum >= 1) {
        const prevLine = state.doc.line(searchLineNum);
        const prevText = prevLine.text;

        // Check if this is a list item
        if (ListPatterns.isFancyList(prevText) ||
            ListPatterns.isExampleList(prevText) ||
            ListPatterns.isCustomLabelList(prevText) ||
            ListPatterns.isHashList(prevText)) {
            lastListLine = prevLine;
            lastListLineText = prevText;
            // Don't break - keep searching to find all list items
        }

        // If we hit a non-indented line that's not empty and not a list item, stop
        const prevIndent = prevText.match(/^(\s*)/);
        if (prevIndent && prevIndent[1].length === 0 && prevText.trim() !== '' &&
            !ListPatterns.isFancyList(prevText) &&
            !ListPatterns.isExampleList(prevText) &&
            !ListPatterns.isCustomLabelList(prevText) &&
            !ListPatterns.isHashList(prevText)) {
            break;
        }

        searchLineNum--;
    }

    // Now search forward from the last found list item to find the actual last list item
    // before the current continuation block
    if (lastListLine) {
        for (let lineNum = lastListLine.number; lineNum < currentLineNumber; lineNum++) {
            const line = state.doc.line(lineNum);
            const text = line.text;

            if (ListPatterns.isFancyList(text) ||
                ListPatterns.isExampleList(text) ||
                ListPatterns.isCustomLabelList(text) ||
                ListPatterns.isHashList(text)) {
                lastListLine = line;
                lastListLineText = text;
            }
        }
    }

    return lastListLine ? { line: lastListLine, text: lastListLineText } : null;
}