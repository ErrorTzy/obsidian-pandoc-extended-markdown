import { getBlockQuoteDepth, isStandaloneBlock } from './pandocBlockBoundaries';
import { getIndentColumns } from './orderedListMarkers';
import { getPandocContainerContent, ParsedPandocListMarker, parsePandocListMarker } from './pandocListMarkers';

export interface LiteralListContinuation {
    parentIndex: number;
    startIndex: number;
    endIndex: number;
    markerIndices: number[];
    kind: 'paragraph' | 'code';
}

interface ListItemFrame {
    index: number;
    marker: ParsedPandocListMarker;
    quoteDepth: number;
    paragraphOpen: boolean;
}

/** Tracks the coordinate system of each recursively parsed Pandoc list item. */
export class PandocListItemContinuations {
    readonly ranges: LiteralListContinuation[] = [];
    private frames: ListItemFrame[] = [];
    private activeRange: LiteralListContinuation | null = null;

    startRoot(line: string, index: number, marker: ParsedPandocListMarker): void {
        this.activeRange = null;
        this.frames = [createFrame(line, index, marker)];
    }

    blank(): void {
        this.activeRange = null;
        this.frames.forEach(frame => { frame.paragraphOpen = false; });
    }

    append(line: string, index: number): void {
        const marker = parsePandocListMarker(line, true);
        const current = this.frames[this.frames.length - 1];
        if (!current || getBlockQuoteDepth(line) !== current.quoteDepth) {
            this.activeRange = null;
            return;
        }
        if (!marker || marker.kind === 'definition' || !marker.hasValidMarkerSpacing) {
            if (this.activeRange) {
                this.activeRange.endIndex = index;
            }
            const indentation = getIndentColumns(getPandocContainerContent(line).match(/^[ \t]*/)?.[0] ?? '');
            if (indentation < current.marker.contentIndentColumns + 4) {
                current.paragraphOpen = true;
            }
            return;
        }
        let previousSibling: ListItemFrame | undefined;
        while (this.frames.length > 0 &&
            marker.indentColumns < this.frames[this.frames.length - 1].marker.contentIndentColumns) {
            previousSibling = this.frames.pop();
        }
        const parent = this.frames[this.frames.length - 1];
        if (!parent) {
            if (previousSibling && marker.indentColumns > 3) {
                // Too little indentation to enter the item's subparser, but
                // too much to begin a new root list: the marker stays content.
                this.frames.push(previousSibling);
                this.appendLiteral(previousSibling, index, marker.indentColumns);
            } else {
                this.startRoot(line, index, marker);
            }
            return;
        }
        const relativeIndent = marker.indentColumns - parent.marker.contentIndentColumns;
        const continuesOrderedList = previousSibling?.marker.kind === 'ordered' &&
            previousSibling.marker.orderedGroup === marker.orderedGroup;
        if (relativeIndent <= 3 && (marker.kind !== 'ordered' || marker.orderedStartNumber === 1 || continuesOrderedList)) {
            this.activeRange = null;
            parent.paragraphOpen = false;
            this.frames.push(createFrame(line, index, marker));
            return;
        }
        this.appendLiteral(parent, index, relativeIndent);
    }

    private appendLiteral(parent: ListItemFrame, index: number, relativeIndent: number): void {
        const kind = relativeIndent >= 4 && !parent.paragraphOpen ? 'code' : 'paragraph';
        if (!this.activeRange || this.activeRange.parentIndex !== parent.index ||
            this.activeRange.kind !== kind) {
            this.activeRange = {
                parentIndex: parent.index, startIndex: index, endIndex: index,
                markerIndices: [], kind
            };
            this.ranges.push(this.activeRange);
        }
        this.activeRange.endIndex = index;
        this.activeRange.markerIndices.push(index);
        parent.paragraphOpen = kind === 'paragraph';
    }
}

function createFrame(line: string, index: number, marker: ParsedPandocListMarker): ListItemFrame {
    const trailing = line.slice(marker.markerEnd);
    const whitespace = trailing.match(/^[ \t]*/)?.[0] ?? '';
    const markerWidth = marker.markerEnd - marker.markerStart;
    let contentColumn = marker.indentColumns + markerWidth;
    for (const character of whitespace) {
        contentColumn += character === '\t' ? 4 - contentColumn % 4 : 1;
    }
    const content = ' '.repeat(Math.max(0, contentColumn - marker.contentIndentColumns)) + trailing.trimStart();
    return {
        index, marker, quoteDepth: getBlockQuoteDepth(line),
        paragraphOpen: content.length > 0 && !isStandaloneBlock([content], 0, content)
    };
}
