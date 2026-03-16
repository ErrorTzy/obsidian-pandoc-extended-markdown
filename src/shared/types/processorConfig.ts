import {
    PandocExtendedMarkdownSettings,
    isSyntaxFeatureEnabled
} from './settingsTypes';

/**
 * Processor Configuration
 * 
 * Configuration object passed to processors instead of the entire App object.
 * This improves testability and reduces coupling.
 */

export interface ProcessorConfig {
    // Obsidian settings
    strictLineBreaks: boolean;
    
    // Plugin settings
    strictPandocMode: boolean;
    moreExtendedSyntax?: boolean;
    
    // Optional features
    enableHashLists?: boolean;
    enableFancyLists?: boolean;
    enableExampleLists?: boolean;
    enableDefinitionLists?: boolean;
    enableSuperSubscripts?: boolean;
    enableSuperscript?: boolean;
    enableSubscript?: boolean;
    enableCustomLabelLists?: boolean;
}

/**
 * Create a ProcessorConfig from Obsidian App and plugin settings
 */
export function createProcessorConfig(
    vaultConfig: { strictLineBreaks?: boolean },
    pluginSettings: Partial<PandocExtendedMarkdownSettings>
): ProcessorConfig {
    return {
        strictLineBreaks: vaultConfig.strictLineBreaks ?? false,
        strictPandocMode: pluginSettings.strictPandocMode ?? false,
        moreExtendedSyntax: isSyntaxFeatureEnabled(pluginSettings, 'enableCustomLabelLists'),
        enableHashLists: isSyntaxFeatureEnabled(pluginSettings, 'enableHashAutoNumber'),
        enableFancyLists: isSyntaxFeatureEnabled(pluginSettings, 'enableFancyLists'),
        enableExampleLists: isSyntaxFeatureEnabled(pluginSettings, 'enableExampleLists'),
        enableDefinitionLists: isSyntaxFeatureEnabled(pluginSettings, 'enableDefinitionLists'),
        enableSuperSubscripts: isSyntaxFeatureEnabled(pluginSettings, 'enableSuperscript')
            || isSyntaxFeatureEnabled(pluginSettings, 'enableSubscript'),
        enableSuperscript: isSyntaxFeatureEnabled(pluginSettings, 'enableSuperscript'),
        enableSubscript: isSyntaxFeatureEnabled(pluginSettings, 'enableSubscript'),
        enableCustomLabelLists: isSyntaxFeatureEnabled(pluginSettings, 'enableCustomLabelLists')
    };
}
