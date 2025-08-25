import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { CustomLabelReferenceProcessor } from '../../../src/live-preview/pipeline/inline/CustomLabelReferenceProcessor';
import { PlaceholderContext } from '../../../src/shared/utils/placeholderProcessor';
import { ProcessingContext, ContentRegion } from '../../../src/live-preview/pipeline/types';

describe('CustomLabelReferenceProcessor - Reference Validation', () => {
    let processor: CustomLabelReferenceProcessor;
    let view: EditorView;
    let placeholderContext: PlaceholderContext;

    beforeEach(() => {
        processor = new CustomLabelReferenceProcessor();
        
        // Create mock view
        const container = document.createElement('div');
        document.body.appendChild(container);
        
        view = new EditorView({
            state: EditorState.create({ doc: 'Test line' }),
            parent: container
        });
        
        // Create a placeholder context
        placeholderContext = new PlaceholderContext();
    });
    
    afterEach(() => {
        if (view && typeof view.destroy === 'function') {
            view.destroy();
        }
    });

    describe('Reference validation with placeholders', () => {
        it('should treat invalid reference {::Q} as plain text when Q is not defined', () => {
            const text = 'This is an invalid reference: {::Q}';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            const context: ProcessingContext = {
                document: view.state.doc,
                view: view,
                settings: { moreExtendedSyntax: true } as any,
                customLabels: new Map(),
                rawToProcessed: new Map(),
                placeholderContext: placeholderContext,
                contentRegions: [],
                structuralDecorations: [],
                inlineDecorations: [],
                hashCounter: { value: 1 },
                definitionState: { lastWasItem: false, pendingBlankLine: false }
            };
            
            const matches = processor.findMatches(text, region, context);
            
            // Should NOT find any matches for invalid references
            expect(matches.length).toBe(0);
        });

        it('should treat {::(#a),(#b)} as valid when both placeholders have been defined', () => {
            const text = 'This is a valid reference: {::(#a),(#b)}';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            // Setup: Define custom labels with placeholders (#a) and (#b)
            placeholderContext.processLabel('P(#a)'); // This assigns #a = 1
            placeholderContext.processLabel('P(#b)'); // This assigns #b = 2
            
            const context: ProcessingContext = {
                document: view.state.doc,
                view: view,
                settings: { moreExtendedSyntax: true } as any,
                customLabels: new Map([
                    ['P1', 'Content for P1'],
                    ['P2', 'Content for P2']
                ]),
                rawToProcessed: new Map([
                    ['P(#a)', 'P1'],
                    ['P(#b)', 'P2']
                ]),
                placeholderContext: placeholderContext,
                contentRegions: [],
                structuralDecorations: [],
                inlineDecorations: [],
                hashCounter: { value: 1 },
                definitionState: { lastWasItem: false, pendingBlankLine: false }
            };
            
            const matches = processor.findMatches(text, region, context);
            
            expect(matches.length).toBe(1);
            expect(matches[0].data.rawLabel).toBe('(#a),(#b)');
            
            const decoration = processor.createDecoration(matches[0], context);
            const widget = (decoration as any).spec?.widget || (decoration as any).value?.spec?.widget;
            
            // Valid reference should have a widget with processed label
            expect(widget).toBeDefined();
            // The reference should be processed to "1,2"
            expect(widget.label).toBe('1,2');
        });
        
        it('should treat {::(#c),(#d)} as invalid when placeholders have NOT been defined', () => {
            const text = 'This is an invalid reference: {::(#c),(#d)}';
            const region: ContentRegion = {
                from: 0,
                to: text.length,
                type: 'normal'
            };
            
            // Setup: Only define (#a) and (#b), not (#c) and (#d)
            placeholderContext.processLabel('P(#a)'); // This assigns #a = 1
            placeholderContext.processLabel('P(#b)'); // This assigns #b = 2
            
            const context: ProcessingContext = {
                document: view.state.doc,
                view: view,
                settings: { moreExtendedSyntax: true } as any,
                customLabels: new Map([
                    ['P1', 'Content for P1'],
                    ['P2', 'Content for P2']
                ]),
                rawToProcessed: new Map([
                    ['P(#a)', 'P1'],
                    ['P(#b)', 'P2']
                ]),
                placeholderContext: placeholderContext,
                contentRegions: [],
                structuralDecorations: [],
                inlineDecorations: [],
                hashCounter: { value: 1 },
                definitionState: { lastWasItem: false, pendingBlankLine: false }
            };
            
            const matches = processor.findMatches(text, region, context);
            
            // Should NOT find any matches for invalid placeholder references
            expect(matches.length).toBe(0);
        });
    });
    
    describe('Full integration test', () => {
        it('should correctly handle mixed valid and invalid references', () => {
            // Setup document with custom labels
            const docLines = [
                '{::P(#a)} First item',
                '{::P(#b)} Second item',
                '',
                'Valid ref: {::(#a),(#b)}',
                'Invalid ref: {::Q}',
                'Invalid placeholder ref: {::(#c),(#d)}'
            ];
            
            // Process labels first to setup context
            placeholderContext.processLabel('P(#a)'); // #a = 1
            placeholderContext.processLabel('P(#b)'); // #b = 2
            
            const context: ProcessingContext = {
                document: view.state.doc,
                view: view,
                settings: { moreExtendedSyntax: true } as any,
                customLabels: new Map([
                    ['P1', 'First item'],
                    ['P2', 'Second item']
                ]),
                rawToProcessed: new Map([
                    ['P(#a)', 'P1'],
                    ['P(#b)', 'P2']
                ]),
                placeholderContext: placeholderContext,
                contentRegions: [],
                structuralDecorations: [],
                inlineDecorations: [],
                hashCounter: { value: 1 },
                definitionState: { lastWasItem: false, pendingBlankLine: false }
            };
            
            // Test line 4: Valid reference
            const validLine = docLines[3];
            const validRegion: ContentRegion = { from: 0, to: validLine.length, type: 'normal' };
            const validMatches = processor.findMatches(validLine, validRegion, context);
            
            expect(validMatches.length).toBe(1);
            const validDecoration = processor.createDecoration(validMatches[0], context);
            const validWidget = (validDecoration as any).spec?.widget || (validDecoration as any).value?.spec?.widget;
            expect(validWidget).toBeDefined();
            expect(validWidget.label).toBe('1,2');
            
            // Test line 5: Invalid reference (undefined label)
            const invalidLine = docLines[4];
            const invalidRegion: ContentRegion = { from: 0, to: invalidLine.length, type: 'normal' };
            const invalidMatches = processor.findMatches(invalidLine, invalidRegion, context);
            
            // Should NOT find matches for invalid references
            expect(invalidMatches.length).toBe(0);
            
            // Test line 6: Invalid placeholder reference
            const invalidPlaceholderLine = docLines[5];
            const invalidPlaceholderRegion: ContentRegion = { from: 0, to: invalidPlaceholderLine.length, type: 'normal' };
            const invalidPlaceholderMatches = processor.findMatches(invalidPlaceholderLine, invalidPlaceholderRegion, context);
            
            // Should NOT find matches for invalid placeholder references
            expect(invalidPlaceholderMatches.length).toBe(0);
        });
    });
});