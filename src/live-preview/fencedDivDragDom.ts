import { EditorView } from '@codemirror/view';
import { FencedDivLineRange } from './fencedDivDragSource';
import { containsLine } from './fencedDivDragRanges';

export interface DropCandidate {
    insertLine: number;
    top: number;
    valid: boolean;
}

const RAIL_HIT_PADDING_PX = 5;
const DEFAULT_NEST_INDENT_EM = 1.5;
const GHOST_CLASS = 'pem-fenced-div-drag-ghost';
const DROP_INDICATOR_CLASS = 'pem-fenced-div-drop-indicator';
const INVALID_GHOST_CLASS = 'is-invalid';

export function getFencedDivRailDepth(
    event: MouseEvent,
    lineElement: HTMLElement
): number | null {
    const rect = lineElement.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const style = window.getComputedStyle(lineElement);
    const railWidth = toPixels(style.getPropertyValue('--pem-fenced-div-rail-width'), lineElement) || 3;
    const nestIndent = toPixels(style.getPropertyValue('--pem-fenced-div-nest-indent'), lineElement) ||
        getFontSize(lineElement) * DEFAULT_NEST_INDENT_EM;
    const depth = getFencedDivLineDepth(lineElement);

    for (let index = 0; index < depth; index++) {
        const railOffset = nestIndent * index;
        if (offsetX >= railOffset - RAIL_HIT_PADDING_PX &&
            offsetX <= railOffset + railWidth + RAIL_HIT_PADDING_PX) {
            return index + 1;
        }
    }

    return null;
}

export function getLineElementFromPoint(
    view: EditorView,
    event: MouseEvent
): HTMLElement | null {
    const target = document.elementFromPoint(event.clientX, event.clientY);
    if (!(target instanceof Element)) {
        return null;
    }

    const line = target.closest('.cm-line');
    return line instanceof HTMLElement && view.dom.contains(line) ? line : null;
}

export function getInsertLine(
    view: EditorView,
    event: MouseEvent,
    lineNumber: number,
    lineElement: HTMLElement | null
): number {
    if (!lineElement) {
        return getInsertLineFromCoords(view, event, lineNumber);
    }

    const rect = lineElement.getBoundingClientRect();
    return event.clientY > rect.top + rect.height / 2
        ? Math.min(lineNumber + 1, view.state.doc.lines + 1)
        : lineNumber;
}

export function getCandidateTop(
    view: EditorView,
    insertLine: number,
    lineElement: HTMLElement | null,
    event: MouseEvent
): number {
    if (lineElement) {
        const rect = lineElement.getBoundingClientRect();
        return event.clientY > rect.top + rect.height / 2 ? rect.bottom : rect.top;
    }

    if (insertLine > view.state.doc.lines) {
        return getDocumentLineBottom(view, view.state.doc.lines);
    }

    const line = view.state.doc.line(Math.min(insertLine, view.state.doc.lines));
    return view.coordsAtPos(line.from)?.top ?? view.dom.getBoundingClientRect().top;
}

export function createDragGhost(view: EditorView, range: FencedDivLineRange): HTMLElement {
    const ghost = document.createElement('div');
    const lineElements = getRenderedRangeLines(view, range);
    const firstRect = lineElements[0]?.getBoundingClientRect();
    const viewRect = view.dom.getBoundingClientRect();

    ghost.className = GHOST_CLASS;
    ghost.style.left = `${Math.round(firstRect?.left ?? viewRect.left)}px`;
    ghost.style.width = `${Math.round(firstRect?.width ?? viewRect.width)}px`;
    for (const lineElement of lineElements) {
        ghost.appendChild(lineElement.cloneNode(true));
    }

    document.body.appendChild(ghost);
    return ghost;
}

export function createDropIndicator(view: EditorView): HTMLElement {
    const indicator = document.createElement('div');
    const contentRect = getEditorContentRect(view);

    indicator.className = DROP_INDICATOR_CLASS;
    indicator.style.left = `${Math.round(contentRect.left)}px`;
    indicator.style.width = `${Math.round(contentRect.width)}px`;
    document.body.appendChild(indicator);
    return indicator;
}

