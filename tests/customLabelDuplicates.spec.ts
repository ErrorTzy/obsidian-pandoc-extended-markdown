import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { scanCustomLabels } from '../src/decorations/scanners/customLabelScanner';
import { processCustomLabelList } from '../src/decorations/processors/customLabelProcessor';
import { PandocExtendedMarkdownSettings } from '../src/settings';
import { PlaceholderContext } from '../src/utils/placeholderProcessor';
import { DuplicateCustomLabelWidget } from '../src/decorations/widgets/customLabelWidget';

describe('Custom Label Duplicate Detection', () => {
    let state: EditorState;
    let view: EditorView;
    let settings: PandocExtendedMarkdownSettings;

    beforeEach(() => {
        settings = {
            moreExtendedSyntax: true,
            strictPandocMode: false,
            autoRenumberLists: false,
            definitionTermsBold: false,
            definitionTermsUnderlined: false
        };
    });

    describe('scanCustomLabels', () => {
        it('should detect duplicate custom labels', () => {
            const content = `{::P(#a)} First point
{::P(#a)} Duplicate label
{::P(#b)} Second point
{::P(#a)'} Not duplicate`;

            state = EditorState.create({
                doc: content
            });

            const result = scanCustomLabels(state.doc, settings);

            // Check that duplicates are detected
            expect(result.duplicateLabels.has('P1')).toBe(true);
            expect(result.duplicateLabels.has('P2')).toBe(false);
            expect(result.duplicateLabels.has("P1'")).toBe(false);
        });

        it('should track first occurrence line and content for duplicates', () => {
            const content = `{::P(#a)} First point
{::P(#a)} Duplicate label
{::P(#a)} Another duplicate`;

            state = EditorState.create({
                doc: content
            });

            const result = scanCustomLabels(state.doc, settings);

            // Should have duplicate info for P1
            expect(result.duplicateLabels.has('P1')).toBe(true);
            
            // The scanner should provide information about which label is a duplicate
            // This will need to be added to the scanner interface
            expect(result.duplicateLineInfo).toBeDefined();
            expect(result.duplicateLineInfo?.get('P1')).toEqual({
                firstLine: 1,
                firstContent: 'First point'
            });
        });
    });

    describe('processCustomLabelList with duplicates', () => {
        it('should render duplicate custom labels with warning style', () => {
            const content = `{::P(#a)} First point
{::P(#a)} Duplicate label`;

            state = EditorState.create({
                doc: content
            });

            // Create a mock view
            view = new EditorView({
                state,
                parent: document.body
            });

            const scanResult = scanCustomLabels(state.doc, settings);
            
            // Process the second line (duplicate)
            const line = state.doc.line(2);
            
            const context = {
                line,
                lineNum: 2,
                lineText: line.text,
                cursorPos: -1,
                view,
                invalidListBlocks: new Set<number>(),
                settings,
                customLabels: scanResult.customLabels,
                rawToProcessed: scanResult.rawToProcessed,
                duplicateLabels: scanResult.duplicateLabels,
                duplicateLineInfo: scanResult.duplicateLineInfo,
                placeholderContext: scanResult.placeholderContext
            };

            const decorations = processCustomLabelList(context);

            // Should have decorations
            expect(decorations).not.toBeNull();
            expect(decorations?.length).toBeGreaterThan(0);

            // Should have a duplicate widget decoration
            // Check by widget properties since instanceof doesn't work well with mocks
            const duplicateDecoration = decorations?.find(d => {
                const widget = d.decoration.spec?.widget;
                // DuplicateCustomLabelWidget has rawLabel, originalLine, and originalLineContent properties
                return widget && 
                       'rawLabel' in widget && 
                       'originalLine' in widget && 
                       'originalLineContent' in widget;
            });
            expect(duplicateDecoration).toBeDefined();
        });

        it('should not render duplicate warning for first occurrence', () => {
            const content = `{::P(#a)} First point
{::P(#a)} Duplicate label`;

            state = EditorState.create({
                doc: content
            });

            view = new EditorView({
                state,
                parent: document.body
            });

            const scanResult = scanCustomLabels(state.doc, settings);
            
            // Process the first line (original)
            const line = state.doc.line(1);
            const context = {
                line,
                lineNum: 1,
                lineText: line.text,
                cursorPos: -1,
                view,
                invalidListBlocks: new Set<number>(),
                settings,
                customLabels: scanResult.customLabels,
                rawToProcessed: scanResult.rawToProcessed,
                duplicateLabels: scanResult.duplicateLabels,
                duplicateLineInfo: scanResult.duplicateLineInfo,
                placeholderContext: scanResult.placeholderContext
            };

            const decorations = processCustomLabelList(context);

            // Should have decorations but not duplicate widget
            expect(decorations).not.toBeNull();
            const duplicateDecoration = decorations?.find(d => 
                d.decoration.spec.widget?.constructor.name === 'DuplicateCustomLabelWidget'
            );
            expect(duplicateDecoration).toBeUndefined();
        });
    });
});