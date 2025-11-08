// External libraries
import { EditorView, DecorationSet, Decoration } from '@codemirror/view';
import { RangeSetBuilder, Text } from '@codemirror/state';
import { App, Component } from 'obsidian';

// Types
import { 
    ProcessingContext, 
    StructuralProcessor, 
    InlineProcessor,
    ContentRegion,
    InlineMatch 
} from './types';
import { CodeRegion } from '../../shared/types/codeTypes';
import { PandocExtendedMarkdownSettings } from '../../core/settings';

// Patterns
import { ListPatterns } from '../../shared/patterns';

// Utils
import { PlaceholderContext } from '../../shared/utils/placeholderProcessor';
import { handleError } from '../../shared/utils/errorHandler';
import { detectCodeRegions, isLineInCodeRegion, isRangeInCodeRegion } from './utils/codeDetection';

// Internal modules
import { PluginStateManager } from '../../core/state/pluginStateManager';
import { scanCustomLabels } from '../scanners/customLabelScanner';
import { validateListBlocks } from '../validators/listBlockValidator';

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
function scanExampleLabelsFromDoc(doc: Text, settings: PandocExtendedMarkdownSettings, codeRegions?: CodeRegion[]) {
    const result = createExampleScanResult();
    const counter = { value: 1 };
    const lines = doc.toString().split('\n');
    const invalidLines = settings.strictPandocMode ? validateListBlocks(doc) : new Set<number>();
    const duplicateLineNumbers = new Set<number>();
    
    for (let i = 0; i < lines.length; i++) {
        // Skip lines in code regions
        if (codeRegions && isLineInCodeRegion(i + 1, doc, codeRegions)) {
            continue;
        }
        
        if (!invalidLines.has(i + 1)) { // invalidLines now contains 1-based line numbers
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
        placeholderContext: PlaceholderContext,
        codeRegions?: CodeRegion[]
    ) {
        return settings.moreExtendedSyntax 
            ? scanCustomLabels(doc, settings, placeholderContext, codeRegions)
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
        
        // Detect code regions that should be skipped
        const codeRegions = detectCodeRegions(doc);
        
        // Pre-scan and validate (pass codeRegions to skip scanning inside them)
        const exampleScanResult = scanExampleLabelsFromDoc(doc, settings, codeRegions);
        const placeholderContext = this.getPlaceholderContext(docPath);
        const customScanResult = this.getCustomScanResult(doc, settings, placeholderContext, codeRegions);
        const invalidLines = settings.strictPandocMode ? validateListBlocks(doc) : new Set<number>();
        
        // Update state manager
        if (docPath && customScanResult.placeholderContext) {
            const counters = this.stateManager.getDocumentCounters(docPath);
            counters.placeholderContext = customScanResult.placeholderContext;
        }
        
        const context = this.buildContext(view, settings, exampleScanResult, customScanResult, invalidLines);
        context.codeRegions = codeRegions;
        return context;
    }
    
    /**
     * Phase 1: Process structural elements
     */
    private processStructural(context: ProcessingContext): void {
        const doc = context.document;
        const numLines = doc.lines;
        const codeRegions = context.codeRegions || [];
        
        for (let lineNum = 1; lineNum <= numLines; lineNum++) {
            const line = doc.line(lineNum);
            
            // Skip invalid lines in strict mode
            if (context.invalidLines.has(lineNum)) {
                continue;
            }
            
            // Skip lines that are inside code regions
            if (isLineInCodeRegion(lineNum, doc, codeRegions as CodeRegion[])) {
                continue;
            }
            
            // Clear list context if we encounter a blank line
            if (line.text.trim() === '' && context.listContext) {
                context.listContext = undefined;
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
        const codeRegions = context.codeRegions || [];
        
        for (const region of context.contentRegions) {
            // Skip invalid regions
            if (!this.isValidRegion(region, docLength)) {
                continue;
            }
            
            // Process this region
            this.processRegion(region, context, docLength, codeRegions as CodeRegion[]);
        }
    }
    
    /**
     * Check if a content region is valid for processing
     */
    private isValidRegion(region: ContentRegion, docLength: number): boolean {
        return region.from < region.to && region.from >= 0 && region.to <= docLength;
    }
    
    /**
     * Process a single content region for inline matches
     */
    private processRegion(
        region: ContentRegion, 
        context: ProcessingContext, 
        docLength: number,
        codeRegions: CodeRegion[]
    ): void {
        const text = context.document.sliceString(region.from, region.to);
        const allMatches = this.collectMatches(region, text, context, codeRegions);
        
        // Sort matches by position to handle overlaps
        allMatches.sort((a, b) => a.match.from - b.match.from);
        
        // Process non-overlapping matches
        this.processMatches(allMatches, region, context, docLength);
    }
    
    /**
     * Collect all inline matches from all processors for a region
     */
    private collectMatches(
        region: ContentRegion,
        text: string,
        context: ProcessingContext,
        codeRegions: CodeRegion[]
    ): Array<{match: InlineMatch; processor: InlineProcessor}> {
        const allMatches: Array<{match: InlineMatch; processor: InlineProcessor}> = [];
        
        for (const processor of this.inlineProcessors) {
            if (!processor.supportedRegions.has(region.type)) continue;
            
            const matches = processor.findMatches(text, region, context);
            for (const match of matches) {
                if (this.isValidMatch(match, text, region, codeRegions)) {
                    allMatches.push({ match, processor });
                }
            }
        }
        
        return allMatches;
    }
    
    /**
     * Check if a match is valid and not in a code region
     */
    private isValidMatch(
        match: InlineMatch, 
        text: string, 
        region: ContentRegion,
        codeRegions: CodeRegion[]
    ): boolean {
        // Validate match positions
        if (match.from < 0 || match.to > text.length || match.from > match.to) {
            return false;
        }
        
        // Check if this specific match is in a code region
        const absoluteFrom = region.from + match.from;
        const absoluteTo = region.from + match.to;
        return !isRangeInCodeRegion(absoluteFrom, absoluteTo, codeRegions);
    }
    
    /**
     * Process matched inline patterns and create decorations
     */
    private processMatches(
        allMatches: Array<{match: InlineMatch; processor: InlineProcessor}>,
        region: ContentRegion,
        context: ProcessingContext,
        docLength: number
    ): void {
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
                handleError(new Error(`Invalid decoration position: from=${from}, to=${to}, docLength=${docLength}`), 'ProcessingPipeline.buildDecorationSet');
                continue;
            }
            
            // Ensure positions are integers
            const safeFrom = Math.floor(from);
            const safeTo = Math.floor(to);
            
            try {
                builder.add(safeFrom, safeTo, decoration);
            } catch (e) {
                handleError(e, 'ProcessingPipeline.buildDecorationSet');
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