export function positionDragGhost(
    ghost: HTMLElement,
    candidate: DropCandidate | null
): void {
    if (!candidate) {
        ghost.classList.add(INVALID_GHOST_CLASS);
        return;
    }

    ghost.classList.toggle(INVALID_GHOST_CLASS, !candidate.valid);
    ghost.style.transform = `translate3d(0, ${Math.round(candidate.top)}px, 0)`;
}

export function positionDropIndicator(
    indicator: HTMLElement,
    candidate: DropCandidate | null
): void {
    if (!candidate) {
        indicator.classList.add(INVALID_GHOST_CLASS);
        return;
    }

    indicator.classList.toggle(INVALID_GHOST_CLASS, !candidate.valid);
    indicator.style.transform = `translate3d(0, ${Math.round(candidate.top)}px, 0)`;
}

function getFencedDivLineDepth(lineElement: HTMLElement): number {
    const depthClass = Array.from(lineElement.classList)
        .find(className => className.startsWith('cm-pem-fenced-div-depth-'));
    const depth = depthClass
        ? Number.parseInt(depthClass.replace('cm-pem-fenced-div-depth-', ''), 10)
        : 1;
    return Number.isFinite(depth) && depth > 0 ? depth : 1;
}

function toPixels(value: string, context: HTMLElement): number {
    const trimmed = value.trim();
    if (!trimmed) {
        return 0;
    }

    if (trimmed.endsWith('px')) {
        return Number.parseFloat(trimmed);
    }

    if (trimmed.endsWith('em')) {
        return Number.parseFloat(trimmed) * getFontSize(context);
    }

    return Number.parseFloat(trimmed) || 0;
}

function getFontSize(element: HTMLElement): number {
    return Number.parseFloat(window.getComputedStyle(element).fontSize) || 16;
}

function getInsertLineFromCoords(
    view: EditorView,
    event: MouseEvent,
    lineNumber: number
): number {
    const lineTop = getDocumentLineTop(view, lineNumber);
    const lineBottom = getDocumentLineBottom(view, lineNumber);
    return event.clientY > lineTop + (lineBottom - lineTop) / 2
        ? Math.min(lineNumber + 1, view.state.doc.lines + 1)
        : lineNumber;
}

function getDocumentLineTop(view: EditorView, lineNumber: number): number {
    const line = view.state.doc.line(lineNumber);
    return view.coordsAtPos(line.from)?.top ?? view.dom.getBoundingClientRect().top;
}

function getDocumentLineBottom(view: EditorView, lineNumber: number): number {
    const line = view.state.doc.line(lineNumber);
    const coords = view.coordsAtPos(line.to) ?? view.coordsAtPos(line.from);
    return coords?.bottom ?? view.dom.getBoundingClientRect().bottom;
}

function getEditorContentRect(view: EditorView): DOMRect {
    const content = view.dom.querySelector('.cm-content');
    return content instanceof HTMLElement
        ? content.getBoundingClientRect()
        : view.dom.getBoundingClientRect();
}

function getRenderedRangeLines(view: EditorView, range: FencedDivLineRange): HTMLElement[] {
    return Array.from(view.dom.querySelectorAll('.cm-line.cm-pem-fenced-div-line'))
        .filter((line): line is HTMLElement => {
            return line.instanceOf(HTMLElement) && isRenderedLineInRange(view, line, range);
        });
}

function isRenderedLineInRange(
    view: EditorView,
    lineElement: HTMLElement,
    range: FencedDivLineRange
): boolean {
    try {
        const pos = view.posAtDOM(lineElement, 0);
        const lineNumber = view.state.doc.lineAt(pos).number;
        return containsLine(range.startLine, range.endLine, lineNumber);
    } catch {
        return false;
    }
}
