/**
 * Settings interface for the Pandoc Extended Markdown plugin.
 */
export interface PandocExtendedMarkdownSettings {
    strictPandocMode: boolean;
    autoRenumberLists: boolean;
    moreExtendedSyntax: boolean;
}

export const DEFAULT_SETTINGS: PandocExtendedMarkdownSettings = {
    strictPandocMode: false,
    autoRenumberLists: false,
    moreExtendedSyntax: false
};