import { MarkdownRenderer, Component, App } from 'obsidian';
import { CSS_CLASSES, UI_CONSTANTS, DOM_ATTRIBUTES, ERROR_MESSAGES, FILE_CONSTANTS } from '../../core/constants';
import { processContent as processContentWithRegistry, ProcessingContext } from '../rendering/ContentProcessorRegistry';
import { handleError } from './errorHandler';

/**
 * Process popover content to replace inline references with their resolved values
 * @param content The raw markdown content
 * @param context The processing context containing label mappings
 * @returns The processed content with references replaced
 * 
 * @deprecated Use ContentProcessorRegistry for extensibility
 */
export function processPopoverContent(
    content: string,
    context?: ProcessingContext
): string {
    if (!context) return content;
    
    // Use the centralized registry for processing
    return processContentWithRegistry(content, context);
}

/**
 * Helper interface for hover state management
 */
interface HoverState {
    hoverPopover: HTMLElement | null;
    isMouseOverElement: boolean;
    isMouseOverPopover: boolean;
    cleanupTimeout: number | null;
    popoverController: AbortController | null;
}

/**
 * Creates initial hover state
 */
function createHoverState(): HoverState {
    return {
        hoverPopover: null,
        isMouseOverElement: false,
        isMouseOverPopover: false,
        cleanupTimeout: null,
        popoverController: null
    };
}

/**
 * Clears any pending cleanup timeout
 */
function clearCleanupTimeout(state: HoverState): void {
    if (state.cleanupTimeout) {
        window.clearTimeout(state.cleanupTimeout);
        state.cleanupTimeout = null;
    }
}

/**
 * Removes the popover and cleans up resources
 */
function removePopover(state: HoverState): void {
    clearCleanupTimeout(state);
    
    if (state.popoverController) {
        state.popoverController.abort();
        state.popoverController = null;
    }
    
    if (state.hoverPopover) {
        state.hoverPopover.remove();
        state.hoverPopover = null;
    }
}

/**
 * Schedules popover removal after a delay
 */
function scheduleRemoval(state: HoverState, remove: () => void): void {
    clearCleanupTimeout(state);
    state.cleanupTimeout = window.setTimeout(() => {
        if (!state.isMouseOverElement && !state.isMouseOverPopover) {
            remove();
        }
    }, UI_CONSTANTS.HOVER_CLEANUP_DELAY_MS);
}

/**
 * Clears hover state and immediately removes the current popover.
 */
function dismissPopover(state: HoverState, remove: () => void): void {
    state.isMouseOverElement = false;
    state.isMouseOverPopover = false;
    remove();
}

/**
 * Positions a popover element relative to a reference element
 */
function positionPopover(popoverElement: HTMLElement, referenceElement: HTMLElement): void {
    const elementRect = referenceElement.getBoundingClientRect();
    popoverElement.style.left = `${elementRect.left}px`;
    popoverElement.style.top = `${elementRect.bottom + UI_CONSTANTS.HOVER_OFFSET_BOTTOM}px`;
    
    // Adjust if goes off screen
    const popoverRect = popoverElement.getBoundingClientRect();
    if (popoverRect.right > window.innerWidth) {
        popoverElement.style.left = `${window.innerWidth - popoverRect.width - UI_CONSTANTS.HOVER_OFFSET_HORIZONTAL}px`;
    }
    if (popoverRect.bottom > window.innerHeight) {
        popoverElement.style.top = `${elementRect.top - popoverRect.height - UI_CONSTANTS.HOVER_OFFSET_TOP}px`;
    }
}

/**
 * Attaches hover event listeners to the popover element
 */
function attachPopoverListeners(
    popoverElement: HTMLElement, 
    state: HoverState,
    remove: () => void
): void {
    state.popoverController = new AbortController();
    const { signal } = state.popoverController;
    
    popoverElement.addEventListener('mouseenter', () => {
        clearCleanupTimeout(state);
        state.isMouseOverPopover = true;
    }, { signal });
    
    popoverElement.addEventListener('mouseleave', () => {
        state.isMouseOverPopover = false;
        scheduleRemoval(state, remove);
    }, { signal });
    
    popoverElement.addEventListener('click', () => {
        dismissPopover(state, remove);
    }, { signal });

    document.addEventListener('pointerdown', (event) => {
        const target = event.target;
        if (target instanceof Node && popoverElement.contains(target)) {
            return;
        }
        dismissPopover(state, remove);
    }, { signal });

    document.addEventListener('click', () => {
        dismissPopover(state, remove);
    }, { signal });
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
    const state = createHoverState();
    const remove = () => removePopover(state);
    
    const mouseEnterHandler = () => {
        clearCleanupTimeout(state);
        state.isMouseOverElement = true;
        
        // Remove any existing popover first
        removePopover(state);
        
        const hoverElement = document.createElement(DOM_ATTRIBUTES.ELEMENT_DIV);
        hoverElement.classList.add(CSS_CLASSES.HOVER_POPOVER, popoverClass);
        hoverElement.textContent = fullText;
        
        document.body.appendChild(hoverElement);
        positionPopover(hoverElement, element);
        
        state.hoverPopover = hoverElement;
        attachPopoverListeners(hoverElement, state, remove);
    };
    
    const mouseLeaveHandler = () => {
        state.isMouseOverElement = false;
        scheduleRemoval(state, remove);
    };
    
    const clickHandler = () => {
        dismissPopover(state, remove);
    };
    
    // Clean up on abort signal
    if (abortSignal) {
        abortSignal.addEventListener('abort', remove, { once: true });
    }
    
    element.addEventListener('mouseenter', mouseEnterHandler, { signal: abortSignal });
    element.addEventListener('mouseleave', mouseLeaveHandler, { signal: abortSignal });
    element.addEventListener('click', clickHandler, { signal: abortSignal });
}

