/**
 * Type definitions for decoration-related interfaces and types
 */
import { Decoration } from '@codemirror/view';

/**
 * Represents a decoration to be applied to the editor
 */
export interface DecorationInfo {
    from: number;
    to: number;
    decoration: Decoration;
}

/**
 * Content region that can be processed by inline processors
 */
export interface ContentRegion {
    from: number;
    to: number;
    type: string;
}

/**
 * Result from structural processing phase
 */
export interface StructuralResult {
    decorations: DecorationInfo[];
    contentRegion?: ContentRegion;
    skipFurtherProcessing?: boolean;
}

/**
 * Match found by inline processor
 */
export interface InlineMatch {
    from: number;
    to: number;
    text: string;
    groups?: string[];
    priority: number;
}

/**
 * Decoration style information
 */
export interface DecorationStyle {
    class?: string;
    attributes?: Record<string, string>;
    inclusive?: boolean;
    side?: number;
}

/**
 * Widget decoration configuration
 */
export interface WidgetConfig {
    widget: any; // CodeMirror widget
    side?: number;
    block?: boolean;
}

/**
 * Mark decoration configuration  
 */
export interface MarkConfig {
    class?: string;
    attributes?: Record<string, string>;
    inclusive?: boolean;
    inclusiveStart?: boolean;
    inclusiveEnd?: boolean;
}