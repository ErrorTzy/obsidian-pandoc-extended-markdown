import { ListPanelView, VIEW_TYPE_LIST_PANEL } from '../../../src/views/panels/ListPanelView';
import { truncateLabel, truncateContent, truncateContentWithRendering } from '../../../src/views/panels/utils/contentTruncator';
import { renderMathToText } from '../../../src/shared/utils/mathRenderer';
import { App, MarkdownView, WorkspaceLeaf, Plugin } from 'obsidian';

// Mock Obsidian modules
jest.mock('obsidian');

// Mock PandocExtendedMarkdownPlugin  
class MockPlugin extends Plugin {
    settings = { 
        moreExtendedSyntax: true,
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
            moreExtendedSyntax: true,
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

    describe('Label Display', () => {
        it('should truncate long labels to 6 characters', () => {
            // Now using the extracted utility function
            const truncated = truncateLabel('PPPPPP1');
            expect(truncated).toBe('PPPPP…');
        });

        it('should not truncate labels with 6 or fewer characters', () => {
            const truncated = truncateLabel('P1');
            expect(truncated).toBe('P1');
            const truncated6 = truncateLabel('PPPPPP');
            expect(truncated6).toBe('PPPPPP');
        });

        it('should truncate content exceeding 51 characters', () => {
            const longContent = 'This is a very long content that definitely exceeds the fifty-one character limit for truncation';
            const truncated = truncateContent(longContent);
            expect(truncated).toBe('This is a very long content that definitely exceed…');
            expect(truncated.length).toBe(51);
        });

        it('should truncate based on rendered length for math content', () => {
            // Math content that renders short but has long raw text
            const mathContent = '$\\therefore \\therefore \\therefore \\therefore \\therefore \\therefore \\therefore \\therefore$';
            // When rendered, this shows as: ∴∴∴∴∴∴∴∴
            // The rendered length is 8 characters, well under 51
            // So it should NOT be truncated
            const truncated = truncateContentWithRendering(mathContent);
            expect(truncated).toBe(mathContent); // Should not truncate
        });

        it('should not have trailing spaces before closing $ in math', () => {
            // Math content with spaces after commands
            const mathWithSpaces = '$\\therefore \\therefore \\therefore $';
            const truncated = truncateContentWithRendering(mathWithSpaces);
            // Should not have space before closing $
            expect(truncated).not.toMatch(/\s\$/);
            expect(truncated).toBe('$\\therefore \\therefore \\therefore$');
        });

        it('should truncate rendered math content properly when exceeding limit', () => {
            // Create content with many math symbols that would exceed 51 when rendered
            let longMathContent = '$';
            for (let i = 0; i < 60; i++) {
                longMathContent += '\\therefore ';
            }
            longMathContent += '$';
            // When rendered, this would show 60 ∴ symbols
            // Should truncate at 50 symbols with ellipsis
            const truncated = truncateContentWithRendering(longMathContent);
            
            // The truncated version should preserve complete LaTeX commands
            // and end with ellipsis when truncated
            expect(truncated).toContain('$');
            expect(truncated).toContain('\\therefore');
            expect(truncated).toContain('…');
            
            // Extract the math content between dollar signs and before ellipsis
            const mathMatch = truncated.match(/\$([^$]+)(?:\$|…)/);
            if (mathMatch) {
                const mathContent = mathMatch[1];
                const renderedText = renderMathToText(mathContent);
                // The rendered length should not exceed 50 (51 - 1 for ellipsis)
                expect(renderedText.length).toBeLessThanOrEqual(50);
            } else {
                fail('Could not extract math content from truncated string');
            }
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
