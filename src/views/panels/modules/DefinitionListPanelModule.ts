// External libraries
import { MarkdownView } from 'obsidian';

// Types
import { PanelModule } from './PanelTypes';

// Constants
import { CSS_CLASSES, MESSAGES, ICONS, UI_CONSTANTS } from '../../../core/constants';

// Utils
import { truncateContentWithRendering } from '../utils/contentTruncator';
import { renderContentWithMath } from '../utils/viewInteractions';
import { handleError } from '../../../shared/utils/errorHandler';
import { DefinitionListItem, extractDefinitionLists } from '../../../shared/extractors/definitionListExtractor';
import { setupSimpleHoverPreview, setupRenderedHoverPreview } from '../../../shared/utils/hoverPopovers';
import { highlightLine } from '../../editor/highlightUtils';
import { extractCustomLabels } from '../../../shared/extractors/customLabelExtractor';
import { extractExampleLists } from '../../../shared/extractors/exampleListExtractor';
import { ProcessingContext } from '../../../shared/rendering/ContentProcessorRegistry';

// Internal modules
import { PandocExtendedMarkdownPlugin } from '../../../core/main';

export class DefinitionListPanelModule implements PanelModule {
    id = 'definition-lists';
    displayName = 'Definition Lists';
    icon = ICONS.DEFINITION_LIST_SVG;
    isActive = false;
    
    private plugin: PandocExtendedMarkdownPlugin;
    private definitionItems: DefinitionListItem[] = [];
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
        this.definitionItems = [];
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
        this.definitionItems = extractDefinitionLists(content);
        
        // Build context for reference processing
        this.buildRenderingContext(content);
        
        this.renderDefinitionItems(activeView);
    }
    
    private showNoFileMessage(): void {
        if (!this.containerEl) return;
        
        this.containerEl.createEl('div', {
            text: MESSAGES.NO_ACTIVE_FILE,
            cls: CSS_CLASSES.DEFINITION_LIST_VIEW_EMPTY
        });
        this.definitionItems = [];
    }
    
    /**
     * Build the rendering context for processing content references
     * @param content The document content to extract context from
     */
    private buildRenderingContext(content: string): void {
        // Build example labels map from the document
        const exampleItems = extractExampleLists(content);
        const exampleLabels = new Map<string, number>();
        exampleItems.forEach(item => {
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
            exampleLabels,
            rawToProcessed
        };
    }
    
    private renderDefinitionItems(activeView: MarkdownView): void {
        if (!this.containerEl) return;
        
        if (this.definitionItems.length === 0) {
            this.containerEl.createEl('div', {
                text: MESSAGES.NO_DEFINITION_LISTS,
                cls: CSS_CLASSES.DEFINITION_LIST_VIEW_EMPTY
            });
            return;
        }
        
        const container = this.containerEl.createEl('table', {
            cls: CSS_CLASSES.DEFINITION_LIST_VIEW_CONTAINER
        });
        
        const tbody = container.createEl('tbody');
        
        for (const item of this.definitionItems) {
            this.renderDefinitionRow(tbody, item, activeView);
        }
    }
    
    private renderDefinitionRow(tbody: HTMLElement, item: DefinitionListItem, activeView: MarkdownView): void {
        const row = tbody.createEl('tr', {
            cls: CSS_CLASSES.DEFINITION_LIST_VIEW_ROW
        });
        
        // Term column
        const termEl = row.createEl('td', {
            cls: CSS_CLASSES.DEFINITION_LIST_VIEW_TERM
        });
        
        // Render the term with full markdown/math/reference processing
        const truncatedTerm = this.truncateTermWithRendering(item.term);
        renderContentWithMath(termEl, truncatedTerm, this.plugin.app, this.plugin, this.currentContext);
        
        // Show popover on hover if truncated
        if (truncatedTerm !== item.term) {
            this.setupTermHoverPreview(termEl, item.term);
        }
        
        // No click handler for terms (unlike labels)
        
        // Definitions column
        const definitionsEl = row.createEl('td', {
            cls: CSS_CLASSES.DEFINITION_LIST_VIEW_DEFINITIONS
        });
        
        // Handle single vs multiple definitions
        if (item.definitions.length === 1) {
            // Single definition - render directly
            const truncatedContent = truncateContentWithRendering(item.definitions[0], UI_CONSTANTS.DEFINITION_MAX_LENGTH);
            renderContentWithMath(definitionsEl, truncatedContent, this.plugin.app, this.plugin, this.currentContext);
            
            // Show popover on hover if truncated
            if (truncatedContent !== item.definitions[0]) {
                this.setupContentHoverPreview(definitionsEl, item.definitions[0]);
            }
        } else {
            // Multiple definitions - render as bullet list
            const ul = definitionsEl.createEl('ul');
            for (const def of item.definitions) {
                const li = ul.createEl('li');
                const truncatedContent = truncateContentWithRendering(def, UI_CONSTANTS.DEFINITION_MAX_LENGTH);
                renderContentWithMath(li, truncatedContent, this.plugin.app, this.plugin, this.currentContext);
                
                // Show popover on hover if truncated
                if (truncatedContent !== def) {
                    this.setupContentHoverPreview(li, def);
                }
            }
        }
        
        // Click to jump to term line
        this.setupDefinitionClickHandler(definitionsEl, item, activeView);
    }
    
    private truncateTermWithRendering(term: string): string {
        // Use the same smart truncation as content to handle rendered length properly
        // This accounts for math formulas and other markdown that may render differently
        return truncateContentWithRendering(term, UI_CONSTANTS.TERM_MAX_LENGTH);
    }
    
    private setupTermHoverPreview(element: HTMLElement, fullTerm: string): void {
        // Use rendered hover preview for terms to show formatted content
        setupRenderedHoverPreview(
            element,
            fullTerm,
            this.plugin.app,
            this.plugin,
            this.currentContext,
            CSS_CLASSES.HOVER_POPOVER_CONTENT,
            this.abortController?.signal
        );
    }
    
    private setupDefinitionClickHandler(element: HTMLElement, item: DefinitionListItem, activeView: MarkdownView): void {
        const clickHandler = () => {
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
                handleError(error, 'Scroll to definition term');
            }
        };
        
        element.addEventListener('click', clickHandler, { signal: this.abortController?.signal });
    }
    
    private setupContentHoverPreview(element: HTMLElement, content: string): void {
        // Use the more powerful setupRenderedHoverPreview that handles all references
        setupRenderedHoverPreview(
            element,
            content,
            this.plugin.app,
            this.plugin,
            this.currentContext,
            CSS_CLASSES.HOVER_POPOVER_CONTENT,
            this.abortController?.signal
        );
    }
}