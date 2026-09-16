import { getRawHtmlContainerOpening, RawHtmlContainerOpening } from './pandocBlockBoundaries';
import { getPandocContainerContent } from './pandocListMarkers';
import { getRawTexCommandBlockEndIndex } from './pandocRawTexBlocks';

/** Reader cursor indentation consumed between blocks, never inside a list. */
export class PandocBlockEntryWhitespace {
    private readonly htmlContainers: RawHtmlContainerOpening[] = [];
    private immediateEntry: { lineIndex: number; columns: number } | null = null;

    normalize(line: string, index: number, isBlockEntry: boolean): string {
        const immediate = this.immediateEntry;
        if (immediate && index >= immediate.lineIndex) {
            this.immediateEntry = null;
        }
        if (!isBlockEntry) {
            return line;
        }
        const container = this.htmlContainers[this.htmlContainers.length - 1];
        const columns = immediate?.lineIndex === index
            ? immediate.columns
            : container?.bodyIndentColumns ?? 0;
        const content = getPandocContainerContent(line);
        return line.slice(0, line.length - content.length) + removeIndentColumns(content, columns);
    }

    openHtml(lines: string[], index: number, content: string): number | null {
        const opening = getRawHtmlContainerOpening(lines, index, content);
        if (!opening) {
            return null;
        }
        if (opening.hasBody) {
            this.htmlContainers.push(opening);
        } else {
            this.immediateEntry = {
                lineIndex: opening.openingEndIndex + 1,
                columns: opening.bodyIndentColumns
            };
        }
        return opening.openingEndIndex;
    }

    closeHtml(content: string): boolean {
        const closingName = content.match(/^\s*<\/([\w:-]+)\s*>\s*$/)?.[1]?.toLowerCase();
        const matchingIndex = this.htmlContainers.findLastIndex(frame => frame.tagName === closingName);
        if (matchingIndex < 0) {
            return false;
        }
        this.htmlContainers.splice(matchingIndex);
        return true;
    }

    afterOpaqueBlock(lines: string[], index: number, endIndex: number): void {
        if (getRawTexCommandBlockEndIndex(lines, index) === endIndex) {
            // rawTeXBlock's spnl' consumes at most one newline and its indent.
            this.immediateEntry = { lineIndex: endIndex + 1, columns: Infinity };
        }
    }
}

function removeIndentColumns(content: string, maximum: number): string {
    let offset = 0;
    let columns = 0;
    while (offset < content.length && columns < maximum) {
        if (content[offset] === ' ') {
            columns++;
        } else if (content[offset] === '\t') {
            columns += 4 - columns % 4;
        } else {
            break;
        }
        offset++;
    }
    return ' '.repeat(Math.max(0, columns - maximum)) + content.slice(offset);
}
