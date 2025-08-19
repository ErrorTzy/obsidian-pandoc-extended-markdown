import { Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from 'obsidian';
import PandocListsPlugin from './main';

interface ExampleSuggestion {
    label: string;
    number: number;
    previewText: string;
}

export class ExampleReferenceSuggestFixed extends EditorSuggest<ExampleSuggestion> {
    plugin: PandocListsPlugin;

    constructor(plugin: PandocListsPlugin) {
        super(plugin.app);
        this.plugin = plugin;
    }

    onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
        // Get the line up to the cursor
        const line = editor.getLine(cursor.line).substring(0, cursor.ch);
        
        // Check if line contains (@
        if (!line.contains('(@')) return null;
        
        // Find the last (@ occurrence
        const matches = [...line.matchAll(/\(@/g)];
        if (matches.length === 0) return null;
        
        const lastMatch = matches[matches.length - 1];
        const startIndex = lastMatch.index!;
        
        // Get everything after (@
        const afterAt = line.substring(startIndex + 2);
        
        // If there's a closing paren, we're not in a suggestion context
        if (afterAt.contains(')')) return null;
        
        // The query is everything after (@
        const query = afterAt;
        
        return {
            start: {
                ch: startIndex,
                line: cursor.line,
            },
            end: cursor,
            query: query,
        };
    }

    getSuggestions(context: EditorSuggestContext): ExampleSuggestion[] {
        const { query } = context;
        
        // Scan document for example labels with their text
        const doc = context.editor.getValue();
        const lines = doc.split('\n');
        const exampleData = new Map<string, { number: number, text: string }>();
        let counter = 1;
        
        for (const line of lines) {
            const match = line.match(/^\s*\(@([a-zA-Z0-9_-]+)\)\s+(.*)$/);
            if (match) {
                const label = match[1];
                const text = match[2].trim();
                if (!exampleData.has(label)) {
                    exampleData.set(label, { number: counter, text });
                }
                counter++;
            } else if (line.match(/^\s*\(@\)\s+/)) {
                counter++;
            }
        }
        
        // Filter by query
        const suggestions: ExampleSuggestion[] = [];
        for (const [label, data] of exampleData) {
            // Filter: label must start with query (case-insensitive)
            if (!query || label.toLowerCase().startsWith(query.toLowerCase())) {
                // Truncate preview text to 30 characters
                let previewText = data.text;
                if (previewText.length > 30) {
                    previewText = previewText.substring(0, 30) + '...';
                }
                suggestions.push({ 
                    label, 
                    number: data.number,
                    previewText: previewText || '(no description)'
                });
            }
        }
        
        // Sort alphabetically
        suggestions.sort((a, b) => a.label.localeCompare(b.label));
        
        return suggestions;
    }

    renderSuggestion(suggestion: ExampleSuggestion, el: HTMLElement): void {
        const container = el.createDiv({ cls: 'pandoc-suggestion-content' });
        const title = container.createDiv({ cls: 'pandoc-suggestion-title' });
        title.setText(`@${suggestion.label}`);
        
        const preview = container.createDiv({ cls: 'pandoc-suggestion-preview' });
        preview.setText(suggestion.previewText);
    }

    selectSuggestion(suggestion: ExampleSuggestion, evt: MouseEvent | KeyboardEvent): void {
        if (!this.context) return;
        
        const { editor, start, end } = this.context;
        
        // Get the line to check what's after the cursor
        const line = editor.getLine(end.line);
        const afterCursor = line.substring(end.ch);
        
        // Check if there's already a closing paren right after cursor
        const hasClosingParen = afterCursor.startsWith(')');
        
        // Build the replacement text
        let replacement: string;
        if (hasClosingParen) {
            // Just replace with (@label, the ) is already there
            replacement = `(@${suggestion.label}`;
        } else {
            // Add the full (@label)
            replacement = `(@${suggestion.label})`;
        }
        
        // Replace from start to end
        editor.replaceRange(replacement, start, end);
        
        // Move cursor after the closing paren
        let newCh = start.ch + replacement.length;
        if (hasClosingParen) {
            newCh += 1; // Move past the existing )
        }
        
        editor.setCursor({
            line: start.line,
            ch: newCh
        });
    }
}