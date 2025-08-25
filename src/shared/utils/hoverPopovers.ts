import { MarkdownRenderer, Component, App } from 'obsidian';
import { CSS_CLASSES } from '../../core/constants';
import { ListPatterns } from '../patterns';

/**
 * Process popover content to replace inline references with their resolved values
 * @param content The raw markdown content
 * @param context The processing context containing label mappings
 * @returns The processed content with references replaced
 */
export function processPopoverContent(
    content: string,
    context?: {
        exampleLabels?: Map<string, number>;
        exampleContent?: Map<string, string>;
        customLabels?: Map<string, string>;
        rawToProcessed?: Map<string, string>;
    }
): string {
    if (!context) return content;
    
    let processedContent = content;
    
    // Process example references (@label) -> (number)
    if (context.exampleLabels) {
        processedContent = processedContent.replace(
            ListPatterns.EXAMPLE_REFERENCE,
            (match, label) => {
                const number = context.exampleLabels!.get(label);
                return number !== undefined ? `(${number})` : match;
            }
        );
    }
    
    // Process custom label references {::label} -> processed label
    if (context.rawToProcessed) {
        // Match {::LABEL} pattern
        const customLabelPattern = /\{::([^}]+)\}/g;
        processedContent = processedContent.replace(
            customLabelPattern,
            (match, label) => {
                const processed = context.rawToProcessed!.get(label);
                return processed !== undefined ? processed : match;
            }
        );
    }
    
    return processedContent;
}

/**
 * Sets up a simple hover preview that displays plain text content in a styled popover.
 * The popover appears on mouseenter and disappears on mouseleave or click.
 * Automatically positions itself to avoid going off-screen.
 * 
 * @param element - The HTML element to attach the hover preview to
 * @param fullText - The plain text content to display in the hover popover
 * @param popoverClass - Optional CSS class for styling the popover (defaults to label class)
 * @throws Does not throw exceptions - handles DOM operations safely
 * @example
 * setupSimpleHoverPreview(labelElement, 'Full label text', 'custom-popover-class');
 */
export function setupSimpleHoverPreview(
    element: HTMLElement, 
    fullText: string, 
    popoverClass: string = CSS_CLASSES.HOVER_POPOVER_LABEL,
    abortSignal?: AbortSignal
): void {
    let hoverPopover: HTMLElement | null = null;
    let isMouseOver = false;
    
    const removePopover = () => {
        if (hoverPopover) {
            hoverPopover.remove();
            hoverPopover = null;
        }
    };
    
    const mouseEnterHandler = () => {
        isMouseOver = true;
        
        const hoverEl = document.createElement('div');
        hoverEl.classList.add(CSS_CLASSES.HOVER_POPOVER, popoverClass);
        hoverEl.textContent = fullText;
        
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
        
        // Add event listeners to the popover itself with cleanup signal
        const popoverController = new AbortController();
        if (abortSignal) {
            abortSignal.addEventListener('abort', () => {
                popoverController.abort();
            });
        }
        
        hoverEl.addEventListener('mouseenter', () => {
            isMouseOver = true;
        }, { signal: popoverController.signal });
        
        hoverEl.addEventListener('mouseleave', () => {
            isMouseOver = false;
            removePopover();
            popoverController.abort();
        }, { signal: popoverController.signal });
    };
    
    const mouseLeaveHandler = () => {
        isMouseOver = false;
        // Add a small delay to allow mouse to move to the popover itself
        setTimeout(() => {
            if (!isMouseOver) {
                removePopover();
            }
        }, 50);
    };
    
    const clickHandler = () => {
        isMouseOver = false;
        removePopover();
    };
    
    element.addEventListener('mouseenter', mouseEnterHandler, { signal: abortSignal });
    element.addEventListener('mouseleave', mouseLeaveHandler, { signal: abortSignal });
    element.addEventListener('click', clickHandler, { signal: abortSignal });
}

/**
 * Sets up a hover preview that renders markdown content (including math, bold, italic, etc.)
 * @param element The element to attach the hover preview to
 * @param content The markdown content to render
 * @param app The Obsidian app instance
 * @param component The component for lifecycle management
 * @param context Optional context for processing inline references
 * @param popoverClass Optional CSS class for the popover
 */
