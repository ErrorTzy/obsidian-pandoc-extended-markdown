import { EditorView, KeyBinding } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import { getCurrentLineInfo } from '../utils/lineInfo';
import { detectListMarker } from '../utils/markerDetection';
import { handleEmptyListSpecialCases, handleEmptyListItem } from './emptyListHandler';
import { handleNonEmptyListItem } from './listItemHandler';
import { handleContinuationLine } from './continuationHandler';
import { formatOrderedListMarker } from '../../../shared/utils/orderedListMarkers';
import { setPendingListBlockReconciliation } from '../utils/listBlockReconciliation';
import { renumberOrderedGroup } from '../utils/orderedSiblingRenumbering';
import {
    findExplicitChildBlock,
    findTargetParentLineIndex,
    getPreviousSiblingOrdinal,
    resolveListOwnerAtLine,
    StandardListMarkerType
} from '../utils/standardListStructure';
import {
    EmptyListHandlingConfig,
    ContinuationLineConfig,
    NewListItemConfig,
    SettingsProvider,
    resolveSettings
} from '../types';

/**
 * Creates the Enter key handler for list autocompletion.
 *
 * @param settings - Plugin settings
 * @returns KeyBinding for Enter key
 */
export function createEnterHandler(settingsProvider: SettingsProvider): KeyBinding {
    return {
        key: 'Enter',
        run: (view: EditorView): boolean => {
            const settings = resolveSettings(settingsProvider);
            // Get current line information
            const currentLine = getCurrentLineInfo(view);

            // Try to handle continuation line first
            const continuationConfig: ContinuationLineConfig = {
                view,
                currentLine,
                settings
            };

            if (handleContinuationLine(continuationConfig)) {
                return true;
            }

            // Original detection logic for when we're on a list item line
            const detection = detectListMarker(currentLine, view, settings);

            if (!detection.shouldHandleEnter) {
                return false; // Let default Enter handling take over
            }

            if (handleEnterBeforeExplicitChildBlock(view, currentLine.line.number - 1, settings)) {
                return true;
            }

            // Handle special cases for empty lists with cursor in specific positions
            if (detection.isEmptyExampleListSpecial || detection.isEmptyCustomLabelSpecial) {
                const state = view.state;
                const beforeCursor = state.doc.sliceString(currentLine.line.from, currentLine.selection.from);
                const afterCursor = state.doc.sliceString(currentLine.selection.from, currentLine.line.to);

            const specialConfig: EmptyListHandlingConfig = {
                view,
                currentLine,
                settings,
                beforeCursor,
                afterCursor
            };

                return handleEmptyListSpecialCases(specialConfig);
            }

            // Handle empty list items (dedent or remove)
            const emptyListConfig: EmptyListHandlingConfig = {
                view,
                currentLine,
                settings,
                beforeCursor: '',
                afterCursor: ''
            };

            if (handleEmptyListItem(emptyListConfig)) {
                return true;
            }

            // Handle non-empty list items (create new list item)
            const nonEmptyConfig: Omit<NewListItemConfig, 'markerInfo'> = {
                view,
                currentLine,
                settings
            };

            return handleNonEmptyListItem(nonEmptyConfig);
        }
    };
}

function handleEnterBeforeExplicitChildBlock(
    view: EditorView,
    lineIndex: number,
    settings: ReturnType<typeof resolveSettings>
): boolean {
    const state = view.state;
    const line = state.doc.line(lineIndex + 1);
    const lines = state.doc.toString().split('\n');
    const ownerContext = resolveListOwnerAtLine(lines, lineIndex, settings);
    if (!ownerContext || ownerContext.owner.lineIndex !== lineIndex) {
        return false;
    }

    const explicitChild = findExplicitChildBlock(lines, ownerContext.owner, settings);
    if (!explicitChild) {
        return false;
    }

    const item = ownerContext.owner;
    const markerPrefixLength = item.indent.length + item.marker.length + item.spaces.length;
    const cursorOffset = state.selection.main.from - line.from;
    const beforeCursor = line.text.slice(0, cursorOffset);
    const afterCursor = line.text.slice(cursorOffset);

    if (cursorOffset < markerPrefixLength) {
        return false;
    }

    const insertedLine = afterCursor.length > 0
        ? `${explicitChild.indent}${afterCursor}`
        : explicitChild.markerType
            ? `${explicitChild.indent}${formatMarkerForInsertedChild(
                explicitChild.markerType,
                ownerContext,
                settings
            )}${item.spaces || ' '}`
            : explicitChild.indent;
    const replacement = `${beforeCursor}\n${insertedLine}`;
    const expectedLines = [...lines];
    expectedLines.splice(lineIndex, 1, ...replacement.split('\n'));
    if (settings.autoRenumberLists && explicitChild.markerType?.kind === 'ordered' && afterCursor.length === 0) {
        renumberOrderedGroup(expectedLines, lineIndex + 1, {
            depth: ownerContext.owner.depth + 1,
            parentLineIndex: ownerContext.owner.lineIndex,
            markerType: explicitChild.markerType
        }, settings);
    }
    const cursorPosition = line.from + beforeCursor.length + 1 + insertedLine.length;

    setPendingListBlockReconciliation(expectedLines, {
        startIndex: 0,
        endIndex: expectedLines.length - 1
    });
    view.dispatch(state.update({
        changes: {
            from: line.from,
            to: line.to,
            insert: replacement
        },
        selection: EditorSelection.cursor(cursorPosition)
    }));

    return true;
}

function formatMarkerForInsertedChild(
    markerType: StandardListMarkerType,
    ownerContext: NonNullable<ReturnType<typeof resolveListOwnerAtLine>>,
    settings: ReturnType<typeof resolveSettings>
): string {
    if (markerType.kind === 'unordered') {
        return markerType.marker;
    }

    const targetDepth = ownerContext.owner.depth + 1;
    const targetParentLineIndex = findTargetParentLineIndex(
        ownerContext.chunk,
        ownerContext.owner.lineIndex + 1,
        targetDepth
    ) ?? ownerContext.owner.lineIndex;
    const previousOrdinal = getPreviousSiblingOrdinal(
        ownerContext.chunk,
        ownerContext.owner.lineIndex + 1,
        targetDepth,
        markerType,
        targetParentLineIndex
    );
    const ordinal = settings.autoRenumberLists
        ? (previousOrdinal ?? 0) + 1
        : 1;

    return formatOrderedListMarker(markerType.style, ordinal);
}
