import { EditorView } from '@codemirror/view';
import { EditorState, EditorSelection } from '@codemirror/state';
import { createListAutocompletionKeymap } from '../src/editor-extensions/listAutocompletion';
import { PandocExtendedMarkdownSettings } from '../src/core/settings';

describe('Custom Label List Autocompletion', () => {
    let mockSettings: PandocExtendedMarkdownSettings;
    let keybindings: any[];
    
    beforeEach(() => {
        mockSettings = {
            enablePandocMarkdown: true,
            enableExampleLists: true,
            enableDefinitionLists: true,
            enablePandocExtendedMarkdown: true,
            enableSuperSub: true,
            moreExtendedSyntax: true,
            autoRenumberLists: false,
            enableLogging: false
        };
        keybindings = createListAutocompletionKeymap(mockSettings);
    });
    
    function createMockView(doc: string, cursorPos: number): EditorView {
        const state = EditorState.create({
            doc: doc,
            selection: EditorSelection.cursor(cursorPos)
        });
        
        const mockView = {
            state,
            dispatch: jest.fn((transaction) => {
                // Mock dispatch to capture the transaction
                mockView.lastTransaction = transaction;
            }),
            lastTransaction: null
        } as any;
        
        return mockView;
    }
    
    function getChangesFromTransaction(transaction: any): { from: number, to: number, insert: string } | null {
        if (!transaction || !transaction.changes) return null;
        
        // Handle different transaction formats
        if (Array.isArray(transaction.changes)) {
            return transaction.changes[0];
        } else if (transaction.changes.from !== undefined) {
            return transaction.changes;
        }
        return null;
    }
    
    describe('Enter key handling for custom label lists', () => {
        it('should create empty custom label list item when pressing Enter after custom label list item', () => {
            const doc = '{::P} All humans are mortal.';
            const cursorPos = doc.length; // At end of line
            const view = createMockView(doc, cursorPos);
            
            const enterHandler = keybindings.find(kb => kb.key === 'Enter');
            const result = enterHandler.run(view);
            
            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();
            
            const transaction = view.lastTransaction;
            expect(transaction).toBeDefined();
            const changes = getChangesFromTransaction(transaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('\n{::} ');
            
            // Check cursor position - should be between :: and }
            const selection = transaction.selection;
            expect(selection).toBeDefined();
            expect(selection.main.from).toBe(doc.length + 4); // After '\n{::'
        });
        
        it('should remove empty custom label list marker when pressing Enter twice', () => {
            const doc = '{::P} All humans are mortal.\n{::}';
            const cursorPos = doc.length - 1; // Between :: and }
            const view = createMockView(doc, cursorPos);
            
            const enterHandler = keybindings.find(kb => kb.key === 'Enter');
            const result = enterHandler.run(view);
            
            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();
            
            const transaction = view.lastTransaction;
            expect(transaction).toBeDefined();
            const changes = getChangesFromTransaction(transaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe(''); // Should remove the empty marker
        });
        
        it('should handle indented custom label lists', () => {
            const doc = '    {::P} Indented custom label.';
            const cursorPos = doc.length;
            const view = createMockView(doc, cursorPos);
            
            const enterHandler = keybindings.find(kb => kb.key === 'Enter');
            const result = enterHandler.run(view);
            
            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();
            
            const transaction = view.lastTransaction;
            expect(transaction).toBeDefined();
            const changes = getChangesFromTransaction(transaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('\n    {::} '); // Should preserve indentation
        });
        
        it('should not trigger for incomplete custom label markers', () => {
            const doc = '{::'; // Incomplete marker
            const cursorPos = doc.length;
            const view = createMockView(doc, cursorPos);
            
            const enterHandler = keybindings.find(kb => kb.key === 'Enter');
            const result = enterHandler.run(view);
            
            expect(result).toBe(false); // Should not handle this
        });
    });
});