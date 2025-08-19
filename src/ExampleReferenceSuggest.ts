import { Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from 'obsidian';
import PandocListsPlugin from './main';

interface ExampleSuggestion {
    label: string;
    number: number;
}

export class ExampleReferenceSuggest extends EditorSuggest<ExampleSuggestion> {
    plugin: PandocListsPlugin;

    constructor(plugin: PandocListsPlugin) {
        super(plugin.app);
        this.plugin = plugin;
        
        // Set limit for number of suggestions
        this.limit = 10;
        
        console.log('[ExampleReferenceSuggest] Constructor called');
        console.log('  App:', plugin.app);
        console.log('  Scope:', this.scope);
    }

    onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
        // Get the current line
        const line = editor.getLine(cursor.line);
        const beforeCursor = line.substring(0, cursor.ch);
        
        console.log('[ExampleReferenceSuggest] onTrigger called');
        console.log('  Line:', line);
        console.log('  Before cursor:', beforeCursor);
        console.log('  Cursor position:', cursor);
        
        // Check for two patterns:
        // 1. (@) with cursor between @ and ) - for auto-paired parentheses
        // 2. (@ with no closing paren yet
        // 3. (@label with partial label
        
        // First check if we're in the middle of (@)
        const afterCursor = line.substring(cursor.ch);
        console.log('  After cursor:', afterCursor);
        
        // Pattern 1: Check for (@) with cursor after @
        if (beforeCursor.endsWith('(@') && afterCursor.startsWith(')')) {
            console.log('  Matched pattern: (@|)');
            return {
                start: {
                    line: cursor.line,
                    ch: cursor.ch - 2 // Position of (
                },
                end: cursor,
                query: '' // Empty query
            };
        }
        
        // Pattern 2: Check for (@ or (@partial without closing paren
        const match = beforeCursor.match(/\(@([a-zA-Z0-9_-]*)$/);
        if (match) {
            console.log('  Matched pattern: (@partial');
            console.log('  Query:', match[1]);
            
            // Don't trigger if this is already a complete reference
            if (afterCursor.startsWith(')') && match[1].length > 0) {
                console.log('  Already complete reference, not triggering');
                return null;
            }
            
            return {
                start: {
                    line: cursor.line,
                    ch: cursor.ch - match[1].length - 2 // Position of (
                },
                end: cursor,
                query: match[1] // The partial label after @
            };
        }
        
        console.log('  No pattern matched, returning null');
        return null;
    }

    getSuggestions(context: EditorSuggestContext): ExampleSuggestion[] {
        const { query } = context;
        
        console.log('[ExampleReferenceSuggest] getSuggestions called');
        console.log('  Query:', query);
        console.log('  Context:', context);
        
        // Scan the document for example labels
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
        
        console.log('  Found labels:', Array.from(exampleLabels.entries()));
        
        // Filter suggestions based on query
        const suggestions: ExampleSuggestion[] = [];
        for (const [label, number] of exampleLabels) {
            if (!query || label.toLowerCase().includes(query.toLowerCase())) {
                suggestions.push({ label, number });
            }
        }
        
        // Sort alphabetically
        suggestions.sort((a, b) => a.label.localeCompare(b.label));
        
        console.log('  Returning suggestions:', suggestions);
        return suggestions;
    }

    renderSuggestion(suggestion: ExampleSuggestion, el: HTMLElement): void {
        const container = el.createDiv({ cls: 'suggestion-content' });
        const title = container.createDiv({ cls: 'suggestion-title' });
        title.setText(`@${suggestion.label}`);
        
        const subtitle = container.createDiv({ cls: 'suggestion-subtitle' });
        subtitle.setText(`Example ${suggestion.number}`);
    }

    selectSuggestion(suggestion: ExampleSuggestion, evt: MouseEvent | KeyboardEvent): void {
        console.log('[ExampleReferenceSuggest] selectSuggestion called');
        console.log('  Suggestion:', suggestion);
        console.log('  Context:', this.context);
        
        if (!this.context) {
            console.log('  No context, returning');
            return;
        }
        
        const { editor, start, end } = this.context;
        
        // Check if there's already a closing parenthesis after the cursor
        const line = editor.getLine(end.line);
        const afterEnd = line.substring(end.ch);
        const hasClosingParen = afterEnd.startsWith(')');
        
        console.log('  After end:', afterEnd);
        console.log('  Has closing paren:', hasClosingParen);
        
        // If there's already a closing paren (from auto-pairing), don't add another
        const replacement = hasClosingParen 
            ? `(@${suggestion.label}` 
            : `(@${suggestion.label})`;
        
        // Replace the partial text with the complete reference
        editor.replaceRange(
            replacement,
            start,
            end
        );
        
        // Move cursor after the label (and closing paren if we added one)
        const newCursor = {
            line: start.line,
            ch: start.ch + replacement.length + (hasClosingParen ? 1 : 0)
        };
        editor.setCursor(newCursor);
        
        console.log('  Replacement:', replacement);
        console.log('  New cursor position:', newCursor);
    }
}