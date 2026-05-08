import { Editor, EditorPosition } from 'obsidian';
import { PandocExtendedMarkdownPlugin } from '../../../src/core/main';
import { FencedDivReferenceSuggest } from '../../../src/editor-extensions/suggestions/fencedDivReferenceSuggest';

const mockApp = {} as any;

describe('Fenced Div Reference Suggestions', () => {
    let plugin: PandocExtendedMarkdownPlugin;
    let suggest: FencedDivReferenceSuggest;
    let mockEditor: Editor;

    beforeEach(() => {
        plugin = {
            app: mockApp,
            settings: {
                enableFencedDivs: true
            }
        } as any;

        suggest = new FencedDivReferenceSuggest(plugin);

        mockEditor = {
            getValue: jest.fn(),
            getLine: jest.fn(),
            replaceRange: jest.fn(),
            setCursor: jest.fn()
        } as any;
    });

    describe('onTrigger', () => {
        it('triggers when cursor is after @', () => {
            const cursor: EditorPosition = { line: 0, ch: 5 };
            mockEditor.getLine = jest.fn().mockReturnValue('See @');

            const result = suggest.onTrigger(cursor, mockEditor, null);

            expect(result).toBeTruthy();
            expect(result?.start).toEqual({ line: 0, ch: 4 });
            expect(result?.end).toEqual(cursor);
            expect(result?.query).toBe('');
        });

        it('uses the partial label after @ as the query', () => {
            const cursor: EditorPosition = { line: 0, ch: 9 };
            mockEditor.getLine = jest.fn().mockReturnValue('See @thm');

            const result = suggest.onTrigger(cursor, mockEditor, null);

            expect(result).toBeTruthy();
            expect(result?.query).toBe('thm');
        });

        it('does not trigger inside example-list reference syntax', () => {
            const cursor: EditorPosition = { line: 0, ch: 6 };
            mockEditor.getLine = jest.fn().mockReturnValue('See (@');

            const result = suggest.onTrigger(cursor, mockEditor, null);

            expect(result).toBeNull();
        });

        it('does not trigger when the feature is disabled', () => {
            plugin.settings.enableFencedDivs = false;
            const cursor: EditorPosition = { line: 0, ch: 5 };
            mockEditor.getLine = jest.fn().mockReturnValue('See @');

            const result = suggest.onTrigger(cursor, mockEditor, null);

            expect(result).toBeNull();
        });
    });

    describe('getSuggestions', () => {
        it('returns indexed fenced div labels with reference text and previews', () => {
            mockEditor.getValue = jest.fn().mockReturnValue([
                '::: {.theorem #thm:pythagoras title="Theorem &"}',
                'For a right triangle, a^2 + b^2 = c^2.',
                ':::',
                '',
                '::: Warning #warn title="Warning &"',
                'Readable shorthand opener.',
                ':::',
                '',
                '::: {.lemma #lem:compact title="Lemma &"}',
                'Every compact metric space is complete.',
                ':::'
            ].join('\n'));

            const suggestions = suggest.getSuggestions({
                editor: mockEditor,
                query: ''
            } as any);

            expect(suggestions).toHaveLength(3);
            expect(suggestions[0]).toEqual({
                label: 'lem:compact',
                displayName: 'Lemma 1',
                previewText: 'Every compact metric space is ...',
                lineNumber: 9
            });
            expect(suggestions[1]).toEqual({
                label: 'thm:pythagoras',
                displayName: 'Theorem 1',
                previewText: 'For a right triangle, a^2 + b^...',
                lineNumber: 1
            });
            expect(suggestions[2]).toEqual({
                label: 'warn',
                displayName: 'Warning 1',
                previewText: 'Readable shorthand opener.',
                lineNumber: 5
            });
        });

        it('skips readable shorthand labels in strict mode', () => {
            plugin.settings.strictPandocMode = true;
            mockEditor.getValue = jest.fn().mockReturnValue([
                '::: Theorem #thm',
                'Readable shorthand content.',
                ':::',
                '',
                '::: {.lemma #lem}',
                'Pandoc content.',
                ':::'
            ].join('\n'));

            const suggestions = suggest.getSuggestions({
                editor: mockEditor,
                query: ''
            } as any);

            expect(suggestions.map(suggestion => suggestion.label)).toEqual(['lem']);
        });

        it('filters suggestions by label', () => {
            mockEditor.getValue = jest.fn().mockReturnValue([
                '::: {.theorem #thm:pythagoras}',
                'Theorem content.',
                ':::',
                '',
                '::: {.lemma #lem:compact}',
                'Lemma content.',
                ':::'
            ].join('\n'));

            const labelMatches = suggest.getSuggestions({
                editor: mockEditor,
                query: 'thm'
            } as any);

            expect(labelMatches.map(suggestion => suggestion.label)).toEqual(['thm:pythagoras']);
        });

        it('skips fenced div labels inside markdown code fences', () => {
            mockEditor.getValue = jest.fn().mockReturnValue([
                '```',
                '::: {.theorem #not-real}',
                ':::',
                '```',
                '',
                '::: {.theorem #real}',
                'Actual content.',
                ':::'
            ].join('\n'));

            const suggestions = suggest.getSuggestions({
                editor: mockEditor,
                query: ''
            } as any);

            expect(suggestions.map(suggestion => suggestion.label)).toEqual(['real']);
        });
    });

    describe('renderSuggestion', () => {
        it('renders the label, display name, and preview', () => {
            const root = document.createElement('div') as any;

            suggest.renderSuggestion({
                label: 'thm:pythagoras',
                displayName: 'Theorem 1',
                previewText: 'For a right triangle.',
                lineNumber: 1
            }, root);

            expect(root.textContent).toContain('@thm:pythagoras');
            expect(root.textContent).toContain('Theorem 1');
            expect(root.textContent).toContain('For a right triangle.');
        });
    });

    describe('selectSuggestion', () => {
        it('replaces the partial @ query with the full citation label', () => {
            const start = { line: 0, ch: 4 };
            const end = { line: 0, ch: 8 };
            suggest.context = {
                editor: mockEditor,
                start,
                end
            } as any;

            suggest.selectSuggestion({
                label: 'thm:pythagoras',
                displayName: 'Theorem 1',
                previewText: 'For a right triangle.',
                lineNumber: 1
            }, {} as any);

            expect(mockEditor.replaceRange).toHaveBeenCalledWith('@thm:pythagoras', start, end);
            expect(mockEditor.setCursor).toHaveBeenCalledWith({ line: 0, ch: 19 });
        });
    });
});
