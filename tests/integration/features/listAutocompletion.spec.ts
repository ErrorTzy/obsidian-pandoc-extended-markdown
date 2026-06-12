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
            enableFancyLists: true,
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
    
    function createMockView(doc: string, cursorPos: number): EditorView {
        const state = EditorState.create({
            doc: doc,
            selection: EditorSelection.cursor(cursorPos)
        });
        
        const mockView = {
            state,
            dispatch: jest.fn((transaction) => {
                // Mock dispatch to capture the transaction
                const oldDoc = mockView.state.doc.toString();
                const objectChange = transaction?.changes &&
                    !Array.isArray(transaction.changes) &&
                    transaction.changes.from !== undefined;
                if (objectChange) {
                    transaction.__oldDoc = oldDoc;
                    transaction.__newDoc = oldDoc.slice(0, transaction.changes.from) +
                        transaction.changes.insert +
                        oldDoc.slice(transaction.changes.to);
                }
                mockView.lastTransaction = transaction;
            }),
            lastTransaction: null
        } as any;
        
        return mockView;
    }
    
    function getChangesFromTransaction(transaction: any): { from: number, to: number, insert: string } | null {
        if (!transaction || !transaction.changes) return null;

        const oldDoc = transaction.__oldDoc ?? transaction.startState?.doc?.toString?.();
        const newDoc = transaction.__newDoc ?? transaction.newDoc?.toString?.();
        if (typeof oldDoc === 'string' && typeof newDoc === 'string') {
            return getMinimalTextChange(oldDoc, newDoc);
        }
        
        // Handle different transaction formats
        if (Array.isArray(transaction.changes)) {
            return transaction.changes[0];
        } else if (transaction.changes.from !== undefined) {
            return transaction.changes;
        }
        return null;
    }

    function getMinimalTextChange(oldDoc: string, newDoc: string): { from: number, to: number, insert: string } {
        const lineChange = getMinimalLineChange(oldDoc, newDoc);
        if (lineChange) {
            return lineChange;
        }

        let start = 0;
        while (
            start < oldDoc.length &&
            start < newDoc.length &&
            oldDoc[start] === newDoc[start]
        ) {
            start++;
        }

        let oldEnd = oldDoc.length;
        let newEnd = newDoc.length;
        while (
            oldEnd > start &&
            newEnd > start &&
            oldDoc[oldEnd - 1] === newDoc[newEnd - 1]
        ) {
            oldEnd--;
            newEnd--;
        }

        return {
            from: start,
            to: oldEnd,
            insert: newDoc.slice(start, newEnd)
        };
    }

    function getMinimalLineChange(oldDoc: string, newDoc: string): { from: number, to: number, insert: string } | null {
        const oldLines = oldDoc.split('\n');
        const newLines = newDoc.split('\n');
        let startLine = 0;

        while (
            startLine < oldLines.length &&
            startLine < newLines.length &&
            oldLines[startLine] === newLines[startLine]
        ) {
            startLine++;
        }

        let oldEndLine = oldLines.length;
        let newEndLine = newLines.length;
        while (
            oldEndLine > startLine &&
            newEndLine > startLine &&
            oldLines[oldEndLine - 1] === newLines[newEndLine - 1]
        ) {
            oldEndLine--;
            newEndLine--;
        }

        if (startLine === oldEndLine && startLine === newEndLine) {
            return null;
        }

        return {
            from: getLineOffset(oldLines, startLine),
            to: getLineOffset(oldLines, oldEndLine),
            insert: newLines.slice(startLine, newEndLine).join('\n')
        };
    }

    function getLineOffset(lines: string[], lineIndex: number): number {
        let offset = 0;
        for (let index = 0; index < lineIndex; index++) {
            offset += lines[index].length + 1;
        }

        return offset;
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
            expect(changes!.insert).toMatch(/\(@\)/);
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
            expect(changes!.insert).toMatch(/\(@\)/);
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
            expect(changes!.insert).toMatch(/\(@\)/);
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
            expect(changes!.insert).toMatch(/\(@\)/);
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
            expect(changes!.insert).toMatch(/\(@\)/);
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
            expect(changes!.insert).toMatch(/#\./);
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
            expect(changes!.insert).toMatch(/B\./);
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

        it('should use configured unordered marker order when indenting', () => {
            mockSettings.unorderedListMarkerOrder = ['*', '-', '+'];
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

        it('should return nested plus markers to a top-level plus parent with Shift+Tab', () => {
            const listText = '+ item 1\n+ item 2\n    + ';
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

        it('should derive nested ordered markers from the surrounding alpha context', () => {
            const listText = 'a. item\nb. ';
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const tabHandler = keybindings.find(kb => kb.key === 'Tab');
            const result = tabHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('    ii. ');
        });

        it('should use configured ordered context when nesting an alpha list', () => {
            mockSettings.orderedListMarkerOrder = [
                'lower-alpha-period',
                'decimal-period',
                'upper-alpha-period'
            ];
            keybindings = createListAutocompletionKeymap(mockSettings);
            const listText = 'a. item\nb. ';
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const tabHandler = keybindings.find(kb => kb.key === 'Tab');
            const result = tabHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('    2. ');
        });

        it('should resolve outdented decimal items to the alpha parent context', () => {
            const listText = 'a. parent\n    1. child';
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const shiftTabHandler = keybindings.find(kb => kb.key === 'Shift-Tab');
            const result = shiftTabHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('a. child');
        });

        it('should wrap upper-roman parenthesis markers to decimal-period bridge children', () => {
            const listText = 'I) parent\nII) ';
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const tabHandler = keybindings.find(kb => kb.key === 'Tab');
            const result = tabHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('    2. ');
        });

        it('should move upper-roman period markers to decimal-parenthesis children', () => {
            const listText = 'I. parent\nII. ';
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const tabHandler = keybindings.find(kb => kb.key === 'Tab');
            const result = tabHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('    2) ');
        });

        it('should restore upper-roman parenthesis style when outdenting bridge decimal children', () => {
            const listText = 'I) parent\n    1. child';
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const shiftTabHandler = keybindings.find(kb => kb.key === 'Shift-Tab');
            const result = shiftTabHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('I) child');
        });

        it('should preserve upper-roman parenthesis markers when ordered cycling is disabled', () => {
            mockSettings.enableOrderedListMarkerCycling = false;
            keybindings = createListAutocompletionKeymap(mockSettings);
            const listText = 'I) parent\nII) ';
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const tabHandler = keybindings.find(kb => kb.key === 'Tab');
            const result = tabHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('    II) ');
        });

        it('should move only the ordered owner when indenting without selecting its child', () => {
            const doc = [
                'a. parent',
                '    1. child',
                'b. sibling'
            ].join('\n');
            const cursorPos = 'a. '.length;
            const view = createMockView(doc, cursorPos);

            const tabHandler = keybindings.find(kb => kb.key === 'Tab');
            const result = tabHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('    1. parent');
        });

        it('should reuse a same-chunk ordered-to-unordered child marker override when indenting', () => {
            const listText = [
                'a. parent',
                'b. parent',
                '    - child',
                '    - child',
                'c. parent',
                'd. '
            ].join('\n');
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

        it('should return an empty unordered child to the ordered parent marker with Shift+Tab', () => {
            const listText = 'a. parent\nb. parent\n    - child\n    - ';
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const shiftTabHandler = keybindings.find(kb => kb.key === 'Shift-Tab');
            const result = shiftTabHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('c. ');
        });
    });

    describe('Enter key handling for ordered lists', () => {
        it('should continue decimal child lists inside fancy ordered parents', () => {
            const doc = 'a. parent\n    1. child';
            const cursorPos = doc.length - 1;
            const view = createMockView(doc, cursorPos);

            const enterHandler = keybindings.find(kb => kb.key === 'Enter');
            const result = enterHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('    2. ');
        });

        it('should continue bridge decimal children inside upper-roman parenthesis parents', () => {
            const doc = 'I) parent\n    1. child';
            const cursorPos = doc.length - 1;
            const view = createMockView(doc, cursorPos);

            const enterHandler = keybindings.find(kb => kb.key === 'Enter');
            const result = enterHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('    2. ');
        });
    });

    describe('Enter key handling for empty unordered list items', () => {
        it('should outdent an empty bridge decimal marker to the parent list context', () => {
            const listText = 'I) parent\n    1. child\n    2. ';
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const enterHandler = keybindings.find(kb => kb.key === 'Enter');
            const result = enterHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('II) ');
        });

        it('should outdent an empty ordered grandchild to its unordered parent with Enter', () => {
            const listText = [
                'a. parent',
                'b. parent',
                '    - child',
                '        i. grandchild',
                '        ii. grandchild',
                '        iii. '
            ].join('\n');
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const enterHandler = keybindings.find(kb => kb.key === 'Enter');
            const result = enterHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('    - ');
        });

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

        it('should use configured unordered marker order when outdenting an empty item', () => {
            mockSettings.unorderedListMarkerOrder = ['*', '-', '+'];
            keybindings = createListAutocompletionKeymap(mockSettings);
            const listText = '* item 1\n    - item 2\n        + ';
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const enterHandler = keybindings.find(kb => kb.key === 'Enter');
            const result = enterHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('    - ');
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

    describe('Shift+Tab handling for empty ordered list items', () => {
        it('should outdent an empty ordered grandchild to its unordered parent marker', () => {
            const listText = [
                'a. parent',
                'b. parent',
                '    - child',
                '        i. grandchild',
                '        ii. grandchild',
                '        iii. '
            ].join('\n');
            const doc = `${listText}\nnext`;
            const cursorPos = listText.length;
            const view = createMockView(doc, cursorPos);

            const shiftTabHandler = keybindings.find(kb => kb.key === 'Shift-Tab');
            const result = shiftTabHandler.run(view);

            expect(result).toBe(true);
            expect(view.dispatch).toHaveBeenCalled();

            const changes = getChangesFromTransaction(view.lastTransaction);
            expect(changes).toBeDefined();
            expect(changes!.insert).toBe('    - ');
        });
    });
});
