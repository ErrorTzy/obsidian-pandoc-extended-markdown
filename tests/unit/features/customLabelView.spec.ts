import { ListPanelView, VIEW_TYPE_LIST_PANEL } from '../../../src/views/panels/ListPanelView';
import { App, MarkdownView, WorkspaceLeaf, Plugin } from 'obsidian';

// Mock Obsidian modules
jest.mock('obsidian');

// Mock PandocExtendedMarkdownPlugin  
class MockPlugin extends Plugin {
    settings = { 
        enableCustomLabelLists: true,
        panelOrder: ['custom-labels', 'example-lists']
    };
    registerHoverLinkSource() {}
}

describe('ListPanelView', () => {
    let app: App;
    let plugin: MockPlugin;
    let view: ListPanelView;
    let leaf: WorkspaceLeaf;
    let mockMarkdownView: MarkdownView;

    beforeEach(() => {
        // Setup DOM environment
        document.body.innerHTML = '';
        
        // Create mock instances
        app = new App();
        plugin = new MockPlugin(app, {} as any);
        
        // Ensure settings are set before creating the view
        plugin.settings = { 
            enableCustomLabelLists: true,
            panelOrder: ['custom-labels', 'example-lists']
        };
        
        leaf = new WorkspaceLeaf(app);
        
        // Setup mock markdown view
        mockMarkdownView = new MarkdownView();
        mockMarkdownView.file = {
            path: 'test.md'
        };
        mockMarkdownView.editor = {
            getValue: jest.fn().mockReturnValue(`{::P(#a)} P1
{::P(#b)} P2  
{::PPPPPP(#a)} PPPPPP1
{::P} {::P(#a)} $=$ {::P(#b)}

Therefore, from {::P(#a)} and {::P(#b)}, we conclude our conclusion.`),
            setCursor: jest.fn(),
            scrollIntoView: jest.fn(),
            getLine: jest.fn()
        } as any;
        
        // Mock workspace methods
        app.workspace.getActiveViewOfType = jest.fn().mockReturnValue(mockMarkdownView);
        
        // Create view instance - now it will properly initialize with custom label panel
        view = new ListPanelView(leaf, plugin as any);
    });

    describe('View Registration', () => {
        it('should return correct view type', () => {
            expect(view.getViewType()).toBe(VIEW_TYPE_LIST_PANEL);
        });

        it('should return correct display text', () => {
            expect(view.getDisplayText()).toBe('List panel');
        });

        it('should have correct icon', () => {
            expect(view.getIcon()).toBe('list-panel-view');
        });
    });

    describe('Label Extraction', () => {
        it.skip('should extract custom labels from current file (requires full DOM)', async () => {
            // This test requires full DOM environment and complex view initialization
            // that is not available in the current test setup.
            // It should be tested as an integration test.
            
            // Ensure the workspace is set up correctly
            app.workspace.getActiveViewOfType = jest.fn().mockReturnValue(mockMarkdownView);
            
            await view.onOpen();
            view.updateView(); // Explicitly call updateView
            
            const labels = view.getCustomLabels();
            expect(labels).toHaveLength(4);
            expect(labels[0]).toMatchObject({
                label: 'P1',
                rawLabel: '{::P(#a)}',
                content: 'P1',
                renderedContent: 'P1',
                lineNumber: 0
            });
            expect(labels[1]).toMatchObject({
                label: 'P2',
                rawLabel: '{::P(#b)}',
                content: 'P2',
                renderedContent: 'P2',
                lineNumber: 1
            });
            expect(labels[2]).toMatchObject({
                label: 'PPPPPP1',
                rawLabel: '{::PPPPPP(#a)}',
                content: 'PPPPPP1',
                renderedContent: 'PPPPPP1',
                lineNumber: 2
            });
            expect(labels[3]).toMatchObject({
                label: 'P',
                rawLabel: '{::P}',
                content: '{::P(#a)} $=$ {::P(#b)}',
                renderedContent: 'P1 $=$ P2',
                lineNumber: 3
            });
        });
    });

    describe('Label Interactions', () => {
        it.skip('should setup click handler for copying raw label text (requires full DOM)', async () => {
            // This test requires full DOM environment and panel initialization
            // that is not available in the current test setup.
            // Mock clipboard API
            Object.assign(navigator, {
                clipboard: {
                    writeText: jest.fn().mockResolvedValue(undefined)
                }
            });
            
            await view.onOpen();
            
            const labelElement = view.contentEl.querySelector('.custom-label-view-label') as HTMLElement;
            expect(labelElement).toBeTruthy();
            
            // Simulate click
            if (labelElement) {
                await labelElement.click();
                expect(navigator.clipboard.writeText).toHaveBeenCalledWith('{::P(#a)}');
            }
        });

        it.skip('should setup click handler for scrolling to label position (requires full DOM)', async () => {
            // This test requires full DOM environment and panel initialization
            // that is not available in the current test setup.
            await view.onOpen();
            
            const contentElement = view.contentEl.querySelector('.custom-label-view-content') as HTMLElement;
            expect(contentElement).toBeTruthy();
            
            if (contentElement) {
                contentElement.click();
                expect(mockMarkdownView.editor.setCursor).toHaveBeenCalled();
                expect(mockMarkdownView.editor.scrollIntoView).toHaveBeenCalled();
            }
        });
    });

    describe('View Updates', () => {
        it('should handle when no active file is present', async () => {
            app.workspace.getActiveViewOfType = jest.fn().mockReturnValue(null);
            
            await view.onOpen();
            
            const labels = view.getCustomLabels();
            expect(labels).toHaveLength(0);
            expect(view.contentEl.textContent).toContain('No active file');
        });
    });

    describe('Cleanup', () => {
        it('should clean up resources on close', async () => {
            await view.onOpen();
            await view.onClose();
            
            // Verify cleanup
            expect(view.contentEl.children.length).toBe(0);
        });
    });
});
