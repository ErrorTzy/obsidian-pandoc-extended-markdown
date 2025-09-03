import { DefinitionListPanelModule } from '../../../src/views/panels/modules/DefinitionListPanelModule';
import { App, MarkdownView, Plugin, MarkdownRenderer } from 'obsidian';

// Mock Obsidian modules
jest.mock('obsidian', () => ({
    ...jest.requireActual('../__mocks__/obsidian'),
    MarkdownRenderer: {
        render: jest.fn((app, content, element) => {
            // Simple mock - just put the content in the element
            element.innerHTML = content;
        })
    }
}));

// Mock PandocExtendedMarkdownPlugin  
class MockPlugin extends Plugin {
    settings = { moreExtendedSyntax: true };
    registerHoverLinkSource() {}
}

describe('DefinitionListPanelModule', () => {
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
        mockMarkdownView.editor = {
            getValue: jest.fn().mockReturnValue(`Term 1
: Def 1

Term 2
: Def 2a

    Def 2a, another paragraph

: Def 2b

Term 3

~ Def 3a
~ Def 3b`),
            setCursor: jest.fn(),
            scrollIntoView: jest.fn(),
            cursorCoords: jest.fn().mockReturnValue({ top: 100, left: 10 })
        } as any;
        
        // Create module instance
        module = new DefinitionListPanelModule(plugin as any);
    });

    describe('Module Properties', () => {
        it('should have correct id', () => {
            expect(module.id).toBe('definition-lists');
        });

        it('should have correct display name', () => {
            expect(module.displayName).toBe('Definition Lists');
        });

        it('should have icon defined', () => {
            expect(module.icon).toBeDefined();
        });

        it('should start as inactive', () => {
            expect(module.isActive).toBe(false);
        });
    });

    describe('Definition List Extraction', () => {
        it('should extract definition lists with single definitions', () => {
            module.onActivate(containerEl, mockMarkdownView);
            
            const rows = containerEl.querySelectorAll('.pandoc-definition-list-view-row');
            expect(rows.length).toBeGreaterThan(0);
            
            // Check first item (Term 1 with single definition)
            const firstRow = rows[0];
            const cells = firstRow.querySelectorAll('td');
            expect(cells[0].textContent).toBe('Term 1'); // Term column
            expect(cells[1].textContent?.trim()).toMatch(/Def 1/); // Definition column
        });

        it('should extract definition lists with multiple definitions', () => {
            module.onActivate(containerEl, mockMarkdownView);
            
            const rows = containerEl.querySelectorAll('.pandoc-definition-list-view-row');
            
            // Find Term 2 row (should have multiple definitions)
            let term2Row: Element | null = null;
            for (const row of rows) {
                const termCell = row.querySelector('.pandoc-definition-list-view-term');
                if (termCell?.textContent === 'Term 2') {
                    term2Row = row;
                    break;
                }
            }
            
            expect(term2Row).toBeTruthy();
            if (term2Row) {
                const defCell = term2Row.querySelector('.pandoc-definition-list-view-definitions');
                expect(defCell).toBeTruthy();
                // Should contain bullet points for multiple definitions
                const listItems = defCell?.querySelectorAll('li');
                expect(listItems?.length).toBe(2);
            }
        });

        it('should handle continuation lines in definitions', () => {
            module.onActivate(containerEl, mockMarkdownView);
            
            const rows = containerEl.querySelectorAll('.pandoc-definition-list-view-row');
            
            // Find Term 2 row
            let term2Row: Element | null = null;
            for (const row of rows) {
                const termCell = row.querySelector('.pandoc-definition-list-view-term');
                if (termCell?.textContent === 'Term 2') {
                    term2Row = row;
                    break;
                }
            }
            
            if (term2Row) {
                const defCell = term2Row.querySelector('.pandoc-definition-list-view-definitions');
                const firstListItem = defCell?.querySelector('li');
                // Should contain the continuation text
                expect(firstListItem?.textContent).toContain('another paragraph');
            }
        });

        it('should handle tilde (~) definition markers', () => {
            module.onActivate(containerEl, mockMarkdownView);
            
            const rows = containerEl.querySelectorAll('.pandoc-definition-list-view-row');
            
            // Find Term 3 row
            let term3Row: Element | null = null;
            for (const row of rows) {
                const termCell = row.querySelector('.pandoc-definition-list-view-term');
                if (termCell?.textContent === 'Term 3') {
                    term3Row = row;
                    break;
                }
            }
            
            expect(term3Row).toBeTruthy();
            if (term3Row) {
                const defCell = term3Row.querySelector('.pandoc-definition-list-view-definitions');
                const listItems = defCell?.querySelectorAll('li');
                expect(listItems?.length).toBe(2);
                expect(listItems?.[0].textContent).toContain('Def 3a');
                expect(listItems?.[1].textContent).toContain('Def 3b');
            }
        });
    });

    describe('Term Truncation', () => {
        it('should truncate long terms', () => {
            const longTerm = 'This is a very long term that should be truncated in the display because it exceeds one hundred characters total';
            mockMarkdownView.editor.getValue = jest.fn().mockReturnValue(
                `${longTerm}
: Definition for the long term`
            );
            
            module.onActivate(containerEl, mockMarkdownView);
            
            const termCell = containerEl.querySelector('.pandoc-definition-list-view-term');
            expect(termCell?.textContent).toBeTruthy();
            expect(termCell?.textContent?.length).toBeLessThanOrEqual(100);
            expect(termCell?.textContent).toContain('…');
        });

        it('should not truncate short terms', () => {
            mockMarkdownView.editor.getValue = jest.fn().mockReturnValue(
                `Short Term
: Definition`
            );
            
            module.onActivate(containerEl, mockMarkdownView);
            
            const termCell = containerEl.querySelector('.pandoc-definition-list-view-term');
            expect(termCell?.textContent).toBe('Short Term');
        });
    });

    describe('Definition Content Truncation', () => {
        it('should truncate long definition content', () => {
            const longContent = 'This is a very long definition that definitely exceeds the character limit for display in the panel and should be truncated appropriately. It needs to be much longer now because we increased the limit to 300 characters. So I am adding more text here to ensure it exceeds the new limit and will be truncated with an ellipsis at the end.';
            mockMarkdownView.editor.getValue = jest.fn().mockReturnValue(
                `Term
: ${longContent}`
            );
            
            module.onActivate(containerEl, mockMarkdownView);
            
            const defCell = containerEl.querySelector('.pandoc-definition-list-view-definitions');
            const displayedContent = defCell?.textContent || '';
            expect(displayedContent.length).toBeLessThanOrEqual(300);
            expect(displayedContent).toContain('…');
        });
    });

    describe('Click Handlers', () => {
        beforeEach(() => {
            // Mock clipboard API
            Object.assign(navigator, {
                clipboard: {
                    writeText: jest.fn().mockResolvedValue(undefined)
                }
            });
            
            // Mock workspace for navigation
            app.workspace.getLeavesOfType = jest.fn().mockReturnValue([{
                view: mockMarkdownView
            }]);
            app.workspace.setActiveLeaf = jest.fn();
        });

        it('should NOT copy term on click (unlike label panels)', () => {
            module.onActivate(containerEl, mockMarkdownView);
            
            const termCell = containerEl.querySelector('.pandoc-definition-list-view-term') as HTMLElement;
            expect(termCell).toBeTruthy();
            
            if (termCell) {
                termCell.click();
                // Should NOT copy to clipboard
                expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
            }
        });

        it('should navigate to term line on definition click', () => {
            module.onActivate(containerEl, mockMarkdownView);
            
            const defCell = containerEl.querySelector('.pandoc-definition-list-view-definitions') as HTMLElement;
            expect(defCell).toBeTruthy();
            
            if (defCell) {
                defCell.click();
                expect(mockMarkdownView.editor.setCursor).toHaveBeenCalled();
                expect(mockMarkdownView.editor.scrollIntoView).toHaveBeenCalled();
            }
        });
    });

    describe('Empty State', () => {
        it('should show no file message when no active file', () => {
            module.onActivate(containerEl, null);
            
            expect(containerEl.textContent).toContain('No active file');
        });

        it('should show no definition lists message when file has none', () => {
            mockMarkdownView.editor.getValue = jest.fn().mockReturnValue(
                `Just regular text without any definition lists`
            );
            
            module.onActivate(containerEl, mockMarkdownView);
            
            expect(containerEl.textContent).toContain('No definition lists found');
        });
    });

    describe('Module Lifecycle', () => {
        it('should activate properly', () => {
            expect(module.isActive).toBe(false);
            
            module.onActivate(containerEl, mockMarkdownView);
            
            expect(module.isActive).toBe(true);
            expect(containerEl.querySelector('.pandoc-definition-list-view-container')).toBeTruthy();
        });

        it('should deactivate properly', () => {
            module.onActivate(containerEl, mockMarkdownView);
            expect(module.isActive).toBe(true);
            
            module.onDeactivate();
            
            expect(module.isActive).toBe(false);
            expect(containerEl.children.length).toBe(0);
        });

        it('should update when active view changes', () => {
            module.onActivate(containerEl, mockMarkdownView);
            
            const newContent = `New Term
: New Definition`;
            mockMarkdownView.editor.getValue = jest.fn().mockReturnValue(newContent);
            
            module.onUpdate(mockMarkdownView);
            
            const termCell = containerEl.querySelector('.pandoc-definition-list-view-term');
            expect(termCell?.textContent).toBe('New Term');
        });

        it('should clean up on destroy', () => {
            module.onActivate(containerEl, mockMarkdownView);
            
            module.destroy();
            
            expect(module.isActive).toBe(false);
            expect(containerEl.children.length).toBe(0);
        });
    });
});