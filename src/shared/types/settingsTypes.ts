/**
 * Settings and state-related type definitions for the Pandoc Extended Markdown plugin.
 */
import { PlaceholderContext } from '../utils/placeholderProcessor';
import {
    DEFAULT_ORDERED_LIST_MARKER_ORDER,
    OrderedListMarkerStyle,
    normalizeOrderedListMarkerOrder
} from './orderedListTypes';
import {
    DEFAULT_UNORDERED_LIST_MARKER_ORDER,
    UnorderedListMarker,
    normalizeUnorderedListMarkerOrder
} from './unorderedListTypes';

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
    enableHashAutoNumber?: boolean;
    enableFancyLists?: boolean;
    enableExampleLists?: boolean;
    enableDefinitionLists?: boolean;
    enableSuperscript?: boolean;
    enableSubscript?: boolean;
    enableCustomLabelLists?: boolean;
    enableUnorderedListMarkerCycling?: boolean;
    enableUnorderedListMarkerStyles?: boolean;
    unorderedListMarkerOrder: UnorderedListMarker[];
    enableOrderedListMarkerCycling?: boolean;
    orderedListMarkerOrder: OrderedListMarkerStyle[];
    enableListPanel: boolean;
    panelOrder: string[];
}

export const DEFAULT_SETTINGS: PandocExtendedMarkdownSettings = {
    strictPandocMode: false,
    autoRenumberLists: false,
    enableHashAutoNumber: true,
    enableFancyLists: true,
    enableExampleLists: true,
    enableDefinitionLists: true,
    enableSuperscript: true,
    enableSubscript: true,
    enableCustomLabelLists: false,
    enableUnorderedListMarkerCycling: true,
    enableUnorderedListMarkerStyles: true,
    unorderedListMarkerOrder: [...DEFAULT_UNORDERED_LIST_MARKER_ORDER],
    enableOrderedListMarkerCycling: true,
    orderedListMarkerOrder: [...DEFAULT_ORDERED_LIST_MARKER_ORDER],
    enableListPanel: true,
    panelOrder: ['custom-labels', 'example-lists', 'definition-lists', 'footnotes']
};

export type SyntaxFeatureSettingKey =
    | 'enableHashAutoNumber'
    | 'enableFancyLists'
    | 'enableExampleLists'
    | 'enableDefinitionLists'
    | 'enableSuperscript'
    | 'enableSubscript'
    | 'enableCustomLabelLists'
    | 'enableUnorderedListMarkerCycling'
    | 'enableUnorderedListMarkerStyles'
    | 'enableOrderedListMarkerCycling';

export function isSyntaxFeatureEnabled(
    settings: Partial<PandocExtendedMarkdownSettings>,
    key: SyntaxFeatureSettingKey
): boolean {
    return settings[key] ?? DEFAULT_SETTINGS[key] ?? false;
}

export function normalizeSettings(
    settings?: Partial<PandocExtendedMarkdownSettings>
): PandocExtendedMarkdownSettings {
    const sourceSettings = settings ?? {};
    const normalized: PandocExtendedMarkdownSettings = {
        strictPandocMode: sourceSettings.strictPandocMode ?? DEFAULT_SETTINGS.strictPandocMode,
        autoRenumberLists: sourceSettings.autoRenumberLists ?? DEFAULT_SETTINGS.autoRenumberLists,
        enableHashAutoNumber: isSyntaxFeatureEnabled(sourceSettings, 'enableHashAutoNumber'),
        enableFancyLists: isSyntaxFeatureEnabled(sourceSettings, 'enableFancyLists'),
        enableExampleLists: isSyntaxFeatureEnabled(sourceSettings, 'enableExampleLists'),
        enableDefinitionLists: isSyntaxFeatureEnabled(sourceSettings, 'enableDefinitionLists'),
        enableSuperscript: isSyntaxFeatureEnabled(sourceSettings, 'enableSuperscript'),
        enableSubscript: isSyntaxFeatureEnabled(sourceSettings, 'enableSubscript'),
        enableCustomLabelLists: isSyntaxFeatureEnabled(sourceSettings, 'enableCustomLabelLists'),
        enableUnorderedListMarkerCycling: isSyntaxFeatureEnabled(sourceSettings, 'enableUnorderedListMarkerCycling'),
        enableUnorderedListMarkerStyles: isSyntaxFeatureEnabled(sourceSettings, 'enableUnorderedListMarkerStyles'),
        unorderedListMarkerOrder: normalizeUnorderedListMarkerOrder(sourceSettings.unorderedListMarkerOrder),
        enableOrderedListMarkerCycling: isSyntaxFeatureEnabled(sourceSettings, 'enableOrderedListMarkerCycling'),
        orderedListMarkerOrder: normalizeOrderedListMarkerOrder(sourceSettings.orderedListMarkerOrder),
        enableListPanel: sourceSettings.enableListPanel ?? DEFAULT_SETTINGS.enableListPanel,
        panelOrder: sourceSettings.panelOrder ?? [...DEFAULT_SETTINGS.panelOrder]
    };

    return normalized;
}
