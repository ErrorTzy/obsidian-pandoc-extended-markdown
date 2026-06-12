import { EditorSelection } from '@codemirror/state';
import { EditorView, KeyBinding } from '@codemirror/view';
import type { PandocExtendedMarkdownSettings } from '../../../core/settings';
import { normalizeUnorderedListMarkerOrder } from '../../../shared/types/unorderedListTypes';
import {
    formatOrderedListMarker,
    parseOrderedListMarker
} from '../../../shared/utils/orderedListMarkers';
import { setPendingListBlockReconciliation } from '../utils/listBlockReconciliation';
import { renumberOrderedGroup } from '../utils/orderedSiblingRenumbering';
import {
    hasEnabledStandardListOwnerCandidate,
    showListAutocompletionError
} from '../utils/debugNotice';
import { resolveSettings, SettingsProvider } from '../types';
import {
    addIndentLevel,
    findExplicitChildBlock,
    findNearestNodeAtDepth,
    findTargetParentLineIndex,
    formatNonOrderedMarker,
    getDirectContinuationLineIndices,
    getPreviousSiblingOrdinal,
    removeIndentLevel,
    resolveListOwnerAtLine,
    resolveMarkerTypeForDepth,
    parseStructuralListItem,
    StandardListChunk,
    StandardListMarkerType,
    StandardListNode
} from '../utils/standardListStructure';

type MoveDirection = 'indent' | 'outdent';

interface OwnerMove {
    owner: StandardListNode;
    chunk: StandardListChunk;
    targetDepth: number;
    targetIndent: string;
    targetMarkerType: StandardListMarkerType;
    targetParentLineIndex: number | null;
    lineIndices: number[];
}

interface MovedOrderedOwner {
    lineIndex: number;
    targetDepth: number;
    targetParentLineIndex: number | null;
    markerType: StandardListMarkerType;
    ordinal: number;
}

export function createTabHandler(settingsProvider: SettingsProvider): KeyBinding {
    return {
        key: 'Tab',
        run: (view: EditorView): boolean => {
            return moveTouchedOwners(view, 'indent', resolveSettings(settingsProvider));
        }
    };
}

export function createShiftTabHandler(settingsProvider: SettingsProvider): KeyBinding {
    return {
        key: 'Shift-Tab',
        run: (view: EditorView): boolean => {
            return moveTouchedOwners(view, 'outdent', resolveSettings(settingsProvider));
        }
    };
}

function moveTouchedOwners(
    view: EditorView,
    direction: MoveDirection,
    settings: PandocExtendedMarkdownSettings
): boolean {
    const state = view.state;
    const lines = state.doc.toString().split('\n');
    const selection = state.selection.main;
    const ownerContexts = selection.empty
        ? collectSingleOwner(lines, state.doc.lineAt(selection.from).number - 1, settings)
        : collectSelectedOwners(lines, selection.from, selection.to, view, settings);

    if (ownerContexts.length === 0) {
        return shouldReportMissingOwner(lines, view, selection.from, selection.to, settings)
            ? showListAutocompletionError(
                'The touched structural list item could not be resolved to an owner.',
                state.doc.lineAt(selection.from).number
            )
            : false;
    }

    const moves = buildOwnerMoves(lines, ownerContexts, direction, settings);
    if (moves.length === 0) {
        return showListAutocompletionError(
            'No valid structural list owner move could be built.',
            state.doc.lineAt(selection.from).number
        );
    }

    const movedOrderedOwners: MovedOrderedOwner[] = [];
    const nextLines = [...lines];
    for (const move of moves) {
        applyOwnerMove(lines, nextLines, move, settings, movedOrderedOwners);
    }

    applyExpectedRenumbering(nextLines, moves, settings);

    const cursor = selection.empty
        ? resolveMovedCursor(view, lines, nextLines, moves, selection.from, settings)
        : selection.from;

    setPendingListBlockReconciliation(nextLines, {
        startIndex: 0,
        endIndex: nextLines.length - 1
    });
    view.dispatch(state.update({
        changes: {
            from: 0,
            to: state.doc.length,
            insert: nextLines.join('\n')
        },
        selection: EditorSelection.cursor(cursor)
    }));

    return true;
}

