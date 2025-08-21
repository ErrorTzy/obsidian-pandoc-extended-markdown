import { Extension, RangeSetBuilder } from '@codemirror/state';
import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';
import { editorLivePreviewField } from 'obsidian';
import { PandocExtendedMarkdownSettings } from '../settings';
import { ValidationContext } from '../pandocValidator';
import { ListBlockValidator } from './validators/listBlockValidator';
import { scanExampleLabels, ExampleScanResult } from './scanners/exampleScanner';
import {
    processHashList,
    processFancyList,
    processExampleList,
    ProcessorContext,
    processDefinitionItem,
    processDefinitionTerm,
    processDefinitionParagraph,
    DefinitionContext,
    processExampleReferences,
    processSuperscripts,
    processSubscripts,
    InlineFormatContext
} from './processors';

// Main view plugin for rendering Pandoc lists
const pandocListsPlugin = (getSettings: () => PandocExtendedMarkdownSettings) => ViewPlugin.fromClass(
    class PandocListsView {
        decorations: DecorationSet;
        private scanResult: ExampleScanResult;

        constructor(view: EditorView) {
            const settings = getSettings();
            this.scanResult = scanExampleLabels(view, settings);
            this.decorations = this.buildDecorations(view);
        }

        update(update: ViewUpdate) {
            if (update.docChanged || update.viewportChanged || update.selectionSet) {
                if (update.docChanged) {
                    const settings = getSettings();
                    this.scanResult = scanExampleLabels(update.view, settings);
                }
                this.decorations = this.buildDecorations(update.view);
            }
        }

        buildDecorations(view: EditorView): DecorationSet {
            const builder = new RangeSetBuilder<Decoration>();
            
            // Check if we're in live preview mode - if not, return empty decorations
            const isLivePreview = view.state.field(editorLivePreviewField);
            if (!isLivePreview) {
                return builder.finish();
            }
            
            // Get settings for strict mode checking
            const settings = getSettings();
            const lines = view.state.doc.toString().split('\n');
            
            // Track cursor position to preserve source mode only when cursor is in the marker
            const selection = view.state.selection.main;
            const cursorPos = selection.head;
            
            // Collect all decorations first
            const decorations: Array<{from: number, to: number, decoration: Decoration}> = [];
            
            // Track hash list numbering
            const hashCounter = { value: 1 };
            
            // In strict mode, pre-validate list blocks
            const invalidListBlocks = ListBlockValidator.validateListBlocks(lines, settings);
            
            // Process entire document for consistent numbering
            for (let lineNum = 1; lineNum <= view.state.doc.lines; lineNum++) {
                const line = view.state.doc.line(lineNum);
                const lineText = line.text;
                
                // Create processor context
                const processorContext: ProcessorContext = {
                    line,
                    lineNum,
                    lineText,
                    cursorPos,
                    view,
                    invalidListBlocks,
                    settings,
                    exampleLabels: this.scanResult.exampleLabels,
                    exampleLineNumbers: this.scanResult.exampleLineNumbers,
                    duplicateLabels: this.scanResult.duplicateLabels,
                    duplicateLabelContent: this.scanResult.duplicateLabelContent
                };
                
                // Process hash lists
                const hashDecorations = processHashList(processorContext, hashCounter);
                if (hashDecorations) {
                    decorations.push(...hashDecorations);
                    continue;
                }
                
                // Process fancy lists
                const fancyDecorations = processFancyList(processorContext);
                if (fancyDecorations) {
                    decorations.push(...fancyDecorations);
                    continue;
                }
                
                // Process example lists
                const exampleDecorations = processExampleList(processorContext);
                if (exampleDecorations) {
                    decorations.push(...exampleDecorations);
                    continue;
                }
                
                // Create definition context
                const definitionContext: DefinitionContext = {
                    line,
                    lineNum,
                    lineText,
                    cursorPos,
                    view,
                    invalidListBlocks,
                    settings,
                    lines
                };
                
                // Process definition items
                const defItemDecorations = processDefinitionItem(definitionContext);
                if (defItemDecorations) {
                    decorations.push(...defItemDecorations);
                    // Don't continue here - we still need to process inline formats
                }
                
                // Process definition paragraphs
                const defParagraphDecorations = processDefinitionParagraph(definitionContext);
                if (defParagraphDecorations) {
                    decorations.push(...defParagraphDecorations);
                    continue; // Skip further processing for indented content
                }
                
                // Process definition terms
                const defTermDecorations = processDefinitionTerm(definitionContext);
                if (defTermDecorations) {
                    decorations.push(...defTermDecorations);
                }
                
                // Create inline format context
                const inlineContext: InlineFormatContext = {
                    line,
                    lineText,
                    cursorPos,
                    exampleLabels: this.scanResult.exampleLabels,
                    exampleContent: this.scanResult.exampleContent
                };
                
                // Process inline formats
                decorations.push(...processExampleReferences(inlineContext));
                decorations.push(...processSuperscripts(inlineContext));
                decorations.push(...processSubscripts(inlineContext));
            }
            
            // Sort decorations by from position
            decorations.sort((a, b) => a.from - b.from || a.to - b.to);
            
            // Add sorted decorations to builder
            for (const {from, to, decoration} of decorations) {
                builder.add(from, to, decoration);
            }
            
            return builder.finish();
        }
    },
    {
        decorations: v => v.decorations
    }
);

export function pandocListsExtension(getSettings: () => PandocExtendedMarkdownSettings): Extension {
    return pandocListsPlugin(getSettings);
}