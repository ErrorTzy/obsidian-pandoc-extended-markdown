import { EditorState, Line } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import { DEFAULT_SETTINGS, PandocExtendedMarkdownSettings } from '../../../src/core/settings';
import { PluginStateManager } from '../../../src/core/state/pluginStateManager';
import { ExampleReferenceProcessor } from '../../../src/live-preview/pipeline/inline/ExampleReferenceProcessor';
import { SuperscriptProcessor } from '../../../src/live-preview/pipeline/inline/SuperscriptProcessor';
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

        const view = createLongDocumentView(1500, 900, 1);

        pipeline.process(view, settings);

        expect(processor.seenLines.length).toBeLessThan(350);
        expect(processor.seenLines).not.toContain(1);
        expect(processor.seenLines).toContain(900);
    });

    it('constrains decorations to the buffered viewport instead of the cursor line or full document', () => {
        const pipeline = new ProcessingPipeline(new PluginStateManager());
        pipeline.registerInlineProcessor(new SuperscriptProcessor());

        const lines = createLongDocumentLines(1500);
        lines[0] = 'Cursor line with ^top^ syntax';
        lines[878] = 'Line 879 with ^outside-before^ syntax';
        lines[879] = 'Line 880 with ^buffer-start^ syntax';
        lines[899] = 'Line 900 with ^visible^ syntax';
        lines[919] = 'Line 920 with ^buffer-end^ syntax';
        lines[920] = 'Line 921 with ^outside-after^ syntax';
        const view = createViewAtLine(lines.join('\n'), 900, 1);

        const decorations = pipeline.process(view, settings) as unknown as {
            decorations: Array<{ from: number; to: number; decoration: Decoration }>;
        };
        const decoratedLines = decorations.decorations
            .map(entry => view.state.doc.lineAt(entry.from).number);

        expect(decoratedLines).toContain(880);
        expect(decoratedLines).toContain(900);
        expect(decoratedLines).toContain(920);
        expect(decoratedLines).not.toContain(1);
        expect(decoratedLines).not.toContain(879);
        expect(decoratedLines).not.toContain(921);
    });

    it('keeps document-wide reference metadata while decorating only the viewport', () => {
        const pipeline = new ProcessingPipeline(new PluginStateManager());
        pipeline.registerStructuralProcessor(new ExampleListProcessor());
        pipeline.registerInlineProcessor(new ExampleReferenceProcessor());

        const lines = createLongDocumentLines(1500);
        lines[0] = '(@alpha) Alpha example outside the viewport';
        lines[899] = 'Reference to (@alpha) in the viewport';
        const view = createViewAtLine(lines.join('\n'), 900, 1);
        const renderStart = view.state.doc.line(880).from;
        const renderEnd = view.state.doc.line(920).to;

        const decorations = pipeline.process(view, settings) as unknown as {
            decorations: Array<{ from: number; to: number; decoration: Decoration & { spec?: Record<string, unknown> } }>;
        };
        const widgets = decorations.decorations
            .map(entry => entry.decoration.spec?.widget)
            .filter(Boolean) as Array<{ number?: number }>;

        expect(widgets.some(widget => widget.number === 1)).toBe(true);
        expect(decorations.decorations.every(entry =>
            entry.from >= renderStart && entry.to <= renderEnd
        )).toBe(true);
    });
});

function createLongDocumentView(lineCount: number, visibleLine: number, selectionLine = visibleLine): EditorView {
    return createViewAtLine(createLongDocumentLines(lineCount).join('\n'), visibleLine, selectionLine);
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

function createViewAtLine(doc: string, visibleLine: number, selectionLine = visibleLine): EditorView {
    const view = new EditorView({
        state: EditorState.create({ doc })
    });
    const line = view.state.doc.line(visibleLine);
    const selection = view.state.doc.line(selectionLine);
    view.dispatch({ selection: { anchor: selection.from } });
    view.viewport = {
        from: line.from,
        to: line.to
    };
    return view;
}
