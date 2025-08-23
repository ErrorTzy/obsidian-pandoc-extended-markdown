import { MarkdownView } from 'obsidian';
import { PanelModule } from './PanelTypes';
import { PandocExtendedMarkdownPlugin } from '../../main';
import { CSS_CLASSES, MESSAGES, ICONS } from '../../constants';
import { CustomLabel, extractCustomLabels } from '../../utils/customLabelExtractor';
import { truncateLabel, truncateContentWithRendering } from '../../utils/views/contentTruncator';
import {
    setupLabelClickHandler,
    setupContentClickHandler,
    setupLabelHoverPreview,
    renderContentWithMath,
    setupContentHoverPreview
} from '../../utils/views/viewInteractions';

export class CustomLabelPanelModule implements PanelModule {
    id = 'custom-labels';
    displayName = 'Custom Labels';
    icon = ICONS.CUSTOM_LABEL_SVG;
    isActive = false;
    
    private plugin: PandocExtendedMarkdownPlugin;
    private labels: CustomLabel[] = [];
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
            setupLabelHoverPreview(labelEl, label.label);
        }
        
        setupLabelClickHandler(labelEl, label.rawLabel);
        
        const contentEl = row.createEl('td', {
            cls: CSS_CLASSES.CUSTOM_LABEL_VIEW_CONTENT
        });
        
        const contentToShow = label.renderedContent || label.content;
        const truncatedContent = truncateContentWithRendering(contentToShow);
        
        if (truncatedContent.includes('$')) {
            // Create a proper HoverLinkSource-compatible object
            const hoverSource = {
                hoverLinkSource: {
                    display: MESSAGES.CUSTOM_LABELS_VIEW_TITLE,
                    defaultMod: true
                }
            };
            renderContentWithMath(contentEl, truncatedContent, this.plugin.app, hoverSource);
        } else {
            contentEl.textContent = truncatedContent;
        }
        
        setupContentClickHandler(contentEl, label, this.lastActiveMarkdownView, this.plugin.app);
        
        if (truncatedContent !== contentToShow) {
            // Create a proper HoverLinkSource-compatible object
            const hoverSource = {
                hoverLinkSource: {
                    display: MESSAGES.CUSTOM_LABELS_VIEW_TITLE,
                    defaultMod: true
                }
            };
            setupContentHoverPreview(contentEl, label, this.plugin.app, hoverSource);
        }
    }
    
    getCustomLabels(): CustomLabel[] {
        return this.labels;
    }
}