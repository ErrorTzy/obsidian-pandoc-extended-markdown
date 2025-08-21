// External libraries
import { Plugin, MarkdownPostProcessorContext, Notice, Editor, MarkdownView, WorkspaceLeaf } from 'obsidian';
import { Extension, Prec } from '@codemirror/state';
import { keymap, EditorView } from '@codemirror/view';

// Types
import { PandocExtendedMarkdownSettings, DEFAULT_SETTINGS, PandocExtendedMarkdownSettingTab } from './settings';
import { ProcessorConfig, createProcessorConfig } from './types/ProcessorConfig';

// Constants
import { MESSAGES, COMMANDS, UI_CONSTANTS } from './constants';

// Patterns
import { ListPatterns } from './patterns';

// Internal modules
import { pandocListsExtension } from './decorations/pandocListsExtension';
import { processReadingMode } from './parsers/readingModeProcessor';
import { ExampleReferenceSuggestFixed } from './ExampleReferenceSuggestFixed';
import { formatToPandocStandard, checkPandocFormatting } from './pandocValidator';
import { createListAutocompletionKeymap } from './listAutocompletion';
import { pluginStateManager } from './state/PluginStateManager';

export class PandocListsPlugin extends Plugin {
    private suggester: ExampleReferenceSuggestFixed;
    settings: PandocExtendedMarkdownSettings;

    async onload() {
        await this.loadSettings();
        
        // Add settings tab
        this.addSettingTab(new PandocExtendedMarkdownSettingTab(this.app, this));
        
        // Register all extensions and processors
        this.registerExtensions();
        this.registerPostProcessor();
        
        // Set up mode change detection
        this.setupModeChangeDetection();
        
        // Register example reference suggester
        this.suggester = new ExampleReferenceSuggestFixed(this);
        this.registerEditorSuggest(this.suggester);
        
        // Register all commands
        this.registerCommands();
    }

    private registerExtensions(): void {
        // Register CodeMirror extension for live preview with settings
        this.registerEditorExtension(pandocListsExtension(() => this.settings));
        
        // Register list autocompletion keymap with highest priority
        this.registerEditorExtension(Prec.highest(keymap.of(createListAutocompletionKeymap(this.settings))));
    }

    private registerPostProcessor(): void {
        // Register markdown post-processor for reading mode
        this.registerMarkdownPostProcessor((element, context) => {
            // Create processor config from current settings
            const config = createProcessorConfig(
                { strictLineBreaks: this.app.vault.getConfig('strictLineBreaks') },
                this.settings
            );
            processReadingMode(element, context, config);
        });
    }

    private setupModeChangeDetection(): void {
        const updateStates = () => {
            const leaves = this.app.workspace.getLeavesOfType("markdown");
            const hadChanges = pluginStateManager.scanAllLeaves(leaves);
            
            // Only force CodeMirror refresh if there were actual mode changes
            if (hadChanges) {
                // Small delay to ensure mode switch is complete
                setTimeout(() => {
                    this.app.workspace.iterateCodeMirrors((cm: EditorView) => {
                        // Trigger a minor update to force decoration recalculation
                        if (cm.dispatch) {
                            cm.dispatch({ effects: [] });
                        }
                    });
                }, 10);
            }
        };
        
        // Initial scan
        updateStates();
        
        // Register workspace events for mode change detection
        this.registerEvent(this.app.workspace.on("layout-change", updateStates));
        this.registerEvent(this.app.workspace.on("active-leaf-change", updateStates));
        this.registerEvent(this.app.workspace.on("file-open", updateStates));
    }

    private registerCommands(): void {
        // Add command to check strict pandoc linting
        this.addCommand({
            id: COMMANDS.CHECK_PANDOC,
            name: 'Check pandoc formatting',
            editorCallback: (editor: Editor) => {
                const content = editor.getValue();
                const issues = checkPandocFormatting(content, this.settings.moreExtendedSyntax);
                
                if (issues.length === 0) {
                    new Notice(MESSAGES.PANDOC_COMPLIANT);
                } else {
                    const issueList = issues.map(issue => 
                        `Line ${issue.line}: ${issue.message}`
                    ).join('\n');
                    new Notice(`${MESSAGES.FORMATTING_ISSUES(issues.length)}:\n${issueList}`, UI_CONSTANTS.NOTICE_DURATION_MS);
                }
            }
        });
        
        // Add command to auto-format to pandoc standard
        this.addCommand({
            id: COMMANDS.FORMAT_PANDOC,
            name: 'Format document to pandoc standard',
            editorCallback: (editor: Editor) => {
                const content = editor.getValue();
                const formatted = formatToPandocStandard(content, this.settings.moreExtendedSyntax);
                
                if (content !== formatted) {
                    editor.setValue(formatted);
                    new Notice(MESSAGES.FORMAT_SUCCESS);
                } else {
                    new Notice(MESSAGES.FORMAT_ALREADY_COMPLIANT);
                }
            }
        });
        
        // Add command to toggle bold style for definition terms
        this.addCommand({
            id: COMMANDS.TOGGLE_DEFINITION_BOLD,
            name: 'Toggle definition list bold style',
            editorCallback: (editor: Editor) => {
                const content = editor.getValue();
                const toggled = this.toggleDefinitionBoldStyle(content);
                
                if (content !== toggled) {
                    editor.setValue(toggled);
                    new Notice(MESSAGES.TOGGLE_BOLD_SUCCESS);
                } else {
                    new Notice(MESSAGES.NO_DEFINITION_TERMS);
                }
            }
        });
        
        // Add command to toggle underline style for definition terms
        this.addCommand({
            id: COMMANDS.TOGGLE_DEFINITION_UNDERLINE,
            name: 'Toggle definition list underline style',
            editorCallback: (editor: Editor) => {
                const content = editor.getValue();
                const toggled = this.toggleDefinitionUnderlineStyle(content);
                
                if (content !== toggled) {
                    editor.setValue(toggled);
                    new Notice(MESSAGES.TOGGLE_UNDERLINE_SUCCESS);
                } else {
                    new Notice(MESSAGES.NO_DEFINITION_TERMS);
                }
            }
        });
    }

