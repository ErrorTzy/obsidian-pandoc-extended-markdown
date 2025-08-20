import { Plugin, MarkdownPostProcessorContext, Notice, Editor } from 'obsidian';
import { Extension, Prec } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { pandocListsExtension } from './decorations/pandocListsExtension';
import { processReadingMode } from './parsers/readingModeProcessor';
import { ExampleReferenceSuggestFixed } from './ExampleReferenceSuggestFixed';
import { PandocListsSettings, DEFAULT_SETTINGS, PandocListsSettingTab } from './settings';
import { formatToPandocStandard, checkPandocFormatting } from './pandocValidator';
import { listAutocompletionKeymap } from './listAutocompletion';

export default class PandocListsPlugin extends Plugin {
    private suggester: ExampleReferenceSuggestFixed;
    settings: PandocListsSettings;

    async onload() {
        await this.loadSettings();
        
        // Add settings tab
        this.addSettingTab(new PandocListsSettingTab(this.app, this));
        
        // Register CodeMirror extension for live preview with settings
        this.registerEditorExtension(pandocListsExtension(() => this.settings));
        
        // Register list autocompletion keymap with highest priority
        this.registerEditorExtension(Prec.highest(keymap.of(listAutocompletionKeymap)));
        
        // Register markdown post-processor for reading mode
        this.registerMarkdownPostProcessor((element, context) => {
            processReadingMode(element, context, this.settings);
        });
        
        // Register example reference suggester
        this.suggester = new ExampleReferenceSuggestFixed(this);
        this.registerEditorSuggest(this.suggester);
        
        // Add command to check strict pandoc linting
        this.addCommand({
            id: 'check-pandoc-formatting',
            name: 'Check pandoc formatting',
            editorCallback: (editor: Editor) => {
                const content = editor.getValue();
                const issues = checkPandocFormatting(content);
                
                if (issues.length === 0) {
                    new Notice('Document follows pandoc formatting standards');
                } else {
                    const issueList = issues.map(issue => 
                        `Line ${issue.line}: ${issue.message}`
                    ).join('\n');
                    new Notice(`Found ${issues.length} formatting issues:\n${issueList}`, 10000);
                }
            }
        });
        
        // Add command to auto-format to pandoc standard
        this.addCommand({
            id: 'format-to-pandoc',
            name: 'Format document to pandoc standard',
            editorCallback: (editor: Editor) => {
                const content = editor.getValue();
                const formatted = formatToPandocStandard(content);
                
                if (content !== formatted) {
                    editor.setValue(formatted);
                    new Notice('Document formatted to pandoc standard');
                } else {
                    new Notice('Document already follows pandoc standard');
                }
            }
        });
        
        // Add command to toggle bold style for definition terms
        this.addCommand({
            id: 'toggle-definition-bold',
            name: 'Toggle definition list bold style',
            editorCallback: (editor: Editor) => {
                const content = editor.getValue();
                const toggled = this.toggleDefinitionBoldStyle(content);
                
                if (content !== toggled) {
                    editor.setValue(toggled);
                    new Notice('Definition terms bold style toggled');
                } else {
                    new Notice('No definition terms found to toggle');
                }
            }
        });
    }

    onunload() {
        // Cleanup is handled automatically by Obsidian
    }
    
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
    
    toggleDefinitionBoldStyle(content: string): string {
        const lines = content.split('\n');
        const modifiedLines = [...lines];
        
        // First pass: identify all definition terms and check if any have bold
        const definitionTerms: {index: number, hasBold: boolean}[] = [];
        let anyHasBold = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            // Skip empty lines and lines that are definition markers
            if (!trimmedLine || trimmedLine.match(/^[~:]\s/)) {
                continue;
            }
            
            // Check if the next line (or line after empty line) is a definition marker
            let isDefinitionTerm = false;
            
            // Check immediate next line
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();
                if (nextLine.match(/^[~:]\s/)) {
                    isDefinitionTerm = true;
                }
                // Check line after empty line
                else if (nextLine === '' && i + 2 < lines.length) {
                    const lineAfterEmpty = lines[i + 2].trim();
                    if (lineAfterEmpty.match(/^[~:]\s/)) {
                        isDefinitionTerm = true;
                    }
                }
            }
            
            if (isDefinitionTerm) {
                const boldRegex = /^\*\*(.+)\*\*$/;
                const hasBold = boldRegex.test(trimmedLine);
                definitionTerms.push({index: i, hasBold});
                if (hasBold) {
                    anyHasBold = true;
                }
            }
        }
        
        // Second pass: apply unified formatting
        // If any term has bold, remove all bold. Otherwise, add bold to all.
        for (const term of definitionTerms) {
            const line = lines[term.index];
            const trimmedLine = line.trim();
            const originalIndent = line.match(/^(\s*)/)?.[1] || '';
            const boldRegex = /^\*\*(.+)\*\*$/;
            
            if (anyHasBold) {
                // Remove bold from all terms
                const match = trimmedLine.match(boldRegex);
                if (match) {
                    modifiedLines[term.index] = originalIndent + match[1];
                }
                // Term already doesn't have bold, leave as is
            } else {
                // Add bold to all terms
                if (!boldRegex.test(trimmedLine)) {
                    modifiedLines[term.index] = originalIndent + '**' + trimmedLine + '**';
                }
                // Term already has bold (shouldn't happen in this branch), leave as is
            }
        }
        
        return modifiedLines.join('\n');
    }
}