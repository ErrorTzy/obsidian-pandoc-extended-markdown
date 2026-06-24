// External libraries
import { EditorView, DecorationSet, Decoration } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
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

// Constants
import { CSS_CLASSES } from '../../core/constants';

// Patterns
import { ListPatterns } from '../../shared/patterns';

// Utils
import { handleError } from '../../shared/utils/errorHandler';
import {
    getMarkdownCodeFenceMarker,
    isLineInCodeRegion,
    isMarkdownCodeFenceClosing,
    isRangeInCodeRegion
} from './utils/codeDetection';
import { allowsFencedDivOpeningAfterLine } from './structural/fencedDiv/parser';

// Internal modules
import { PluginStateManager } from '../../core/state/pluginStateManager';
import { ProcessingContextFactory } from './context/ProcessingContextFactory';

function isCodeRegionEndLine(
    line: { from: number; to: number },
    codeRegions: CodeRegion[]
): boolean {
    return codeRegions.some(region =>
        region.type === 'codeblock' &&
        line.from >= region.from &&
        line.to === region.to
    );
}

function isNativeListLine(line: string): boolean {
    return ListPatterns.UNORDERED_LIST.test(line) ||
        ListPatterns.NUMBERED_LIST_WITH_SPACE.test(line);
}

/**
 * Orchestrates the two-phase processing pipeline for decorations
 */
export class ProcessingPipeline {
    private structuralProcessors: StructuralProcessor[] = [];
    private inlineProcessors: InlineProcessor[] = [];
    private contextFactory: ProcessingContextFactory;
    
    constructor(stateManager: PluginStateManager, app?: App, component?: Component) {
        this.contextFactory = new ProcessingContextFactory(stateManager, app, component);
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
        
        this.processStructural(context);
        this.processInline(context);
        return this.buildDecorationSet(context);
    }

    private createContext(view: EditorView, settings: PandocExtendedMarkdownSettings): ProcessingContext {
        return this.contextFactory.create(view, settings);
    }

    private processStructural(context: ProcessingContext): void {
        const doc = context.document;
        const processingRange = context.processingRange;
        const startLine = processingRange?.startLine ?? 1;
        const endLine = processingRange?.endLine ?? doc.lines;
        const codeRegions = context.codeRegions || [];
        let fencedDivCanOpenAtCurrentLine = context.fencedDivCanOpenAtCurrentLine ?? true;
        let fallbackCodeFenceMarker: string | undefined;
        
        for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
            const line = doc.line(lineNum);
            context.fencedDivCanOpenAtCurrentLine = fencedDivCanOpenAtCurrentLine;
            
            // Skip lines blocked by Pandoc list spacing enforcement.
            if (context.invalidLines.has(lineNum)) {
                this.decorateInvalidNativeListLine(line, context);
                fencedDivCanOpenAtCurrentLine = false;
                continue;
            }
            
            // Skip lines that are inside code regions
            if (isLineInCodeRegion(lineNum, doc, codeRegions as CodeRegion[])) {
                fencedDivCanOpenAtCurrentLine = isCodeRegionEndLine(line, codeRegions as CodeRegion[]);
                continue;
            }

            if (fallbackCodeFenceMarker) {
                if (isMarkdownCodeFenceClosing(line.text, fallbackCodeFenceMarker)) {
                    fallbackCodeFenceMarker = undefined;
                    fencedDivCanOpenAtCurrentLine = true;
                } else {
                    fencedDivCanOpenAtCurrentLine = false;
                }
                continue;
            }

            const openingCodeFenceMarker = getMarkdownCodeFenceMarker(line.text);
            if (openingCodeFenceMarker) {
                fallbackCodeFenceMarker = openingCodeFenceMarker;
                fencedDivCanOpenAtCurrentLine = false;
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

            fencedDivCanOpenAtCurrentLine = allowsFencedDivOpeningAfterLine(line.text) ||
                context.fencedDivBoundaryLine === lineNum;
        }
    }

    private decorateInvalidNativeListLine(
        line: { from: number; text: string },
        context: ProcessingContext
    ): void {
        if (!isNativeListLine(line.text)) {
            return;
        }

        context.structuralDecorations.push({
            from: line.from,
            to: line.from,
            decoration: Decoration.line({
                class: CSS_CLASSES.PANDOC_INVALID_NATIVE_LIST
            })
        });
    }
    
    /**
     * Phase 2: Process inline content within marked regions
     */
    private processInline(context: ProcessingContext): void {
        const docLength = context.document.length;
        const codeRegions = context.codeRegions || [];
        
        for (const region of context.contentRegions) {
            // Skip invalid regions
            if (!this.isValidRegion(region, docLength) || !this.isInRenderRange(region, context)) {
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

    private isInRenderRange(region: ContentRegion, context: ProcessingContext): boolean {
        const range = context.processingRange;
        if (!range) {
            return true;
        }

        return region.to > range.renderFrom && region.from < range.renderTo;
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
            if (!this.isDecorationInRenderRange(from, to, context)) {
                continue;
            }

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

    private isDecorationInRenderRange(from: number, to: number, context: ProcessingContext): boolean {
        const range = context.processingRange;
        if (!range) {
            return true;
        }

        if (from === to) {
            return from >= range.renderFrom && from <= range.renderTo;
        }

        return to > range.renderFrom && from < range.renderTo;
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
