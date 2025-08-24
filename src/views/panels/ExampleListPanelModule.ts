// External libraries
import { MarkdownView, Notice, MarkdownRenderer, Component } from 'obsidian';

// Types
import { PanelModule } from './PanelTypes';

// Constants
import { CSS_CLASSES, MESSAGES, ICONS, UI_CONSTANTS } from '../../constants';

// Patterns
import { ListPatterns } from '../../patterns';

// Utils
import { truncateContentWithRendering } from '../../utils/views/contentTruncator';
import { renderContentWithMath } from '../../utils/views/viewInteractions';

// Utils
import { handleError } from '../../utils/errorHandler';

// Internal modules
import { PandocExtendedMarkdownPlugin } from '../../main';

interface ExampleListItem {
    renderedNumber: number;
    rawLabel: string;  // e.g., "@a", "@", "@b"
    content: string;
    lineNumber: number;
    position: { line: number; ch: number };
}

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
        this.exampleItems = this.extractExampleLists(content);
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
        const items: ExampleListItem[] = [];
        const lines = content.split('\n');
        let exampleCounter = 1;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(ListPatterns.EXAMPLE_LIST_WITH_CONTENT);
            if (match) {
                const rawLabel = `@${match[2]}`;
                const listContent = match[3].trim();
                
                items.push({
                    renderedNumber: exampleCounter,
                    rawLabel: rawLabel,
                    content: listContent,
                    lineNumber: i,
                    position: { line: i, ch: 0 }
                });
                
                exampleCounter++;
            } else {
                // Check for unlabeled example list
                const unlabeledMatch = line.match(ListPatterns.UNLABELED_EXAMPLE_LIST);
                if (unlabeledMatch) {
                    // Extract content after the (@) marker
                    const contentStart = line.indexOf('(@)') + 3;
                    const listContent = line.substring(contentStart).trim();
                    
                    items.push({
                        renderedNumber: exampleCounter,
                        rawLabel: '@',
                        content: listContent,
                        lineNumber: i,
                        position: { line: i, ch: 0 }
                    });
                    
                    exampleCounter++;
                }
            }
        }
        
        return items;
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
            // Create a proper HoverLinkSource-compatible object
            const hoverSource = {
                hoverLinkSource: {
                    display: MESSAGES.EXAMPLE_LISTS_VIEW_TITLE,
                    defaultMod: true
                }
            };
            renderContentWithMath(contentEl, truncatedContent, this.plugin.app, hoverSource);
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
        let hoverPopover: HTMLElement | null = null;
        
        const removePopover = () => {
            if (hoverPopover) {
                hoverPopover.remove();
                hoverPopover = null;
            }
        };
        
        element.addEventListener('mouseenter', () => {
            const hoverEl = document.createElement('div');
            hoverEl.classList.add(CSS_CLASSES.HOVER_POPOVER, CSS_CLASSES.HOVER_POPOVER_LABEL);
            hoverEl.textContent = fullNumber;
            
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
    
    private setupLabelHoverPreview(element: HTMLElement, fullLabel: string): void {
        let hoverPopover: HTMLElement | null = null;
        
        const removePopover = () => {
            if (hoverPopover) {
                hoverPopover.remove();
                hoverPopover = null;
            }
        };
        
        element.addEventListener('mouseenter', () => {
            const hoverEl = document.createElement('div');
            hoverEl.classList.add(CSS_CLASSES.HOVER_POPOVER, CSS_CLASSES.HOVER_POPOVER_LABEL);
            hoverEl.textContent = fullLabel;
            
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
                    this.highlightLine(activeView, item.lineNumber);
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
            const component = {
                hoverLinkSource: {
                    display: MESSAGES.EXAMPLE_LISTS_VIEW_TITLE,
                    defaultMod: true
                }
            };
            MarkdownRenderer.render(
                this.plugin.app,
                item.content,
                hoverEl,
                '',
                component as Component
            );
        } else {
            hoverEl.textContent = item.content;
        }
    }
    
    private positionHoverElement(hoverEl: HTMLElement, referenceEl: HTMLElement): void {
        const rect = referenceEl.getBoundingClientRect();
        hoverEl.style.left = `${rect.left}px`;
        hoverEl.style.top = `${rect.bottom + 5}px`;
        hoverEl.style.maxWidth = UI_CONSTANTS.MAX_HOVER_WIDTH;
        hoverEl.style.maxHeight = UI_CONSTANTS.MAX_HOVER_HEIGHT;
        hoverEl.style.overflow = 'auto';
        
        // Adjust if goes off screen
        const hoverRect = hoverEl.getBoundingClientRect();
        if (hoverRect.right > window.innerWidth) {
            hoverEl.style.left = `${window.innerWidth - hoverRect.width - 10}px`;
        }
        if (hoverRect.bottom > window.innerHeight) {
            hoverEl.style.top = `${rect.top - hoverRect.height - 5}px`;
        }
    }
    
    private highlightLine(view: MarkdownView, lineNumber: number): void {
        try {
            const editor = view.editor;
            this.moveCursorToLine(editor, lineNumber);
            
            const cm = (editor as any).cm;
            if (cm) {
                const editorDom = cm.dom || cm.contentDOM;
                if (editorDom) {
                    setTimeout(() => {
                        this.highlightTargetLine(editorDom, editor);
                    }, 50);
                }
            }
        } catch (error) {
            handleError(error, 'Highlight line');
        }
    }
    
    private moveCursorToLine(editor: any, lineNumber: number): void {
        const lineStart = { line: lineNumber, ch: 0 };
        editor.setCursor(lineStart);
        editor.scrollIntoView({ from: lineStart, to: lineStart }, true);
    }
    
    private highlightTargetLine(editorDom: HTMLElement, editor: any): void {
        const activeLine = editorDom.querySelector('.cm-line.cm-active');
        if (activeLine) {
            this.applyHighlight(activeLine as HTMLElement);
        } else {
            const targetLine = this.findClosestLine(editorDom, editor);
            if (targetLine) {
                this.applyHighlight(targetLine);
            }
        }
    }
    
    private findClosestLine(editorDom: HTMLElement, editor: any): HTMLElement | null {
        const allLines = editorDom.querySelectorAll('.cm-line');
        const coords = editor.cursorCoords(true, 'local');
        
        if (!coords || allLines.length === 0) return null;
        
        let targetLine: HTMLElement | null = null;
        let minDistance = Infinity;
        
        allLines.forEach((line: Element) => {
            const rect = line.getBoundingClientRect();
            const editorRect = editorDom.getBoundingClientRect();
            const relativeTop = rect.top - editorRect.top;
            const distance = Math.abs(relativeTop - coords.top);
            
            if (distance < minDistance) {
                minDistance = distance;
                targetLine = line as HTMLElement;
            }
        });
        
        return targetLine;
    }
    
    private applyHighlight(lineElement: HTMLElement): void {
        // Remove any existing highlight class first
        lineElement.classList.remove(CSS_CLASSES.CUSTOM_LABEL_HIGHLIGHT);
        
        // Force a reflow to restart the animation
        void lineElement.offsetWidth;
        
        // Add the highlight class to trigger the animation
        lineElement.classList.add(CSS_CLASSES.CUSTOM_LABEL_HIGHLIGHT);
        
        // Remove the class after animation completes (2s duration)
        setTimeout(() => {
            lineElement.classList.remove(CSS_CLASSES.CUSTOM_LABEL_HIGHLIGHT);
        }, UI_CONSTANTS.HIGHLIGHT_DURATION_MS);
    }
}