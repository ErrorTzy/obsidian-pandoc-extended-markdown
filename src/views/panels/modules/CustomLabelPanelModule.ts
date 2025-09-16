// External libraries
import { MarkdownView } from 'obsidian';

// Types
import { CustomLabel } from '../../../shared/extractors/customLabelExtractor';

// Constants
import { CSS_CLASSES, MESSAGES, ICONS } from '../../../core/constants';

// Utils
import { extractCustomLabels } from '../../../shared/extractors/customLabelExtractor';
import { truncateLabel, truncateContentWithRendering } from '../utils/contentTruncator';
import {
    setupLabelClickHandler,
    setupContentClickHandler,
    setupLabelHoverPreview,
    renderContentWithMath
} from '../utils/viewInteractions';
import { setupRenderedHoverPreview } from '../../../shared/utils/hoverPopovers';

// Internal modules
import { BasePanelModule } from './BasePanelModule';
import { PandocExtendedMarkdownPlugin } from '../../../core/main';

export class CustomLabelPanelModule extends BasePanelModule {
    id = 'custom-labels';
    displayName = 'Custom Labels';
    icon = ICONS.CUSTOM_LABEL_SVG;

    private labels: CustomLabel[] = [];
    
    protected cleanupModuleData(): void {
        this.labels = [];
    }

    protected extractData(content: string): void {
        this.labels = extractCustomLabels(content, this.plugin.settings?.moreExtendedSyntax || false);
    }

    protected renderContent(activeView: MarkdownView): void {
        this.renderLabels(activeView);
    }
    
    protected showNoFileMessage(): void {
        if (!this.containerEl) return;

        this.containerEl.createEl('div', {
            text: MESSAGES.NO_ACTIVE_FILE,
            cls: CSS_CLASSES.CUSTOM_LABEL_VIEW_EMPTY
        });
        this.labels = [];
    }
    
    /**
     * Build the rendering context for processing content references
     * @param content The document content to extract context from
     */
    protected buildRenderingContext(content: string): void {
        // Call parent to build base context
        super.buildRenderingContext(content);

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
            ...this.currentContext,
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