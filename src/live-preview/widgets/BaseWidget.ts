import { WidgetType, EditorView } from '@codemirror/view';
import { setTooltip, App, Component } from 'obsidian';
import { DECORATION_STYLES } from '../../core/constants';
import { setupRenderedHoverPreview } from '../../shared/utils/hoverPopovers';

/**
 * Base class for all plugin widgets.
 * Provides common functionality for DOM creation, event handling, and lifecycle management.
 */
export abstract class BaseWidget extends WidgetType {
    protected controller: AbortController;

    constructor(
        protected view?: EditorView,
        protected pos?: number
    ) {
        super();
        this.controller = new AbortController();
    }

    /**
     * Creates the root DOM element with common setup.
     * Subclasses should override this to create their specific DOM structure.
     */
    toDOM(): HTMLElement {
        const element = this.createRootElement();
        this.applyStyles(element);
        this.setContent(element);
        this.setupTooltip(element);
        this.setupClickHandler(element);
        this.setupAdditionalHandlers(element);
        return element;
    }

    /**
     * Creates the root element for the widget.
     * Override to use different element types (e.g., 'sup', 'sub').
     */
    protected createRootElement(): HTMLElement {
        return document.createElement('span');
    }

    /**
     * Applies CSS classes to the root element.
     * Override to customize styling.
     */
    protected abstract applyStyles(element: HTMLElement): void;

    /**
     * Sets the content of the element.
     * Override to customize content structure.
     */
    protected abstract setContent(element: HTMLElement): void;

    /**
     * Sets up tooltip for the element if needed.
     * Override to add tooltips.
     */
    protected setupTooltip(element: HTMLElement): void {
        // Default: no tooltip
    }

    /**
     * Sets up the standard click handler for cursor positioning.
     * Can be overridden for custom click behavior.
     */
    protected setupClickHandler(element: HTMLElement): void {
        if (this.view && this.pos !== undefined) {
            element.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.view && this.pos !== undefined) {
                    this.view.dispatch({
                        selection: { anchor: this.pos }
                    });
                    this.view.focus();
                }
            }, { signal: this.controller.signal });
        }
    }

    /**
     * Hook for additional event handlers.
     * Override to add custom event handling.
     */
    protected setupAdditionalHandlers(element: HTMLElement): void {
        // Default: no additional handlers
    }

    /**
     * Helper method to create inner elements with classes.
     */
    protected createElement(tag: string, className?: string, textContent?: string): HTMLElement {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (textContent) element.textContent = textContent;
        return element;
    }

    /**
     * Helper method to add a simple tooltip.
     */
    protected addSimpleTooltip(element: HTMLElement, text: string): void {
        setTooltip(element, text, { delay: DECORATION_STYLES.TOOLTIP_DELAY_MS });
    }

    /**
     * Helper method to add a rendered hover preview.
     */
    protected addRenderedHoverPreview(
        element: HTMLElement,
        content: string,
        app: App,
        component: Component,
        context?: any,
        cssClass?: string
    ): void {
        setupRenderedHoverPreview(
            element,
            content,
            app,
            component,
            context,
            cssClass || 'hover-popover-content',
            this.controller.signal
        );
    }

    /**
     * Cleanup method called when the widget is destroyed.
     */
    destroy(): void {
        this.controller.abort();
    }

    /**
     * Determines whether to ignore events.
     * Default: allow all events to pass through.
     */
    ignoreEvent(): boolean {
        return false;
    }

    /**
     * Abstract method for equality comparison.
     * Must be implemented by subclasses.
     */
    abstract eq(other: any): boolean;
}