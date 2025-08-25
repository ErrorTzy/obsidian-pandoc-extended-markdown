import { Editor, EditorPosition, TFile } from 'obsidian';
import { PandocExtendedMarkdownPlugin } from '../src/core/main';
import { CustomLabelReferenceSuggest } from '../src/editor-extensions/suggestions/customLabelReferenceSuggest';

// Mock the Obsidian objects
const mockApp = {} as any;

describe('Custom Label Reference Suggestions', () => {
    let plugin: PandocExtendedMarkdownPlugin;
    let suggest: CustomLabelReferenceSuggest;
    let mockEditor: Editor;
    
    beforeEach(() => {
        plugin = {
            app: mockApp,
            settings: {
                moreExtendedSyntax: true
            }
        } as any;
        
        suggest = new CustomLabelReferenceSuggest(plugin);
        
        mockEditor = {
            getValue: jest.fn(),
            getLine: jest.fn(),
            replaceRange: jest.fn(),
            setCursor: jest.fn()
        } as any;
    });
    
    describe('onTrigger', () => {
        it('should trigger when cursor is after {::', () => {
            const cursor: EditorPosition = { line: 0, ch: 3 };
            mockEditor.getLine = jest.fn().mockReturnValue('{::');
            
            const result = suggest.onTrigger(cursor, mockEditor, null);
            
            expect(result).toBeTruthy();
            expect(result?.start).toEqual({ line: 0, ch: 0 });
            expect(result?.end).toEqual(cursor);
            expect(result?.query).toBe('');
        });
        
        it('should trigger with partial label query', () => {
            const cursor: EditorPosition = { line: 0, ch: 5 };
            mockEditor.getLine = jest.fn().mockReturnValue('{::PR');
            
            const result = suggest.onTrigger(cursor, mockEditor, null);
            
            expect(result).toBeTruthy();
            expect(result?.query).toBe('PR');
        });
        
        it('should not trigger when closing brace is present', () => {
            const cursor: EditorPosition = { line: 0, ch: 6 };
            mockEditor.getLine = jest.fn().mockReturnValue('{::P} ');
            
            const result = suggest.onTrigger(cursor, mockEditor, null);
            
            expect(result).toBeNull();
        });
        
        it('should not trigger without {::', () => {
            const cursor: EditorPosition = { line: 0, ch: 3 };
            mockEditor.getLine = jest.fn().mockReturnValue('foo');
            
            const result = suggest.onTrigger(cursor, mockEditor, null);
            
            expect(result).toBeNull();
        });
    });
    
    describe('getSuggestions', () => {
        it('should return all custom labels when no query', () => {
            const doc = `{::P} All humans are mortal.
{::Q} Socrates is human.
{::Result} Therefore, Socrates is mortal.`;
            
            mockEditor.getValue = jest.fn().mockReturnValue(doc);
            
            const context = {
                editor: mockEditor,
                query: ''
            } as any;
            
            const suggestions = suggest.getSuggestions(context);
            
            expect(suggestions).toHaveLength(3);
            expect(suggestions.map(s => s.label)).toContain('P');
            expect(suggestions.map(s => s.label)).toContain('Q');
            expect(suggestions.map(s => s.label)).toContain('Result');
        });
        
        it('should filter suggestions by query', () => {
            const doc = `{::P} All humans are mortal.
{::Q} Socrates is human.
{::Premise1} First premise.
{::Premise2} Second premise.`;
            
            mockEditor.getValue = jest.fn().mockReturnValue(doc);
            
            const context = {
                editor: mockEditor,
                query: 'Pre'
            } as any;
            
            const suggestions = suggest.getSuggestions(context);
            
            expect(suggestions).toHaveLength(2);
            expect(suggestions.map(s => s.label)).toContain('Premise1');
            expect(suggestions.map(s => s.label)).toContain('Premise2');
        });
        
        it('should include preview text in suggestions', () => {
            const doc = `{::P} All humans are mortal.`;
            
            mockEditor.getValue = jest.fn().mockReturnValue(doc);
            
            const context = {
                editor: mockEditor,
                query: ''
            } as any;
            
            const suggestions = suggest.getSuggestions(context);
            
            expect(suggestions[0].previewText).toBe('All humans are mortal.');
        });
        
        it('should truncate long preview text', () => {
            const longText = 'This is a very long text that should be truncated after 30 characters for the preview';
            const doc = `{::LongLabel} ${longText}`;
            
            mockEditor.getValue = jest.fn().mockReturnValue(doc);
            
            const context = {
                editor: mockEditor,
                query: ''
            } as any;
            
            const suggestions = suggest.getSuggestions(context);
            
            expect(suggestions[0].previewText).toBe('This is a very long text that ...');
        });
    });
    
    describe('selectSuggestion', () => {
        it('should replace partial input with complete custom label reference', () => {
            const suggestion = { label: 'P', previewText: 'All humans are mortal.' };
            const start = { line: 0, ch: 0 };
            const end = { line: 0, ch: 5 };
            
            suggest.context = {
                editor: mockEditor,
                start,
                end
            } as any;
            
            mockEditor.getLine = jest.fn().mockReturnValue('{::P ');
            
            suggest.selectSuggestion(suggestion, {} as any);
            
            expect(mockEditor.replaceRange).toHaveBeenCalledWith('{::P}', start, end);
            expect(mockEditor.setCursor).toHaveBeenCalledWith({ line: 0, ch: 5 });
        });
        
        it('should not add duplicate closing brace if already present', () => {
            const suggestion = { label: 'P', previewText: 'All humans are mortal.' };
            const start = { line: 0, ch: 0 };
            const end = { line: 0, ch: 3 };
            
            suggest.context = {
                editor: mockEditor,
                start,
                end
            } as any;
            
            mockEditor.getLine = jest.fn().mockReturnValue('{::} some text');
            
            suggest.selectSuggestion(suggestion, {} as any);
            
            expect(mockEditor.replaceRange).toHaveBeenCalledWith('{::P', start, end);
            expect(mockEditor.setCursor).toHaveBeenCalledWith({ line: 0, ch: 5 }); // After the existing }
        });
    });
});