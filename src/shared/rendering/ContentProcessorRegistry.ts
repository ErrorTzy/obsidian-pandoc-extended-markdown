import { ListPatterns } from '../patterns';

/**
 * Context for content processing containing all necessary data
 */
export interface ProcessingContext {
    exampleLabels?: Map<string, number>;
    exampleContent?: Map<string, string>;
    customLabels?: Map<string, string>;
    rawToProcessed?: Map<string, string>;
    footnotes?: Map<string, string>; // For footnote processor example
    // Add more specific context fields as needed for new processors
}

/**
 * Interface for content processors that transform text
 */
export interface ContentProcessor {
    /**
     * Unique identifier for this processor
     */
    id: string;
    
    /**
     * Process content using the provided context
     * @param content The content to process
     * @param context The processing context
     * @returns The processed content
     */
    process(content: string, context: ProcessingContext): string;
}

/**
 * Registry for content processors that can be extended with new processors
 */
export class ContentProcessorRegistry {
    private static instance: ContentProcessorRegistry;
    private processors: Map<string, ContentProcessor> = new Map();
    
    private constructor() {
        // Initialize with default processors
        this.registerDefaultProcessors();
    }
    
    /**
     * Get the singleton instance
     */
    static getInstance(): ContentProcessorRegistry {
        if (!ContentProcessorRegistry.instance) {
            ContentProcessorRegistry.instance = new ContentProcessorRegistry();
        }
        return ContentProcessorRegistry.instance;
    }
    
    /**
     * Register a content processor with the registry
     * @param processor The processor to register
     */
    registerProcessor(processor: ContentProcessor): void {
        this.processors.set(processor.id, processor);
    }
    
    /**
     * Unregister a content processor from the registry
     * @param id The unique identifier of the processor to remove
     */
    unregisterProcessor(id: string): void {
        this.processors.delete(id);
    }
    
    /**
     * Process content through all registered processors in sequence
     * @param content The content to process
     * @param context The processing context containing data for processors
     * @returns The processed content with all transformations applied
     */
    processContent(content: string, context: ProcessingContext): string {
        let processedContent = content;
        
        // Apply each processor in sequence
        for (const processor of this.processors.values()) {
            processedContent = processor.process(processedContent, context);
        }
        
        return processedContent;
    }
    
    /**
     * Register the default built-in processors
     */
    private registerDefaultProcessors(): void {
        // Example reference processor
        this.registerProcessor({
            id: 'example-references',
            process: (content: string, context: ProcessingContext): string => {
                if (!context.exampleLabels) return content;
                
                return content.replace(
                    ListPatterns.EXAMPLE_REFERENCE,
                    (match, label) => {
                        const number = context.exampleLabels!.get(label);
                        return number !== undefined ? `(${number})` : match;
                    }
                );
            }
        });
        
        // Custom label reference processor
        this.registerProcessor({
            id: 'custom-label-references',
            process: (content: string, context: ProcessingContext): string => {
                if (!context.rawToProcessed) return content;
                
                return content.replace(
                    ListPatterns.CUSTOM_LABEL_REFERENCE,
                    (match, label) => {
                        const processed = context.rawToProcessed!.get(label);
                        return processed !== undefined ? processed : match;
                    }
                );
            }
        });
    }
    
    /**
     * Clear all processors (useful for testing)
     */
    clearProcessors(): void {
        this.processors.clear();
    }
    
    /**
     * Reset to default processors
     */
    reset(): void {
        this.clearProcessors();
        this.registerDefaultProcessors();
    }
}

/**
 * Convenience function to process content using the global registry
 */
export function processContent(content: string, context: ProcessingContext): string {
    return ContentProcessorRegistry.getInstance().processContent(content, context);
}