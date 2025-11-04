import { ListPatterns } from '../patterns';
import { UI_CONSTANTS } from '../../core/constants';

/**
 * Represents a flattened definition list item for panel display
 * @interface DefinitionListItem
 * @property {string} term - The definition term text
 * @property {string[]} definitions - Array of definition texts for this term
 * @property {number} lineNumber - Line number where the term appears in the document
 * @property {Object} position - Position object for cursor navigation
 */
export interface DefinitionListItem {
    term: string;
    definitions: string[];
    lineNumber: number;
    position: { line: number; ch: number };
}

/**
 * State for tracking current definition list parsing
 */
interface DefinitionParseState {
    currentTerm: string | null;
    currentDefinitions: string[];
    termLineNumber: number;
    termPosition: { line: number; ch: number } | null;
    inDefinitionBlock: boolean;
}

/**
 * Checks if a line is not a list item of any type
 */
function isNotListItem(line: string): boolean {
    return !line.match(ListPatterns.UNORDERED_LIST) &&
           !line.match(ListPatterns.NUMBERED_LIST) &&
           !line.match(ListPatterns.HASH_LIST) &&
           !line.match(ListPatterns.FANCY_LIST) &&
           !line.match(ListPatterns.CUSTOM_LABEL_LIST) &&
           !line.match(ListPatterns.EXAMPLE_LIST) &&
           !ListPatterns.isDefinitionMarker(line);
}

/**
 * Processes a definition marker line and updates state
 */
function processDefinitionLine(
    line: string,
    defMatch: RegExpMatchArray,
    state: DefinitionParseState
): void {
    if (!state.currentTerm) return;

    state.inDefinitionBlock = true;
    const content = line.substring(defMatch[0].length);

    if (content) {
        state.currentDefinitions.push(content);
    }
}

/**
 * Processes a continuation line for a definition
 */
function processContinuationLine(
    line: string,
    state: DefinitionParseState
): boolean {
    if (!state.inDefinitionBlock || !line.trim()) return false;

    const leadingSpaces = line.match(/^(\s*)/)?.[1].length || 0;

    if (leadingSpaces >= UI_CONSTANTS.MARKDOWN_INDENT_SIZE &&
        !ListPatterns.isDefinitionMarker(line) &&
        state.currentDefinitions.length > 0) {
        // Append to the last definition
        const lastIndex = state.currentDefinitions.length - 1;
        state.currentDefinitions[lastIndex] += ' ' + line.trim();
        return true;
    }

    return false;
}

/**
 * Saves the current term to the items array if valid
 */
function saveCurrentTerm(
    state: DefinitionParseState,
    items: DefinitionListItem[]
): void {
    if (state.currentTerm &&
        state.currentDefinitions.length > 0 &&
        state.termPosition) {
        items.push({
            term: state.currentTerm,
            definitions: [...state.currentDefinitions],
            lineNumber: state.termLineNumber,
            position: state.termPosition
        });
    }
}

/**
 * Extracts all definition lists from the document content
 * @param content The document content
 * @returns Array of definition list items
 */
export function extractDefinitionLists(content: string): DefinitionListItem[] {
    const lines = content.split('\n');
    const items: DefinitionListItem[] = [];

    const state: DefinitionParseState = {
        currentTerm: null,
        currentDefinitions: [],
        termLineNumber: -1,
        termPosition: null,
        inDefinitionBlock: false
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for definition marker
        const defMatch = ListPatterns.isDefinitionMarker(line);
        if (defMatch) {
            processDefinitionLine(line, defMatch, state);
            continue;
        }

        // Check for continuation lines
        if (processContinuationLine(line, state)) {
            continue;
        }

        // Check if this line could be a term
        const leadingSpaces = line.match(/^(\s*)/)?.[1].length || 0;
        const isPotentialTerm = line.trim() &&
                               leadingSpaces < UI_CONSTANTS.MARKDOWN_INDENT_SIZE &&
                               isNotListItem(line);

        if (isPotentialTerm) {
            // Save the previous term if we have one
            saveCurrentTerm(state, items);

            // Start a new term
            state.currentTerm = line.trim();
            state.currentDefinitions = [];
            state.termLineNumber = i;
            state.termPosition = { line: i, ch: leadingSpaces };
            state.inDefinitionBlock = false;
        }
    }

    // Save the last term if we have one
    saveCurrentTerm(state, items);

    return items;
}
