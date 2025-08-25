import { MarkdownRenderer, Component, App } from 'obsidian';
import { CSS_CLASSES } from '../../../core/constants';
import { ListPatterns } from '../../../shared/patterns';

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

export function setupSimpleHoverPreview(
    element: HTMLElement, 
    fullText: string, 
    popoverClass: string = CSS_CLASSES.HOVER_POPOVER_LABEL
): void {
    let hoverPopover: HTMLElement | null = null;
    let isMouseOver = false;
    
    const removePopover = () => {
        if (hoverPopover) {
            hoverPopover.remove();
            hoverPopover = null;
        }
    };
    
    element.addEventListener('mouseenter', () => {
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
        
        // Add event listeners to the popover itself
        hoverEl.addEventListener('mouseenter', () => {
            isMouseOver = true;
        });
        
        hoverEl.addEventListener('mouseleave', () => {
            isMouseOver = false;
            removePopover();
        });
    });
    
    element.addEventListener('mouseleave', () => {
        isMouseOver = false;
        // Add a small delay to allow mouse to move to the popover itself
        setTimeout(() => {
            if (!isMouseOver) {
                removePopover();
            }
        }, 50);
    });
    
    element.addEventListener('click', () => {
        isMouseOver = false;
        removePopover();
    });
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
    popoverClass: string = CSS_CLASSES.HOVER_POPOVER_CONTENT
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
    
    element.addEventListener('mouseenter', async () => {
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
            
            // Add event listeners to the popover itself to handle mouse interactions
            hoverEl.addEventListener('mouseenter', () => {
                isMouseOver = true;
            });
            
            hoverEl.addEventListener('mouseleave', () => {
                isMouseOver = false;
                removePopover();
            });
        } else {
            // Mouse left while we were creating, clean up
            hoverEl.remove();
        }
        
        isCreatingPopover = false;
    });
    
    element.addEventListener('mouseleave', () => {
        isMouseOver = false;
        // Add a small delay to allow mouse to move to the popover itself
        setTimeout(() => {
            if (!isMouseOver && !isCreatingPopover) {
                removePopover();
            }
        }, 50);
    });
    
    element.addEventListener('click', () => {
        isMouseOver = false;
        removePopover();
    });
}

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