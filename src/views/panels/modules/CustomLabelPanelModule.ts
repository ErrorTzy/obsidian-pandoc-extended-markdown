import { MarkdownView } from 'obsidian';
import { PanelModule } from './PanelTypes';
import { PandocExtendedMarkdownPlugin } from '../../../core/main';
import { CSS_CLASSES, MESSAGES, ICONS } from '../../../core/constants';
import { CustomLabel, extractCustomLabels } from '../../../shared/extractors/customLabelExtractor';
import { truncateLabel, truncateContentWithRendering } from '../utils/contentTruncator';
import {
    setupLabelClickHandler,
    setupContentClickHandler,
    setupLabelHoverPreview,
    renderContentWithMath
} from '../utils/viewInteractions';
import { setupRenderedHoverPreview } from '../../../shared/utils/hoverPopovers';
import { extractExampleLists } from '../../../shared/extractors/exampleListExtractor';
import { ProcessingContext } from '../../../shared/rendering/ContentProcessorRegistry';

export class CustomLabelPanelModule implements PanelModule {
    id = 'custom-labels';
    displayName = 'Custom Labels';
    icon = ICONS.CUSTOM_LABEL_SVG;
    isActive = false;
    
    private plugin: PandocExtendedMarkdownPlugin;
    private labels: CustomLabel[] = [];
    private containerEl: HTMLElement | null = null;
    private lastActiveMarkdownView: MarkdownView | null = null;
    private abortController: AbortController | null = null;
    private currentContext: ProcessingContext = {};
    
    constructor(plugin: PandocExtendedMarkdownPlugin) {
        this.plugin = plugin;
    }
    
    onActivate(containerEl: HTMLElement, activeView: MarkdownView | null): void {
        this.isActive = true;
        this.containerEl = containerEl;
        this.lastActiveMarkdownView = activeView;
        // Create new abort controller for cleanup
        this.abortController = new AbortController();
        this.updateContent(activeView);
    }
    
    onDeactivate(): void {
        this.isActive = false;
        // Clean up all event listeners
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
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
        this.labels = [];
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
        this.labels = this.extractCustomLabels(content);
        
        // Build context for reference processing
        this.buildRenderingContext(content);
        
        this.renderLabels(activeView);
    }
    
    private showNoFileMessage(): void {
        if (!this.containerEl) return;
        
        this.containerEl.createEl('div', {
            text: MESSAGES.NO_ACTIVE_FILE,
            cls: CSS_CLASSES.CUSTOM_LABEL_VIEW_EMPTY
        });
        this.labels = [];
    }
    
    private extractCustomLabels(content: string): CustomLabel[] {
        return extractCustomLabels(content, this.plugin.settings?.moreExtendedSyntax || false);
    }
    
    /**
     * Build the rendering context for processing content references
     * @param content The document content to extract context from
     */
    private buildRenderingContext(content: string): void {
        // Extract example labels for reference processing
        const exampleItems = extractExampleLists(content);
        const exampleLabels = new Map<string, number>();
        exampleItems.forEach(item => {
            // Extract label from rawLabel (e.g., "@a" -> "a")
            const label = item.rawLabel.substring(1);
            if (label) {
                exampleLabels.set(label, item.renderedNumber);
            }
        });
        
        // Build rawToProcessed map for custom labels
        const rawToProcessed = new Map<string, string>();
        this.labels.forEach(label => {
            // Extract the raw label without the {::} wrapper
            const match = label.rawLabel.match(/\{::([^}]+)\}/);
            if (match) {
                rawToProcessed.set(match[1], label.label);
            }
        });
        
        this.currentContext = {
            exampleLabels,
            rawToProcessed
        };
    }
    
    private renderLabels(activeView: MarkdownView): void {
        if (!this.containerEl) return;
        
        if (this.labels.length === 0) {
            this.containerEl.createEl('div', {
                text: MESSAGES.NO_CUSTOM_LABELS,
                cls: CSS_CLASSES.CUSTOM_LABEL_VIEW_EMPTY
            });
            return;
        }
        
        const container = this.containerEl.createEl('table', {
            cls: CSS_CLASSES.CUSTOM_LABEL_VIEW_CONTAINER
        });
        
        const tbody = container.createEl('tbody');
        
        for (const label of this.labels) {
            this.renderLabelRow(tbody, label, activeView);
        }
    }
    
    private renderLabelRow(tbody: HTMLElement, label: CustomLabel, activeView: MarkdownView): void {
        const row = tbody.createEl('tr', {
            cls: CSS_CLASSES.CUSTOM_LABEL_VIEW_ROW
        });
        
        const labelEl = row.createEl('td', {
            cls: CSS_CLASSES.CUSTOM_LABEL_VIEW_LABEL
        });
        
        const displayLabel = truncateLabel(label.label);
        labelEl.textContent = displayLabel;
        
        if (displayLabel !== label.label) {
            setupLabelHoverPreview(labelEl, label.label, this.abortController?.signal);
        }
        
        setupLabelClickHandler(labelEl, label.rawLabel, this.abortController?.signal);
        
        const contentEl = row.createEl('td', {
            cls: CSS_CLASSES.CUSTOM_LABEL_VIEW_CONTENT
        });
        
        const contentToShow = label.renderedContent || label.content;
        const truncatedContent = truncateContentWithRendering(contentToShow);
        
        // Always use renderContentWithMath to handle all markdown, math, and references
        renderContentWithMath(contentEl, truncatedContent, this.plugin.app, this.plugin, this.currentContext);
        
        setupContentClickHandler(contentEl, label, this.lastActiveMarkdownView, this.plugin.app, this.abortController?.signal);
        
        if (truncatedContent !== contentToShow) {
            // Use the more powerful setupRenderedHoverPreview that handles all references
            setupRenderedHoverPreview(
                contentEl,
                contentToShow,
                this.plugin.app,
                this.plugin,
                this.currentContext,
                CSS_CLASSES.HOVER_POPOVER_CONTENT,
                this.abortController?.signal
            );
        }
    }
    
    getCustomLabels(): CustomLabel[] {
        return this.labels;
    }
}