import { MarkdownView, Notice, MarkdownRenderer, Component } from 'obsidian';
import { CSS_CLASSES, MESSAGES, UI_CONSTANTS } from '../../constants';
import { CustomLabel } from '../customLabelExtractor';

export function highlightLine(view: MarkdownView, lineNumber: number): void {
    try {
        const editor = view.editor;
        
        // Move cursor to the line first for visibility
        const lineStart = { line: lineNumber, ch: 0 };
        editor.setCursor(lineStart);
        editor.scrollIntoView({ from: lineStart, to: lineStart }, true);
        
        // Get the CodeMirror instance through the editor
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
        console.error('Error highlighting line:', error);
    }
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
    }, 2000);
}

export function setupLabelClickHandler(
    element: HTMLElement, 
    rawLabel: string
): void {
    element.addEventListener('click', () => {
        try {
            navigator.clipboard.writeText(rawLabel).then(() => {
                new Notice(MESSAGES.LABEL_COPIED);
            }).catch((error) => {
                console.error('Failed to copy label:', error);
            });
        } catch (error) {
            console.error('Error in label click handler:', error);
        }
    });
}

export function setupContentClickHandler(
    element: HTMLElement,
    label: CustomLabel,
    lastActiveMarkdownView: MarkdownView | null,
    app: any
): void {
    element.addEventListener('click', () => {
        try {
            // Use the last active markdown view
            const targetView = lastActiveMarkdownView;
            if (targetView && targetView.editor) {
                const editor = targetView.editor;
                
                // First, make the markdown view active
                const leaves = app.workspace.getLeavesOfType("markdown");
                const targetLeaf = leaves.find((leaf: any) => leaf.view === targetView);
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
            console.error('Error scrolling to label:', error);
        }
    });
}

export function setupLabelHoverPreview(element: HTMLElement, fullLabel: string): void {
    // Show full label in preview style on hover
    let hoverPopover: HTMLElement | null = null;
    
    const removePopover = () => {
        if (hoverPopover) {
            hoverPopover.remove();
            hoverPopover = null;
        }
    };
    
    element.addEventListener('mouseenter', () => {
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
    });
    
    element.addEventListener('mouseleave', removePopover);
    element.addEventListener('click', removePopover);
}

export function renderContentWithMath(
    element: HTMLElement, 
    truncatedContent: string,
    app: any,
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
    app: any,
    component: Component
): void {
    // Show full content preview on hover when content is truncated
    let hoverPopover: HTMLElement | null = null;
    
    const removePopover = () => {
        if (hoverPopover) {
            hoverPopover.remove();
            hoverPopover = null;
        }
    };
    
    element.addEventListener('mouseenter', () => {
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
    });
    
    element.addEventListener('mouseleave', removePopover);
    element.addEventListener('click', removePopover);
}