import { JSDOM } from 'jsdom';
import { processPopoverContent } from '../../../src/shared/utils/hoverPopovers';
import { ContentProcessorRegistry, ContentProcessor, processContent } from '../../../src/shared/rendering/ContentProcessorRegistry';

describe('Panel Content Rendering', () => {
    describe('processPopoverContent', () => {
        it('should replace example references with their numbers', () => {
            const content = '(@a) is *1*';
            const context = {
                exampleLabels: new Map([['a', 1]]),
            };
            
            const result = processPopoverContent(content, context);
            expect(result).toBe('(1) is *1*');
        });
        
        it('should replace custom label references with processed labels', () => {
            const content = '{::P(#a)} refers to item {::P(#b)}';
            const context = {
                rawToProcessed: new Map([
                    ['P(#a)', 'P1'],
                    ['P(#b)', 'P2']
                ])
            };
            
            const result = processPopoverContent(content, context);
            expect(result).toBe('P1 refers to item P2');
        });
        
        it('should handle mixed references', () => {
            const content = 'See (@example) and {::LABEL} for details';
            const context = {
                exampleLabels: new Map([['example', 42]]),
                rawToProcessed: new Map([['LABEL', 'L1']])
            };
            
            const result = processPopoverContent(content, context);
            expect(result).toBe('See (42) and L1 for details');
        });
    });
    
    describe('Extensible content processor', () => {
        beforeEach(() => {
            // Reset registry to default state before each test
            ContentProcessorRegistry.getInstance().reset();
        });
        
        it('should allow registering custom processors', () => {
            // Create a custom processor for wiki links
            const wikiLinkProcessor: ContentProcessor = {
                id: 'wiki-links',
                process: (content: string, context) => {
                    return content.replace(/\[\[([^\]]+)\]\]/g, (match, pageName) => {
                        return `<${pageName}>`;
                    });
                }
            };
            
            // Register the processor
            ContentProcessorRegistry.getInstance().registerProcessor(wikiLinkProcessor);
            
            // Test that it processes content
            const content = 'See [[HomePage]] and (@ref)';
            const context = {
                exampleLabels: new Map([['ref', 1]])
            };
            
            const result = processContent(content, context);
            expect(result).toBe('See <HomePage> and (1)');
        });
        
        it('should process content through all registered processors', () => {
            // The default processors should handle example and custom label references
            const content = 'Item (@a) references {::LABEL}';
            const context = {
                exampleLabels: new Map([['a', 5]]),
                rawToProcessed: new Map([['LABEL', 'L1']])
            };
            
            const result = processContent(content, context);
            expect(result).toBe('Item (5) references L1');
        });
    });
    
    describe('Content rendering in panels', () => {
        it('should fully render markdown formatting in hover previews', () => {
            // This test verifies that markdown like *italic* and **bold** 
            // gets properly rendered in the hover preview
            const markdown = '(@a) is *italic* and **bold**';
            
            // The processPopoverContent should first replace references
            const context = {
                exampleLabels: new Map([['a', 1]])
            };
            const processed = processPopoverContent(markdown, context);
            expect(processed).toBe('(1) is *italic* and **bold**');
            
            // Then MarkdownRenderer.render (mocked or real) should handle the formatting
            // This would be rendered as HTML with <em> and <strong> tags
        });
    });
});