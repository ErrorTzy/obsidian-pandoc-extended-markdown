import { Text } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { ProcessingPipeline } from '../../../../src/live-preview/pipeline/ProcessingPipeline';
import { FancyListProcessor } from '../../../../src/live-preview/pipeline/structural/FancyListProcessor';
import { ListContinuationProcessor } from '../../../../src/live-preview/pipeline/structural/ListContinuationProcessor';
import { DEFAULT_SETTINGS } from '../../../../src/core/settings';
import { PandocExtendedMarkdownSettings } from '../../../../src/shared/types/settingsTypes';
import { pluginStateManager } from '../../../../src/core/state/pluginStateManager';

// Mock the EditorView
jest.mock('@codemirror/view');
jest.mock('@codemirror/state');

describe('List Continuation Processing', () => {
    let pipeline: ProcessingPipeline;
    let mockView: EditorView;
    let settings: PandocExtendedMarkdownSettings;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Create a basic settings object
        settings = { ...DEFAULT_SETTINGS };
        
        // Create the processing pipeline
        pipeline = new ProcessingPipeline(pluginStateManager, undefined, undefined);
        
        // Register processors
        pipeline.registerStructuralProcessor(new FancyListProcessor());
        pipeline.registerStructuralProcessor(new ListContinuationProcessor());
    });

    it('should detect and decorate continuation lines in fancy lists', () => {
        const docText = `A. First item
   with continuation
B. Second item`;
        
        // Create mock document
        const mockDoc = Text.of(docText.split('\n'));
        
        // Create mock view with the document
        mockView = {
            state: {
                doc: mockDoc,
                selection: { main: { head: 0 } }
            }
        } as any;
        
        // Process the document
        const decorations = pipeline.process(mockView, settings);
        
        // Get all decorations as array
        const decorArray: any[] = [];
        decorations.iter((from, to, value) => {
            decorArray.push({ from, to, value });
        });
        
        // Debug output
        console.log('Document:', docText);
        console.log('Decorations:', decorArray);
        
        // Check that we have decorations for all three lines
        const lineDecorations = decorArray.filter(d => 
            d.value?.spec?.class?.includes('HyperMD-list-line')
        );
        
        console.log('Line decorations:', lineDecorations);
        
        // Should have decoration for line 1 (A. First item)
        const line1Decoration = lineDecorations.find(d => d.from === 0);
        expect(line1Decoration).toBeDefined();
        expect(line1Decoration?.value?.spec?.class).toContain('pandoc-list-line');
        
        // Should have decoration for line 2 (continuation)
        const line2Decoration = lineDecorations.find(d => d.from === 14); // Position after "A. First item\n"
        expect(line2Decoration).toBeDefined();
        expect(line2Decoration?.value?.spec?.class).toContain('HyperMD-list-line-nobullet');
        
        // Should have decoration for line 3 (B. Second item)
        const line3Decoration = lineDecorations.find(d => d.from === 35); // Position after first two lines
        expect(line3Decoration).toBeDefined();
        expect(line3Decoration?.value?.spec?.class).toContain('pandoc-list-line');
    });
});