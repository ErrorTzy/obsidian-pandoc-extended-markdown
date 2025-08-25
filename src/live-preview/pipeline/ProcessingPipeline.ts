import { EditorView, DecorationSet, Decoration } from '@codemirror/view';
import { RangeSetBuilder, Text } from '@codemirror/state';
import { App, Component } from 'obsidian';

import { 
    ProcessingContext, 
    StructuralProcessor, 
    InlineProcessor,
    ContentRegion,
    InlineMatch 
} from './types';

import { ListPatterns } from '../../shared/patterns';

import { PlaceholderContext } from '../../shared/utils/placeholderProcessor';

import { PandocExtendedMarkdownSettings } from '../../core/settings';
import { PluginStateManager } from '../../core/state/pluginStateManager';
import { scanCustomLabels } from '../scanners/customLabelScanner';
import { validateListBlocks } from '../validators/listBlockValidator';
import { handleError } from '../../shared/utils/errorHandler';

// Helper: Process a single example list line
function processExampleLine(
    line: string,
    lineNum: number,
    counter: { value: number },
    result: ReturnType<typeof createExampleScanResult>,
    duplicateLineNumbers: Set<number>
): void {
    const exampleMatch = ListPatterns.isExampleList(line);
    
    if (exampleMatch && exampleMatch.length >= 5) {
        const indent = exampleMatch[1] || '';
        const fullMarker = exampleMatch[2] || '';
        const label = exampleMatch[3] || '';
        const space = exampleMatch[4] || '';
        const content = line.substring(
            indent.length + fullMarker.length + space.length
        );
        
        // Only check for duplicates if there's an actual label (not empty)
        // Unlabeled example lists (@) should not be flagged as duplicates
        if (label && result.exampleLabels.has(label)) {
            // This is a duplicate - mark THIS line as duplicate, not the first
            duplicateLineNumbers.add(lineNum);
            // Store info about the first occurrence for reference
            if (!result.duplicateLabels.has(label)) {
                const firstOccurrenceNumber = result.exampleLabels.get(label)!;
                const firstLine = Array.from(result.exampleLineNumbers.entries())
                    .find(([, num]) => num === firstOccurrenceNumber)?.[0] || 0;
                result.duplicateLabels.set(label, firstLine);
                result.duplicateLabelContent.set(label, result.exampleContent.get(label) || '');
            }
        } else if (label) {
            // First occurrence of this label - track it
            result.exampleLabels.set(label, counter.value);
            result.exampleContent.set(label, content);
        }
        
        // Always track line numbers for all example lists
        result.exampleLineNumbers.set(lineNum, counter.value);
        counter.value++;
    }
}

// Helper: Create empty example scan result
function createExampleScanResult() {
    return {
        exampleLabels: new Map<string, number>(),
        exampleContent: new Map<string, string>(),
        exampleLineNumbers: new Map<number, number>(),
        duplicateLabels: new Map<string, number>(),
        duplicateLabelContent: new Map<string, string>()
    };
}

// Scan example labels from document
function scanExampleLabelsFromDoc(doc: Text, settings: PandocExtendedMarkdownSettings) {
    const result = createExampleScanResult();
    const counter = { value: 1 };
    const lines = doc.toString().split('\n');
    const invalidLines = settings.strictPandocMode ? validateListBlocks(doc) : new Set<number>();
    const duplicateLineNumbers = new Set<number>();
    
    for (let i = 0; i < lines.length; i++) {
        if (!invalidLines.has(i)) {
            processExampleLine(lines[i], i + 1, counter, result, duplicateLineNumbers);
        }
    }
    
    // Return result with duplicate line numbers
    return { ...result, duplicateLineNumbers };
}

/**
 * Orchestrates the two-phase processing pipeline for decorations
 */
export class ProcessingPipeline {
    private structuralProcessors: StructuralProcessor[] = [];
    private inlineProcessors: InlineProcessor[] = [];
    private stateManager: PluginStateManager;
    private app: App | undefined; // Will be passed from plugin to avoid global app access
    private component: Component | undefined; // Component for lifecycle management
    
    constructor(stateManager: PluginStateManager, app?: App, component?: Component) {
        this.stateManager = stateManager;
        this.app = app;
        this.component = component;
    }
    
