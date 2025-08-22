import { Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from 'obsidian';
import { PandocListsPlugin } from './main';
import { CSS_CLASSES } from './constants';
import { ListPatterns } from './patterns';

interface CustomLabelSuggestion {
    label: string;
    previewText: string;
}

export class CustomLabelReferenceSuggest extends EditorSuggest<CustomLabelSuggestion> {
    plugin: PandocListsPlugin;

    constructor(plugin: PandocListsPlugin) {
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

    getSuggestions(context: EditorSuggestContext): CustomLabelSuggestion[] {
        const { query } = context;
        
        // Scan document for custom labels with their text
        const doc = context.editor.getValue();
        const lines = doc.split('\n');
        const labelData = new Map<string, string>();
        
        for (const line of lines) {
            const match = ListPatterns.isCustomLabelList(line);
            if (match) {
                const label = match[3]; // match[3] is the label from {::LABEL}
                if (label) { // Only process labeled items
                    // Extract the text after the marker
                    const markerEnd = match[0].length; // Length of the entire match
                    const text = line.substring(markerEnd).trim();
                    if (!labelData.has(label)) {
                        labelData.set(label, text);
                    }
                }
            }
        }
        
        // Filter by query
        const suggestions: CustomLabelSuggestion[] = [];
        for (const [label, text] of labelData) {
            // Filter: label must start with query (case-insensitive)
            if (!query || label.toLowerCase().startsWith(query.toLowerCase())) {
                // Truncate preview text to 30 characters
                let previewText = text;
                if (previewText.length > 30) {
                    previewText = previewText.substring(0, 30) + '...';
                }
                suggestions.push({ 
                    label, 
                    previewText: previewText || '(no description)'
                });
            }
        }
        
        // Sort alphabetically
        suggestions.sort((a, b) => a.label.localeCompare(b.label));
        
        return suggestions;
    }

    renderSuggestion(suggestion: CustomLabelSuggestion, el: HTMLElement): void {
        const container = el.createDiv({ cls: CSS_CLASSES.SUGGESTION_CONTENT });
        const title = container.createDiv({ cls: CSS_CLASSES.SUGGESTION_TITLE });
        title.setText(`::${suggestion.label}`);
        
        const preview = container.createDiv({ cls: CSS_CLASSES.SUGGESTION_PREVIEW });
        preview.setText(suggestion.previewText);
    }

    selectSuggestion(suggestion: CustomLabelSuggestion, evt: MouseEvent | KeyboardEvent): void {
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