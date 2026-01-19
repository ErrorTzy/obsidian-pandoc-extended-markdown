/**
 * Settings and state-related type definitions for the Pandoc Extended Markdown plugin.
 */
import { PlaceholderContext } from '../utils/placeholderProcessor';

/**
 * View modes supported by the plugin
 */
export type ViewMode = "reading" | "live" | "source";

/**
 * Document-specific counters and data
 */
export interface DocumentCounters {
    exampleCounter: number;
    exampleMap: Map<string, number>;      // Maps example labels to numbers
    exampleContent: Map<string, string>;   // Maps example labels to content
    hashCounter: number;                   // Counter for hash auto-numbering lists
    placeholderContext: PlaceholderContext; // Context for placeholder auto-numbering
    customLabels?: Map<string, string>;   // Maps processed custom labels to content
    rawToProcessed?: Map<string, string>; // Maps raw labels to processed labels
}

/**
 * View state tracking per leaf
 */
export interface ViewState {
    mode: ViewMode;
    filePath: string | null;
}

/**
 * Mode change event data
 */
export interface ModeChangeEvent {
    leafId: string;
    previousMode: ViewMode | null;
    currentMode: ViewMode;
    previousPath: string | null;
    currentPath: string | null;
}

/**
 * Settings interface for the Pandoc Extended Markdown plugin.
 */
export interface PandocExtendedMarkdownSettings {
    strictPandocMode: boolean;
    autoRenumberLists: boolean;
    moreExtendedSyntax: boolean;
    enableListPanel: boolean;
    panelOrder: string[];
}

export const DEFAULT_SETTINGS: PandocExtendedMarkdownSettings = {
    strictPandocMode: false,
    autoRenumberLists: false,
    moreExtendedSyntax: false,
    enableListPanel: true,
    panelOrder: ['custom-labels', 'example-lists', 'definition-lists', 'footnotes']
};
