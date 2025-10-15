import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { renumberListItems } from '../../../src/shared/utils/listRenumbering';

describe('renumberListItems', () => {
    let view: EditorView & { lastTransaction?: { changes?: unknown; selection?: EditorSelection } };

    function createMockView(doc: string): EditorView & { lastTransaction?: { changes?: unknown; selection?: EditorSelection } } {
        const state = EditorState.create({ doc });
        const mockView = {
            state,
            dispatch: jest.fn((transaction: { changes?: any; selection?: EditorSelection }) => {
                mockView.lastTransaction = transaction;

                const rawChanges = transaction.changes;

                if (rawChanges) {
                    const changeSpecs = Array.isArray(rawChanges)
                        ? rawChanges
                        : rawChanges.changes ?? [rawChanges];

                    let updatedDoc = mockView.state.doc.toString();
                    let offset = 0;

                    changeSpecs.forEach((change: { from: number; to: number; insert: string }) => {
                        const from = change.from + offset;
                        const to = change.to + offset;

                        updatedDoc = updatedDoc.slice(0, from) + change.insert + updatedDoc.slice(to);
                        offset += change.insert.length - (change.to - change.from);
                    });

                    mockView.state = EditorState.create({
                        doc: updatedDoc,
                        selection: transaction.selection ?? mockView.state.selection
                    });
                } else if (transaction.selection) {
                    mockView.state.selection = transaction.selection;
                }
            }),
        };

        return mockView as unknown as EditorView & { lastTransaction?: { changes?: unknown; selection?: EditorSelection } };
    }

    it('preserves existing markers when continuation lines are present', () => {
        const initialDoc = [
            'A.  first line',
            '   ..continuation of the first line',
            'B.  Second line',
            'B. '
        ].join('\n');

        view = createMockView(initialDoc);

        const insertedLineIndex = initialDoc.split('\n').length - 1;
        renumberListItems(view, insertedLineIndex);

        const expectedDoc = [
            'A.  first line',
            '   ..continuation of the first line',
            'B.  Second line',
            'C. '
        ].join('\n');

        expect(view.state.doc.toString()).toBe(expectedDoc);
    });
});
