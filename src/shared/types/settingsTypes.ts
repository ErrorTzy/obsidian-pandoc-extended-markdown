/**
 * Settings and state-related type definitions for the Pandoc Extended Markdown plugin.
 */
import { PlaceholderContext } from '../utils/placeholderProcessor';
import {
    DEFAULT_ORDERED_LIST_MARKER_ORDER,
    OrderedListMarkerStyle,
    normalizeOrderedListMarkerOrder
} from './orderedListTypes';

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
    enableHashAutoNumber?: boolean;
    enableFancyLists?: boolean;
    enableExampleLists?: boolean;
    enableDefinitionLists?: boolean;
    enableSuperscript?: boolean;
    enableSubscript?: boolean;
    enableCustomLabelLists?: boolean;
    enableUnorderedListMarkerCycling?: boolean;
    enableUnorderedListMarkerStyles?: boolean;
    enableOrderedListMarkerCycling?: boolean;
    orderedListMarkerOrder: OrderedListMarkerStyle[];
    enableListPanel: boolean;
    panelOrder: string[];
}

export const DEFAULT_SETTINGS: PandocExtendedMarkdownSettings = {
    strictPandocMode: false,
    autoRenumberLists: false,
    moreExtendedSyntax: false,
    enableHashAutoNumber: true,
    enableFancyLists: true,
    enableExampleLists: true,
    enableDefinitionLists: true,
    enableSuperscript: true,
    enableSubscript: true,
    enableCustomLabelLists: false,
    enableUnorderedListMarkerCycling: true,
    enableUnorderedListMarkerStyles: true,
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
    if (key === 'enableCustomLabelLists') {
        if (settings.moreExtendedSyntax === true) {
            return true;
        }

        return settings.enableCustomLabelLists
            ?? settings.moreExtendedSyntax
            ?? DEFAULT_SETTINGS.enableCustomLabelLists
            ?? false;
    }

    return settings[key] ?? DEFAULT_SETTINGS[key] ?? false;
}

export function normalizeSettings(
    settings?: Partial<PandocExtendedMarkdownSettings>
): PandocExtendedMarkdownSettings {
    const sourceSettings = settings ?? {};
    const normalized: PandocExtendedMarkdownSettings = {
        ...DEFAULT_SETTINGS,
        ...settings
    };

    normalized.enableHashAutoNumber = isSyntaxFeatureEnabled(sourceSettings, 'enableHashAutoNumber');
    normalized.enableFancyLists = isSyntaxFeatureEnabled(sourceSettings, 'enableFancyLists');
    normalized.enableExampleLists = isSyntaxFeatureEnabled(sourceSettings, 'enableExampleLists');
    normalized.enableDefinitionLists = isSyntaxFeatureEnabled(sourceSettings, 'enableDefinitionLists');
    normalized.enableSuperscript = isSyntaxFeatureEnabled(sourceSettings, 'enableSuperscript');
    normalized.enableSubscript = isSyntaxFeatureEnabled(sourceSettings, 'enableSubscript');
    normalized.enableCustomLabelLists = isSyntaxFeatureEnabled(sourceSettings, 'enableCustomLabelLists');
    normalized.enableUnorderedListMarkerCycling = isSyntaxFeatureEnabled(sourceSettings, 'enableUnorderedListMarkerCycling');
    normalized.enableUnorderedListMarkerStyles = isSyntaxFeatureEnabled(sourceSettings, 'enableUnorderedListMarkerStyles');
    normalized.enableOrderedListMarkerCycling = isSyntaxFeatureEnabled(sourceSettings, 'enableOrderedListMarkerCycling');
    normalized.orderedListMarkerOrder = normalizeOrderedListMarkerOrder(sourceSettings.orderedListMarkerOrder);
    normalized.moreExtendedSyntax = normalized.enableCustomLabelLists;

    return normalized;
}