export function setupRenderedHoverPreview(
    element: HTMLElement,
    content: string,
    app: App,
    component: Component,
    context?: {
        exampleLabels?: Map<string, number>;
        exampleContent?: Map<string, string>;
        customLabels?: Map<string, string>;
        rawToProcessed?: Map<string, string>;
    },
    popoverClass: string = CSS_CLASSES.HOVER_POPOVER_CONTENT,
    abortSignal?: AbortSignal
): void {
    let hoverPopover: HTMLElement | null = null;
    let isMouseOver = false;
    let isCreatingPopover = false;
    
    const removePopover = () => {
        if (hoverPopover) {
            hoverPopover.remove();
            hoverPopover = null;
        }
        isCreatingPopover = false;
    };
    
    const mouseEnterHandler = async () => {
        isMouseOver = true;
        isCreatingPopover = true;
        
        const hoverEl = document.createElement('div');
        hoverEl.classList.add(CSS_CLASSES.HOVER_POPOVER, popoverClass);
        
        // Process content to replace inline references
        const processedContent = processPopoverContent(content, context);
        
        // Use MarkdownRenderer to properly render content
        await MarkdownRenderer.render(
            app,
            processedContent,
            hoverEl,
            '',
            component
        );
        
        // Check if mouse is still over the element after async operation
        if (!isMouseOver) {
            // Mouse already left, don't show the popover
            isCreatingPopover = false;
            return;
        }
        
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
        
        // Final check before setting the popover
        if (isMouseOver) {
            hoverPopover = hoverEl;
            
            // Add event listeners to the popover itself with cleanup signal
            const popoverController = new AbortController();
            if (abortSignal) {
                abortSignal.addEventListener('abort', () => {
                    popoverController.abort();
                });
            }
            
            hoverEl.addEventListener('mouseenter', () => {
                isMouseOver = true;
            }, { signal: popoverController.signal });
            
            hoverEl.addEventListener('mouseleave', () => {
                isMouseOver = false;
                removePopover();
                popoverController.abort();
            }, { signal: popoverController.signal });
        } else {
            // Mouse left while we were creating, clean up
            hoverEl.remove();
        }
        
        isCreatingPopover = false;
    };
    
    const mouseLeaveHandler = () => {
        isMouseOver = false;
        // Add a small delay to allow mouse to move to the popover itself
        setTimeout(() => {
            if (!isMouseOver && !isCreatingPopover) {
                removePopover();
            }
        }, 50);
    };
    
    const clickHandler = () => {
        isMouseOver = false;
        removePopover();
    };
    
    element.addEventListener('mouseenter', mouseEnterHandler, { signal: abortSignal });
    element.addEventListener('mouseleave', mouseLeaveHandler, { signal: abortSignal });
    element.addEventListener('click', clickHandler, { signal: abortSignal });
}

/**
 * Positions a hover element relative to a reference element with intelligent overflow handling.
 * Places the hover element below the reference by default, but moves it above if it would
 * overflow the bottom of the screen. Also handles horizontal overflow.
 * 
 * @param hoverEl - The hover element to position (popover, tooltip, etc.)
 * @param referenceEl - The reference element to position relative to
 * @param maxWidth - Optional maximum width constraint for the hover element
 * @param maxHeight - Optional maximum height constraint for the hover element
 * @throws Does not throw exceptions - handles positioning calculations safely
 * @example
 * positionHoverElement(popoverDiv, triggerButton, '300px', '200px');
 */
export function positionHoverElement(hoverEl: HTMLElement, referenceEl: HTMLElement, maxWidth?: string, maxHeight?: string): void {
    const rect = referenceEl.getBoundingClientRect();
    hoverEl.style.left = `${rect.left}px`;
    hoverEl.style.top = `${rect.bottom + 5}px`;
    
    if (maxWidth) {
        hoverEl.style.maxWidth = maxWidth;
    }
    if (maxHeight) {
        hoverEl.style.maxHeight = maxHeight;
    }
    hoverEl.style.overflow = 'auto';
    
    // Adjust if goes off screen
    const hoverRect = hoverEl.getBoundingClientRect();
    if (hoverRect.right > window.innerWidth) {
        hoverEl.style.left = `${window.innerWidth - hoverRect.width - 10}px`;
    }
    if (hoverRect.bottom > window.innerHeight) {
        hoverEl.style.top = `${rect.top - hoverRect.height - 5}px`;
    }
}