import { Extension, RangeSetBuilder } from '@codemirror/state';
import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';
import { editorLivePreviewField } from 'obsidian';
import { PandocExtendedMarkdownSettings } from '../settings';
import { ValidationContext } from '../pandocValidator';
import { ListBlockValidator } from './validators/listBlockValidator';
import { scanExampleLabels, ExampleScanResult } from './scanners/exampleScanner';
import { scanCustomLabels, validateCustomLabelBlocks, CustomLabelScanResult } from './scanners/customLabelScanner';
import { pluginStateManager } from '../state/PluginStateManager';
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
import { processCustomLabelList, processCustomLabelReferences, CustomLabelProcessorContext } from './processors/customLabelProcessor';

// Main view plugin for rendering Pandoc extended markdown
const pandocExtendedMarkdownPlugin = (getSettings: () => PandocExtendedMarkdownSettings, getDocPath: () => string | null) => ViewPlugin.fromClass(
    class PandocExtendedMarkdownView {
        decorations: DecorationSet;
        private scanResult: ExampleScanResult;
        private customLabelScanResult: CustomLabelScanResult;

        constructor(view: EditorView) {
            const settings = getSettings();
            const docPath = getDocPath();
            const placeholderContext = docPath ? pluginStateManager.getDocumentCounters(docPath).placeholderContext : undefined;
            this.scanResult = scanExampleLabels(view, settings);
            this.customLabelScanResult = scanCustomLabels(view.state.doc, settings, placeholderContext);
            this.decorations = this.buildDecorations(view);
        }

        update(update: ViewUpdate) {
            // Check if live preview state changed
            const prevLivePreview = update.startState.field(editorLivePreviewField);
            const currLivePreview = update.state.field(editorLivePreviewField);
            const livePreviewChanged = prevLivePreview !== currLivePreview;
            
            if (update.docChanged || update.viewportChanged || update.selectionSet || livePreviewChanged) {
                if (update.docChanged) {
                    const settings = getSettings();
                    const docPath = getDocPath();
                    const placeholderContext = docPath ? pluginStateManager.getDocumentCounters(docPath).placeholderContext : undefined;
                    this.scanResult = scanExampleLabels(update.view, settings);
                    this.customLabelScanResult = scanCustomLabels(update.view.state.doc, settings, placeholderContext);
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
            
            // Validate custom label blocks if in strict mode
            const invalidCustomLabelBlocks = validateCustomLabelBlocks(view.state.doc, settings);
            
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
                
                // Process custom label lists (if More Extended Syntax is enabled)
                if (settings.moreExtendedSyntax) {
                    const customLabelContext: CustomLabelProcessorContext = {
                        line,
                        lineNum,
                        lineText,
                        cursorPos,
                        view,
                        invalidListBlocks: invalidCustomLabelBlocks,
                        settings,
                        customLabels: this.customLabelScanResult.customLabels,
                        rawToProcessed: this.customLabelScanResult.rawToProcessed,
                        placeholderContext: this.customLabelScanResult.placeholderContext
                    };
                    
                    const customLabelDecorations = processCustomLabelList(customLabelContext);
                    if (customLabelDecorations) {
                        decorations.push(...customLabelDecorations);
                        continue;
                    }
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
                
                // Process custom label references (if More Extended Syntax is enabled)
                if (settings.moreExtendedSyntax) {
                    // Check if this line is valid (not in invalidCustomLabelBlocks)
                    const isValidLine = !invalidCustomLabelBlocks.has(lineNum - 1);
                    const customLabelRefs = processCustomLabelReferences(
                        lineText,
                        line.from,
                        this.customLabelScanResult.customLabels,
                        view,
                        cursorPos,
                        settings,
                        isValidLine,
                        this.customLabelScanResult.rawToProcessed,
                        this.customLabelScanResult.placeholderContext
                    );
                    decorations.push(...customLabelRefs);
                }
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

export function pandocExtendedMarkdownExtension(getSettings: () => PandocExtendedMarkdownSettings, getDocPath: () => string | null): Extension {
    return pandocExtendedMarkdownPlugin(getSettings, getDocPath);
}