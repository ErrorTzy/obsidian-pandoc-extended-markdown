/**
 * Example of how to create and register a new content processor
 * This example shows how to process wiki-style links [[page name]]
 * 
 * To use this processor:
 * 1. Create your processor implementing the ContentProcessor interface
 * 2. Register it with ContentProcessorRegistry.getInstance().registerProcessor(processor)
 * 3. The processor will automatically be applied in panels and hover previews
 */

import { ContentProcessor, ProcessingContext, ContentProcessorRegistry } from '../ContentProcessorRegistry';

/**
 * Example processor for wiki-style links
 */
export class WikiLinkProcessor implements ContentProcessor {
    id = 'wiki-links';
    
    process(content: string, context: ProcessingContext): string {
        // Example: Replace [[page name]] with a clickable link
        const wikiLinkPattern = /\[\[([^\]]+)\]\]/g;
        
        return content.replace(wikiLinkPattern, (match, pageName) => {
            // In a real implementation, you might check if the page exists
            // and style it differently
            return `[${pageName}](${pageName.replace(/ /g, '%20')}.md)`;
        });
    }
}

/**
 * Example of how to register the processor in your plugin's onload()
 */
export function registerWikiLinkProcessor(): void {
    const registry = ContentProcessorRegistry.getInstance();
    registry.registerProcessor(new WikiLinkProcessor());
}

/**
 * Example of a processor that needs document context
 */
export class FootnoteProcessor implements ContentProcessor {
    id = 'footnotes';
    
    process(content: string, context: ProcessingContext): string {
        // Check if we have footnote data in context
        if (!context.footnotes) return content;
        
        // Replace [^1] with the actual footnote text
        const footnotePattern = /\[\^(\d+)\]/g;
        
        return content.replace(footnotePattern, (match, num) => {
            const footnoteText = context.footnotes?.get(num);
            return footnoteText ? `[${num}: ${footnoteText}]` : match;
        });
    }
}

/**
 * Example of how to add context data for your processor
 * This would be called in the panel modules' buildRenderingContext method
 */
export function extractFootnotes(content: string): Map<string, string> {
    const footnotes = new Map<string, string>();
    const footnotePattern = /\[\^(\d+)\]:\s*(.+)$/gm;
    
    let match;
    while ((match = footnotePattern.exec(content)) !== null) {
        footnotes.set(match[1], match[2]);
    }
    
    return footnotes;
}

/**
 * Example of extending the context in panel modules:
 * 
 * private buildRenderingContext(content: string): void {
 *     // ... existing code ...
 *     
 *     // Add footnotes to context
 *     this.currentContext.footnotes = extractFootnotes(content);
 * }
 */