function shouldReportMissingOwner(
    lines: string[],
    view: EditorView,
    selectionFrom: number,
    selectionTo: number,
    settings: PandocExtendedMarkdownSettings
): boolean {
    const fromLine = view.state.doc.lineAt(selectionFrom);
    const toLine = view.state.doc.lineAt(Math.max(selectionFrom, selectionTo - 1));

    for (let lineNumber = fromLine.number; lineNumber <= toLine.number; lineNumber++) {
        if (hasEnabledStandardListOwnerCandidate(lines, lineNumber - 1, settings)) {
            return true;
        }
    }

    return false;
}

function collectSingleOwner(
    lines: string[],
    lineIndex: number,
    settings: PandocExtendedMarkdownSettings
): Array<ReturnType<typeof resolveListOwnerAtLine> & {}> {
    const owner = resolveListOwnerAtLine(lines, lineIndex, settings);
    return owner ? [owner] : [];
}

function collectSelectedOwners(
    lines: string[],
    selectionFrom: number,
    selectionTo: number,
    view: EditorView,
    settings: PandocExtendedMarkdownSettings
): Array<ReturnType<typeof resolveListOwnerAtLine> & {}> {
    const fromLine = view.state.doc.lineAt(selectionFrom);
    const toLine = view.state.doc.lineAt(Math.max(selectionFrom, selectionTo - 1));
    const owners = new Map<number, NonNullable<ReturnType<typeof resolveListOwnerAtLine>>>();

    for (let lineNumber = fromLine.number; lineNumber <= toLine.number; lineNumber++) {
        const context = resolveListOwnerAtLine(lines, lineNumber - 1, settings);
        if (context) {
            owners.set(context.owner.lineIndex, context);
        }
    }

    return [...owners.values()].sort((left, right) => left.owner.lineIndex - right.owner.lineIndex);
}

function buildOwnerMoves(
    lines: string[],
    ownerContexts: Array<NonNullable<ReturnType<typeof resolveListOwnerAtLine>>>,
    direction: MoveDirection,
    settings: PandocExtendedMarkdownSettings
): OwnerMove[] {
    const plannedMoves: OwnerMove[] = [];

    for (const ownerContext of ownerContexts) {
        const { owner, chunk } = ownerContext;
        const targetDepth = direction === 'indent' ? owner.depth + 1 : owner.depth - 1;
        if (targetDepth < 1) {
            continue;
        }

        const explicitChild = direction === 'indent'
            ? findExplicitChildBlock(lines, owner, settings)
            : null;
        const explicitParent = direction === 'outdent'
            ? chunk.nodes.find(node => node.lineIndex === owner.parentLineIndex) ?? null
            : null;
        const movedParent = findMovedParentMove(plannedMoves, owner, targetDepth);
        const targetIndent = direction === 'indent'
            ? explicitChild?.indent ?? addIndentLevel(owner.indent)
            : explicitParent?.indent ??
                findNearestNodeAtDepth(chunk, owner.lineIndex, targetDepth)?.indent ??
                removeIndentLevel(owner.indent);
        const explicitMarkerType = explicitChild?.markerType ??
            explicitParent?.markerType ??
            resolveMovedParentChildMarkerType(movedParent, owner, settings);
        const targetMarkerType = resolveTargetMarkerType(chunk, owner, targetDepth, settings, explicitMarkerType);
        const targetParentLineIndex = movedParent?.owner.lineIndex ??
            findTargetParentLineIndex(chunk, owner.lineIndex, targetDepth);

        plannedMoves.push({
            owner,
            chunk,
            targetDepth,
            targetIndent,
            targetMarkerType,
            targetParentLineIndex,
            lineIndices: [
                owner.lineIndex,
                ...getDirectContinuationLineIndices(lines, owner, settings)
            ]
        });
    }

    return plannedMoves;
}

