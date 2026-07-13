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
    const visibleLineRanges = getVisibleLineRanges(view, viewportRange);
    const lineRanges = addOuterMargin(visibleLineRanges, doc.lines, VIEWPORT_CONTEXT_LINE_MARGIN);
    const renderLineRanges = addOuterMargin(
        visibleLineRanges,
        doc.lines,
        VIEWPORT_DECORATION_LINE_MARGIN
    );
    const renderRanges = renderLineRanges.map(range => ({
        from: doc.line(range.startLine).from,
        to: doc.line(range.endLine).to
    }));

    return {
        lineRanges,
        renderRanges,
        startLine: lineRanges[0].startLine,
        endLine: lineRanges[lineRanges.length - 1].endLine,
        renderFrom: renderRanges[0].from,
        renderTo: renderRanges[renderRanges.length - 1].to
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

function getVisibleLineRanges(
    view: EditorView,
    viewport: { from: number; to: number }
): Array<{ startLine: number; endLine: number }> {
    const doc = view.state.doc;
    const visibleRanges = (view.visibleRanges || [viewport])
        .map(range => ({
            from: Math.max(viewport.from, range.from),
            to: Math.min(viewport.to, range.to)
        }))
        .filter(range => range.from <= range.to)
        .map(range => ({
            startLine: getLineAt(doc, range.from).number,
            endLine: getLineAt(doc, Math.max(range.from, range.to - 1)).number
        }));

    return mergeAdjacentLineRanges(visibleRanges.length > 0
        ? visibleRanges
        : [{
            startLine: getLineAt(doc, viewport.from).number,
            endLine: getLineAt(doc, Math.max(viewport.from, viewport.to - 1)).number
        }]);
}

function mergeAdjacentLineRanges(
    ranges: Array<{ startLine: number; endLine: number }>
): Array<{ startLine: number; endLine: number }> {
    const merged: Array<{ startLine: number; endLine: number }> = [];
    for (const range of ranges) {
        const previous = merged[merged.length - 1];
        if (previous && range.startLine <= previous.endLine + 1) {
            previous.endLine = Math.max(previous.endLine, range.endLine);
        } else {
            merged.push({ ...range });
        }
    }
    return merged;
}

function addOuterMargin(
    ranges: Array<{ startLine: number; endLine: number }>,
    documentLineCount: number,
    margin: number
): Array<{ startLine: number; endLine: number }> {
    return ranges.map((range, index) => ({
        startLine: index === 0 ? Math.max(1, range.startLine - margin) : range.startLine,
        endLine: index === ranges.length - 1
            ? Math.min(documentLineCount, range.endLine + margin)
            : range.endLine
    }));
}
