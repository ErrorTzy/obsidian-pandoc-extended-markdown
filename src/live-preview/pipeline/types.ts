import { Decoration } from '@codemirror/view';
import { EditorView } from '@codemirror/view';
import { Text, Line } from '@codemirror/state';
import { App, Component } from 'obsidian';
import { PandocExtendedMarkdownSettings } from '../../core/settings';
import { PlaceholderContext } from '../../shared/utils/placeholderProcessor';

/**
 * Represents a region of content that needs inline processing
 */
export interface ContentRegion {
    from: number;
    to: number;
    type: 'list-content' | 'definition-content' | 'paragraph' | 'normal';
    parentStructure?: 'hash-list' | 'fancy-list' | 'example-list' | 'custom-label-list' | 'definition';
    metadata?: any; // Structure-specific metadata
}

/**
 * Unified context that flows through the entire processing pipeline
 */
export interface ProcessingContext {
    // Document-level data
    document: Text;
    view: EditorView;
    settings: PandocExtendedMarkdownSettings;
    app?: App;
    component?: Component;
    
    // Scanned data (pre-computed)
    exampleLabels: Map<string, number>;
    exampleContent: Map<string, string>;
    exampleLineNumbers: Map<number, number>;
    duplicateExampleLabels: Map<string, number>;
    duplicateExampleContent: Map<string, string>;
    duplicateExampleLineNumbers?: Set<number>;
    customLabels: Map<string, string>;
    rawToProcessed: Map<string, string>;
    duplicateCustomLabels: Set<string>;
    duplicateCustomLineInfo?: Map<string, { firstLine: number; firstContent: string }>;
    placeholderContext: PlaceholderContext;
    invalidLines: Set<number>;
    
    // Processing metadata
    contentRegions: ContentRegion[];
    structuralDecorations: Array<{from: number, to: number, decoration: Decoration}>;
    inlineDecorations: Array<{from: number, to: number, decoration: Decoration}>;
    
    // State tracking
    hashCounter: { value: number };
    definitionState: {
        lastWasItem: boolean;
        pendingBlankLine: boolean;
    };
    
    // Code regions to skip
    codeRegions?: Array<{from: number, to: number, type: string}>;
}

/**
 * Result from structural processing
 */
export interface StructuralResult {
    decorations: Array<{from: number, to: number, decoration: Decoration}>;
    contentRegion?: ContentRegion;
    skipFurtherProcessing?: boolean;
}

/**
 * Interface for processors that handle block-level structures
 */
export interface StructuralProcessor {
    name: string;
    priority: number; // Lower numbers process first
    
    canProcess(line: Line, context: ProcessingContext): boolean;
    process(line: Line, context: ProcessingContext): StructuralResult;
}

/**
 * Represents a match found by an inline processor
 */
export interface InlineMatch {
    from: number; // Relative to region start
    to: number;
    type: string;
    data: any;
}

/**
 * Interface for processors that handle inline content
 */
export interface InlineProcessor {
    name: string;
    priority: number; // Lower numbers process first
    supportedRegions: Set<string>; // Which content types to process
    
    findMatches(text: string, region: ContentRegion, context: ProcessingContext): InlineMatch[];
    createDecoration(match: InlineMatch, context: ProcessingContext): Decoration;
}