function resolveTargetMarkerType(
    chunk: StandardListChunk,
    owner: StandardListNode,
    targetDepth: number,
    settings: PandocExtendedMarkdownSettings,
    explicitMarkerType: StandardListMarkerType | null
): StandardListMarkerType {
    if (
        owner.markerType.kind === 'ordered' &&
        !settings.enableOrderedListMarkerCycling &&
        !explicitMarkerType
    ) {
        return owner.markerType;
    }

    return resolveMarkerTypeForDepth(
        chunk,
        owner.lineIndex,
        targetDepth,
        settings,
        explicitMarkerType
    );
}

function applyOwnerMove(
    originalLines: string[],
    nextLines: string[],
    move: OwnerMove,
    settings: PandocExtendedMarkdownSettings,
    movedOrderedOwners: MovedOrderedOwner[]
): void {
    const owner = move.owner;
    const marker = formatMovedMarker(originalLines, move, settings, movedOrderedOwners);
    const ownerLine = originalLines[owner.lineIndex];
    const markerEnd = owner.indent.length + owner.marker.length + owner.spaces.length;
    nextLines[owner.lineIndex] = `${move.targetIndent}${marker}${owner.spaces || ' '}${ownerLine.slice(markerEnd)}`;

    for (const lineIndex of move.lineIndices) {
        if (lineIndex === owner.lineIndex) {
            continue;
        }

        nextLines[lineIndex] = `${move.targetIndent}${originalLines[lineIndex].slice(owner.indent.length)}`;
    }
}

function formatMovedMarker(
    originalLines: string[],
    move: OwnerMove,
    settings: PandocExtendedMarkdownSettings,
    movedOrderedOwners: MovedOrderedOwner[]
): string {
    if (move.targetMarkerType.kind !== 'ordered') {
        return formatNonOrderedMarker(move.targetMarkerType);
    }

    const currentOrdered = parseOrderedListMarker(
        originalLines[move.owner.lineIndex],
        originalLines,
        move.owner.lineIndex
    );
    const previousMovedSibling = findPreviousMovedOrderedSibling(movedOrderedOwners, move);
    const previousExistingOrdinal = getPreviousSiblingOrdinal(
        move.chunk,
        move.owner.lineIndex,
        move.targetDepth,
        move.targetMarkerType,
        move.targetParentLineIndex
    );
    const ordinal = settings.autoRenumberLists
        ? previousMovedSibling?.ordinal ?? ((previousExistingOrdinal ?? 0) + 1)
        : currentOrdered?.ordinal ?? ((previousExistingOrdinal ?? 0) + 1);
    const normalizedOrdinal = previousMovedSibling && settings.autoRenumberLists
        ? previousMovedSibling.ordinal + 1
        : ordinal;

    movedOrderedOwners.push({
        lineIndex: move.owner.lineIndex,
        targetDepth: move.targetDepth,
        targetParentLineIndex: move.targetParentLineIndex,
        markerType: move.targetMarkerType,
        ordinal: normalizedOrdinal
    });

    return formatOrderedListMarker(move.targetMarkerType.style, normalizedOrdinal);
}

function findPreviousMovedOrderedSibling(
    movedOrderedOwners: MovedOrderedOwner[],
    move: OwnerMove
): MovedOrderedOwner | null {
    for (let index = movedOrderedOwners.length - 1; index >= 0; index--) {
        const moved = movedOrderedOwners[index];
        if (
            moved.targetDepth === move.targetDepth &&
            moved.targetParentLineIndex === move.targetParentLineIndex &&
            moved.markerType.kind === 'ordered' &&
            move.targetMarkerType.kind === 'ordered' &&
            moved.markerType.style === move.targetMarkerType.style
        ) {
            return moved;
        }
    }

    return null;
}

