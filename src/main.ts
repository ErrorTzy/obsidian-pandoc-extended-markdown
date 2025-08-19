import { Plugin, MarkdownPostProcessorContext } from 'obsidian';
import { Extension } from '@codemirror/state';
import { pandocListsExtension } from './decorations/pandocListsExtension';
import { processReadingMode } from './parsers/readingModeProcessor';

export default class PandocListsPlugin extends Plugin {
    async onload() {
        console.log('Loading Pandoc Lists plugin');
        
        // Register CodeMirror extension for live preview
        this.registerEditorExtension(pandocListsExtension());
        
        // Register markdown post-processor for reading mode
        this.registerMarkdownPostProcessor((element, context) => {
            processReadingMode(element, context);
        });
        
        console.log('Pandoc Lists plugin loaded successfully');
    }

    onunload() {
        console.log('Unloading Pandoc Lists plugin');
    }
}