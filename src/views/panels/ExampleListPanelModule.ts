// External libraries
import { MarkdownView, Notice, MarkdownRenderer, Component } from 'obsidian';

// Types
import { PanelModule } from './PanelTypes';

// Constants
import { CSS_CLASSES, MESSAGES, ICONS, UI_CONSTANTS } from '../../constants';

// Utils
import { truncateContentWithRendering } from '../../utils/views/contentTruncator';
import { renderContentWithMath } from '../../utils/views/viewInteractions';
import { handleError } from '../../utils/errorHandler';
import { ExampleListItem, extractExampleLists } from '../../utils/exampleListExtractor';
import { setupSimpleHoverPreview, positionHoverElement } from '../../utils/views/hoverPopovers';
import { highlightLine } from '../../utils/views/highlightUtils';

// Internal modules
import { PandocExtendedMarkdownPlugin } from '../../main';

export class ExampleListPanelModule implements PanelModule {
    id = 'example-lists';
    displayName = 'Example Lists';
    icon = ICONS.EXAMPLE_LIST_SVG;
    isActive = false;
    
    private plugin: PandocExtendedMarkdownPlugin;
    private exampleItems: ExampleListItem[] = [];
    private containerEl: HTMLElement | null = null;
    private lastActiveMarkdownView: MarkdownView | null = null;
    
    constructor(plugin: PandocExtendedMarkdownPlugin) {
        this.plugin = plugin;
    }
    
    onActivate(containerEl: HTMLElement, activeView: MarkdownView | null): void {
        this.isActive = true;
        this.containerEl = containerEl;
        this.lastActiveMarkdownView = activeView;
        this.updateContent(activeView);
    }
    
    onDeactivate(): void {
        this.isActive = false;
        if (this.containerEl) {
            this.containerEl.empty();
            this.containerEl = null;
        }
    }
    
    onUpdate(activeView: MarkdownView | null): void {
        if (!this.isActive || !this.containerEl) return;
        
        if (activeView && activeView.file) {
            this.lastActiveMarkdownView = activeView;
        } else if (!activeView) {
            activeView = this.lastActiveMarkdownView;
        }
        
        this.updateContent(activeView);
    }
    
    shouldUpdate(): boolean {
        return this.isActive;
    }
    
    destroy(): void {
        this.onDeactivate();
        this.exampleItems = [];
        this.lastActiveMarkdownView = null;
    }
    
    private updateContent(activeView: MarkdownView | null): void {
        if (!this.containerEl) return;
        
        this.containerEl.empty();
        
        if (!activeView || !activeView.file) {
            this.showNoFileMessage();
            return;
        }
        
        const content = activeView.editor.getValue();
        this.exampleItems = extractExampleLists(content);
        this.renderExampleItems(activeView);
    }
    
    private showNoFileMessage(): void {
        if (!this.containerEl) return;
        
        this.containerEl.createEl('div', {
            text: MESSAGES.NO_ACTIVE_FILE,
            cls: CSS_CLASSES.EXAMPLE_LIST_VIEW_EMPTY
        });
        this.exampleItems = [];
    }
    
    private extractExampleLists(content: string): ExampleListItem[] {
        return extractExampleLists(content);
    }
    
    private renderExampleItems(activeView: MarkdownView): void {
        if (!this.containerEl) return;
        
        if (this.exampleItems.length === 0) {
            this.containerEl.createEl('div', {
                text: MESSAGES.NO_EXAMPLE_LISTS,
                cls: CSS_CLASSES.EXAMPLE_LIST_VIEW_EMPTY
            });
            return;
        }
        
        const container = this.containerEl.createEl('table', {
            cls: CSS_CLASSES.EXAMPLE_LIST_VIEW_CONTAINER
        });
        
        const tbody = container.createEl('tbody');
        
        for (const item of this.exampleItems) {
            this.renderExampleRow(tbody, item, activeView);
        }
    }
    
    private renderExampleRow(tbody: HTMLElement, item: ExampleListItem, activeView: MarkdownView): void {
        const row = tbody.createEl('tr', {
            cls: CSS_CLASSES.EXAMPLE_LIST_VIEW_ROW
        });
        
        // Rendered number column
        const numberEl = row.createEl('td', {
            cls: CSS_CLASSES.EXAMPLE_LIST_VIEW_NUMBER
        });
        
        const displayNumber = this.truncateNumber(item.renderedNumber);
        numberEl.textContent = displayNumber;
        
        // Show popover on hover if truncated
        if (displayNumber !== String(item.renderedNumber)) {
            this.setupNumberHoverPreview(numberEl, String(item.renderedNumber));
        }
        
        // Raw label column
        const labelEl = row.createEl('td', {
            cls: CSS_CLASSES.EXAMPLE_LIST_VIEW_LABEL
        });
        
        const displayLabel = this.truncateRawLabel(item.rawLabel);
        labelEl.textContent = displayLabel;
        
        // Show popover on hover if truncated
        if (displayLabel !== item.rawLabel) {
            this.setupLabelHoverPreview(labelEl, item.rawLabel);
        }
        
        // Click to copy raw label syntax
        this.setupLabelClickHandler(labelEl, `(@${item.rawLabel.substring(1)})`);
        
        // Content column
        const contentEl = row.createEl('td', {
            cls: CSS_CLASSES.EXAMPLE_LIST_VIEW_CONTENT
        });
        
        const truncatedContent = truncateContentWithRendering(item.content);
        
        if (truncatedContent.includes('$')) {
            // Pass the plugin as the Component to avoid memory leaks
            renderContentWithMath(contentEl, truncatedContent, this.plugin.app, this.plugin);
        } else {
            contentEl.textContent = truncatedContent;
        }
        
        // Click to jump to line
        this.setupContentClickHandler(contentEl, item, activeView);
        
        // Show popover on hover if truncated
        if (truncatedContent !== item.content) {
            this.setupContentHoverPreview(contentEl, item);
        }
    }
    
