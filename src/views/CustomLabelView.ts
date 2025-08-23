// External libraries
import { ItemView, WorkspaceLeaf, MarkdownView, Notice, HoverLinkSource, EditorPosition, MarkdownRenderer } from 'obsidian';

// Types
import { PandocExtendedMarkdownPlugin } from '../main';

// Constants
import { CSS_CLASSES, MESSAGES, UI_CONSTANTS } from '../constants';

// Patterns
import { ListPatterns } from '../patterns';

// Utils
import { PlaceholderContext } from '../utils/placeholderProcessor';
import { withErrorBoundary } from '../utils/errorHandler';

export const VIEW_TYPE_CUSTOM_LABEL = 'custom-label-view';

interface CustomLabel {
    label: string;          // Rendered label (e.g., "(P1)")
    rawLabel: string;       // Raw label text (e.g., "{::P(#a)}")
    content: string;        // List content (raw markdown)
    renderedContent?: string; // Rendered content (with processed references)
    lineNumber: number;     // 0-indexed line number
    position: EditorPosition; // Position in editor
}

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
        return 'list-ordered';
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
        withErrorBoundary(() => {
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
        }, undefined, 'CustomLabelView.updateView');
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
     * Processes placeholders and builds label information.
     */
    private extractCustomLabels(content: string): CustomLabel[] {
        return withErrorBoundary(() => {
            const lines = content.split('\n');
            const labels: CustomLabel[] = [];
            
            // Check if plugin settings allow custom labels
            if (!this.plugin.settings?.moreExtendedSyntax) {
                return labels;
            }
            
            // Process labels with placeholder context
            const { processedLabels, rawToProcessed } = this.processLabels(lines);
            
            // Extract label information
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const match = ListPatterns.isCustomLabelList(line);
                
                if (match) {
                    const fullMarker = match[2];
                    const rawLabel = match[3];
                    const restOfLine = line.substring(match[0].length);
                    
                    // Get processed label
                    const processedLabel = rawToProcessed.get(rawLabel) || rawLabel;
                    
                    // Build the rendered label - just show the processed label without wrapper syntax
                    const renderedLabel = processedLabel;
                    
                    // Process content to replace references with rendered forms
                    let renderedContent = restOfLine.trim();
                    // Replace custom label references in content
                    const refPattern = /\{::([^}]+)\}/g;
                    renderedContent = renderedContent.replace(refPattern, (match, ref) => {
                        const processedRef = rawToProcessed.get(ref) || ref;
                        return processedRef;
                    });
                    
                    labels.push({
                        label: renderedLabel,
                        rawLabel: fullMarker,
                        content: restOfLine.trim(),
                        renderedContent: renderedContent,
                        lineNumber: i,
                        position: { line: i, ch: 0 }
                    });
                }
            }
            
            return labels;
        }, [], 'CustomLabelView.extractCustomLabels');
    }

    /**
     * Process labels with placeholders.
     * Returns processed labels and raw-to-processed mapping.
     */
    private processLabels(lines: string[]): { 
        processedLabels: Map<string, string>, 
        rawToProcessed: Map<string, string> 
    } {
        const placeholderContext = new PlaceholderContext();
        const processedLabels = new Map<string, string>();
        const rawToProcessed = new Map<string, string>();
        
        // Process all labels using PlaceholderContext
        for (const line of lines) {
            const match = ListPatterns.isCustomLabelList(line);
            if (match) {
                const rawLabel = match[3];
                const restOfLine = line.substring(match[0].length);
                
                // Use PlaceholderContext to process the label
                const processedLabel = placeholderContext.processLabel(rawLabel);
                
                processedLabels.set(processedLabel, restOfLine.trim());
                rawToProcessed.set(rawLabel, processedLabel);
            }
        }
        
        return { processedLabels, rawToProcessed };
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
        const displayLabel = this.truncateLabel(label.label);
        labelEl.textContent = displayLabel;
        
        // Setup hover preview for truncated labels (consistent with content preview)
        if (displayLabel !== label.label) {
            this.setupLabelHoverPreview(labelEl, label.label);
        }
        
        // Label click handler - copy raw label
        labelEl.addEventListener('click', async () => {
            await withErrorBoundary(async () => {
                await navigator.clipboard.writeText(label.rawLabel);
                new Notice(MESSAGES.LABEL_COPIED);
            }, undefined, 'CustomLabelView.copyLabel');
        });
        
        // Content column
        const contentEl = row.createEl('div', {
            cls: CSS_CLASSES.CUSTOM_LABEL_VIEW_CONTENT
        });
        
        // Use rendered content if available, truncate to max 51 chars
        const contentToShow = label.renderedContent || label.content;
        const truncatedContent = this.truncateContent(contentToShow);
        
        // Check if content has math to render
        if (contentToShow.includes('$')) {
            // Render content with math support
            this.renderContentWithMath(contentEl, truncatedContent, contentToShow);
        } else {
            contentEl.textContent = truncatedContent;
        }
        
        // Content click handler - scroll to position
        contentEl.addEventListener('click', () => {
            withErrorBoundary(() => {
                // Use the last active markdown view
                const targetView = this.lastActiveMarkdownView;
                if (targetView && targetView.editor) {
                    const editor = targetView.editor;
                    
                    // First, make the markdown view active
                    const leaves = this.app.workspace.getLeavesOfType("markdown");
                    const targetLeaf = leaves.find(leaf => leaf.view === targetView);
                    if (targetLeaf) {
                        this.app.workspace.setActiveLeaf(targetLeaf, { focus: true });
                    }
                    
                    // Then scroll to position
                    editor.setCursor(label.position);
                    editor.scrollIntoView({ from: label.position, to: label.position }, true);
                    
                    // Add highlight effect
                    this.highlightLine(targetView, label.lineNumber);
                }
            }, undefined, 'CustomLabelView.scrollToLabel');
        });
        
        // Content hover handler - only show tooltip if content is truncated
        if (truncatedContent !== contentToShow) {
            this.setupHoverPreview(contentEl, label, activeView);
        }
    }

    private truncateLabel(label: string): string {
        // Truncate at 6 characters, replace 6th with ellipsis if longer
        if (label.length > 6) {
            return label.slice(0, 5) + '…';
        }
        return label;
    }

    private truncateContent(content: string): string {
        // Truncate at 51 characters, replace 51st with ellipsis if longer
        if (content.length > 51) {
            return content.slice(0, 50) + '…';
        }
        return content;
    }

    private highlightLine(view: MarkdownView, lineNumber: number) {
        withErrorBoundary(() => {
            const editor = view.editor;
            
            // Use selection approach for visual feedback
            const lineContent = editor.getLine(lineNumber);
            const lineStart = { line: lineNumber, ch: 0 };
            const lineEnd = { line: lineNumber, ch: lineContent.length };
            
            // Select the entire line
            editor.setSelection(lineStart, lineEnd);
            
            // Add fade effect to the selection
            const cm = (editor as any).cm;
            if (cm && cm.dom) {
                const selections = cm.dom.querySelectorAll('.cm-selectionBackground');
                selections.forEach((sel: HTMLElement) => {
                    sel.style.transition = 'opacity 2s ease-out';
                    sel.style.opacity = '0.3';
                    
                    setTimeout(() => {
                        sel.style.opacity = '0';
                    }, UI_CONSTANTS.SELECTION_FADE_DELAY_MS);
                });
            }
            
            // Clear selection after a brief moment
            setTimeout(() => {
                editor.setCursor(lineStart);
            }, UI_CONSTANTS.SELECTION_CLEAR_DELAY_MS);
        }, undefined, 'CustomLabelView.highlightLine');
    }

    private setupLabelHoverPreview(element: HTMLElement, fullLabel: string) {
        // Show full label in preview style on hover
        let hoverPopover: HTMLElement | null = null;
        
        const removePopover = () => {
            if (hoverPopover) {
                hoverPopover.remove();
                hoverPopover = null;
            }
        };
        
        element.addEventListener('mouseenter', () => {
            // Create a popover to show full label
            const hoverEl = document.createElement('div');
            hoverEl.classList.add(CSS_CLASSES.CUSTOM_LABEL_HOVER_PREVIEW);
            
            Object.assign(hoverEl.style, {
                position: 'absolute',
                zIndex: UI_CONSTANTS.HOVER_Z_INDEX,
                padding: UI_CONSTANTS.HOVER_PADDING,
                backgroundColor: 'var(--background-primary)',
                border: '1px solid var(--background-modifier-border)',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                fontSize: '0.9em',
                fontFamily: 'var(--font-monospace)',
                whiteSpace: 'nowrap'
            });
            
            // Set the full label text
            hoverEl.textContent = fullLabel;
            
            // Position near the element
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
        });
        
        element.addEventListener('mouseleave', removePopover);
        element.addEventListener('click', removePopover);
    }
    
    private renderContentWithMath(element: HTMLElement, truncatedContent: string, fullContent: string) {
        // Use MarkdownRenderer for proper math rendering
        MarkdownRenderer.render(
            this.plugin.app,
            truncatedContent,
            element,
            '',
            this
        );
    }
    
    private setupHoverPreview(element: HTMLElement, label: CustomLabel, view: MarkdownView) {
        // Show full content preview on hover when content is truncated
        let hoverPopover: HTMLElement | null = null;
        
        const removePopover = () => {
            if (hoverPopover) {
                hoverPopover.remove();
                hoverPopover = null;
            }
        };
        
        element.addEventListener('mouseenter', () => {
            // Create a popover to show full content with proper rendering
            const hoverEl = document.createElement('div');
            hoverEl.classList.add(CSS_CLASSES.CUSTOM_LABEL_HOVER_PREVIEW);
            
            Object.assign(hoverEl.style, {
                position: 'absolute',
                zIndex: UI_CONSTANTS.HOVER_Z_INDEX,
                padding: UI_CONSTANTS.HOVER_PADDING,
                backgroundColor: 'var(--background-primary)',
                border: '1px solid var(--background-modifier-border)',
                borderRadius: '4px',
                maxWidth: UI_CONSTANTS.MAX_HOVER_WIDTH,
                maxHeight: UI_CONSTANTS.MAX_HOVER_HEIGHT,
                overflow: 'auto',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                fontSize: '0.9em',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
            });
            
            // Use rendered content for display
            const contentToShow = label.renderedContent || label.content;
            
            // For math rendering, check if content contains math delimiters
            if (contentToShow.includes('$')) {
                // Use MarkdownRenderer for proper math rendering
                MarkdownRenderer.render(
                    this.plugin.app,
                    contentToShow,
                    hoverEl,
                    '',
                    this
                );
            } else {
                // Plain text content
                hoverEl.textContent = contentToShow;
            }
            
            // Position near the element
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
        });
        
        element.addEventListener('mouseleave', removePopover);
        element.addEventListener('click', removePopover);
    }

    getCustomLabels(): CustomLabel[] {
        return this.labels;
    }
}