    /**
     * Register a structural processor
     */
    registerStructuralProcessor(processor: StructuralProcessor): void {
        this.structuralProcessors.push(processor);
        this.structuralProcessors.sort((a, b) => a.priority - b.priority);
    }
    
    /**
     * Register an inline processor
     */
    registerInlineProcessor(processor: InlineProcessor): void {
        this.inlineProcessors.push(processor);
        this.inlineProcessors.sort((a, b) => a.priority - b.priority);
    }
    
    /**
     * Process the document through both phases
     */
    process(view: EditorView, settings: PandocExtendedMarkdownSettings): DecorationSet {
        const context = this.createContext(view, settings);
        
        // Phase 1: Structural processing
        this.processStructural(context);
        
        // Phase 2: Inline processing
        this.processInline(context);
        
        // Build and return the decoration set
        return this.buildDecorationSet(context);
    }
    
    /**
     * Create the processing context with pre-scanned data
     */
    // Helper: Get document path from workspace
    private getDocumentPath(): string | null {
        const workspace = this.app?.workspace;
        const activeFile = workspace?.getActiveFile();
        return activeFile?.path || null;
    }
    
    // Helper: Get or create placeholder context
    private getPlaceholderContext(docPath: string | null): PlaceholderContext {
        return docPath 
            ? this.stateManager.getDocumentCounters(docPath).placeholderContext 
            : new PlaceholderContext();
    }
    
    // Helper: Get custom scan result
    private getCustomScanResult(
        doc: Text,
        settings: PandocExtendedMarkdownSettings,
        placeholderContext: PlaceholderContext
    ) {
        return settings.moreExtendedSyntax 
            ? scanCustomLabels(doc, settings, placeholderContext)
            : {
                customLabels: new Map<string, string>(),
                rawToProcessed: new Map<string, string>(),
                duplicateLabels: new Set<string>(),
                placeholderContext: placeholderContext
            };
    }
    
    // Helper: Build final context object
    private buildContext(
        view: EditorView,
        settings: PandocExtendedMarkdownSettings,
        exampleScanResult: ReturnType<typeof scanExampleLabelsFromDoc>,
        customScanResult: ReturnType<typeof scanCustomLabels>,
        invalidLines: Set<number>
    ): ProcessingContext {
        return {
            document: view.state.doc,
            view,
            settings,
            app: this.app,
            component: this.component,
            
            // Scanned data
            exampleLabels: exampleScanResult.exampleLabels,
            exampleContent: exampleScanResult.exampleContent,
            exampleLineNumbers: exampleScanResult.exampleLineNumbers,
            duplicateExampleLabels: exampleScanResult.duplicateLabels,
            duplicateExampleContent: exampleScanResult.duplicateLabelContent,
            duplicateExampleLineNumbers: exampleScanResult.duplicateLineNumbers,
            customLabels: customScanResult.customLabels,
            rawToProcessed: customScanResult.rawToProcessed,
            duplicateCustomLabels: customScanResult.duplicateLabels,
            duplicateCustomLineInfo: customScanResult.duplicateLineInfo,
            placeholderContext: customScanResult.placeholderContext,
            invalidLines,
            
            // Processing metadata
            contentRegions: [],
            structuralDecorations: [],
            inlineDecorations: [],
            
            // State tracking
            hashCounter: { value: 1 },
            definitionState: {
                lastWasItem: false,
                pendingBlankLine: false
            }
        };
    }
    
    private createContext(view: EditorView, settings: PandocExtendedMarkdownSettings): ProcessingContext {
        const doc = view.state.doc;
        const docPath = this.getDocumentPath();
        
        // Pre-scan and validate
        const exampleScanResult = scanExampleLabelsFromDoc(doc, settings);
        const placeholderContext = this.getPlaceholderContext(docPath);
        const customScanResult = this.getCustomScanResult(doc, settings, placeholderContext);
        const invalidLines = settings.strictPandocMode ? validateListBlocks(doc) : new Set<number>();
        
        // Update state manager
        if (docPath && customScanResult.placeholderContext) {
            const counters = this.stateManager.getDocumentCounters(docPath);
            counters.placeholderContext = customScanResult.placeholderContext;
        }
        
        return this.buildContext(view, settings, exampleScanResult, customScanResult, invalidLines);
    }
    
