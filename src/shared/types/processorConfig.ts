import {
    PandocExtendedMarkdownSettings,
    isFencedDivExtrasEnabled,
    isCustomLabelListsEnabled,
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
    enforcePandocListSpacing: boolean;
    enableReadableFencedDivSyntax: boolean;
    
    // Optional features
    enableHashLists?: boolean;
    enableFancyLists?: boolean;
    enableExampleLists?: boolean;
    enableDefinitionLists?: boolean;
    enableFencedDivs?: boolean;
    enableFencedDivExtras?: boolean;
    enableSuperSubscripts?: boolean;
    enableSuperscript?: boolean;
    enableSubscript?: boolean;
    enableCustomLabelLists?: boolean;
    enableUnorderedListMarkerStyles?: boolean;
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
        enforcePandocListSpacing: pluginSettings.enforcePandocListSpacing ?? false,
        enableReadableFencedDivSyntax: pluginSettings.enableReadableFencedDivSyntax ?? true,
        enableHashLists: isSyntaxFeatureEnabled(pluginSettings, 'enableHashAutoNumber'),
        enableFancyLists: isSyntaxFeatureEnabled(pluginSettings, 'enableFancyLists'),
        enableExampleLists: isSyntaxFeatureEnabled(pluginSettings, 'enableExampleLists'),
        enableDefinitionLists: isSyntaxFeatureEnabled(pluginSettings, 'enableDefinitionLists'),
        enableFencedDivs: isSyntaxFeatureEnabled(pluginSettings, 'enableFencedDivs'),
        enableFencedDivExtras: isFencedDivExtrasEnabled(pluginSettings),
        enableSuperSubscripts: isSyntaxFeatureEnabled(pluginSettings, 'enableSuperscript')
            || isSyntaxFeatureEnabled(pluginSettings, 'enableSubscript'),
        enableSuperscript: isSyntaxFeatureEnabled(pluginSettings, 'enableSuperscript'),
        enableSubscript: isSyntaxFeatureEnabled(pluginSettings, 'enableSubscript'),
        enableCustomLabelLists: isCustomLabelListsEnabled(pluginSettings),
        enableUnorderedListMarkerStyles: isSyntaxFeatureEnabled(pluginSettings, 'enableUnorderedListMarkerStyles')
    };
}
