// External libraries
import { MarkdownView, Editor, EditorPosition } from 'obsidian';

// Constants
import { CSS_CLASSES, UI_CONSTANTS } from '../../core/constants';

// Utils
import { handleError } from '../../shared/utils/errorHandler';

interface CodeMirrorViewLike {
    dom?: HTMLElement;
    contentDOM?: HTMLElement;
}

type ExtendedEditor = Editor & {
    cm?: CodeMirrorViewLike;
    cursorCoords?: (force: boolean, mode?: 'local' | 'page') => { top: number } | null;
};

type EditorCursorPosition = { line: number; ch: number };

export function highlightLine(view: MarkdownView, lineNumber: number, cursorPosition?: EditorCursorPosition): void {
    try {
        const editor = view.editor as ExtendedEditor;
        if (cursorPosition) {
            editor.setCursor(cursorPosition);
            editor.scrollIntoView({ from: cursorPosition, to: cursorPosition }, true);
        } else {
            moveCursorToLine(editor, lineNumber);
        }
        
        const cm = editor.cm;
        if (cm) {
            const editorDom = cm.dom || cm.contentDOM;
            if (editorDom) {
                window.setTimeout(() => {
                    highlightTargetLine(editorDom, editor);
                }, 50);
            }
        }
    } catch (error) {
        handleError(error, 'Highlight line');
    }
}

/**
 * Moves the editor cursor to a specific line and scrolls it into view.
 * Sets the cursor to the beginning of the target line and ensures the line
 * is visible in the editor viewport.
 * 
 * @param editor - The editor instance (CodeMirror editor object)
 * @param lineNumber - Zero-based line number to navigate to
 * @throws Does not throw exceptions - relies on editor's error handling
 * @example
 * moveCursorToLine(view.editor, 10); // Navigate to line 10
 */
function moveCursorToLine(editor: ExtendedEditor, lineNumber: number): void {
    const lineStart: EditorPosition = { line: lineNumber, ch: 0 };
    editor.setCursor(lineStart);
    editor.scrollIntoView({ from: lineStart, to: lineStart }, true);
}

/**
 * Highlights the target line in the editor by finding the active line or closest match.
 * First attempts to find the currently active line, then falls back to finding
 * the closest line based on cursor position if no active line is found.
 * 
 * @param editorDom - The DOM element containing the editor content
 * @param editor - The editor instance for getting cursor coordinates
 * @throws Does not throw exceptions - handles missing elements gracefully
 * @example
 * highlightTargetLine(cmDom, editor); // Highlights the line at cursor position
 */
function highlightTargetLine(editorDom: HTMLElement, editor: ExtendedEditor): void {
    const activeLine = editorDom.querySelector('.cm-line.cm-active');
    if (activeLine instanceof HTMLElement) {
        applyHighlight(activeLine);
    } else {
        const targetLine = findClosestLine(editorDom, editor);
        if (targetLine instanceof HTMLElement) {
            applyHighlight(targetLine);
        }
    }
}

/**
 * Finds the line element closest to the current cursor position in the editor.
 * Calculates distance between cursor coordinates and each line's position,
 * returning the line with minimum distance to the cursor.
 * 
 * @param editorDom - The DOM element containing all editor lines
 * @param editor - The editor instance for getting cursor coordinates
 * @returns The closest line element, or null if no lines found or no cursor coords
 * @throws Does not throw exceptions - returns null for error conditions
 * @example
 * const line = findClosestLine(editorDom, editor);
 * if (line) applyHighlight(line);
 */
function findClosestLine(editorDom: HTMLElement, editor: ExtendedEditor): HTMLElement | null {
    const allLines = editorDom.querySelectorAll('.cm-line');
    const coords = editor.cursorCoords?.(true, 'local');
    
    if (!coords || allLines.length === 0) return null;
    
    let targetLine: HTMLElement | null = null;
    let minDistance = Infinity;
    
    allLines.forEach((line: Element) => {
        const rect = line.getBoundingClientRect();
        const editorRect = editorDom.getBoundingClientRect();
        const relativeTop = rect.top - editorRect.top;
        const distance = Math.abs(relativeTop - coords.top);
        
        if (distance < minDistance && line instanceof HTMLElement) {
            minDistance = distance;
            targetLine = line;
        }
    });
    
    return targetLine;
}

/**
 * Applies a visual highlight animation to a specific line element.
 * Removes any existing highlights, forces a reflow to reset animation state,
 * applies the highlight class, and automatically removes it after the animation duration.
 * 
 * @param lineElement - The line element to highlight with CSS animation
 * @throws Does not throw exceptions - handles DOM operations safely
 * @example
 * const lineEl = document.querySelector('.cm-line');
 * if (lineEl) applyHighlight(lineEl as HTMLElement);
 */
function applyHighlight(lineElement: HTMLElement): void {
    // Remove any existing highlight class first
    lineElement.classList.remove(CSS_CLASSES.CUSTOM_LABEL_HIGHLIGHT);
    
    // Force a reflow to restart the animation
    void lineElement.offsetWidth;
    
    // Add the highlight class to trigger the animation
    lineElement.classList.add(CSS_CLASSES.CUSTOM_LABEL_HIGHLIGHT);
    
    // Remove the class after animation completes (2s duration)
    window.setTimeout(() => {
        lineElement.classList.remove(CSS_CLASSES.CUSTOM_LABEL_HIGHLIGHT);
    }, UI_CONSTANTS.HIGHLIGHT_DURATION_MS);
}
