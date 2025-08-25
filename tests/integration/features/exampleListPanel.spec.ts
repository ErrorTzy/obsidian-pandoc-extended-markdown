import { ExampleListPanelModule } from '../../../src/views/panels/modules/ExampleListPanelModule';
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

describe('ExampleListPanelModule', () => {
    let app: App;
    let plugin: MockPlugin;
    let module: ExampleListPanelModule;
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
            getValue: jest.fn().mockReturnValue(`(@a) Proposition 1
(@) Proposition 2
(@b) Proposition 3

Therefore, from (@a) and (@b), we conclude our conclusion.`),
            setCursor: jest.fn(),
            scrollIntoView: jest.fn(),
            cursorCoords: jest.fn().mockReturnValue({ top: 100, left: 10 })
        } as any;
        
        // Create module instance
        module = new ExampleListPanelModule(plugin as any);
    });

    describe('Module Properties', () => {
        it('should have correct id', () => {
            expect(module.id).toBe('example-lists');
        });

        it('should have correct display name', () => {
            expect(module.displayName).toBe('Example Lists');
        });

        it('should have icon defined', () => {
            expect(module.icon).toBeDefined();
            expect(module.icon).toContain('(@)');
        });

        it('should start as inactive', () => {
            expect(module.isActive).toBe(false);
        });
    });

    describe('Example List Extraction', () => {
        it('should extract labeled example lists', () => {
            module.onActivate(containerEl, mockMarkdownView);
            
            // Access the private exampleItems through rendered DOM
            const rows = containerEl.querySelectorAll('.pandoc-example-list-view-row');
            expect(rows).toHaveLength(3);
            
            // Check first item
            const firstRow = rows[0];
            const cells = firstRow.querySelectorAll('td');
            expect(cells[0].textContent).toBe('1'); // Rendered number
            expect(cells[1].textContent).toBe('@a'); // Raw label
            expect(cells[2].textContent).toBe('Proposition 1'); // Content
        });

        it('should extract unlabeled example lists', () => {
            module.onActivate(containerEl, mockMarkdownView);
            
            const rows = containerEl.querySelectorAll('.pandoc-example-list-view-row');
            
            // Check second item (unlabeled)
            const secondRow = rows[1];
            const cells = secondRow.querySelectorAll('td');
            expect(cells[0].textContent).toBe('2'); // Rendered number
            expect(cells[1].textContent).toBe('@'); // Raw label (empty)
            expect(cells[2].textContent).toBe('Proposition 2'); // Content
        });

        it('should assign sequential numbers to example lists', () => {
            module.onActivate(containerEl, mockMarkdownView);
            
            const rows = containerEl.querySelectorAll('.pandoc-example-list-view-row');
            const numbers = Array.from(rows).map(row => 
                row.querySelector('.pandoc-example-list-view-number')?.textContent
            );
            
            expect(numbers).toEqual(['1', '2', '3']);
        });
    });

    describe('Number Truncation', () => {
        it('should not truncate two-digit numbers', () => {
            mockMarkdownView.editor.getValue = jest.fn().mockReturnValue(
                Array.from({ length: 99 }, (_, i) => `(@ex${i + 1}) Example ${i + 1}`).join('\n')
            );
            
            module.onActivate(containerEl, mockMarkdownView);
            
            const rows = containerEl.querySelectorAll('.pandoc-example-list-view-row');
            const lastRow = rows[rows.length - 1];
            const numberCell = lastRow.querySelector('.pandoc-example-list-view-number');
            
            expect(numberCell?.textContent).toBe('99'); // Should not be truncated
        });

        it('should truncate three-digit numbers', () => {
            mockMarkdownView.editor.getValue = jest.fn().mockReturnValue(
                Array.from({ length: 100 }, (_, i) => `(@ex${i + 1}) Example ${i + 1}`).join('\n')
            );
            
            module.onActivate(containerEl, mockMarkdownView);
            
            const rows = containerEl.querySelectorAll('.pandoc-example-list-view-row');
            const lastRow = rows[rows.length - 1];
            const numberCell = lastRow.querySelector('.pandoc-example-list-view-number');
            
            expect(numberCell?.textContent).toBe('10…'); // Should be truncated
        });
    });

    describe('Label Truncation', () => {
        it('should truncate long labels', () => {
            mockMarkdownView.editor.getValue = jest.fn().mockReturnValue(
                `(@verylonglabel) Example with long label`
            );
            
            module.onActivate(containerEl, mockMarkdownView);
            
            const labelCell = containerEl.querySelector('.pandoc-example-list-view-label');
            expect(labelCell?.textContent).toBe('@very…'); // Should be truncated at 6 chars
        });

        it('should not truncate short labels', () => {
            mockMarkdownView.editor.getValue = jest.fn().mockReturnValue(
                `(@short) Example with short label`
            );
            
            module.onActivate(containerEl, mockMarkdownView);
            
            const labelCell = containerEl.querySelector('.pandoc-example-list-view-label');
            expect(labelCell?.textContent).toBe('@short'); // Should not be truncated
        });
    });

    describe('Content Rendering', () => {
        it('should render math content properly', () => {
            mockMarkdownView.editor.getValue = jest.fn().mockReturnValue(
                `(@math) $x^2 + y^2 = z^2$`
            );
            
            module.onActivate(containerEl, mockMarkdownView);
            
            const contentCell = containerEl.querySelector('.pandoc-example-list-view-content');
            expect(contentCell).toBeTruthy();
            // Math content should be rendered (though we can't test the actual rendering in unit tests)
            expect(contentCell?.innerHTML).toContain('$');
        });

        it('should truncate long content', () => {
            const longContent = 'This is a very long content that definitely exceeds the character limit for display in the panel and should be truncated';
            mockMarkdownView.editor.getValue = jest.fn().mockReturnValue(
                `(@long) ${longContent}`
            );
            
            module.onActivate(containerEl, mockMarkdownView);
            
            const contentCell = containerEl.querySelector('.pandoc-example-list-view-content');
            const displayedContent = contentCell?.textContent || '';
            expect(displayedContent.length).toBeLessThanOrEqual(51);
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

        it('should copy raw label syntax on label click', async () => {
            module.onActivate(containerEl, mockMarkdownView);
            
            const labelCell = containerEl.querySelector('.pandoc-example-list-view-label') as HTMLElement;
            expect(labelCell).toBeTruthy();
            
            if (labelCell) {
                await labelCell.click();
                expect(navigator.clipboard.writeText).toHaveBeenCalledWith('(@a)');
            }
        });

        it('should navigate to line on content click', () => {
            module.onActivate(containerEl, mockMarkdownView);
            
            const contentCell = containerEl.querySelector('.pandoc-example-list-view-content') as HTMLElement;
            expect(contentCell).toBeTruthy();
            
            if (contentCell) {
                contentCell.click();
                expect(mockMarkdownView.editor.setCursor).toHaveBeenCalledWith({ line: 0, ch: 0 });
                expect(mockMarkdownView.editor.scrollIntoView).toHaveBeenCalled();
            }
        });

        it('should not have click handler on number column', () => {
            module.onActivate(containerEl, mockMarkdownView);
            
            const numberCell = containerEl.querySelector('.pandoc-example-list-view-number') as HTMLElement;
            expect(numberCell).toBeTruthy();
            
            if (numberCell) {
                const originalWriteText = navigator.clipboard.writeText;
                numberCell.click();
                // Clipboard should not be called for number column
                expect(navigator.clipboard.writeText).not.toHaveBeenCalledWith(expect.stringContaining('1'));
            }
        });
    });

    describe('Empty State', () => {
        it('should show no file message when no active file', () => {
            module.onActivate(containerEl, null);
            
            expect(containerEl.textContent).toContain('No active file');
        });

        it('should show no example lists message when file has no examples', () => {
            mockMarkdownView.editor.getValue = jest.fn().mockReturnValue(
                `Just regular text without any example lists`
            );
            
            module.onActivate(containerEl, mockMarkdownView);
            
            expect(containerEl.textContent).toContain('No example lists found');
        });
    });

    describe('Module Lifecycle', () => {
        it('should activate properly', () => {
            expect(module.isActive).toBe(false);
            
            module.onActivate(containerEl, mockMarkdownView);
            
            expect(module.isActive).toBe(true);
            expect(containerEl.querySelector('.pandoc-example-list-view-container')).toBeTruthy();
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
            
            const newContent = `(@new) New example list`;
            mockMarkdownView.editor.getValue = jest.fn().mockReturnValue(newContent);
            
            module.onUpdate(mockMarkdownView);
            
            const labelCell = containerEl.querySelector('.pandoc-example-list-view-label');
            expect(labelCell?.textContent).toBe('@new');
        });

        it('should clean up on destroy', () => {
            module.onActivate(containerEl, mockMarkdownView);
            
            module.destroy();
            
            expect(module.isActive).toBe(false);
            expect(containerEl.children.length).toBe(0);
        });
    });
});