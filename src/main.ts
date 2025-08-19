import { Plugin, MarkdownPostProcessorContext } from 'obsidian';
import { Extension } from '@codemirror/state';
import { pandocListsExtension } from './decorations/pandocListsExtension';
import { processReadingMode } from './parsers/readingModeProcessor';
import { ExampleReferenceSuggestFixed } from './ExampleReferenceSuggestFixed';

export default class PandocListsPlugin extends Plugin {
    private suggester: ExampleReferenceSuggestFixed;

    async onload() {
        console.log('Loading Pandoc Lists plugin');
        
        // Register CodeMirror extension for live preview
        this.registerEditorExtension(pandocListsExtension());
        
        // Register markdown post-processor for reading mode
        this.registerMarkdownPostProcessor((element, context) => {
            processReadingMode(element, context);
        });
        
        // Register example reference suggester
        this.suggester = new ExampleReferenceSuggestFixed(this);
        this.registerEditorSuggest(this.suggester);
        
        console.log('Pandoc Lists plugin loaded successfully');
    }

    onunload() {
        console.log('Unloading Pandoc Lists plugin');
    }
}