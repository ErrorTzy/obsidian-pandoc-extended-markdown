// External libraries
import { ItemView, WorkspaceLeaf, MarkdownView, HoverLinkSource } from 'obsidian';

// Types
import { PandocExtendedMarkdownPlugin } from '../main';

// Constants
import { CSS_CLASSES, MESSAGES, UI_CONSTANTS, ICONS } from '../constants';

// Utils
import { CustomLabel, extractCustomLabels } from '../utils/customLabelExtractor';
import { truncateLabel, truncateContentWithRendering } from '../utils/views/contentTruncator';
import {
    highlightLine,
    setupLabelClickHandler,
    setupContentClickHandler,
    setupLabelHoverPreview,
    renderContentWithMath,
    setupContentHoverPreview
} from '../utils/views/viewInteractions';

export const VIEW_TYPE_CUSTOM_LABEL = 'custom-label-view';

/**
 * Custom view for displaying labeled lists in a sidebar.
 * Shows all custom labels from the current markdown file in a two-column layout.
 */
export class CustomLabelView extends ItemView {
    private plugin: PandocExtendedMarkdownPlugin;
    private labels: CustomLabel[] = [];
    private updateTimer: NodeJS.Timeout | null = null;
    private lastActiveMarkdownView: MarkdownView | null = null;
    hoverLinkSource: HoverLinkSource;

    constructor(leaf: WorkspaceLeaf, plugin: PandocExtendedMarkdownPlugin) {
        super(leaf);
        this.plugin = plugin;
        
        // Configure hover link source
        this.hoverLinkSource = {
            display: MESSAGES.CUSTOM_LABELS_VIEW_TITLE,
            defaultMod: true
        };
    }

    getViewType(): string {
        return VIEW_TYPE_CUSTOM_LABEL;
    }

    getDisplayText(): string {
        return MESSAGES.CUSTOM_LABELS_VIEW_TITLE;
    }

    getIcon(): string {
        return ICONS.CUSTOM_LABEL_ID;
    }

