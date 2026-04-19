import { EditorView } from '@codemirror/view';
import { EditorState, EditorSelection } from '@codemirror/state';
import { createListAutocompletionKeymap } from '../../../src/editor-extensions/listAutocompletion';
import { PandocExtendedMarkdownSettings } from '../../../src/core/settings';

describe('List Autocompletion', () => {
    let mockSettings: PandocExtendedMarkdownSettings;
    let keybindings: any[];
    
    beforeEach(() => {
        mockSettings = {
            enablePandocMarkdown: true,
            enableExampleLists: true,
            enableDefinitionLists: true,
            enablePandocExtendedMarkdown: true,
            enableSuperSub: true,
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
    
    describe('Enter key handling for example lists', () => {
        it('should delete empty example list marker when cursor is between @ and )', () => {
            const doc = '(@eg1) Example\n(@)';
            const cursorPos = 17; // Position between @ and ) (15 chars for first line + newline + @ = 17)
            const view = createMockView(doc, cursorPos);
            
            const enterHandler = keybindings.find(kb => kb.key === 'Enter');
            const result = enterHandler.run(view);
            
            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();
            
            const transaction = view.lastTransaction;
            expect(transaction).toBeDefined();
            expect(transaction.changes).toBeDefined();
            const changes = getChangesFromTransaction(transaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe(''); // Should remove the marker
        });
        
        it('should NOT delete empty example list marker when cursor is after the closing parenthesis', () => {
            const doc = '(@eg1) Example\n(@)';
            const cursorPos = 18; // Position after the closing )
            const view = createMockView(doc, cursorPos);
            
            const enterHandler = keybindings.find(kb => kb.key === 'Enter');
            const result = enterHandler.run(view);
            
            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();
            
            const transaction = view.lastTransaction;
            expect(transaction).toBeDefined();
            const changes = getChangesFromTransaction(transaction);
            expect(changes).toBeDefined();
            // Should create a new line with the next marker, not delete the current one
            expect(changes!.insert).toMatch(/\n\(@\)/);
        });
        
        it('should continue list when (@) has content on previous line', () => {
            const doc = '(@) Example content\n(@)';
            const cursorPos = 23; // Position after the second (@)
            const view = createMockView(doc, cursorPos);
            
            const enterHandler = keybindings.find(kb => kb.key === 'Enter');
            const result = enterHandler.run(view);
            
            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();
            
            const transaction = view.lastTransaction;
            expect(transaction).toBeDefined();
            const changes = getChangesFromTransaction(transaction);
            expect(changes).toBeDefined();
            // Should create a new line with the next marker, not delete the current one
            expect(changes!.insert).toMatch(/\n\(@\)/);
        });
        
        it('should NOT delete example list marker when cursor is after the closing parenthesis', () => {
            const doc = '(@eg1) Example\n(@eg2)';
            const cursorPos = 21; // Position after the closing )
            const view = createMockView(doc, cursorPos);
            
            const enterHandler = keybindings.find(kb => kb.key === 'Enter');
            const result = enterHandler.run(view);
            
            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();
            
            const transaction = view.lastTransaction;
            expect(transaction).toBeDefined();
            expect(transaction.changes).toBeDefined();
            const changes = getChangesFromTransaction(transaction);
            expect(changes).toBeDefined();
            // Should create a new line with the next marker, not delete the current one
            expect(changes!.insert).toMatch(/\n\(@\)/);
        });
        
        it('should handle Enter correctly after example list with content', () => {
            const doc = '(@eg1) Example content';
            const cursorPos = doc.length; // At end of line
            const view = createMockView(doc, cursorPos);
            
            const enterHandler = keybindings.find(kb => kb.key === 'Enter');
            const result = enterHandler.run(view);
            
            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();
            
            const transaction = view.lastTransaction;
            expect(transaction).toBeDefined();
            expect(transaction.changes).toBeDefined();
            const changes = getChangesFromTransaction(transaction);
            expect(changes).toBeDefined();
            // Should create a new line with an empty example marker
            expect(changes!.insert).toMatch(/\n\(@\)/);
        });
        
        it('should handle Enter when cursor is immediately after example label', () => {
            const doc = '(@eg1) Example\n(@eg2) ';
            const cursorPos = 22; // Position after the space, at end of line
            const view = createMockView(doc, cursorPos);
            
            const enterHandler = keybindings.find(kb => kb.key === 'Enter');
            const result = enterHandler.run(view);
            
            // Since cursor is at end of line with content (even if just space), should add new line
            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();
            
            const transaction = view.lastTransaction;
            expect(transaction).toBeDefined();
            const changes = getChangesFromTransaction(transaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toMatch(/\n\(@\)/);
        });
    });
    
    describe('Enter key handling for other list types', () => {
        it('should handle hash lists correctly', () => {
            const doc = '#. First item';
            const cursorPos = doc.length;
            const view = createMockView(doc, cursorPos);
            
            const enterHandler = keybindings.find(kb => kb.key === 'Enter');
            const result = enterHandler.run(view);
            
            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();
            
            const transaction = view.lastTransaction;
            expect(transaction).toBeDefined();
            expect(transaction.changes).toBeDefined();
            const changes = getChangesFromTransaction(transaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toMatch(/\n#\./);
        });
        
        it('should handle fancy lists with letters', () => {
            const doc = 'A. First item';
            const cursorPos = doc.length;
            const view = createMockView(doc, cursorPos);
            
            const enterHandler = keybindings.find(kb => kb.key === 'Enter');
            const result = enterHandler.run(view);
            
            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();
            
            const transaction = view.lastTransaction;
            expect(transaction).toBeDefined();
            expect(transaction.changes).toBeDefined();
            const changes = getChangesFromTransaction(transaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toMatch(/\nB\./);
        });
    });

    describe('Tab key handling for unordered lists', () => {
        it('should use the bullet marker for the resulting nested depth when indenting', () => {
            const listText = '- item 1\n- ';
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const tabHandler = keybindings.find(kb => kb.key === 'Tab');
            const result = tabHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('    + ');
        });

        it('should switch from plus to star when indenting to the second nested depth', () => {
            const listText = '- item 1\n    + item 2\n    + ';
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const tabHandler = keybindings.find(kb => kb.key === 'Tab');
            const result = tabHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('        * ');
        });

        it('should wrap from star back to dash at the third nested depth', () => {
            const listText = '- item 1\n    + item 2\n        * item 3\n        * ';
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const tabHandler = keybindings.find(kb => kb.key === 'Tab');
            const result = tabHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('            - ');
        });

        it('should use the bullet marker for the resulting shallower depth when outdenting', () => {
            const listText = '- item 1\n    + item 2\n        * ';
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const shiftTabHandler = keybindings.find(kb => kb.key === 'Shift-Tab');
            const result = shiftTabHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('    + ');
        });

        it('should return plus markers to dash when outdenting to top level', () => {
            const listText = '- item 1\n    + ';
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const shiftTabHandler = keybindings.find(kb => kb.key === 'Shift-Tab');
            const result = shiftTabHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('- ');
        });

        it('should preserve the current unordered marker when marker cycling is disabled', () => {
            mockSettings.enableUnorderedListMarkerCycling = false;
            keybindings = createListAutocompletionKeymap(mockSettings);
            const listText = '- item 1\n- ';
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const tabHandler = keybindings.find(kb => kb.key === 'Tab');
            const result = tabHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('    - ');
        });

        it('should read current marker cycling settings from a settings provider', () => {
            let currentSettings = {
                ...mockSettings,
                enableUnorderedListMarkerCycling: true
            };
            keybindings = createListAutocompletionKeymap(() => currentSettings);
            currentSettings = {
                ...currentSettings,
                enableUnorderedListMarkerCycling: false
            };
            const listText = '- item 1\n- ';
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const tabHandler = keybindings.find(kb => kb.key === 'Tab');
            const result = tabHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('    - ');
        });

        it('should preserve the current unordered marker when marker cycling is disabled during outdent', () => {
            mockSettings.enableUnorderedListMarkerCycling = false;
            keybindings = createListAutocompletionKeymap(mockSettings);
            const listText = '+ item 1\n    + ';
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const shiftTabHandler = keybindings.find(kb => kb.key === 'Shift-Tab');
            const result = shiftTabHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('+ ');
        });
    });

    describe('Tab key handling for ordered lists', () => {
        it('should use ordered marker styles for the resulting nested depth when indenting', () => {
            mockSettings.orderedListMarkerOrder = [
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
            ];
            keybindings = createListAutocompletionKeymap(mockSettings);
            const listText = '1. item 1\n1. ';
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const tabHandler = keybindings.find(kb => kb.key === 'Tab');
            const result = tabHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('    a. ');
        });

        it('should switch ordered marker styles using the configured order', () => {
            mockSettings.orderedListMarkerOrder = [
                'decimal-period',
                'upper-alpha-period',
                'upper-roman-period'
            ];
            keybindings = createListAutocompletionKeymap(mockSettings);
            const listText = '1. item 1\n1. ';
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const tabHandler = keybindings.find(kb => kb.key === 'Tab');
            const result = tabHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('    A. ');
        });

        it('should preserve ordered marker styles when ordered marker cycling is disabled', () => {
            mockSettings.enableOrderedListMarkerCycling = false;
            keybindings = createListAutocompletionKeymap(mockSettings);
            const listText = '1. item 1\n1. ';
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const tabHandler = keybindings.find(kb => kb.key === 'Tab');
            const result = tabHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('    1. ');
        });

        it('should restore ordered marker styles for the resulting shallower depth when outdenting', () => {
            mockSettings.orderedListMarkerOrder = [
                'decimal-period',
                'lower-alpha-period',
                'lower-roman-period'
            ];
            keybindings = createListAutocompletionKeymap(mockSettings);
            const listText = '1. item 1\n    a. ';
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const shiftTabHandler = keybindings.find(kb => kb.key === 'Shift-Tab');
            const result = shiftTabHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('1. ');
        });

        it('should include right-parenthesis ordered marker variants in the configured order', () => {
            mockSettings.orderedListMarkerOrder = [
                'decimal-period',
                'decimal-one-paren',
                'upper-alpha-one-paren'
            ];
            keybindings = createListAutocompletionKeymap(mockSettings);
            const listText = '1. item 1\n1. ';
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const tabHandler = keybindings.find(kb => kb.key === 'Tab');
            const result = tabHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('    1) ');
        });
    });

    describe('Enter key handling for empty unordered list items', () => {
        it('should outdent an empty plus item to a top-level dash item', () => {
            const listText = '- item 1\n    + ';
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const enterHandler = keybindings.find(kb => kb.key === 'Enter');
            const result = enterHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('- ');
        });

        it('should outdent an empty star item to a plus item', () => {
            const listText = '- item 1\n    + item 2\n        * ';
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const enterHandler = keybindings.find(kb => kb.key === 'Enter');
            const result = enterHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('    + ');
        });

        it('should remove an empty top-level unordered marker', () => {
            const listText = '- item 1\n- ';
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const enterHandler = keybindings.find(kb => kb.key === 'Enter');
            const result = enterHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('');
        });

        it('should preserve the current unordered marker when marker cycling is disabled during empty-item outdent', () => {
            mockSettings.enableUnorderedListMarkerCycling = false;
            keybindings = createListAutocompletionKeymap(mockSettings);
            const listText = '+ item 1\n    + ';
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const enterHandler = keybindings.find(kb => kb.key === 'Enter');
            const result = enterHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('+ ');
        });
    });
});
