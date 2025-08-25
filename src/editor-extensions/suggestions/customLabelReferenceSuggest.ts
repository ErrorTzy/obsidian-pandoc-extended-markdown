import { Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from 'obsidian';
import { PandocExtendedMarkdownPlugin } from '../../core/main';
import { CSS_CLASSES } from '../../core/constants';
import { ListPatterns } from '../../shared/patterns';
import { CustomLabelSuggestion } from '../../shared/types/listTypes';
import { PlaceholderContext } from '../../shared/utils/placeholderProcessor';
import { withErrorBoundary } from '../../shared/utils/errorHandler';

/**
 * Provides auto-completion suggestions for custom label references with
 * rendered placeholder display.
 */
export class CustomLabelReferenceSuggest extends EditorSuggest<CustomLabelSuggestion> {
    plugin: PandocExtendedMarkdownPlugin;

    constructor(plugin: PandocExtendedMarkdownPlugin) {
        super(plugin.app);
        this.plugin = plugin;
    }

    onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
        // Only trigger if More Extended Syntax is enabled
        if (!this.plugin.settings.moreExtendedSyntax) return null;
        
        // Get the line up to the cursor
        const line = editor.getLine(cursor.line).substring(0, cursor.ch);
        
        // Check if line contains {::
        if (!line.includes('{::')) return null;
        
        // Find the last {:: occurrence
        const matches = ListPatterns.findCustomLabelRefStarts(line);
        if (matches.length === 0) return null;
        
        const lastMatch = matches[matches.length - 1];
        const startIndex = lastMatch.index!;
        
        // Get everything after {::
        const afterStart = line.substring(startIndex + 3);
        
        // If there's a closing brace, we're not in a suggestion context
        if (afterStart.includes('}')) return null;
        
        // The query is everything after {::
        const query = afterStart;
        
        return {
            start: {
                ch: startIndex,
                line: cursor.line,
            },
            end: cursor,
            query: query,
        };
    }

    /**
     * Scans the document for custom label definitions.
     * @returns Map of raw labels to their content
     */
    private scanDocumentForLabels(doc: string): Map<string, { text: string; rawLabel: string }> {
        const lines = doc.split('\n');
        const labelData = new Map<string, { text: string; rawLabel: string }>();
        
        for (const line of lines) {
            const match = ListPatterns.isCustomLabelList(line);
            if (match) {
                const rawLabel = match[3];
                if (rawLabel) {
                    const markerEnd = match[0].length;
                    const text = line.substring(markerEnd).trim();
                    if (!labelData.has(rawLabel)) {
                        labelData.set(rawLabel, { text, rawLabel });
                    }
                }
            }
        }
        
        return labelData;
    }

    /**
     * Processes a label to extract placeholder information.
     */
    private extractPlaceholderParts(
        rawLabel: string,
        placeholderContext: PlaceholderContext
    ): Array<{original: string; replacement: string; index: number}> | null {
        const placeholderParts: Array<{original: string; replacement: string; index: number}> = [];
        const regex = /\(#([^)]+)\)/g;
        let match;
        
        while ((match = regex.exec(rawLabel)) !== null) {
            const placeholderName = match[1];
            const placeholderNumber = placeholderContext.getPlaceholderNumber(placeholderName);
            if (placeholderNumber !== null) {
                placeholderParts.push({
                    original: match[0],
                    replacement: placeholderNumber.toString(),
                    index: match.index
                });
            }
        }
        
        return placeholderParts.length > 0 ? placeholderParts : null;
    }

    getSuggestions(context: EditorSuggestContext): CustomLabelSuggestion[] {
        return withErrorBoundary(() => this.getSuggestionsInternal(context), [], 'CustomLabelReferenceSuggest.getSuggestions');
    }
    
    private getSuggestionsInternal(context: EditorSuggestContext): CustomLabelSuggestion[] {
        const { query } = context;
        
        // Scan document for custom labels
        const doc = context.editor.getValue();
        const labelData = this.scanDocumentForLabels(doc);
        const placeholderContext = new PlaceholderContext();
        
        // First pass: process all labels to establish placeholder numbering
        for (const [rawLabel] of labelData) {
            if (/\(#[^)]+\)/.test(rawLabel)) {
                placeholderContext.processLabel(rawLabel);
            }
        }
        
        // Filter by query and build suggestions
        const suggestions: CustomLabelSuggestion[] = [];
        for (const [rawLabel, data] of labelData) {
            // Process the label first to get its rendered form
            let processedLabel: string | null = null;
            if (/\(#[^)]+\)/.test(rawLabel)) {
                processedLabel = placeholderContext.processLabel(rawLabel);
            }
            
            // Filter: label must start with query (case-insensitive)
            // Check both the raw label and the processed label
            const matchesRaw = !query || rawLabel.toLowerCase().startsWith(query.toLowerCase());
            const matchesProcessed = processedLabel && (!query || processedLabel.toLowerCase().startsWith(query.toLowerCase()));
            
            if (matchesRaw || matchesProcessed) {
                // Truncate preview text to 30 characters
                let previewText = data.text;
                if (previewText.length > 30) {
                    previewText = previewText.substring(0, 30) + '...';
                }
                
                // Check if this label has placeholders
                let displayLabel: string | null = processedLabel;
                let placeholderParts: Array<{original: string; replacement: string; index: number}> | null = null;
                
                if (processedLabel) {
                    // Extract placeholder replacement information
                    placeholderParts = this.extractPlaceholderParts(rawLabel, placeholderContext);
                }
                
                suggestions.push({ 
                    label: rawLabel,
                    displayLabel,
                    placeholderParts,
                    previewText: previewText || '(no description)'
                });
            }
        }
        
        // Sort alphabetically
        suggestions.sort((a, b) => a.label.localeCompare(b.label));
        
        return suggestions;
    }

    /**
     * Renders a suggestion item with styled placeholder display.
     */
    renderSuggestion(suggestion: CustomLabelSuggestion, el: HTMLElement): void {
        withErrorBoundary(() => this.renderSuggestionInternal(suggestion, el), undefined, 'CustomLabelReferenceSuggest.renderSuggestion');
    }
    
    private renderSuggestionInternal(suggestion: CustomLabelSuggestion, el: HTMLElement): void {
        const container = el.createDiv({ cls: CSS_CLASSES.SUGGESTION_CONTENT });
        const title = container.createDiv({ cls: CSS_CLASSES.SUGGESTION_TITLE });
        
        if (suggestion.displayLabel && suggestion.placeholderParts) {
            // Render with styled components for placeholder labels
            title.setText('::');
            
            // Build the display by replacing placeholders with styled numbers
            let lastIndex = 0;
            const sortedParts = [...suggestion.placeholderParts].sort((a, b) => a.index - b.index);
            
            for (const part of sortedParts) {
                // Add the text before this placeholder
                if (part.index > lastIndex) {
                    const beforeText = suggestion.label.substring(lastIndex, part.index);
                    title.createSpan().setText(beforeText);
                }
                
                // Add the replacement number with underline
                const numberSpan = title.createSpan({ cls: CSS_CLASSES.SUGGESTION_NUMBER });
                numberSpan.setText(part.replacement);
                
                // Add the original placeholder in smaller, grey text
                const placeholderSpan = title.createSpan({ cls: CSS_CLASSES.SUGGESTION_PLACEHOLDER });
                placeholderSpan.setText(part.original);
                
                lastIndex = part.index + part.original.length;
            }
            
            // Add any remaining text after the last placeholder
            if (lastIndex < suggestion.label.length) {
                const afterText = suggestion.label.substring(lastIndex);
                title.createSpan().setText(afterText);
            }
        } else {
            // Normal rendering for non-placeholder labels
            title.setText(`::${suggestion.label}`);
        }
        
        const preview = container.createDiv({ cls: CSS_CLASSES.SUGGESTION_PREVIEW });
        preview.setText(suggestion.previewText);
    }

    /**
     * Handles selection of a suggestion, inserting the original label.
     */
    selectSuggestion(suggestion: CustomLabelSuggestion, evt: MouseEvent | KeyboardEvent): void {
        withErrorBoundary(() => this.selectSuggestionInternal(suggestion, evt), undefined, 'CustomLabelReferenceSuggest.selectSuggestion');
    }
    
    private selectSuggestionInternal(suggestion: CustomLabelSuggestion, evt: MouseEvent | KeyboardEvent): void {
        if (!this.context) return;
        
        const { editor, start, end } = this.context;
        
        // Get the line to check what's after the cursor
        const line = editor.getLine(end.line);
        const afterCursor = line.substring(end.ch);
        
        // Check if there's already a closing brace right after cursor
        const hasClosingBrace = afterCursor.startsWith('}');
        
        // Build the replacement text
        let replacement: string;
        if (hasClosingBrace) {
            // Just replace with {::label, the } is already there
            replacement = `{::${suggestion.label}`;
        } else {
            // Add the full {::label}
            replacement = `{::${suggestion.label}}`;
        }
        
        // Replace from start to end
        editor.replaceRange(replacement, start, end);
        
        // Move cursor after the closing brace
        let newCh = start.ch + replacement.length;
        if (hasClosingBrace) {
            newCh += 1; // Move past the existing }
        }
        
        editor.setCursor({
            line: start.line,
            ch: newCh
        });
    }
}