/**
 * Extended hover state for async rendering
 */
interface AsyncHoverState extends HoverState {
    renderAbortController: AbortController | null;
    renderingGeneration: number;
}

/**
 * Creates initial async hover state
 */
function createAsyncHoverState(): AsyncHoverState {
    return {
        ...createHoverState(),
        renderAbortController: null,
        renderingGeneration: 0
    };
}

/**
 * Removes popover with async render cancellation
 */
function removeAsyncPopover(state: AsyncHoverState): void {
    clearCleanupTimeout(state);
    
    // Cancel any in-progress rendering
    if (state.renderAbortController) {
        state.renderAbortController.abort();
        state.renderAbortController = null;
    }
    
    // Clean up popover event listeners
    if (state.popoverController) {
        state.popoverController.abort();
        state.popoverController = null;
    }
    
    // Remove the popover element
    if (state.hoverPopover) {
        state.hoverPopover.remove();
        state.hoverPopover = null;
    }
}

/**
 * Renders markdown content into a popover element
 */
async function renderPopoverContent(
    popoverElement: HTMLElement,
    content: string,
    app: App,
    component: Component,
    context?: ProcessingContext
): Promise<void> {
    const processedContent = context ? processContentWithRegistry(content, context) : content;
    
    try {
        await MarkdownRenderer.render(
            app,
            processedContent,
            popoverElement,
            FILE_CONSTANTS.EMPTY_STRING,
            component
        );
    } catch (error) {
        // Use centralized error handling
        handleError(error, ERROR_MESSAGES.PLUGIN_PREFIX + ': Hover preview rendering');
        throw error; // Re-throw to signal failure to caller
    }
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
    context?: ProcessingContext,
    popoverClass: string = CSS_CLASSES.HOVER_POPOVER_CONTENT,
    abortSignal?: AbortSignal
): void {
    const state = createAsyncHoverState();
    const remove = () => removeAsyncPopover(state);
    
    const mouseEnterHandler = async () => {
        clearCleanupTimeout(state);
        state.isMouseOverElement = true;

        // Increment generation to track this specific render attempt
        const currentGeneration = ++state.renderingGeneration;
        
        // Cancel any previous render in progress and remove existing popover
        removeAsyncPopover(state);
        
        // Create abort controller for this render operation
        state.renderAbortController = new AbortController();
        
        const hoverElement = document.createElement(DOM_ATTRIBUTES.ELEMENT_DIV);
        hoverElement.classList.add(CSS_CLASSES.HOVER_POPOVER, popoverClass);
        
        try {
            await renderPopoverContent(hoverElement, content, app, component, context);
        } catch {
            if (state.renderAbortController?.signal.aborted) {
                return; // Expected abort, clean up silently
            }
            return; // Error already handled in renderPopoverContent
        }
        
        // Check if this render is still the latest one and mouse is still over
        if (currentGeneration !== state.renderingGeneration || !state.isMouseOverElement) {
            return; // A newer render was started or mouse left
        }
        
        document.body.appendChild(hoverElement);
        positionPopover(hoverElement, element);
        
        // Final check before setting the popover as active
        if (currentGeneration === state.renderingGeneration && state.isMouseOverElement) {
            state.hoverPopover = hoverElement;
            attachPopoverListeners(hoverElement, state, remove);
        } else {
            hoverElement.remove(); // Conditions changed while setting up
        }
    };
    
    const mouseLeaveHandler = () => {
        state.isMouseOverElement = false;
        scheduleRemoval(state, remove);
    };
    
    const clickHandler = () => {
        dismissPopover(state, remove);
    };
    
    // Clean up on abort signal
    if (abortSignal) {
        abortSignal.addEventListener('abort', remove, { once: true });
    }
    
    const enterListener = () => { void mouseEnterHandler(); };
    element.addEventListener('mouseenter', enterListener, { signal: abortSignal });
    element.addEventListener('mouseleave', mouseLeaveHandler, { signal: abortSignal });
    element.addEventListener('click', clickHandler, { signal: abortSignal });
}
