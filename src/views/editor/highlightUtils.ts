import { MarkdownView } from 'obsidian';
import { CSS_CLASSES, UI_CONSTANTS } from '../../core/constants';
import { handleError } from '../../shared/utils/errorHandler';

export function highlightLine(view: MarkdownView, lineNumber: number): void {
    try {
        const editor = view.editor;
        moveCursorToLine(editor, lineNumber);
        
        const cm = (editor as any).cm;
        if (cm) {
            const editorDom = cm.dom || cm.contentDOM;
            if (editorDom) {
                setTimeout(() => {
                    highlightTargetLine(editorDom, editor);
                }, 50);
            }
        }
    } catch (error) {
        handleError(error, 'Highlight line');
    }
}

function moveCursorToLine(editor: any, lineNumber: number): void {
    const lineStart = { line: lineNumber, ch: 0 };
    editor.setCursor(lineStart);
    editor.scrollIntoView({ from: lineStart, to: lineStart }, true);
}

function highlightTargetLine(editorDom: HTMLElement, editor: any): void {
    const activeLine = editorDom.querySelector('.cm-line.cm-active');
    if (activeLine) {
        applyHighlight(activeLine as HTMLElement);
    } else {
        const targetLine = findClosestLine(editorDom, editor);
        if (targetLine) {
            applyHighlight(targetLine);
        }
    }
}

function findClosestLine(editorDom: HTMLElement, editor: any): HTMLElement | null {
    const allLines = editorDom.querySelectorAll('.cm-line');
    const coords = editor.cursorCoords(true, 'local');
    
    if (!coords || allLines.length === 0) return null;
    
    let targetLine: HTMLElement | null = null;
    let minDistance = Infinity;
    
    allLines.forEach((line: Element) => {
        const rect = line.getBoundingClientRect();
        const editorRect = editorDom.getBoundingClientRect();
        const relativeTop = rect.top - editorRect.top;
        const distance = Math.abs(relativeTop - coords.top);
        
        if (distance < minDistance) {
            minDistance = distance;
            targetLine = line as HTMLElement;
        }
    });
    
    return targetLine;
}

function applyHighlight(lineElement: HTMLElement): void {
    // Remove any existing highlight class first
    lineElement.classList.remove(CSS_CLASSES.CUSTOM_LABEL_HIGHLIGHT);
    
    // Force a reflow to restart the animation
    void lineElement.offsetWidth;
    
    // Add the highlight class to trigger the animation
    lineElement.classList.add(CSS_CLASSES.CUSTOM_LABEL_HIGHLIGHT);
    
    // Remove the class after animation completes (2s duration)
    setTimeout(() => {
        lineElement.classList.remove(CSS_CLASSES.CUSTOM_LABEL_HIGHLIGHT);
    }, UI_CONSTANTS.HIGHLIGHT_DURATION_MS);
}