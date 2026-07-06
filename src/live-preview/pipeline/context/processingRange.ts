// External libraries
import { Text } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

// Types
import { ProcessingRange } from '../types';

const VIEWPORT_CONTEXT_LINE_MARGIN = 40;
const VIEWPORT_DECORATION_LINE_MARGIN = 20;

export function getProcessingRange(view: EditorView): ProcessingRange {
    const doc = view.state.doc;
    const viewportRange = getViewportRange(view);
    const viewportStartLine = getLineAt(doc, viewportRange.from).number;
    const viewportEndLine = getLineAt(doc, Math.max(viewportRange.from, viewportRange.to - 1)).number;
    const renderStartLine = Math.max(1, viewportStartLine - VIEWPORT_DECORATION_LINE_MARGIN);
    const renderEndLine = Math.min(doc.lines, viewportEndLine + VIEWPORT_DECORATION_LINE_MARGIN);
    const startLine = Math.max(1, viewportStartLine - VIEWPORT_CONTEXT_LINE_MARGIN);
    const endLine = Math.min(doc.lines, viewportEndLine + VIEWPORT_CONTEXT_LINE_MARGIN);

    return {
        startLine,
        endLine,
        renderFrom: doc.line(renderStartLine).from,
        renderTo: doc.line(renderEndLine).to
    };
}

export function getLineAt(doc: Text, position: number): ReturnType<Text['line']> {
    if (typeof doc.lineAt === 'function') {
        return doc.lineAt(position);
    }

    const safePosition = Math.max(0, Math.min(position, doc.length));
    for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber++) {
        const line = doc.line(lineNumber);
        if (safePosition <= line.to || lineNumber === doc.lines) {
            return line;
        }
    }

    return doc.line(1);
}

function getViewportRange(view: EditorView): { from: number; to: number } {
    const doc = view.state.doc;
    const viewport = view.viewport || { from: 0, to: doc.length };
    const viewportFrom = Math.max(0, Math.min(viewport.from, doc.length));
    const viewportTo = Math.max(viewportFrom, Math.min(viewport.to, doc.length));

    return {
        from: viewportFrom,
        to: Math.max(viewportTo, viewportFrom + 1)
    };
}
