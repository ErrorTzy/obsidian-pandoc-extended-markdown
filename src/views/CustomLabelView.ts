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
        labelEl.addEventListener('click', () => {
            try {
                navigator.clipboard.writeText(label.rawLabel).then(() => {
                    new Notice(MESSAGES.LABEL_COPIED);
                }).catch((error) => {
                    console.error('Failed to copy label:', error);
                });
            } catch (error) {
                console.error('Error in label click handler:', error);
            }
        });
        
        // Content column
        const contentEl = row.createEl('div', {
            cls: CSS_CLASSES.CUSTOM_LABEL_VIEW_CONTENT
        });
        
        // Use rendered content if available, truncate based on rendered length
        const contentToShow = label.renderedContent || label.content;
        const truncatedContent = this.truncateContentWithRendering(contentToShow);
        
        // Check if content has math to render
        if (truncatedContent.includes('$')) {
            // Render content with math support
            this.renderContentWithMath(contentEl, truncatedContent, contentToShow);
        } else {
            contentEl.textContent = truncatedContent;
        }
        
        // Content click handler - scroll to position
        contentEl.addEventListener('click', () => {
            try {
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
            } catch (error) {
                console.error('Error scrolling to label:', error);
            }
        });
        
        // Content hover handler - only show tooltip if content is truncated
        if (truncatedContent !== contentToShow) {
            this.setupHoverPreview(contentEl, label, activeView);
        }
    }

    /**
     * Truncates label text to the maximum allowed length.
     * @param label - The label text to truncate
     * @returns Truncated label with ellipsis if needed
     */
    private truncateLabel(label: string): string {
        // Truncate at max length, replace last character with ellipsis if longer
        if (label.length > UI_CONSTANTS.LABEL_MAX_LENGTH) {
            return label.slice(0, UI_CONSTANTS.LABEL_TRUNCATION_LENGTH) + '…';
        }
        return label;
    }

    /**
     * Simple truncation for content without math formatting.
     * @param content - The content to truncate
     * @returns Truncated content with ellipsis if needed
     */
    private truncateContent(content: string): string {
        // Truncate at max length, replace last character with ellipsis if longer
        if (content.length > UI_CONSTANTS.CONTENT_MAX_LENGTH) {
            return content.slice(0, UI_CONSTANTS.CONTENT_TRUNCATION_LENGTH) + '…';
        }
        return content;
    }

    /**
     * Truncates content based on rendered length, handling math content specially.
     * This ensures math formulas are properly considered for their rendered length,
     * not their raw LaTeX length.
     */
    private truncateContentWithRendering(content: string): string {
        // If no math content, use simple truncation
        if (!content.includes('$')) {
            return this.truncateContent(content);
        }

        const parseResult = this.parseContentWithMath(content);
        return parseResult.truncated ? parseResult.result : content;
    }
    
    /**
     * Parses content containing math and applies truncation logic.
     * @returns Object with parsed result and truncation status
     */
    private parseContentWithMath(content: string): { result: string; truncated: boolean } {
        let renderedLength = 0;
        let result = '';
        let inMath = false;
        let mathBuffer = '';
        let i = 0;
        
        while (i < content.length) {
            const char = content[i];
            
            if (char === '$') {
                const mathResult = this.processMathDelimiter(
                    inMath, 
                    mathBuffer, 
                    result, 
                    renderedLength
                );
                
                if (mathResult.shouldBreak) {
                    return { result: mathResult.result, truncated: true };
                }
                
                result = mathResult.result;
                renderedLength = mathResult.renderedLength;
                mathBuffer = mathResult.mathBuffer;
                inMath = mathResult.inMath;
            } else if (inMath) {
                mathBuffer += char;
            } else {
                const textResult = this.processRegularCharacter(char, result, renderedLength);
                if (textResult.shouldBreak) {
                    return { result: textResult.result, truncated: true };
                }
                result = textResult.result;
                renderedLength = textResult.renderedLength;
            }
            
            i++;
        }
        
        // Handle unclosed math at end of string
        if (inMath) {
            const finalResult = this.handleUnclosedMath(mathBuffer, result, renderedLength);
            return { result: finalResult.result, truncated: finalResult.truncated };
        }
        
        return { result, truncated: false };
    }
    
    /**
     * Processes a math delimiter ($) in the content.
     */
    private processMathDelimiter(
        inMath: boolean,
        mathBuffer: string,
        currentResult: string,
        currentLength: number
    ): {
        result: string;
        renderedLength: number;
        mathBuffer: string;
        inMath: boolean;
        shouldBreak: boolean;
    } {
        if (inMath) {
            // End of math block
            const renderedMath = this.renderMathToText(mathBuffer);
            const remainingSpace = UI_CONSTANTS.CONTENT_MAX_LENGTH - currentLength;
            
            if (renderedMath.length <= remainingSpace) {
                // Entire math fits
                return {
                    result: currentResult + mathBuffer.trimEnd() + '$',
                    renderedLength: currentLength + renderedMath.length,
                    mathBuffer: '',
                    inMath: false,
                    shouldBreak: false
                };
            } else {
                // Math doesn't fit, truncate
                const truncatedResult = this.truncateMathAtLimit(
                    mathBuffer, 
                    currentResult, 
                    remainingSpace
                );
                return {
                    result: truncatedResult,
                    renderedLength: UI_CONSTANTS.CONTENT_MAX_LENGTH,
                    mathBuffer: '',
                    inMath: false,
                    shouldBreak: true
                };
            }
        } else {
            // Start of math block
            return {
                result: currentResult + '$',
                renderedLength: currentLength,
                mathBuffer: '',
                inMath: true,
                shouldBreak: false
            };
        }
    }
    
    /**
     * Processes a regular (non-math) character.
     */
    private processRegularCharacter(
        char: string,
        currentResult: string,
        currentLength: number
    ): {
        result: string;
        renderedLength: number;
        shouldBreak: boolean;
    } {
        if (currentLength < UI_CONSTANTS.CONTENT_MAX_LENGTH) {
            return {
                result: currentResult + char,
                renderedLength: currentLength + 1,
                shouldBreak: false
            };
        } else {
            // We've reached the limit
            const truncated = currentResult.length > 0 && !currentResult.endsWith('…') 
                ? currentResult.slice(0, -1) + '…' 
                : currentResult + '…';
            return {
                result: truncated,
                renderedLength: UI_CONSTANTS.CONTENT_MAX_LENGTH,
                shouldBreak: true
            };
        }
    }
    
    /**
     * Handles unclosed math content at the end of the string.
     */
    private handleUnclosedMath(
        mathBuffer: string,
        currentResult: string,
        currentLength: number
    ): {
        result: string;
        truncated: boolean;
    } {
        const renderedMath = this.renderMathToText(mathBuffer);
        const remainingSpace = UI_CONSTANTS.CONTENT_MAX_LENGTH - currentLength;
        
        if (renderedMath.length <= remainingSpace) {
            // Math fits
            return {
                result: currentResult + mathBuffer.trimEnd() + '$',
                truncated: false
            };
        } else {
            // Math doesn't fit, truncate it
            const truncatedResult = this.truncateMathAtLimit(
                mathBuffer,
                currentResult,
                remainingSpace
            );
            return {
                result: truncatedResult,
                truncated: true
            };
        }
    }
    
    /**
     * Truncates math content when it exceeds the remaining space.
     */
    private truncateMathAtLimit(
        mathBuffer: string,
        currentResult: string,
        remainingSpace: number
    ): string {
        if (remainingSpace > 1) {
            const truncatedMath = this.truncateMathContent(mathBuffer, remainingSpace - 1);
            return currentResult + truncatedMath.slice(1) + '…';
        } else if (currentResult.endsWith('$')) {
            return currentResult.slice(0, -1) + '…';
        } else {
            return currentResult + '…';
        }
    }
    
    /**
     * Renders math LaTeX to plain text representation.
     * Converts common LaTeX symbols to their Unicode equivalents.
     */
    private renderMathToText(mathContent: string): string {
        // Map common LaTeX commands to their rendered characters
        const replacements: Record<string, string> = {
            '\\therefore': '∴',
            '\\because': '∵',
            '\\alpha': 'α',
            '\\beta': 'β',
            '\\gamma': 'γ',
            '\\delta': 'δ',
            '\\epsilon': 'ε',
            '\\theta': 'θ',
            '\\lambda': 'λ',
            '\\mu': 'μ',
            '\\pi': 'π',
            '\\sigma': 'σ',
            '\\phi': 'φ',
            '\\psi': 'ψ',
            '\\omega': 'ω',
            '\\infty': '∞',
            '\\pm': '±',
            '\\times': '×',
            '\\div': '÷',
            '\\neq': '≠',
            '\\leq': '≤',
            '\\geq': '≥',
            '\\approx': '≈',
            '\\subset': '⊂',
            '\\supset': '⊃',
            '\\cup': '∪',
            '\\cap': '∩',
            '\\in': '∈',
            '\\notin': '∉',
            '\\exists': '∃',
            '\\forall': '∀',
            '\\land': '∧',
            '\\lor': '∨',
            '\\neg': '¬',
            '\\rightarrow': '→',
            '\\leftarrow': '←',
            '\\leftrightarrow': '↔',
            '\\Rightarrow': '⇒',
            '\\Leftarrow': '⇐',
            '\\Leftrightarrow': '⇔'
        };
        
        let rendered = mathContent;
        
        // Replace LaTeX commands with their Unicode equivalents
        for (const [latex, unicode] of Object.entries(replacements)) {
            rendered = rendered.replace(new RegExp(latex.replace(/\\/g, '\\\\'), 'g'), unicode);
        }
        
        // Remove remaining backslashes and spaces that were part of commands
        rendered = rendered.replace(/\\/g, '').replace(/\s+/g, ' ').trim();
        
        return rendered;
    }
    
    /**
     * Truncates math content intelligently, preserving complete LaTeX commands.
     * Returns the truncated LaTeX with proper closing.
     */
    private truncateMathContent(mathContent: string, maxRenderedLength: number): string {
        // For complex math truncation, we'll render progressively and stop when we exceed the limit
        const tokens = this.tokenizeMath(mathContent);
        let result = '$';
        let tokenCount = 0;
        
        // Render all tokens together to get the actual formatted output
        let accumulatedTokens: string[] = [];
        
        for (const token of tokens) {
            // Test if adding this token would exceed the limit
            const testTokens = [...accumulatedTokens, token];
            const testLatex = testTokens.join('');
            const testRendered = this.renderMathToText(testLatex);
            
            if (testRendered.length <= maxRenderedLength) {
                accumulatedTokens.push(token);
                tokenCount++;
            } else {
                // We've reached the limit
                break;
            }
        }
        
        // Build the result from accumulated tokens
        let latexContent = accumulatedTokens.join('');
        
        // Remove trailing spaces before closing the math expression
        // This is crucial for valid LaTeX syntax
        latexContent = latexContent.trimEnd();
        
        result += latexContent;
        
        // Close the math expression
        if (!result.endsWith('$')) {
            result += '$';
        }
        
        return result;
    }
    
    /**
     * Tokenizes math content into individual commands and text.
     */
    private tokenizeMath(mathContent: string): string[] {
        const tokens: string[] = [];
        let current = '';
        let i = 0;
        
        while (i < mathContent.length) {
            if (mathContent[i] === '\\') {
                // Start of a LaTeX command
                if (current) {
                    tokens.push(current);
                    current = '';
                }
                
                // Read the full command
                let command = '\\';
                i++;
                
                // Read command name (letters)
                while (i < mathContent.length && /[a-zA-Z]/.test(mathContent[i])) {
                    command += mathContent[i];
                    i++;
                }
                
                // Include trailing space if it's part of the command
                if (i < mathContent.length && mathContent[i] === ' ') {
                    command += ' ';
                    i++;
                }
                
                tokens.push(command);
            } else {
                current += mathContent[i];
                i++;
            }
        }
        
        if (current) {
            tokens.push(current);
        }
        
        return tokens;
    }

    private highlightLine(view: MarkdownView, lineNumber: number) {
        try {
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
        } catch (error) {
            console.error('Error highlighting line:', error);
        }
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