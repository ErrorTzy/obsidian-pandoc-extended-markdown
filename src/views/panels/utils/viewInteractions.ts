import { MarkdownView, Notice, MarkdownRenderer, Component, App, WorkspaceLeaf } from 'obsidian';

import { CustomLabel } from '../../../shared/extractors/customLabelExtractor';

import { CSS_CLASSES, MESSAGES, UI_CONSTANTS } from '../../../core/constants';
import { handleError } from '../../../shared/utils/errorHandler';

/**
 * Highlights a specific line in the markdown editor with a visual animation effect.
 * Navigates to the line, scrolls it into view, and applies a temporary highlight animation.
 * Uses CodeMirror DOM manipulation to find and highlight the target line element.
 * 
 * @param view - The active MarkdownView containing the editor to highlight
 * @param lineNumber - Zero-based line number to highlight in the editor
 * @throws Logs errors to console but does not throw exceptions
 * @example
 * // Highlight line 5 in the current markdown view
 * highlightLine(activeView, 5);
 */
export function highlightLine(view: MarkdownView, lineNumber: number): void {
    try {
        const editor = view.editor;
        
        // Move cursor to the line first for visibility
        const lineStart = { line: lineNumber, ch: 0 };
        editor.setCursor(lineStart);
        editor.scrollIntoView({ from: lineStart, to: lineStart }, true);
        
        // Get the CodeMirror instance through the editor
        // Note: This uses internal Obsidian editor API which may change
        const cm = (editor as any).cm;
        if (cm) {
            // Get the viewport and find all line elements
            const viewport = cm.viewportLines || cm.visibleRanges;
            const editorDom = cm.dom || cm.contentDOM;
            
            if (editorDom) {
                // Find all line elements in the editor
                const lineElements = editorDom.querySelectorAll('.cm-line');
                
                // Calculate which visual line corresponds to our logical line
                // This is an approximation - we look for the line that's currently at the cursor
                setTimeout(() => {
                    // After setCursor, the line should be in view
                    const activeLine = editorDom.querySelector('.cm-line.cm-active');
                    if (!activeLine) {
                        // Fallback: try to find line by position
                        const allLines = editorDom.querySelectorAll('.cm-line');
                        // Get line position info from editor
                        const coords = editor.cursorCoords(true, 'local');
                        if (coords && allLines.length > 0) {
                            // Find the closest line element
                            let targetLine = null;
                            let minDistance = Infinity;
                            
                            allLines.forEach((line: Element) => {
                                const rect = line.getBoundingClientRect();
                                const editorRect = editorDom.getBoundingClientRect();
                                const relativeTop = rect.top - editorRect.top;
                                const distance = Math.abs(relativeTop - coords.top);
                                
                                if (distance < minDistance) {
                                    minDistance = distance;
                                    targetLine = line;
                                }
                            });
                            
                            if (targetLine) {
                                applyHighlight(targetLine as HTMLElement);
                            }
                        }
                    } else {
                        applyHighlight(activeLine as HTMLElement);
                    }
                }, 50); // Small delay to ensure DOM is updated after setCursor
            }
        }
    } catch (error) {
        handleError(error, 'error');
    }
}