    onunload() {
        // Clear all states on unload
        pluginStateManager.clearAllStates();
        // Other cleanup is handled automatically by Obsidian
    }
    
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
    
    private isDefinitionTerm(lines: string[], index: number): boolean {
        if (index + 1 >= lines.length) {
            return false;
        }
        
        const nextLine = lines[index + 1].trim();
        if (ListPatterns.isDefinitionMarker(nextLine)) {
            return true;
        }
        
        // Check line after empty line
        if (nextLine === '' && index + 2 < lines.length) {
            const lineAfterEmpty = lines[index + 2].trim();
            return ListPatterns.isDefinitionMarker(lineAfterEmpty) !== null;
        }
        
        return false;
    }

    private identifyDefinitionTerms(lines: string[]): {terms: {index: number, hasBold: boolean}[], anyHasBold: boolean} {
        const definitionTerms: {index: number, hasBold: boolean}[] = [];
        let anyHasBold = false;
        
        for (let i = 0; i < lines.length; i++) {
            const trimmedLine = lines[i].trim();
            
            // Skip empty lines and lines that are definition markers
            if (!trimmedLine || ListPatterns.isDefinitionMarker(trimmedLine)) {
                continue;
            }
            
            if (this.isDefinitionTerm(lines, i)) {
                const hasBold = ListPatterns.BOLD_TEXT.test(trimmedLine);
                definitionTerms.push({index: i, hasBold});
                if (hasBold) {
                    anyHasBold = true;
                }
            }
        }
        
        return { terms: definitionTerms, anyHasBold };
    }
    
    private identifyDefinitionTermsWithUnderline(lines: string[]): {terms: {index: number, hasUnderline: boolean}[], anyHasUnderline: boolean} {
        const definitionTerms: {index: number, hasUnderline: boolean}[] = [];
        let anyHasUnderline = false;
        
        for (let i = 0; i < lines.length; i++) {
            const trimmedLine = lines[i].trim();
            
            // Skip empty lines and lines that are definition markers
            if (!trimmedLine || ListPatterns.isDefinitionMarker(trimmedLine)) {
                continue;
            }
            
            if (this.isDefinitionTerm(lines, i)) {
                const hasUnderline = ListPatterns.UNDERLINE_SPAN.test(trimmedLine);
                definitionTerms.push({index: i, hasUnderline});
                if (hasUnderline) {
                    anyHasUnderline = true;
                }
            }
        }
        
        return { terms: definitionTerms, anyHasUnderline };
    }

    toggleDefinitionBoldStyle(content: string): string {
        const lines = content.split('\n');
        const modifiedLines = [...lines];
        
        const { terms, anyHasBold } = this.identifyDefinitionTerms(lines);
        
        // Apply unified formatting
        for (const term of terms) {
            const line = lines[term.index];
            const trimmedLine = line.trim();
            const originalIndent = line.match(/^(\s*)/)?.[1] || '';
            
            if (anyHasBold) {
                // Remove bold from all terms
                const match = trimmedLine.match(ListPatterns.BOLD_TEXT);
                if (match) {
                    modifiedLines[term.index] = originalIndent + match[1];
                }
            } else {
                // Add bold to all terms
                if (!ListPatterns.BOLD_TEXT.test(trimmedLine)) {
                    modifiedLines[term.index] = originalIndent + '**' + trimmedLine + '**';
                }
            }
        }
        
        return modifiedLines.join('\n');
    }
    
    toggleDefinitionUnderlineStyle(content: string): string {
        const lines = content.split('\n');
        const modifiedLines = [...lines];
        
        const { terms, anyHasUnderline } = this.identifyDefinitionTermsWithUnderline(lines);
        
        // Apply unified formatting
        for (const term of terms) {
            const line = lines[term.index];
            const trimmedLine = line.trim();
            const originalIndent = line.match(/^(\s*)/)?.[1] || '';
            
            if (anyHasUnderline) {
                // Remove underline from all terms
                const match = trimmedLine.match(ListPatterns.UNDERLINE_SPAN);
                if (match) {
                    modifiedLines[term.index] = originalIndent + match[1];
                }
            } else {
                // Add underline to all terms
                if (!ListPatterns.UNDERLINE_SPAN.test(trimmedLine)) {
                    modifiedLines[term.index] = originalIndent + '<span class="underline">' + trimmedLine + '</span>';
                }
            }
        }
        
        return modifiedLines.join('\n');
    }
}

export default PandocListsPlugin;