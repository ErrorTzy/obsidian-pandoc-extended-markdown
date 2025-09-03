import { DefinitionListPanelModule } from '../../../src/views/panels/modules/DefinitionListPanelModule';
import { App, MarkdownView, Plugin, MarkdownRenderer } from 'obsidian';

// Mock Obsidian modules
jest.mock('obsidian', () => ({
    ...jest.requireActual('../../__mocks__/obsidian'),
    MarkdownRenderer: {
        render: jest.fn((app, content, element) => {
            // Simple mock - render bold and italic
            let rendered = content;
            rendered = rendered.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            rendered = rendered.replace(/\*(.*?)\*/g, '<em>$1</em>');
            rendered = rendered.replace(/_(.*?)_/g, '<em>$1</em>');
            element.innerHTML = rendered;
        })
    }
}));

// Mock renderContentWithMath to simulate actual rendering
jest.mock('../../../src/views/panels/utils/viewInteractions', () => ({
    renderContentWithMath: jest.fn((element, content, app, plugin, context) => {
        // Simulate rendering markdown
        let rendered = content;
        rendered = rendered.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        rendered = rendered.replace(/\*(.*?)\*/g, '<em>$1</em>');
        rendered = rendered.replace(/_(.*?)_/g, '<em>$1</em>');
        element.innerHTML = rendered;
    })
}));

// Mock PandocExtendedMarkdownPlugin  
class MockPlugin extends Plugin {
    settings = { moreExtendedSyntax: true };
    registerHoverLinkSource() {}
}

describe('DefinitionListPanelModule - Term Rendering', () => {
    let app: App;
    let plugin: MockPlugin;
    let module: DefinitionListPanelModule;
    let mockMarkdownView: MarkdownView;
    let containerEl: HTMLElement;

    beforeEach(() => {
        // Setup DOM environment
        document.body.innerHTML = '';
        containerEl = document.createElement('div');
        // Add mock empty method for Obsidian compatibility
        containerEl.empty = function() {
            while (this.firstChild) {
                this.removeChild(this.firstChild);
            }
        } as any;
        
        // Define createEl function to use recursively
        const createElFunc = function(this: any, tag: string, options?: any) {
            const el = document.createElement(tag) as any;
            if (options?.text) el.textContent = options.text;
            if (options?.cls) el.className = options.cls;
            // Add createEl to created elements recursively
            el.createEl = createElFunc;
            this.appendChild(el);
            return el;
        };
        
        containerEl.createEl = createElFunc;
        document.body.appendChild(containerEl);
        
        // Create mock instances
        app = new App();
        plugin = new MockPlugin(app, {} as any);
        
        // Setup mock markdown view
        mockMarkdownView = new MarkdownView();
        mockMarkdownView.file = {
            path: 'test.md'
        };
        
        // Create module instance
        module = new DefinitionListPanelModule(plugin as any);
    });

    describe('Term Rendering', () => {
        it('should render bold terms with markdown formatting', () => {
            mockMarkdownView.editor = {
                getValue: jest.fn().mockReturnValue(`**Bold Term**
: Definition for bold term`),
                setCursor: jest.fn(),
                scrollIntoView: jest.fn(),
                cursorCoords: jest.fn().mockReturnValue({ top: 100, left: 10 })
            } as any;
            
            module.onActivate(containerEl, mockMarkdownView);
            
            const termCell = containerEl.querySelector('.pandoc-definition-list-view-term');
            expect(termCell).toBeTruthy();
            // Check that the term is rendered with bold formatting (contains <strong> tag)
            expect(termCell?.innerHTML).toContain('<strong>Bold Term</strong>');
        });

        it('should render italic terms with markdown formatting', () => {
            mockMarkdownView.editor = {
                getValue: jest.fn().mockReturnValue(`*Italic Term*
: Definition for italic term`),
                setCursor: jest.fn(),
                scrollIntoView: jest.fn(),
                cursorCoords: jest.fn().mockReturnValue({ top: 100, left: 10 })
            } as any;
            
            module.onActivate(containerEl, mockMarkdownView);
            
            const termCell = containerEl.querySelector('.pandoc-definition-list-view-term');
            expect(termCell).toBeTruthy();
            // Check that the term is rendered with italic formatting (contains <em> tag)
            expect(termCell?.innerHTML).toContain('<em>Italic Term</em>');
        });

        it('should render terms with math expressions', () => {
            mockMarkdownView.editor = {
                getValue: jest.fn().mockReturnValue(`$E = mc^2$ Energy Formula
: Definition of the famous equation`),
                setCursor: jest.fn(),
                scrollIntoView: jest.fn(),
                cursorCoords: jest.fn().mockReturnValue({ top: 100, left: 10 })
            } as any;
            
            module.onActivate(containerEl, mockMarkdownView);
            
            const termCell = containerEl.querySelector('.pandoc-definition-list-view-term');
            expect(termCell).toBeTruthy();
            // Math should be preserved in the rendered output
            expect(termCell?.textContent).toContain('$E = mc^2$');
        });

        it('should render terms with mixed formatting', () => {
            mockMarkdownView.editor = {
                getValue: jest.fn().mockReturnValue(`**Bold** and *italic* term
: Definition with mixed formatting`),
                setCursor: jest.fn(),
                scrollIntoView: jest.fn(),
                cursorCoords: jest.fn().mockReturnValue({ top: 100, left: 10 })
            } as any;
            
            module.onActivate(containerEl, mockMarkdownView);
            
            const termCell = containerEl.querySelector('.pandoc-definition-list-view-term');
            expect(termCell).toBeTruthy();
            // Check for both bold and italic formatting
            expect(termCell?.innerHTML).toContain('<strong>Bold</strong>');
            expect(termCell?.innerHTML).toContain('<em>italic</em>');
        });

        it('should truncate long rendered terms properly', () => {
            const longTerm = '**' + 'A'.repeat(40) + '**'; // Will render to 40 chars
            mockMarkdownView.editor = {
                getValue: jest.fn().mockReturnValue(`${longTerm}
: Definition`),
                setCursor: jest.fn(),
                scrollIntoView: jest.fn(),
                cursorCoords: jest.fn().mockReturnValue({ top: 100, left: 10 })
            } as any;
            
            module.onActivate(containerEl, mockMarkdownView);
            
            const termCell = containerEl.querySelector('.pandoc-definition-list-view-term');
            expect(termCell).toBeTruthy();
            // Should be truncated with ellipsis (30 char limit for terms)
            const text = termCell?.textContent || '';
            expect(text.length).toBeLessThanOrEqual(30);
            expect(text).toContain('…');
        });
    });
});