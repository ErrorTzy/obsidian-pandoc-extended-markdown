import { INDENTATION } from '../../../core/constants';

/**
 * Calculates proper indentation for dedented list items.
 *
 * @param currentIndent - Current indentation string
 * @returns New indentation string after dedenting
 */
export function calculateIndentation(currentIndent: string): string {
    let newIndent = '';

    if (currentIndent.startsWith(INDENTATION.FOUR_SPACES)) {
        newIndent = currentIndent.substring(INDENTATION.TAB_SIZE);
    } else if (currentIndent.startsWith(INDENTATION.TAB)) {
        newIndent = currentIndent.substring(1);
    } else {
        // Remove up to 4 spaces
        newIndent = currentIndent.substring(Math.min(INDENTATION.TAB_SIZE, currentIndent.length));
    }

    return newIndent;
}

/**
 * Removes one level of indentation from a string.
 *
 * @param currentIndent - The current indentation string
 * @returns The new indentation string after removal
 */
export function removeIndentLevel(currentIndent: string): string {
    if (currentIndent.startsWith(INDENTATION.FOUR_SPACES)) {
        return currentIndent.substring(INDENTATION.TAB_SIZE);
    } else if (currentIndent.startsWith(INDENTATION.TAB)) {
        return currentIndent.substring(1);
    } else {
        // Remove up to 4 spaces
        return currentIndent.substring(Math.min(INDENTATION.TAB_SIZE, currentIndent.length));
    }
}