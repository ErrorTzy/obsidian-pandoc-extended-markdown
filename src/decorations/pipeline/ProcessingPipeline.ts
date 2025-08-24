import { EditorView, DecorationSet, Decoration } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { PandocExtendedMarkdownSettings } from '../../settings';
import { PluginStateManager } from '../../state/pluginStateManager';
import { 
    ProcessingContext, 
    StructuralProcessor, 
    InlineProcessor,
    ContentRegion 
} from './types';
// scanExampleLabels import removed - we'll create our own version
import { scanCustomLabels } from '../scanners/customLabelScanner';
import { validateListBlocks } from '../validators/listBlockValidator';
import { PlaceholderContext } from '../../utils/placeholderProcessor';
import { ListPatterns } from '../../patterns';
import { Text } from '@codemirror/state';

// Helper function to scan example labels from Text
function scanExampleLabelsFromDoc(doc: Text, settings: PandocExtendedMarkdownSettings) {
    const result = {
        exampleLabels: new Map<string, number>(),
        exampleContent: new Map<string, string>(),
        exampleLineNumbers: new Map<number, number>(),
        duplicateLabels: new Map<string, number>(),
        duplicateLabelContent: new Map<string, string>()
    };
    
    let counter = 1;
    const docText = doc.toString();
    const lines = docText.split('\n');
    
    // In strict mode, validate list blocks first
    const invalidLines = settings.strictPandocMode ? validateListBlocks(doc) : new Set<number>();
    
    for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        
        // Skip invalid lines in strict mode
        if (invalidLines.has(i)) continue;
        
        const line = lines[i];
        const exampleMatch = ListPatterns.isExampleList(line);
        
        if (exampleMatch && exampleMatch.length >= 5) {
            const indent = exampleMatch[1] || '';
            const fullMarker = exampleMatch[2] || ''; // Full (@label) part
            const label = exampleMatch[3] || '';
            const space = exampleMatch[4] || '';
            const content = line.substring(
                indent.length + 
                fullMarker.length + 
                space.length
            );
            
            if (result.exampleLabels.has(label)) {
                // Track duplicate label
                if (!result.duplicateLabels.has(label)) {
                    const firstLine = Array.from(result.exampleLineNumbers.entries())
                        .find(([, num]) => num === result.exampleLabels.get(label))?.[0] || 0;
                    result.duplicateLabels.set(label, firstLine);
                    result.duplicateLabelContent.set(label, result.exampleContent.get(label) || '');
                }
            } else {
                result.exampleLabels.set(label, counter);
                result.exampleContent.set(label, content);
                result.exampleLineNumbers.set(lineNum, counter);
                counter++;
            }
        }
    }
    
    return result;
}

/**
 * Orchestrates the two-phase processing pipeline for decorations
 */
export class ProcessingPipeline {
    private structuralProcessors: StructuralProcessor[] = [];
    private inlineProcessors: InlineProcessor[] = [];
    private stateManager: PluginStateManager;
    
    constructor(stateManager: PluginStateManager) {
        this.stateManager = stateManager;
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
    private createContext(view: EditorView, settings: PandocExtendedMarkdownSettings): ProcessingContext {
        const doc = view.state.doc;
        // Get document path from the active file
        const workspace = (window as any).app?.workspace;
        const activeFile = workspace?.getActiveFile();
        const docPath = activeFile?.path || null;
        
        // Pre-scan the document for labels and references
        const exampleScanResult = scanExampleLabelsFromDoc(doc, settings);
        
        // Get placeholder context from state manager
        const placeholderContext = docPath 
            ? this.stateManager.getDocumentCounters(docPath).placeholderContext 
            : new PlaceholderContext();
            
        const customScanResult = settings.moreExtendedSyntax 
            ? scanCustomLabels(doc, settings, placeholderContext)
            : {
                customLabels: new Map<string, string>(),
                rawToProcessed: new Map<string, string>(),
                duplicateLabels: new Set<string>(),
                placeholderContext: placeholderContext
            };
        
        // Validate list blocks if in strict mode
        const invalidLines = settings.strictLineBreaks 
            ? validateListBlocks(doc)
            : new Set<number>();
        
        // Update state manager with scanned data
        if (docPath && customScanResult.placeholderContext) {
            const counters = this.stateManager.getDocumentCounters(docPath);
            counters.placeholderContext = customScanResult.placeholderContext;
        }
        
        return {
            // Document data
            document: doc,
            view,
            settings,
            
            // Scanned data
            exampleLabels: exampleScanResult.exampleLabels,
            exampleContent: exampleScanResult.exampleContent,
            exampleLineNumbers: exampleScanResult.exampleLineNumbers,
            duplicateExampleLabels: exampleScanResult.duplicateLabels,
            duplicateExampleContent: exampleScanResult.duplicateLabelContent,
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
        for (const region of context.contentRegions) {
            // Skip regions with no content
            if (region.from >= region.to) continue;
            
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
                        allMatches.push({ match, processor });
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
                context.inlineDecorations.push({
                    from: region.from + match.from,
                    to: region.from + match.to,
                    decoration
                });
                
                lastEnd = match.to;
            }
        }
    }
    
    /**
     * Build the final decoration set from both phases
     */
    private buildDecorationSet(context: ProcessingContext): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        
        // Combine and sort all decorations
        const allDecorations = [
            ...context.structuralDecorations,
            ...context.inlineDecorations
        ].sort((a, b) => a.from - b.from || a.to - b.to);
        
        // Add decorations to builder
        for (const { from, to, decoration } of allDecorations) {
            builder.add(from, to, decoration);
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

// Helper type for InlineMatch with processor
interface InlineMatch {
    from: number;
    to: number;
    type: string;
    data: any;
}