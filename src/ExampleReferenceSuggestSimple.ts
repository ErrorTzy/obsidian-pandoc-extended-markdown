import { Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from 'obsidian';
import PandocListsPlugin from './main';

interface ExampleSuggestion {
    label: string;
    number: number;
}

export class ExampleReferenceSuggestSimple extends EditorSuggest<ExampleSuggestion> {
    plugin: PandocListsPlugin;

    constructor(plugin: PandocListsPlugin) {
        super(plugin.app);
        this.plugin = plugin;
        console.log('[ExampleReferenceSuggestSimple] Created');
    }

    onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
        const line = editor.getLine(cursor.line);
        
        // Look for @ anywhere in the line up to cursor
        let start = -1;
        for (let i = cursor.ch - 1; i >= 0; i--) {
            if (line[i] === '@' && i > 0 && line[i-1] === '(') {
                start = i - 1; // Position of (
                break;
            }
            // Stop if we hit whitespace or other breaking chars
            if (line[i] === ' ' || line[i] === '\n' || line[i] === '\t') {
                break;
            }
            // Stop if we hit ) before finding (@
            if (line[i] === ')') {
                break;
            }
        }
        
        if (start === -1) {
            return null;
        }
        
        // Extract the query part (everything after @)
        const query = line.substring(start + 2, cursor.ch);
        
        console.log(`[Trigger] Found (@ at position ${start}, query: "${query}"`);
        
        return {
            start: { line: cursor.line, ch: start },
            end: cursor,
            query: query
        };
    }

    getSuggestions(context: EditorSuggestContext): ExampleSuggestion[] {
        const { query } = context;
        console.log(`[Suggestions] Getting suggestions for query: "${query}"`);
        
        // Scan document for example labels
        const doc = context.editor.getValue();
        const lines = doc.split('\n');
        const exampleLabels = new Map<string, number>();
        let counter = 1;
        
        for (const line of lines) {
            const match = line.match(/^\s*\(@([a-zA-Z0-9_-]+)\)\s+/);
            if (match) {
                const label = match[1];
                if (!exampleLabels.has(label)) {
                    exampleLabels.set(label, counter);
                }
                counter++;
            } else if (line.match(/^\s*\(@\)\s+/)) {
                counter++;
            }
        }
        
        // Filter by query
        const suggestions: ExampleSuggestion[] = [];
        for (const [label, number] of exampleLabels) {
            if (!query || label.toLowerCase().startsWith(query.toLowerCase())) {
                suggestions.push({ label, number });
            }
        }
        
        suggestions.sort((a, b) => a.label.localeCompare(b.label));
        console.log(`[Suggestions] Returning ${suggestions.length} suggestions`);
        
        return suggestions;
    }

    renderSuggestion(suggestion: ExampleSuggestion, el: HTMLElement): void {
        el.setText(`@${suggestion.label} (Example ${suggestion.number})`);
    }

    selectSuggestion(suggestion: ExampleSuggestion, evt: MouseEvent | KeyboardEvent): void {
        if (!this.context) return;
        
        const { editor, start, end } = this.context;
        const line = editor.getLine(end.line);
        const afterEnd = line.substring(end.ch);
        
        // Check if there's already a closing paren
        const needsClosingParen = !afterEnd.startsWith(')');
        const replacement = needsClosingParen 
            ? `(@${suggestion.label})` 
            : `(@${suggestion.label}`;
        
        editor.replaceRange(replacement, start, end);
        
        // Position cursor after the closing paren
        const newCh = start.ch + replacement.length;
        const finalCh = needsClosingParen ? newCh : newCh + 1;
        editor.setCursor({ line: start.line, ch: finalCh });
        
        console.log(`[Select] Replaced with "${replacement}"`);
    }
}