    /**
     * Phase 1: Process structural elements
     */
    private processStructural(context: ProcessingContext): void {
        const doc = context.document;
        const numLines = doc.lines;
        
        for (let lineNum = 1; lineNum <= numLines; lineNum++) {
            const line = doc.line(lineNum);
            
            // Skip invalid lines in strict mode
            if (context.invalidLines.has(lineNum)) {
                continue;
            }
            
            // Try each structural processor
            let processed = false;
            for (const processor of this.structuralProcessors) {
                if (processor.canProcess(line, context)) {
                    const result = processor.process(line, context);
                    
                    // Add structural decorations
                    context.structuralDecorations.push(...result.decorations);
                    
                    // Track content region for phase 2
                    if (result.contentRegion) {
                        context.contentRegions.push(result.contentRegion);
                    }
                    
                    // Skip other processors if requested
                    if (result.skipFurtherProcessing) {
                        processed = true;
                        break;
                    }
                }
            }
            
            // If no processor handled this line, mark it as normal content
            if (!processed) {
                context.contentRegions.push({
                    from: line.from,
                    to: line.to,
                    type: 'normal'
                });
            }
        }
    }
    
    /**
     * Phase 2: Process inline content within marked regions
     */
    private processInline(context: ProcessingContext): void {
        const docLength = context.document.length;
        
        for (const region of context.contentRegions) {
            // Skip regions with no content or invalid bounds
            if (region.from >= region.to || region.from < 0 || region.to > docLength) {
                continue;
            }
            
            const text = context.document.sliceString(region.from, region.to);
            
            // Collect all matches from all processors
            const allMatches: Array<{
                match: InlineMatch;
                processor: InlineProcessor;
            }> = [];
            
            for (const processor of this.inlineProcessors) {
                if (processor.supportedRegions.has(region.type)) {
                    const matches = processor.findMatches(text, region, context);
                    for (const match of matches) {
                        // Validate match positions
                        if (match.from >= 0 && match.to <= text.length && match.from <= match.to) {
                            allMatches.push({ match, processor });
                        }
                    }
                }
            }
            
            // Sort matches by position to handle overlaps
            allMatches.sort((a, b) => a.match.from - b.match.from);
            
            // Process non-overlapping matches
            let lastEnd = 0;
            for (const { match, processor } of allMatches) {
                // Skip overlapping matches
                if (match.from < lastEnd) continue;
                
                const decoration = processor.createDecoration(match, context);
                const absoluteFrom = region.from + match.from;
                const absoluteTo = region.from + match.to;
                
                // Final bounds check before adding decoration
                if (absoluteFrom >= 0 && absoluteTo <= docLength && absoluteFrom <= absoluteTo) {
                    context.inlineDecorations.push({
                        from: absoluteFrom,
                        to: absoluteTo,
                        decoration
                    });
                }
                
                lastEnd = match.to;
            }
        }
    }
    
    /**
     * Build the final decoration set from both phases
     */
    private buildDecorationSet(context: ProcessingContext): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        const docLength = context.document.length;
        
        // Combine and sort all decorations
        const allDecorations = [
            ...context.structuralDecorations,
            ...context.inlineDecorations
        ].sort((a, b) => a.from - b.from || a.to - b.to);
        
        // Add decorations to builder with bounds checking
        for (const { from, to, decoration } of allDecorations) {
            // Validate positions are within document bounds
            if (from < 0 || to > docLength || from > to) {
                handleError(`Invalid decoration position: from=${from}, to=${to}, docLength=${docLength}`, 'warning');
                continue;
            }
            
            // Ensure positions are integers
            const safeFrom = Math.floor(from);
            const safeTo = Math.floor(to);
            
            try {
                builder.add(safeFrom, safeTo, decoration);
            } catch (e) {
                handleError(e, 'error');
            }
        }
        
        return builder.finish();
    }
    
    /**
     * Clear all registered processors
     */
    clear(): void {
        this.structuralProcessors = [];
        this.inlineProcessors = [];
    }
    
    /**
     * Get registered processor counts for debugging
     */
    getProcessorCounts(): { structural: number; inline: number } {
        return {
            structural: this.structuralProcessors.length,
            inline: this.inlineProcessors.length
        };
    }
}