/**
 * Applies a visual highlight animation to a specific line element in the editor.
 * Removes any existing highlights, triggers a CSS animation, and automatically
 * removes the highlight class after the animation duration (2 seconds).
 * 
 * @param lineElement - The HTML line element to highlight with animation
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
    setTimeout(() => {
        lineElement.classList.remove(CSS_CLASSES.CUSTOM_LABEL_HIGHLIGHT);
    }, 2000);
}

export function setupLabelClickHandler(
    element: HTMLElement, 
    rawLabel: string,
    abortSignal?: AbortSignal
): void {
    const clickHandler = () => {
        try {
            navigator.clipboard.writeText(rawLabel).then(() => {
                new Notice(MESSAGES.LABEL_COPIED);
            }).catch((error) => {
                handleError(error, 'error');
            });
        } catch (error) {
            handleError(error, 'error');
        }
    };
    
    element.addEventListener('click', clickHandler, { signal: abortSignal });
}

export function setupContentClickHandler(
    element: HTMLElement,
    label: CustomLabel,
    lastActiveMarkdownView: MarkdownView | null,
    app: App,
    abortSignal?: AbortSignal
): void {
    const clickHandler = () => {
        try {
            // Use the last active markdown view
            const targetView = lastActiveMarkdownView;
            if (targetView && targetView.editor) {
                const editor = targetView.editor;
                
                // First, make the markdown view active
                const leaves = app.workspace.getLeavesOfType("markdown");
                const targetLeaf = leaves.find((leaf: WorkspaceLeaf) => leaf.view === targetView);
                if (targetLeaf) {
                    app.workspace.setActiveLeaf(targetLeaf, { focus: true });
                }
                
                // Then scroll to position
                editor.setCursor(label.position);
                editor.scrollIntoView({ from: label.position, to: label.position }, true);
                
                // Add highlight effect
                highlightLine(targetView, label.lineNumber);
            }
        } catch (error) {
            handleError(error, 'error');
        }
    };
    
    element.addEventListener('click', clickHandler, { signal: abortSignal });
}

export function setupLabelHoverPreview(
    element: HTMLElement, 
    fullLabel: string,
    abortSignal?: AbortSignal
): void {
    // Show full label in preview style on hover
    let hoverPopover: HTMLElement | null = null;
    
    const removePopover = () => {
        if (hoverPopover) {
            hoverPopover.remove();
            hoverPopover = null;
        }
    };
    
    const mouseEnterHandler = () => {
        // Create a popover to show full label
        const hoverEl = document.createElement('div');
        hoverEl.classList.add(CSS_CLASSES.HOVER_POPOVER, CSS_CLASSES.HOVER_POPOVER_LABEL);
        
        // Set the full label text
        hoverEl.textContent = fullLabel;
        
        // Position near the element
        document.body.appendChild(hoverEl);
        const rect = element.getBoundingClientRect();
        hoverEl.style.left = `${rect.left}px`;
        hoverEl.style.top = `${rect.bottom + 5}px`;
        
        // Adjust if goes off screen
        const hoverRect = hoverEl.getBoundingClientRect();
        if (hoverRect.right > window.innerWidth) {
            hoverEl.style.left = `${window.innerWidth - hoverRect.width - 10}px`;
        }
        if (hoverRect.bottom > window.innerHeight) {
            hoverEl.style.top = `${rect.top - hoverRect.height - 5}px`;
        }
        
        hoverPopover = hoverEl;
    };
    
    element.addEventListener('mouseenter', mouseEnterHandler, { signal: abortSignal });
    element.addEventListener('mouseleave', removePopover, { signal: abortSignal });
    element.addEventListener('click', removePopover, { signal: abortSignal });
}

export function renderContentWithMath(
    element: HTMLElement, 
    truncatedContent: string,
    app: App,
    component: Component
): void {
    // Use MarkdownRenderer for proper math rendering
    MarkdownRenderer.render(
        app,
        truncatedContent,
        element,
        '',
        component
    );
}

export function setupContentHoverPreview(
    element: HTMLElement, 
    label: CustomLabel,
    app: App,
    component: Component,
    abortSignal?: AbortSignal
): void {
    // Show full content preview on hover when content is truncated
    let hoverPopover: HTMLElement | null = null;
    
    const removePopover = () => {
        if (hoverPopover) {
            hoverPopover.remove();
            hoverPopover = null;
        }
    };
    
    const mouseEnterHandler = () => {
        // Create a popover to show full content with proper rendering
        const hoverEl = document.createElement('div');
        hoverEl.classList.add(CSS_CLASSES.HOVER_POPOVER, CSS_CLASSES.HOVER_POPOVER_CONTENT);
        
        // Use rendered content for display
        const contentToShow = label.renderedContent || label.content;
        
        // For math rendering, check if content contains math delimiters
        if (contentToShow.includes('$')) {
            // Use MarkdownRenderer for proper math rendering
            MarkdownRenderer.render(
                app,
                contentToShow,
                hoverEl,
                '',
                component
            );
        } else {
            // Plain text content
            hoverEl.textContent = contentToShow;
        }
        
        // Position near the element
        document.body.appendChild(hoverEl);
        const rect = element.getBoundingClientRect();
        hoverEl.style.left = `${rect.left}px`;
        hoverEl.style.top = `${rect.bottom + 5}px`;
        
        // Adjust if goes off screen
        const hoverRect = hoverEl.getBoundingClientRect();
        if (hoverRect.right > window.innerWidth) {
            hoverEl.style.left = `${window.innerWidth - hoverRect.width - 10}px`;
        }
        if (hoverRect.bottom > window.innerHeight) {
            hoverEl.style.top = `${rect.top - hoverRect.height - 5}px`;
        }
        
        hoverPopover = hoverEl;
    };
    
    element.addEventListener('mouseenter', mouseEnterHandler, { signal: abortSignal });
    element.addEventListener('mouseleave', removePopover, { signal: abortSignal });
    element.addEventListener('click', removePopover, { signal: abortSignal });
}