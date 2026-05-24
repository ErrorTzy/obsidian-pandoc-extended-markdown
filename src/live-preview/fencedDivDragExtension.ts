import { Extension } from '@codemirror/state';
import { EditorView, ViewPlugin } from '@codemirror/view';
import { editorLivePreviewField } from 'obsidian';
import { PandocExtendedMarkdownSettings } from '../core/settings';
import { isSyntaxFeatureEnabled } from '../shared/types/settingsTypes';
import {
    createDragGhost,
    createDropIndicator,
    getFencedDivRailDepth,
    positionDragGhost,
    positionDropIndicator
} from './fencedDivDragDom';
import { findFencedDivRangeAtDepth } from './fencedDivDragRanges';
import {
    FencedDivLineRange,
    moveFencedDivBlockText
} from './fencedDivDragSource';
import { getDropCandidate } from './fencedDivDropCandidate';

interface DragState {
    ghost: HTMLElement;
    indicator: HTMLElement;
    range: FencedDivLineRange;
    startX: number;
    startY: number;
    moved: boolean;
}

const DRAG_THRESHOLD_PX = 4;
const RAIL_HOVER_CLASS = 'cm-pem-fenced-div-rail-hover';
const DRAGGING_CLASS = 'cm-pem-fenced-div-dragging';
const BODY_DRAGGING_CLASS = 'pem-fenced-div-rail-dragging';

class FencedDivDragView {
    private dragState: DragState | null = null;
    private hoverLine: HTMLElement | null = null;
    private readonly handleDocumentMouseMove = (event: MouseEvent): void => this.onDragMove(event);
    private readonly handleDocumentMouseUp = (event: MouseEvent): void => this.onDragEnd(event);

    constructor(
        private readonly view: EditorView,
        private readonly getSettings: () => PandocExtendedMarkdownSettings
    ) {}

    startDrag(event: MouseEvent): boolean {
        if (!this.canStartDrag(event)) {
            return false;
        }

        const lineElement = this.getFencedDivLineElement(event.target);
        const sourceLine = this.getSourceLineFromEvent(event);
        const railDepth = lineElement ? getFencedDivRailDepth(event, lineElement) : null;
        if (!lineElement || !sourceLine || railDepth === null) {
            return false;
        }

        const range = findFencedDivRangeAtDepth(
            this.view.state.doc,
            sourceLine,
            railDepth,
            this.getSettings()
        );
        if (!range) {
            return false;
        }

        this.beginDrag(event, range);
        return true;
    }

    updateRailHover(event: MouseEvent): void {
        if (this.dragState) {
            return;
        }

        const lineElement = this.getFencedDivLineElement(event.target);
        const nextHover = lineElement && getFencedDivRailDepth(event, lineElement) !== null
            ? lineElement
            : null;
        this.setHoverLine(nextHover);
    }

    clearRailHover(): void {
        this.setHoverLine(null);
    }

    destroy(): void {
        this.clearDragState();
        this.clearRailHover();
    }

    private beginDrag(event: MouseEvent, range: FencedDivLineRange): void {
        this.clearRailHover();
        this.dragState = {
            ghost: createDragGhost(this.view, range),
            indicator: createDropIndicator(this.view),
            range,
            startX: event.clientX,
            startY: event.clientY,
            moved: false
        };
        this.setDraggingClasses(true);
        document.addEventListener('mousemove', this.handleDocumentMouseMove);
        document.addEventListener('mouseup', this.handleDocumentMouseUp);
        this.updateGhost(event);
        event.preventDefault();
    }

    private canStartDrag(event: MouseEvent): boolean {
        return event.button === 0 &&
            this.view.state.field(editorLivePreviewField) &&
            isSyntaxFeatureEnabled(this.getSettings(), 'enableFencedDivs');
    }

    private getFencedDivLineElement(target: EventTarget | null): HTMLElement | null {
        if (!(target instanceof Element)) {
            return null;
        }

        const line = target.closest('.cm-line.cm-pem-fenced-div-line');
        return line instanceof HTMLElement && this.view.dom.contains(line)
            ? line
            : null;
    }

    private getSourceLineFromEvent(event: MouseEvent): number | null {
        const pos = this.view.posAtCoords({ x: event.clientX, y: event.clientY });
        return pos === null ? null : this.view.state.doc.lineAt(pos).number;
    }

    private onDragMove(event: MouseEvent): void {
        if (!this.dragState) {
            return;
        }

        const distance = Math.hypot(
            event.clientX - this.dragState.startX,
            event.clientY - this.dragState.startY
        );
        this.dragState.moved = this.dragState.moved || distance >= DRAG_THRESHOLD_PX;
        this.updateGhost(event);
        event.preventDefault();
    }

    private onDragEnd(event: MouseEvent): void {
        const state = this.dragState;
        const candidate = state ? getDropCandidate(this.view, event, state.range) : null;
        this.clearDragState();
        if (!state?.moved || !candidate?.valid) {
            return;
        }

        moveFencedDivBlock(this.view, state.range, candidate.insertLine, this.getSettings());
        event.preventDefault();
    }

    private updateGhost(event: MouseEvent): void {
        if (!this.dragState) {
            return;
        }

        const candidate = getDropCandidate(this.view, event, this.dragState.range);
        positionDragGhost(this.dragState.ghost, candidate);
        positionDropIndicator(this.dragState.indicator, candidate);
    }

    private setHoverLine(lineElement: HTMLElement | null): void {
        if (this.hoverLine === lineElement) {
            return;
        }

        this.hoverLine?.classList.remove(RAIL_HOVER_CLASS);
        this.hoverLine = lineElement;
        this.hoverLine?.classList.add(RAIL_HOVER_CLASS);
    }

    private clearDragState(): void {
        document.removeEventListener('mousemove', this.handleDocumentMouseMove);
        document.removeEventListener('mouseup', this.handleDocumentMouseUp);
        this.dragState?.ghost.remove();
        this.dragState?.indicator.remove();
        this.setDraggingClasses(false);
        this.dragState = null;
    }

    private setDraggingClasses(isDragging: boolean): void {
        this.view.dom.classList.toggle(DRAGGING_CLASS, isDragging);
        document.body.classList.toggle(BODY_DRAGGING_CLASS, isDragging);
    }
}

export function fencedDivDragExtension(
    getSettings: () => PandocExtendedMarkdownSettings
): Extension {
    const plugin = ViewPlugin.fromClass(
        class extends FencedDivDragView {
            constructor(view: EditorView) {
                super(view, getSettings);
            }
        },
        {
            eventHandlers: {
                mousedown(event: MouseEvent, view: EditorView): boolean {
                    return view.plugin(plugin)?.startDrag(event) ?? false;
                },
                mouseleave(_event: MouseEvent, view: EditorView): void {
                    view.plugin(plugin)?.clearRailHover();
                },
                mousemove(event: MouseEvent, view: EditorView): void {
                    view.plugin(plugin)?.updateRailHover(event);
                }
            }
        }
    );

    return plugin;
}

function moveFencedDivBlock(
    view: EditorView,
    range: FencedDivLineRange,
    insertLine: number,
    settings: PandocExtendedMarkdownSettings
): void {
    const result = moveFencedDivBlockText(
        view.state.doc.toString(),
        range,
        insertLine,
        settings
    );
    if (!result.changed) {
        return;
    }

    view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: result.docText },
        selection: { anchor: result.selectionAnchor },
        scrollIntoView: true
    });
}
