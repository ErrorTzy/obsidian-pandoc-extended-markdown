import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { 
    CustomLabelMarkerWidget,
    CustomLabelPartialWidget,
    CustomLabelPlaceholderWidget,
    CustomLabelProcessedWidget
} from '../src/decorations/widgets/customLabelWidget';
import { processCustomLabelList } from '../src/decorations/processors/customLabelProcessor';
import { PlaceholderContext } from '../src/utils/placeholderProcessor';

describe('Custom Label Nested Widget Behavior', () => {
    let view: EditorView;
    let placeholderContext: PlaceholderContext;

    beforeEach(() => {
        // Create a mock EditorView
        const state = EditorState.create({
            doc: '{::P(#good)\'} This is a test'
        });
        
        view = new EditorView({
            state,
            parent: document.body
        });

        // Setup placeholder context
        placeholderContext = new PlaceholderContext();
        placeholderContext.processLabel('P(#good)\'');
    });

    describe('processCustomLabelList', () => {
        it('should render full widget when cursor is outside marker', () => {
            const context = {
                line: { from: 0, to: 29, text: '{::P(#good)\'} This is a test' },
                lineNum: 1,
                lineText: '{::P(#good)\'} This is a test',
                cursorPos: 20, // Cursor in content part
                view,
                invalidListBlocks: new Set<number>(),
                settings: { moreExtendedSyntax: true, strictPandocMode: false },
                customLabels: new Map(),
                rawToProcessed: new Map([['P(#good)\'', 'P1\'']]),
                placeholderContext
            };

            const decorations = processCustomLabelList(context);
            
            expect(decorations).not.toBeNull();
            expect(decorations!.length).toBeGreaterThan(0);
            
            // Should have a full replacement widget
            const replaceDecoration = decorations!.find(d => 
                d.decoration.spec.widget instanceof CustomLabelMarkerWidget
            );
            expect(replaceDecoration).toBeDefined();
        });

        it('should render processed form when cursor is in marker but not on placeholder', () => {
            const context = {
                line: { from: 0, to: 29, text: '{::P(#good)\'} This is a test' },
                lineNum: 1,
                lineText: '{::P(#good)\'} This is a test',
                cursorPos: 2, // Cursor on :: part
                view,
                invalidListBlocks: new Set<number>(),
                settings: { moreExtendedSyntax: true, strictPandocMode: false },
                customLabels: new Map(),
                rawToProcessed: new Map([['P(#good)\'', 'P1\'']]),
                placeholderContext
            };

            const decorations = processCustomLabelList(context);
            
            expect(decorations).not.toBeNull();
            
            // Should have inline number widgets for placeholders
            const inlineNumberWidgets = decorations!.filter(d => 
                d.decoration.spec.widget?.constructor.name === 'CustomLabelInlineNumberWidget'
            );
            expect(inlineNumberWidgets.length).toBeGreaterThan(0);
        });

        it('should show raw text when cursor is on placeholder', () => {
            const context = {
                line: { from: 0, to: 29, text: '{::P(#good)\'} This is a test' },
                lineNum: 1, 
                lineText: '{::P(#good)\'} This is a test',
                cursorPos: 6, // Cursor on (#good) part
                view,
                invalidListBlocks: new Set<number>(),
                settings: { moreExtendedSyntax: true, strictPandocMode: false },
                customLabels: new Map(),
                rawToProcessed: new Map([['P(#good)\'', 'P1\'']]),
                placeholderContext
            };

            const decorations = processCustomLabelList(context);
            
            expect(decorations).not.toBeNull();
            
            // Should not have any replacement widgets when cursor is on placeholder
            const replacementWidgets = decorations!.filter(d => 
                d.decoration.spec.widget !== undefined
            );
            
            // Only line decorations should be present
            expect(replacementWidgets.length).toBe(0);
        });

        it('should handle multiple placeholders correctly', () => {
            const multiPlaceholderContext = new PlaceholderContext();
            multiPlaceholderContext.processLabel('Ex(#a)(#b)');
            
            const context = {
                line: { from: 0, to: 25, text: '{::Ex(#a)(#b)} Test text' },
                lineNum: 1,
                lineText: '{::Ex(#a)(#b)} Test text',
                cursorPos: 3, // Cursor after ::
                view,
                invalidListBlocks: new Set<number>(),
                settings: { moreExtendedSyntax: true, strictPandocMode: false },
                customLabels: new Map(),
                rawToProcessed: new Map([['Ex(#a)(#b)', 'Ex12']]),
                placeholderContext: multiPlaceholderContext
            };

            const decorations = processCustomLabelList(context);
            
            expect(decorations).not.toBeNull();
            
            // Should have inline number widgets for multiple placeholders
            const inlineNumberWidgets = decorations!.filter(d => 
                d.decoration.spec.widget?.constructor.name === 'CustomLabelInlineNumberWidget'
            );
            expect(inlineNumberWidgets.length).toBe(2);
        });

        it('should selectively expand only the placeholder under cursor', () => {
            const multiPlaceholderContext = new PlaceholderContext();
            multiPlaceholderContext.processLabel('(#good)+(#bad)\'');
            
            const context = {
                line: { from: 0, to: 31, text: '{::(#good)+(#bad)\'} Test text' },
                lineNum: 1,
                lineText: '{::(#good)+(#bad)\'} Test text',
                cursorPos: 6, // Cursor on first placeholder (#good)
                view,
                invalidListBlocks: new Set<number>(),
                settings: { moreExtendedSyntax: true, strictPandocMode: false },
                customLabels: new Map(),
                rawToProcessed: new Map([['(#good)+(#bad)\'', '1+2\'']]),
                placeholderContext: multiPlaceholderContext
            };

            const decorations = processCustomLabelList(context);
            
            expect(decorations).not.toBeNull();
            
            // Should have only one inline number widget (for the second placeholder)
            const inlineNumberWidgets = decorations!.filter(d => 
                d.decoration.spec.widget?.constructor.name === 'CustomLabelInlineNumberWidget'
            );
            expect(inlineNumberWidgets.length).toBe(1); // Only second placeholder replaced
            
            // The widget should be for the second placeholder
            const widgetDecoration = inlineNumberWidgets[0];
            expect(widgetDecoration.from).toBeGreaterThan(10); // After first placeholder
        });
    });

    describe('Widget Classes', () => {
        it('CustomLabelPlaceholderWidget should render with correct class', () => {
            const widget = new CustomLabelPlaceholderWidget('1', view);
            const dom = widget.toDOM();
            
            expect(dom.textContent).toBe('1');
            expect(dom.className).toBe('pandoc-custom-label-placeholder');
        });

        it('CustomLabelPartialWidget should render with correct formatting', () => {
            const widget = new CustomLabelPartialWidget('(', view);
            const dom = widget.toDOM();
            
            expect(dom.textContent).toBe('(');
            expect(dom.className).toContain('cm-formatting');
            expect(dom.className).toContain('pandoc-list-marker');
        });
    });
});