import { Plugin, MarkdownPostProcessorContext, Notice, Editor } from 'obsidian';
import { Extension } from '@codemirror/state';
import { pandocListsExtension } from './decorations/pandocListsExtension';
import { processReadingMode } from './parsers/readingModeProcessor';
import { ExampleReferenceSuggestFixed } from './ExampleReferenceSuggestFixed';
import { PandocListsSettings, DEFAULT_SETTINGS, PandocListsSettingTab } from './settings';
import { formatToPandocStandard, checkPandocFormatting } from './pandocValidator';

export default class PandocListsPlugin extends Plugin {
    private suggester: ExampleReferenceSuggestFixed;
    settings: PandocListsSettings;

    async onload() {
        await this.loadSettings();
        
        // Add settings tab
        this.addSettingTab(new PandocListsSettingTab(this.app, this));
        
        // Register CodeMirror extension for live preview with settings
        this.registerEditorExtension(pandocListsExtension(() => this.settings));
        
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
}