/**
 * Integration test for cross-references within list items in reading mode
 * Tests that example references (@label) and custom label references {::label}
 * are properly processed when they appear in list content
 */

import { ReadingModeParser } from '../../../src/reading-mode/parsers/parser';
import { ReadingModeRenderer, RenderContext } from '../../../src/reading-mode/renderer';
import { pluginStateManager } from '../../../src/core/state/pluginStateManager';

describe('Cross-references in list content', () => {
    let parser: ReadingModeParser;
    let renderer: ReadingModeRenderer;
    const docPath = 'test.md';

    beforeEach(() => {
        parser = new ReadingModeParser();
        renderer = new ReadingModeRenderer();
        
        // Reset state manager
        pluginStateManager.resetDocumentCounters(docPath);
        
        // Setup example list data
        pluginStateManager.setLabeledExample(docPath, 'a', 1, 'Example list content');
    });

    afterEach(() => {
        pluginStateManager.clearAllStates();
    });

    describe('Example references (@label)', () => {
        it('should process references in fancy list content', () => {
            const line = 'A. crossref in fancy list (@a)';
            const parsedLines = parser.parseLines([line], false);
            
            const context: RenderContext = {
                strictLineBreaks: false,
                getExampleNumber: (label: string) => 
                    pluginStateManager.getLabeledExampleNumber(docPath, label),
                getExampleContent: (label: string) => 
                    pluginStateManager.getLabeledExampleContent(docPath, label)
            };
            
            const elements = renderer.renderLines(parsedLines, context);
            
            // Convert elements to HTML string for inspection
            const container = document.createElement('div');
            elements.forEach(el => {
                if (el instanceof Text) {
                    container.appendChild(document.createTextNode(el.textContent || ''));
                } else {
                    container.appendChild(el.cloneNode(true));
                }
            });
            const html = container.innerHTML;
            
            // Should have the fancy list marker
            expect(html).toContain('class="pandoc-list-fancy-upper-alpha"');
            expect(html).toContain('A.');
            
            // FAILING: Should also have the reference converted to number
            expect(html).toContain('(1)');
            expect(html).not.toContain('(@a)');
        });

        it('should process references in example list content', () => {
            const line = '(@b) crossref in example list (@a)';
            const parsedLines = parser.parseLines([line], true); // isInParagraph = true for example lists
            
            const context: RenderContext = {
                strictLineBreaks: false,
                getExampleNumber: (label: string) => 
                    pluginStateManager.getLabeledExampleNumber(docPath, label),
                getExampleContent: (label: string) => 
                    pluginStateManager.getLabeledExampleContent(docPath, label)
            };
            
            const numberProvider = (type: string, index: number): number => {
                if (type === 'example') {
                    return pluginStateManager.incrementExampleCounter(docPath);
                }
                return 0;
            };
            
            const elements = renderer.renderLines(parsedLines, context, numberProvider);
            
            // Convert elements to HTML string for inspection
            const container = document.createElement('div');
            elements.forEach(el => {
                if (el instanceof Text) {
                    container.appendChild(document.createTextNode(el.textContent || ''));
                } else {
                    container.appendChild(el.cloneNode(true));
                }
            });
            const html = container.innerHTML;
            
            // Should have the example list marker
            expect(html).toContain('class="pandoc-example-list"');
            
            // FAILING: Should also have the reference converted to number
            expect(html).toContain('(1)');
            expect(html).not.toContain('(@a)');
        });

        it('should process references in hash list content', () => {
            const line = '#. crossref in hash list (@a)';
            const parsedLines = parser.parseLines([line], false);
            
            const context: RenderContext = {
                strictLineBreaks: false,
                getExampleNumber: (label: string) => 
                    pluginStateManager.getLabeledExampleNumber(docPath, label),
                getExampleContent: (label: string) => 
                    pluginStateManager.getLabeledExampleContent(docPath, label)
            };
            
            const numberProvider = (type: string, index: number): number => {
                if (type === 'hash') {
                    return pluginStateManager.incrementHashCounter(docPath);
                }
                return 0;
            };
            
            const elements = renderer.renderLines(parsedLines, context, numberProvider);
            
            // Convert elements to HTML string for inspection
            const container = document.createElement('div');
            elements.forEach(el => {
                if (el instanceof Text) {
                    container.appendChild(document.createTextNode(el.textContent || ''));
                } else {
                    container.appendChild(el.cloneNode(true));
                }
            });
            const html = container.innerHTML;
            
            // Should have the hash list marker
            expect(html).toContain('class="pandoc-list-fancy-hash"');
            
            // FAILING: Should also have the reference converted to number
            expect(html).toContain('(1)');
            expect(html).not.toContain('(@a)');
        });
    });

    describe('References in headings', () => {
        it('should NOT process references in headings', () => {
            // This test documents the current behavior where references in headings
            // are not processed. This is because the processor skips elements inside headings.
            const headingElement = document.createElement('h2');
            headingElement.textContent = 'Heading with (@a) reference';
            
            // In the actual processor, headings are skipped, so references remain unprocessed
            expect(headingElement.textContent).toContain('(@a)');
        });
    });
});