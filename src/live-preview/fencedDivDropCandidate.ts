import { EditorView } from '@codemirror/view';
import { FencedDivLineRange } from './fencedDivDragSource';
import { DropCandidate, getCandidateTop, getInsertLine, getLineElementFromPoint } from './fencedDivDragDom';
import { detectCodeRegions, isLineInCodeRegion } from './pipeline/utils/codeDetection';

export function getDropCandidate(
    view: EditorView,
    event: MouseEvent,
    range: FencedDivLineRange
): DropCandidate | null {
    const lineElement = getLineElementFromPoint(view, event);
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) {
        return getDocumentEndCandidate(view, event, range);
    }

    const pointerLine = view.state.doc.lineAt(pos);
    const insertLine = getInsertLine(view, event, pointerLine.number, lineElement);

    return {
        insertLine,
        top: getCandidateTop(view, insertLine, lineElement, event),
        valid: isDropCandidateValid(view, insertLine, pointerLine.number, range)
    };
}

function getDocumentEndCandidate(
    view: EditorView,
    event: MouseEvent,
    range: FencedDivLineRange
): DropCandidate | null {
    const endTop = getDocumentEndTop(view);
    const viewRect = view.dom.getBoundingClientRect();
    if (event.clientY < endTop || event.clientX < viewRect.left || event.clientX > viewRect.right) {
        return null;
    }

    const insertLine = view.state.doc.lines + 1;
    return {
        insertLine,
        top: endTop,
        valid: !isInsertInsideRange(insertLine, range)
    };
}

function getDocumentEndTop(view: EditorView): number {
    const lastLine = view.state.doc.line(view.state.doc.lines);
    const coords = view.coordsAtPos(lastLine.to) ?? view.coordsAtPos(lastLine.from);
    return coords?.bottom ?? view.dom.getBoundingClientRect().bottom;
}

function isDropCandidateValid(
    view: EditorView,
    insertLine: number,
    pointerLine: number,
    range: FencedDivLineRange
): boolean {
    return !isInsertInsideRange(insertLine, range) &&
        !isPointerLineInCodeRegion(view, pointerLine);
}

function isInsertInsideRange(insertLine: number, range: FencedDivLineRange): boolean {
    return insertLine >= range.startLine && insertLine <= range.endLine + 1;
}

function isPointerLineInCodeRegion(view: EditorView, lineNumber: number): boolean {
    const codeRegions = detectCodeRegions(view.state.doc, view.state);
    return isLineInCodeRegion(lineNumber, view.state.doc, codeRegions);
}
