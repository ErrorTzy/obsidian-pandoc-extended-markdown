import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ExampleReferenceWidget } from '../../../src/live-preview/widgets/referenceWidget';
import { CustomLabelReferenceWidget } from '../../../src/live-preview/widgets/customLabelWidget';
import { MarkdownRenderer } from 'obsidian';

// Import the actual processPopoverContent function to test it
import { processPopoverContent } from '../../../src/shared/utils/hoverPopovers';

// Mock the hoverPopovers module but use real processPopoverContent
jest.mock('../../../src/shared/utils/hoverPopovers', () => {
    const actual = jest.requireActual('../../../src/shared/utils/hoverPopovers');
    return {
        ...actual,
        setupRenderedHoverPreview: jest.fn((element, content, app, component, context) => {
            // Simulate setting up event listeners
            element.addEventListener('mouseenter', jest.fn());
            element.addEventListener('mouseleave', jest.fn());
        }),
        setupSimpleHoverPreview: jest.fn(),
        positionHoverElement: jest.fn(),
        // Use the real processPopoverContent implementation
        processPopoverContent: actual.processPopoverContent
    };
});

// Mock MarkdownRenderer and other Obsidian functions
jest.mock('obsidian', () => ({
    ...jest.requireActual('obsidian'),
    setTooltip: jest.fn(),
    MarkdownRenderer: {
        render: jest.fn((app, markdown, el, sourcePath, component) => {
            // Simulate rendering markdown to HTML - process all patterns
            let html = markdown;
            
            // Process math first (protect it)
            html = html.replace(/\$([^$]+)\$/g, '<span class="math">$1</span>');
            
            // Process bold/italic
            html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
            
            // Process sub/superscript
            html = html.replace(/~([^~]+)~/g, '<sub>$1</sub>');
            html = html.replace(/\^([^^]+)\^/g, '<sup>$1</sup>');
            
            el.innerHTML = html;
            return Promise.resolve();
        })
    }
}));

describe('Popover Rendering for References', () => {
    beforeEach(() => {
        // Setup DOM environment without JSDOM
        const mockAddEventListener = jest.fn();
        global.document = {
            createElement: jest.fn((tag: string) => {
                const element = {
                    tagName: tag,
                    className: '',
                    textContent: '',
                    innerHTML: '',
                    setAttribute: jest.fn(),
                    getAttribute: jest.fn(),
                    addEventListener: mockAddEventListener,
                    appendChild: jest.fn(),
                    classList: {
                        add: jest.fn()
                    }
                };
                return element;
            }),
            body: {
                appendChild: jest.fn()
            }
        } as any;
        
        // Store mockAddEventListener for test access
        (global as any).mockAddEventListener = mockAddEventListener;
    });

    describe('Example References', () => {
        it('should render markdown content in hover popover when app and component provided', () => {
            const { setupRenderedHoverPreview } = require('../../../src/shared/utils/hoverPopovers');
            const tooltipText = '*proposition~a~^b^* $\\exists x Px$';
            const mockApp = {};
            const mockComponent = {};
            const widget = new ExampleReferenceWidget(
                1, 
                tooltipText, 
                undefined, 
                0, 
                mockApp as any, 
                mockComponent as any
            );
            const element = widget.toDOM();

            // With app and component, setupRenderedHoverPreview should be called
            expect(setupRenderedHoverPreview).toHaveBeenCalled();
            expect(setupRenderedHoverPreview).toHaveBeenCalledWith(
                element,
                tooltipText,
                mockApp,
                mockComponent,
                undefined // context is optional
            );
        });

        it('should fallback to setTooltip when app/component not provided', () => {
            const tooltipText = '*proposition~a~^b^* $\\exists x Px$';
            const widget = new ExampleReferenceWidget(1, tooltipText);
            const element = widget.toDOM();

            // Without app and component, should use setTooltip
            const { setTooltip } = require('obsidian');
            expect(setTooltip).toHaveBeenCalled();
        });
    });

    describe('Custom Label References', () => {
        it('should render markdown content in hover popover', () => {
            const content = '*bold text* with ~subscript~ and ^superscript^ plus $\\alpha + \\beta$';
            const widget = new CustomLabelReferenceWidget('P', content, undefined as any, 0);
            const element = widget.toDOM();

            // Current implementation uses title attribute which doesn't render
            expect(element.getAttribute('title')).toBe(content); // Shows raw text
            
            // After fix: should create a popover with MarkdownRenderer
            // The popover should show properly rendered content
        });
    });

    describe('Expected Behavior', () => {
        it('should use MarkdownRenderer for popover content', async () => {
            const content = '*test* $x^2$';
            const container = document.createElement('div');
            
            // Simulate what the popover should do
            await MarkdownRenderer.render(
                {} as any, // app
                content,
                container,
                '',
                {} as any // component
            );

            // Check that content was rendered
            expect(container.innerHTML).toContain('<em>test</em>');
            expect(container.innerHTML).toContain('<span class="math">x^2</span>');
        });
    });
    
    describe('Bug: Example References in Popovers', () => {
        it('should process example references in popover content', () => {
            // Setup context with example labels
            const context = {
                exampleLabels: new Map([
                    ['a', 1],
                    ['b', 2]
                ]),
                exampleContent: new Map([
                    ['a', 'item 1'],
                    ['b', 'reference to (@a)']
                ])
            };
            
            // The content that would be shown in popover for (@b)
            const rawContent = 'reference to (@a)';
            
            // Process the content - this should replace (@a) with (1)
            const processedContent = processPopoverContent(rawContent, context);
            
            // Currently fails: returns 'reference to (@a)' 
            // Should return: 'reference to (1)'
            expect(processedContent).toBe('reference to (1)');
        });
        
        it('should process custom label references in popover content', () => {
            // Setup context with custom labels
            const context = {
                customLabels: new Map([
                    ['LABEL1', 'Content 1']
                ]),
                rawToProcessed: new Map([
                    ['LABEL1', 'LABEL1']
                ])
            };
            
            const rawContent = 'See {::LABEL1} for details';
            const processedContent = processPopoverContent(rawContent, context);
            
            // Should replace {::LABEL1} with LABEL1
            expect(processedContent).toBe('See LABEL1 for details');
        });
    });
});