    private truncateNumber(number: number): string {
        const str = String(number);
        // Truncate at the third digit (don't truncate 99, truncate 100 to 10…)
        if (str.length > 2) {
            return str.substring(0, 2) + '…';
        }
        return str;
    }
    
    private truncateRawLabel(label: string): string {
        // Similar to custom label truncation logic
        if (label.length > UI_CONSTANTS.LABEL_MAX_LENGTH) {
            return label.slice(0, UI_CONSTANTS.LABEL_TRUNCATION_LENGTH) + '…';
        }
        return label;
    }
    
    private setupNumberHoverPreview(element: HTMLElement, fullNumber: string): void {
        setupSimpleHoverPreview(element, fullNumber, CSS_CLASSES.HOVER_POPOVER_LABEL);
    }
    
    private setupLabelHoverPreview(element: HTMLElement, fullLabel: string): void {
        setupSimpleHoverPreview(element, fullLabel, CSS_CLASSES.HOVER_POPOVER_LABEL);
    }
    
    private setupLabelClickHandler(element: HTMLElement, rawLabelSyntax: string): void {
        element.addEventListener('click', () => {
            try {
                navigator.clipboard.writeText(rawLabelSyntax).then(() => {
                    new Notice(MESSAGES.LABEL_COPIED);
                }).catch((error) => {
                    handleError(error, 'Copy label to clipboard');
                });
            } catch (error) {
                handleError(error, 'Label click handler');
            }
        });
    }
    
    private setupContentClickHandler(element: HTMLElement, item: ExampleListItem, activeView: MarkdownView): void {
        element.addEventListener('click', () => {
            try {
                if (activeView && activeView.editor) {
                    const editor = activeView.editor;
                    
                    // First, make the markdown view active
                    const leaves = this.plugin.app.workspace.getLeavesOfType("markdown");
                    const targetLeaf = leaves.find((leaf: any) => leaf.view === activeView);
                    if (targetLeaf) {
                        this.plugin.app.workspace.setActiveLeaf(targetLeaf, { focus: true });
                    }
                    
                    // Then scroll to position
                    editor.setCursor(item.position);
                    editor.scrollIntoView({ from: item.position, to: item.position }, true);
                    
                    // Add highlight effect
                    highlightLine(activeView, item.lineNumber);
                }
            } catch (error) {
                handleError(error, 'Scroll to example list');
            }
        });
    }
    
    private setupContentHoverPreview(element: HTMLElement, item: ExampleListItem): void {
        let hoverPopover: HTMLElement | null = null;
        
        const removePopover = () => {
            if (hoverPopover) {
                hoverPopover.remove();
                hoverPopover = null;
            }
        };
        
        element.addEventListener('mouseenter', () => {
            hoverPopover = this.createContentHoverElement(item, element);
        });
        
        element.addEventListener('mouseleave', removePopover);
        element.addEventListener('click', removePopover);
    }
    
    private createContentHoverElement(item: ExampleListItem, element: HTMLElement): HTMLElement {
        const hoverEl = document.createElement('div');
        hoverEl.classList.add(CSS_CLASSES.HOVER_POPOVER, CSS_CLASSES.HOVER_POPOVER_CONTENT);
        
        this.renderHoverContent(hoverEl, item);
        document.body.appendChild(hoverEl);
        this.positionHoverElement(hoverEl, element);
        
        return hoverEl;
    }
    
    private renderHoverContent(hoverEl: HTMLElement, item: ExampleListItem): void {
        if (item.content.includes('$')) {
            // Pass the plugin as the Component to avoid memory leaks
            MarkdownRenderer.render(
                this.plugin.app,
                item.content,
                hoverEl,
                '',
                this.plugin
            );
        } else {
            hoverEl.textContent = item.content;
        }
    }
    
    private positionHoverElement(hoverEl: HTMLElement, referenceEl: HTMLElement): void {
        positionHoverElement(hoverEl, referenceEl, UI_CONSTANTS.MAX_HOVER_WIDTH, UI_CONSTANTS.MAX_HOVER_HEIGHT);
    }
}