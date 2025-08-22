import { CustomLabelReferenceSuggest } from '../src/customLabelReferenceSuggest';
import { PandocExtendedMarkdownPlugin } from '../src/main';
import { Editor, TFile, App } from 'obsidian';
import { CustomLabelSuggestion } from '../src/types/listTypes';

describe('Custom Label Rendered Suggestions', () => {
    let plugin: PandocExtendedMarkdownPlugin;
    let suggest: CustomLabelReferenceSuggest;
    let mockEditor: Editor;
    let mockApp: App;

    beforeEach(() => {
        mockApp = {
            workspace: {},
            vault: {},
            metadataCache: {}
        } as App;

        plugin = {
            app: mockApp,
            settings: {
                moreExtendedSyntax: true
            }
        } as PandocExtendedMarkdownPlugin;

        suggest = new CustomLabelReferenceSuggest(plugin);

        mockEditor = {
            getValue: jest.fn(),
            getLine: jest.fn(),
            replaceRange: jest.fn(),
            setCursor: jest.fn()
        } as unknown as Editor;
    });

    describe('getSuggestions with placeholder rendering', () => {
        it('should return suggestions with rendered placeholders', () => {
            // Setup document with custom labels containing placeholders
            const docContent = `{::P(#a)} First principle
{::P(#b)} Second principle
{::Q(#x)} First question

Therefore, from {::|}`;

            mockEditor.getValue = jest.fn().mockReturnValue(docContent);

            const context = {
                editor: mockEditor,
                query: ''
            } as any;

            const suggestions = suggest.getSuggestions(context);

            // Check that we get the right number of suggestions
            expect(suggestions).toHaveLength(3);

            // Check that placeholders are replaced with numbers in display text
            // Find each suggestion by its label
            const pa = suggestions.find(s => s.label === 'P(#a)');
            const pb = suggestions.find(s => s.label === 'P(#b)');
            const qx = suggestions.find(s => s.label === 'Q(#x)');
            
            expect(pa).toEqual({
                label: 'P(#a)',
                displayLabel: 'P1',
                placeholderParts: [{
                    original: '(#a)',
                    replacement: '1',
                    index: 1
                }],
                previewText: 'First principle'
            });

            expect(pb).toEqual({
                label: 'P(#b)', 
                displayLabel: 'P2',
                placeholderParts: [{
                    original: '(#b)',
                    replacement: '2',
                    index: 1
                }],
                previewText: 'Second principle'
            });

            expect(qx).toEqual({
                label: 'Q(#x)',
                displayLabel: 'Q3',
                placeholderParts: [{
                    original: '(#x)',
                    replacement: '3',
                    index: 1
                }],
                previewText: 'First question'
            });
        });

        it('should handle complex labels with placeholders and text', () => {
            const docContent = `{::P(#a)P} Complex label with suffix
{::Q(#x)_final} Label with underscore suffix

Ref: {::|}`;

            mockEditor.getValue = jest.fn().mockReturnValue(docContent);

            const context = {
                editor: mockEditor,
                query: ''
            } as any;

            const suggestions = suggest.getSuggestions(context);

            expect(suggestions).toHaveLength(2);

            // Check P(#a)P - should show P1(#a)P with only "1" underlined
            expect(suggestions[0]).toEqual({
                label: 'P(#a)P',
                displayLabel: 'P1P',
                placeholderParts: [{
                    original: '(#a)',
                    replacement: '1',
                    index: 1
                }],
                previewText: 'Complex label with suffix'
            });

            // Check Q(#x)_final (x gets number 2 since a was 1)
            expect(suggestions[1]).toEqual({
                label: 'Q(#x)_final',
                displayLabel: 'Q2_final',
                placeholderParts: [{
                    original: '(#x)',
                    replacement: '2',
                    index: 1
                }],
                previewText: 'Label with underscore suffix'
            });
        });

        it('should handle labels without placeholders', () => {
            const docContent = `{::Definition} A simple definition
{::P(#a)} With placeholder

Ref: {::|}`;

            mockEditor.getValue = jest.fn().mockReturnValue(docContent);

            const context = {
                editor: mockEditor,
                query: ''
            } as any;

            const suggestions = suggest.getSuggestions(context);

            expect(suggestions).toHaveLength(2);

            // Non-placeholder label should not have displayLabel
            expect(suggestions[0]).toEqual({
                label: 'Definition',
                displayLabel: null,
                placeholderParts: null,
                previewText: 'A simple definition'
            });

            // Placeholder label should have displayLabel
            expect(suggestions[1]).toEqual({
                label: 'P(#a)',
                displayLabel: 'P1',
                placeholderParts: [{
                    original: '(#a)',
                    replacement: '1',
                    index: 1
                }],
                previewText: 'With placeholder'
            });
        });
    });

    describe('renderSuggestion with styled elements', () => {
        it('should render placeholder suggestions with styled components', () => {
            const suggestion: CustomLabelSuggestion = {
                label: 'P(#a)',
                displayLabel: 'P1',
                placeholderParts: [{
                    original: '(#a)',
                    replacement: '1',
                    index: 1
                }],
                previewText: 'First principle'
            };

            const mockEl = {
                createDiv: jest.fn().mockImplementation(({ cls }) => {
                    const div = {
                        createDiv: jest.fn().mockReturnThis(),
                        createSpan: jest.fn().mockReturnThis(),
                        setText: jest.fn(),
                        style: {}
                    };
                    return div;
                })
            } as unknown as HTMLElement;

            suggest.renderSuggestion(suggestion, mockEl);

            // Verify the structure was created
            expect(mockEl.createDiv).toHaveBeenCalledWith(
                expect.objectContaining({ cls: 'pandoc-suggestion-content' })
            );
        });

        it('should render non-placeholder suggestions normally', () => {
            const suggestion = {
                label: 'Definition',
                displayLabel: null,
                placeholderParts: null,
                previewText: 'A simple definition'
            };

            const mockEl = {
                createDiv: jest.fn().mockImplementation(() => ({
                    createDiv: jest.fn().mockReturnThis(),
                    setText: jest.fn()
                }))
            } as unknown as HTMLElement;

            suggest.renderSuggestion(suggestion, mockEl);

            expect(mockEl.createDiv).toHaveBeenCalledWith(
                expect.objectContaining({ cls: 'pandoc-suggestion-content' })
            );
        });
    });

    describe('getSuggestions with processed label matching', () => {
        it('should match by processed label when typing numbers', () => {
            const docContent = `{::P(#a)P} First principle
{::P(#b)} Second principle
{::Q(#x)_final} Question

Typing here: {::P1|}`;

            mockEditor.getValue = jest.fn().mockReturnValue(docContent);

            const context = {
                editor: mockEditor,
                query: 'P1'
            } as any;

            const suggestions = suggest.getSuggestions(context);

            // Should find P(#a)P because it processes to P1P
            expect(suggestions).toHaveLength(1);
            expect(suggestions[0].label).toBe('P(#a)P');
        });

        it('should match both raw and processed forms', () => {
            const docContent = `{::P(#a)P} With placeholder
{::P1X} Without placeholder

Typing: {::P1|}`;

            mockEditor.getValue = jest.fn().mockReturnValue(docContent);

            const context = {
                editor: mockEditor,
                query: 'P1'
            } as any;

            const suggestions = suggest.getSuggestions(context);

            // Should find both: P(#a)P (processes to P1P) and P1X (starts with P1)
            expect(suggestions).toHaveLength(2);
            const labels = suggestions.map(s => s.label).sort();
            expect(labels).toEqual(['P(#a)P', 'P1X']);
        });
    });

    describe('selectSuggestion behavior', () => {
        it('should insert the original label, not the rendered version', () => {
            const suggestion = {
                label: 'P(#a)',
                displayLabel: 'P1',
                placeholderParts: [{
                    original: '(#a)',
                    replacement: '1',
                    index: 1
                }],
                previewText: 'First principle'
            };

            const context = {
                editor: mockEditor,
                start: { line: 0, ch: 5 },
                end: { line: 0, ch: 8 }
            };

            suggest.context = context as any;

            mockEditor.getLine = jest.fn().mockReturnValue('Test {::P} more text');

            suggest.selectSuggestion(suggestion, {} as MouseEvent);

            // Should insert the original label, not the rendered one
            expect(mockEditor.replaceRange).toHaveBeenCalledWith(
                '{::P(#a)}',
                { line: 0, ch: 5 },
                { line: 0, ch: 8 }
            );
        });
    });
});