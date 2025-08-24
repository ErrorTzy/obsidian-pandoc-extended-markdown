/**
 * Settings interface for the Pandoc Extended Markdown plugin.
 */
export interface PandocExtendedMarkdownSettings {
    strictPandocMode: boolean;
    autoRenumberLists: boolean;
    moreExtendedSyntax: boolean;
    panelOrder: string[];
    useNewPipeline: boolean; // Feature flag for new two-phase processing pipeline
}

export const DEFAULT_SETTINGS: PandocExtendedMarkdownSettings = {
    strictPandocMode: false,
    autoRenumberLists: false,
    moreExtendedSyntax: false,
    panelOrder: ['custom-labels', 'example-lists'],
    useNewPipeline: false // Default to old implementation for now
};