    async onOpen() {
        await this.updateView();
        
        // Register event listeners for file changes
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                this.scheduleUpdate();
            })
        );
        
        this.registerEvent(
            this.app.workspace.on('editor-change', () => {
                this.scheduleUpdate();
            })
        );
        
        // Also listen for file open events
        this.registerEvent(
            this.app.workspace.on('file-open', () => {
                this.scheduleUpdate();
            })
        );
        
        // Listen for layout changes (switching between preview/edit modes)
        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                this.scheduleUpdate();
            })
        );
        
        // Register hover link source
        this.plugin.registerHoverLinkSource(VIEW_TYPE_CUSTOM_LABEL, this.hoverLinkSource);
    }

    async onClose() {
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }
        // Clear content safely
        while (this.contentEl.firstChild) {
            this.contentEl.removeChild(this.contentEl.firstChild);
        }
    }

    private scheduleUpdate() {
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }
        
        // Debounce updates to avoid excessive processing
        this.updateTimer = setTimeout(() => {
            this.updateView();
        }, UI_CONSTANTS.UPDATE_DEBOUNCE_MS);
    }

    async updateView() {
        try {
            // Try to get the active markdown view
            const activeLeaf = this.app.workspace.activeLeaf;
            let markdownView: MarkdownView | null = null;
            
            // Check if the active leaf has a markdown view
            if (activeLeaf && activeLeaf.view instanceof MarkdownView) {
                markdownView = activeLeaf.view as MarkdownView;
                // Save it as the last active markdown view
                if (markdownView.file) {
                    this.lastActiveMarkdownView = markdownView;
                }
            }
            
            // If no active markdown view, try to use the last one we saw
            if (!markdownView || !markdownView.file) {
                markdownView = this.lastActiveMarkdownView;
            }
            
            // If still no markdown view available, show message
            if (!markdownView || !markdownView.file) {
                this.showNoFileMessage();
                return;
            }
            
            const content = markdownView.editor.getValue();
            this.labels = this.extractCustomLabels(content);
            this.renderLabels(markdownView);
        } catch (error) {
            console.error('Error updating CustomLabelView:', error);
            this.showNoFileMessage();
        }
    }

    private showNoFileMessage() {
        // Clear content safely
        while (this.contentEl.firstChild) {
            this.contentEl.removeChild(this.contentEl.firstChild);
        }
        
        this.contentEl.createEl('div', {
            text: MESSAGES.NO_ACTIVE_FILE,
            cls: CSS_CLASSES.CUSTOM_LABEL_VIEW_EMPTY
        });
        this.labels = [];
    }

    /**
     * Extracts custom labels from markdown content.
     * Delegates to the customLabelExtractor utility.
     */
    private extractCustomLabels(content: string): CustomLabel[] {
        return extractCustomLabels(content, this.plugin.settings?.moreExtendedSyntax || false);
    }

    private renderLabels(activeView: MarkdownView) {
        // Clear content safely
        while (this.contentEl.firstChild) {
            this.contentEl.removeChild(this.contentEl.firstChild);
        }
        
        if (this.labels.length === 0) {
            this.contentEl.createEl('div', {
                text: MESSAGES.NO_CUSTOM_LABELS,
                cls: CSS_CLASSES.CUSTOM_LABEL_VIEW_EMPTY
            });
            return;
        }
        
        const container = this.contentEl.createEl('div', {
            cls: CSS_CLASSES.CUSTOM_LABEL_VIEW_CONTAINER
        });
        
        // Create header
        const header = container.createEl('div', {
            cls: CSS_CLASSES.CUSTOM_LABEL_VIEW_HEADER
        });
        header.createEl('span', { 
            text: 'Label', 
            cls: CSS_CLASSES.CUSTOM_LABEL_VIEW_HEADER_LABEL 
        });
        header.createEl('span', { 
            text: 'Content', 
            cls: CSS_CLASSES.CUSTOM_LABEL_VIEW_HEADER_CONTENT 
        });
        
        // Create label rows
        for (const label of this.labels) {
            this.renderLabelRow(container, label, activeView);
        }
    }

    private renderLabelRow(container: HTMLElement, label: CustomLabel, activeView: MarkdownView) {
        const row = container.createEl('div', {
            cls: CSS_CLASSES.CUSTOM_LABEL_VIEW_ROW
        });
        
        // Label column
        const labelEl = row.createEl('div', {
            cls: CSS_CLASSES.CUSTOM_LABEL_VIEW_LABEL
        });
        
        // Truncate label if needed and display it
        const displayLabel = truncateLabel(label.label);
        labelEl.textContent = displayLabel;
        
        // Setup hover preview for truncated labels (consistent with content preview)
        if (displayLabel !== label.label) {
            setupLabelHoverPreview(labelEl, label.label);
        }
        
        // Label click handler - copy raw label
        setupLabelClickHandler(labelEl, label.rawLabel);
        
        // Content column
        const contentEl = row.createEl('div', {
            cls: CSS_CLASSES.CUSTOM_LABEL_VIEW_CONTENT
        });
        
        // Use rendered content if available, truncate based on rendered length
        const contentToShow = label.renderedContent || label.content;
        const truncatedContent = truncateContentWithRendering(contentToShow);
        
        // Check if content has math to render
        if (truncatedContent.includes('$')) {
            // Render content with math support
            renderContentWithMath(contentEl, truncatedContent, this.plugin.app, this);
        } else {
            contentEl.textContent = truncatedContent;
        }
        
        // Content click handler - scroll to position
        setupContentClickHandler(contentEl, label, this.lastActiveMarkdownView, this.app);
        
        // Content hover handler - only show tooltip if content is truncated
        if (truncatedContent !== contentToShow) {
            setupContentHoverPreview(contentEl, label, this.plugin.app, this);
        }
    }


    getCustomLabels(): CustomLabel[] {
        return this.labels;
    }
}