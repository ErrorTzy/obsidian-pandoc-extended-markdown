import { EditorState, Line } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import { DEFAULT_SETTINGS, PandocExtendedMarkdownSettings } from '../../../src/core/settings';
import { PluginStateManager } from '../../../src/core/state/pluginStateManager';
import { ExampleReferenceProcessor } from '../../../src/live-preview/pipeline/inline/ExampleReferenceProcessor';
import { ExampleListProcessor } from '../../../src/live-preview/pipeline/structural/ExampleListProcessor';
import { ProcessingPipeline } from '../../../src/live-preview/pipeline/ProcessingPipeline';
import { ProcessingContext, StructuralProcessor, StructuralResult } from '../../../src/live-preview/pipeline/types';

class CountingStructuralProcessor implements StructuralProcessor {
    name = 'counting-structural';
    priority = 1;
    seenLines: number[] = [];

    canProcess(line: Line, _context: ProcessingContext): boolean {
        this.seenLines.push(line.number);
        return false;
    }

    process(_line: Line, _context: ProcessingContext): StructuralResult {
        return { decorations: [] };
    }
}

describe('ProcessingPipeline long document performance', () => {
    let settings: PandocExtendedMarkdownSettings;

    beforeEach(() => {
        settings = {
            ...DEFAULT_SETTINGS,
            enforcePandocListSpacing: false,
            enableCustomLabelLists: false,
            enableFencedDivs: false,
            enableFencedDivExtras: false,
            enableUnorderedListMarkerStyles: false
        };
    });

    it('does not run structural decoration processing across every line of a long document', () => {
        const processor = new CountingStructuralProcessor();
        const pipeline = new ProcessingPipeline(new PluginStateManager());
        pipeline.registerStructuralProcessor(processor);

        const view = createLongDocumentView(1500, 900);

        pipeline.process(view, settings);

        expect(processor.seenLines.length).toBeLessThan(350);
        expect(processor.seenLines).not.toContain(1);
        expect(processor.seenLines).toContain(900);
    });

    it('keeps document-wide reference metadata while decorating only the viewport', () => {
        const pipeline = new ProcessingPipeline(new PluginStateManager());
        pipeline.registerStructuralProcessor(new ExampleListProcessor());
        pipeline.registerInlineProcessor(new ExampleReferenceProcessor());

        const lines = createLongDocumentLines(1500);
        lines[0] = '(@alpha) Alpha example outside the viewport';
        lines[899] = 'Reference to (@alpha) in the viewport';
        const view = createViewAtLine(lines.join('\n'), 900);

        const decorations = pipeline.process(view, settings) as unknown as {
            decorations: Array<{ from: number; to: number; decoration: Decoration & { spec?: Record<string, unknown> } }>;
        };
        const widgets = decorations.decorations
            .map(entry => entry.decoration.spec?.widget)
            .filter(Boolean) as Array<{ number?: number }>;

        expect(widgets.some(widget => widget.number === 1)).toBe(true);
        expect(decorations.decorations.every(entry => entry.from >= view.viewport.from)).toBe(true);
    });
});

function createLongDocumentView(lineCount: number, visibleLine: number): EditorView {
    return createViewAtLine(createLongDocumentLines(lineCount).join('\n'), visibleLine);
}

function createLongDocumentLines(lineCount: number): string[] {
    return Array.from({ length: lineCount }, (_value, index) => {
        const lineNumber = index + 1;
        if (lineNumber % 5 === 0) {
            return `A. Ordered item ${lineNumber} with ^superscript^ and ~subscript~`;
        }
        if (lineNumber % 7 === 0) {
            return `- Unordered item ${lineNumber} with reference (@alpha)`;
        }
        return `Paragraph ${lineNumber} with enough text to resemble a real note`;
    });
}

function createViewAtLine(doc: string, visibleLine: number): EditorView {
    const view = new EditorView({
        state: EditorState.create({ doc })
    });
    const line = view.state.doc.line(visibleLine);
    view.viewport = {
        from: line.from,
        to: line.to
    };
    return view;
}
