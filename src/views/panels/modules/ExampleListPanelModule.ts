// External libraries
import { MarkdownView, Notice } from 'obsidian';

// Base class
import { BasePanelModule } from './BasePanelModule';

// Constants
import { CSS_CLASSES, MESSAGES, ICONS, UI_CONSTANTS } from '../../../core/constants';

// Utils
import { truncateContentWithRendering } from '../utils/contentTruncator';
import { renderContentWithMath } from '../utils/viewInteractions';
import { handleError } from '../../../shared/utils/errorHandler';
import { ExampleListItem, extractExampleLists } from '../../../shared/extractors/exampleListExtractor';
import { setupSimpleHoverPreview, setupRenderedHoverPreview } from '../../../shared/utils/hoverPopovers';
import { highlightLine } from '../../editor/highlightUtils';
import { extractCustomLabels } from '../../../shared/extractors/customLabelExtractor';

export class ExampleListPanelModule extends BasePanelModule {
    id = 'example-lists';
    displayName = 'Example Lists';
    icon = ICONS.EXAMPLE_LIST_SVG;

    private exampleItems: ExampleListItem[] = [];
    
    protected cleanupModuleData(): void {
        this.exampleItems = [];
    }

    protected extractData(content: string): void {
        this.exampleItems = extractExampleLists(content);
    }

    protected renderContent(activeView: MarkdownView): void {
        this.renderExampleItems(activeView);
    }
    
    protected showNoFileMessage(): void {
        if (!this.containerEl) return;

        this.containerEl.createEl('div', {
            text: MESSAGES.NO_ACTIVE_FILE,
            cls: CSS_CLASSES.EXAMPLE_LIST_VIEW_EMPTY
        });
        this.exampleItems = [];
    }
    
    /**
     * Build the rendering context for processing content references
     * @param content The document content to extract context from
     */
    protected buildRenderingContext(content: string): void {
        // Call parent to build base context
        super.buildRenderingContext(content);

        // Build example labels map from current items
        const exampleLabels = new Map<string, number>();
        this.exampleItems.forEach(item => {
            // Extract label from rawLabel (e.g., "@a" -> "a")
            const label = item.rawLabel.substring(1);
            if (label) {
                exampleLabels.set(label, item.renderedNumber);
            }
        });

        // Extract custom labels for reference processing if enabled
        const rawToProcessed = new Map<string, string>();
        if (this.plugin.settings?.moreExtendedSyntax) {
            const customLabels = extractCustomLabels(content, true);
            customLabels.forEach(label => {
                // Extract the raw label without the {::} wrapper
                const match = label.rawLabel.match(/\{::([^}]+)\}/);
                if (match) {
                    rawToProcessed.set(match[1], label.label);
                }
            });
        }

        this.currentContext = {
            ...this.currentContext,
            exampleLabels,
            rawToProcessed
        };
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
        
        // Always use renderContentWithMath to handle all markdown, math, and references
        renderContentWithMath(contentEl, truncatedContent, this.plugin.app, this.plugin, this.currentContext);
        
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
        setupSimpleHoverPreview(element, fullLabel, CSS_CLASSES.HOVER_POPOVER_LABEL, this.abortController?.signal);
    }
    
    private setupLabelClickHandler(element: HTMLElement, rawLabelSyntax: string): void {
        const clickHandler = () => {
            try {
                navigator.clipboard.writeText(rawLabelSyntax).then(() => {
                    new Notice(MESSAGES.LABEL_COPIED);
                }).catch((error) => {
                    handleError(error, 'Copy label to clipboard');
                });
            } catch (error) {
                handleError(error, 'Label click handler');
            }
        };
        
        element.addEventListener('click', clickHandler, { signal: this.abortController?.signal });
    }
    
    private setupContentClickHandler(element: HTMLElement, item: ExampleListItem, activeView: MarkdownView): void {
        const clickHandler = () => {
            try {
                if (activeView && activeView.editor) {
                    const editor = activeView.editor;
                    
                    // First, make the markdown view active
                    const leaves = this.plugin.app.workspace.getLeavesOfType("markdown");
                    const targetLeaf = leaves.find((leaf) => leaf.view === activeView);
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
        };
        
        element.addEventListener('click', clickHandler, { signal: this.abortController?.signal });
    }
    
    private setupContentHoverPreview(element: HTMLElement, item: ExampleListItem): void {
        // Use the more powerful setupRenderedHoverPreview that handles all references
        setupRenderedHoverPreview(
            element,
            item.content,
            this.plugin.app,
            this.plugin,
            this.currentContext,
            CSS_CLASSES.HOVER_POPOVER_CONTENT,
            this.abortController?.signal
        );
    }
}
