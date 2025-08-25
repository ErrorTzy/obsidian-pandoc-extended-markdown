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
    enableCustomLabelLists?: boolean;
}

/**
 * Create a ProcessorConfig from Obsidian App and plugin settings
 */
export function createProcessorConfig(
    vaultConfig: { strictLineBreaks?: boolean },
    pluginSettings: { 
        strictPandocMode?: boolean,
        moreExtendedSyntax?: boolean
    }
): ProcessorConfig {
    const moreExtendedSyntax = pluginSettings.moreExtendedSyntax ?? false;
    return {
        strictLineBreaks: vaultConfig.strictLineBreaks ?? false,
        strictPandocMode: pluginSettings.strictPandocMode ?? false,
        moreExtendedSyntax: moreExtendedSyntax,
        enableHashLists: true,
        enableFancyLists: true,
        enableExampleLists: true,
        enableDefinitionLists: true,
        enableSuperSubscripts: true,
        enableCustomLabelLists: moreExtendedSyntax
    };
}