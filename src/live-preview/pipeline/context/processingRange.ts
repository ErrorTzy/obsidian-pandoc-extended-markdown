// External libraries
import { Text } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

// Types
import { ProcessingRange } from '../types';

const VIEWPORT_CONTEXT_LINE_MARGIN = 40;

export function getProcessingRange(view: EditorView): ProcessingRange {
    const doc = view.state.doc;
    const renderRange = getRenderRange(view);
    const renderStartLine = getLineAt(doc, renderRange.from).number;
    const renderEndLine = getLineAt(doc, Math.max(renderRange.from, renderRange.to - 1)).number;
    const startLine = Math.max(1, renderStartLine - VIEWPORT_CONTEXT_LINE_MARGIN);
    const endLine = Math.min(doc.lines, renderEndLine + VIEWPORT_CONTEXT_LINE_MARGIN);

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

function getRenderRange(view: EditorView): { from: number; to: number } {
    const doc = view.state.doc;
    const viewport = view.viewport || { from: 0, to: doc.length };
    const viewportFrom = Math.max(0, Math.min(viewport.from, doc.length));
    const viewportTo = Math.max(viewportFrom, Math.min(viewport.to, doc.length));
    const selectionHead = view.state.selection?.main?.head;

    if (typeof selectionHead !== 'number') {
        return {
            from: viewportFrom,
            to: Math.max(viewportTo, viewportFrom + 1)
        };
    }

    const selectionInViewport = selectionHead >= viewportFrom && selectionHead <= viewportTo;
    if (selectionInViewport) {
        return {
            from: viewportFrom,
            to: Math.max(viewportTo, viewportFrom + 1)
        };
    }

    const selectionLine = getLineAt(doc, Math.max(0, Math.min(selectionHead, doc.length)));
    return {
        from: selectionLine.from,
        to: selectionLine.to
    };
}
