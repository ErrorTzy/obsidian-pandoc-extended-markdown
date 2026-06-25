import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { createListAutocompletionKeymap } from '../../../src/editor-extensions/listAutocompletion';
import { PandocExtendedMarkdownSettings } from '../../../src/core/settings';

describe('Definition list autocompletion', () => {
    let mockSettings: PandocExtendedMarkdownSettings;
    let keybindings: any[];

    beforeEach(() => {
        mockSettings = {
            enablePandocMarkdown: true,
            enablePandocExtendedMarkdown: true,
            enableExampleLists: true,
            enableDefinitionLists: true,
            enableFancyLists: true,
            enableHashAutoNumber: true,
            enableOrderedListMarkerCycling: true,
            enableUnorderedListMarkerCycling: true,
            orderedListMarkerOrder: [
                'decimal-period',
                'lower-alpha-period',
                'lower-roman-period',
                'upper-alpha-period',
                'upper-roman-period',
                'decimal-one-paren',
                'lower-alpha-one-paren',
                'lower-roman-one-paren',
                'upper-alpha-one-paren',
                'upper-roman-one-paren'
            ],
            unorderedListMarkerOrder: ['-', '+', '*'],
            autoRenumberLists: false,
            enableLogging: false
        };
        keybindings = createListAutocompletionKeymap(mockSettings);
    });

    function runKey(key: string, markedDoc: string): { handled: boolean; doc: string; view: EditorView } {
        const cursorPos = markedDoc.indexOf('|');
        const rawDoc = markedDoc.replace('|', '');
        const needsTrailingLineForMock = rawDoc.includes('\n') && cursorPos === rawDoc.length;
        const doc = needsTrailingLineForMock ? `${rawDoc}\nnext` : rawDoc;
        const state = EditorState.create({
            doc,
            selection: EditorSelection.cursor(cursorPos)
        });
        const mockView = {
            state,
            dispatch: jest.fn((transaction) => {
                const oldDoc = mockView.state.doc.toString();
                const nextDoc = transaction?.newDoc?.toString?.() ??
                    applyChangeSpecs(oldDoc, transaction?.changes);
                mockView.lastTransaction = transaction;
                if (typeof nextDoc === 'string') {
                    mockView.state = EditorState.create({
                        doc: nextDoc,
                        selection: transaction.newSelection ?? mockView.state.selection
                    });
                }
            }),
            lastTransaction: null
        } as any;
        const handler = keybindings.find(binding => binding.key === key);
        const handled = handler.run(mockView);
        const resultDoc = mockView.state.doc.toString();

        return {
            handled,
            doc: needsTrailingLineForMock && resultDoc.endsWith('\nnext')
                ? resultDoc.slice(0, -'\nnext'.length)
                : resultDoc,
            view: mockView
        };
    }

    function applyChangeSpecs(oldDoc: string, changes: any): string | null {
        if (!changes) {
            return null;
        }

        if (Array.isArray(changes)) {
            return flattenChangeSpecs(changes)
                .sort((left, right) => right.from - left.from)
                .reduce((doc, change) => applySingleChangeSpec(doc, change), oldDoc);
        }

        if (changes.from !== undefined) {
            return applySingleChangeSpec(oldDoc, changes);
        }

        return null;
    }

    function flattenChangeSpecs(changes: any[]): any[] {
        return changes.flatMap(change => Array.isArray(change) ? flattenChangeSpecs(change) : [change]);
    }

    function applySingleChangeSpec(oldDoc: string, change: any): string {
        const to = change.to ?? change.from;
        const insert = change.insert?.toString?.() ?? change.insert ?? '';

        return oldDoc.slice(0, change.from) + insert + oldDoc.slice(to);
    }

    it('continues colon and tilde definition items on Enter', () => {
        expect(runKey('Enter', ': text|').doc).toBe(': text\n: ');
        expect(runKey('Enter', '~ text|').doc).toBe('~ text\n~ ');
    });

    it('does not treat definition item checkbox-looking content as a task item', () => {
        expect(runKey('Enter', ': [x] text|').doc).toBe(': [x] text\n: ');
    });

    it('removes top-level empty definition markers on Enter', () => {
        expect(runKey('Enter', ':|').doc).toBe('');
        expect(runKey('Enter', '~|').doc).toBe('');
    });

    it('removes a top-level empty definition marker after a term line', () => {
        expect(runKey('Enter', 'Term 1\n: |').doc).toBe('Term 1\n');
    });

    it('returns empty nested definition items to the parent definition marker', () => {
        expect(runKey('Enter', ': parent\n    ~|').doc).toBe(': parent\n: ');
        expect(runKey('Shift-Tab', ': parent\n    ~|').doc).toBe(': parent\n: ');
    });

    it('uses the definition parent marker when indenting without a nested override', () => {
        expect(runKey('Tab', ': parent\n: child|').doc).toBe(': parent\n    : child');
    });

    it('uses an existing target-depth definition marker override when indenting', () => {
        expect(runKey('Tab', ': parent\n    ~ nested\n: child|').doc)
            .toBe(': parent\n    ~ nested\n    ~ child');
    });

    it('keeps definition items out of normal list marker families', () => {
        expect(runKey('Tab', '- normal\n    + nested\n: def|').doc)
            .toBe('- normal\n    + nested\n    : def');
    });

    it('keeps normal list items from using definition marker depth overrides', () => {
        expect(runKey('Tab', ': term\n    ~ def\n- item|').doc)
            .toBe(': term\n    ~ def\n    + item');
    });

    it('preserves continuation indentation under definition items on Enter', () => {
        expect(runKey('Enter', ': item\n    continuation|').doc)
            .toBe(': item\n    continuation\n    ');
    });

    it('inserts an extended-list continuation line on Shift+Enter', () => {
        expect(runKey('Shift-Enter', ': item|').doc).toBe(': item\n   ');
    });

    it('does not handle definition markers when definition lists are disabled', () => {
        mockSettings.enableDefinitionLists = false;
        keybindings = createListAutocompletionKeymap(mockSettings);

        const nonEmpty = runKey('Enter', ': text|');
        const empty = runKey('Enter', ':|');

        expect(nonEmpty.handled).toBe(false);
        expect(nonEmpty.view.dispatch).not.toHaveBeenCalled();
        expect(empty.handled).toBe(false);
        expect(empty.view.dispatch).not.toHaveBeenCalled();
    });
});