function findMovedParentMove(
    plannedMoves: OwnerMove[],
    owner: StandardListNode,
    targetDepth: number
): OwnerMove | null {
    for (let index = plannedMoves.length - 1; index >= 0; index--) {
        const move = plannedMoves[index];
        if (move.owner.lineIndex === owner.parentLineIndex && move.targetDepth === targetDepth - 1) {
            return move;
        }
    }

    return null;
}

function resolveMovedParentChildMarkerType(
    movedParent: OwnerMove | null,
    owner: StandardListNode,
    settings: PandocExtendedMarkdownSettings
): StandardListMarkerType | null {
    if (
        !movedParent ||
        owner.markerType.kind !== 'unordered' ||
        movedParent.targetMarkerType.kind !== 'unordered'
    ) {
        return null;
    }

    if (!settings.enableUnorderedListMarkerCycling) {
        return owner.markerType;
    }

    const order = normalizeUnorderedListMarkerOrder(settings.unorderedListMarkerOrder);
    const parentIndex = order.indexOf(movedParent.targetMarkerType.marker as '-' | '+' | '*');
    const normalizedParentIndex = parentIndex >= 0 ? parentIndex : 0;

    return {
        kind: 'unordered',
        marker: order[(normalizedParentIndex + 1) % order.length]
    };
}

function resolveMovedCursor(
    view: EditorView,
    originalLines: string[],
    nextLines: string[],
    moves: OwnerMove[],
    cursorPosition: number,
    settings: PandocExtendedMarkdownSettings
): number {
    const cursorLine = view.state.doc.lineAt(cursorPosition);
    const cursorLineIndex = cursorLine.number - 1;
    const move = moves.find(candidate => candidate.lineIndices.includes(cursorLineIndex));
    if (!move) {
        return cursorPosition;
    }

    const oldOffset = cursorPosition - cursorLine.from;
    const newOffset = cursorLineIndex === move.owner.lineIndex
        ? getMovedOwnerCursorOffset(originalLines[cursorLineIndex], nextLines[cursorLineIndex], oldOffset, settings)
        : Math.max(0, oldOffset + move.targetIndent.length - move.owner.indent.length);

    return getLineStartOffset(nextLines, cursorLineIndex) +
        Math.min(newOffset, nextLines[cursorLineIndex].length);
}

function getMovedOwnerCursorOffset(
    oldLine: string,
    newLine: string,
    oldOffset: number,
    settings: PandocExtendedMarkdownSettings
): number {
    const oldMarkerEnd = getMarkerEnd(oldLine, settings);
    const newMarkerEnd = getMarkerEnd(newLine, settings);

    if (oldMarkerEnd === null || newMarkerEnd === null) {
        return oldOffset;
    }

    return oldOffset <= oldMarkerEnd
        ? newMarkerEnd
        : Math.max(newMarkerEnd, oldOffset + newMarkerEnd - oldMarkerEnd);
}

function getMarkerEnd(line: string, settings: PandocExtendedMarkdownSettings): number | null {
    const item = parseStructuralListItem(line, settings);
    return item ? item.indent.length + item.marker.length + item.spaces.length : null;
}

function getLineStartOffset(lines: string[], lineIndex: number): number {
    let offset = 0;
    for (let index = 0; index < lineIndex; index++) {
        offset += lines[index].length + 1;
    }

    return offset;
}

function applyExpectedRenumbering(
    lines: string[],
    moves: OwnerMove[],
    settings: PandocExtendedMarkdownSettings
): void {
    if (!settings.autoRenumberLists) {
        return;
    }

    for (const move of moves) {
        if (move.targetMarkerType.kind === 'ordered') {
            renumberOrderedGroup(lines, move.owner.lineIndex, {
                depth: move.targetDepth,
                parentLineIndex: move.targetParentLineIndex,
                markerType: move.targetMarkerType
            }, settings);
        }

        if (move.owner.markerType.kind === 'ordered') {
            renumberOrderedGroup(lines, move.owner.lineIndex, {
                depth: move.owner.depth,
                parentLineIndex: move.owner.parentLineIndex,
                markerType: move.owner.markerType
            }, settings);
        }
    }
}
