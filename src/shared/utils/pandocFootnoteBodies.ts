import { getIndentColumns } from './orderedListMarkers';
import {
    FenceState,
    getBlockQuoteDepth,
    getFenceOpening,
    getMultilineBacktickCodeSpanEndIndex,
    getRawTexEnvironmentOpening,
    getStandaloneOpaqueBlockEndIndex,
    isFenceClosing,
    isYamlMetadataStart,
    stripBlockQuoteDepth
} from './pandocBlockBoundaries';
import { getPandocContainerContent } from './pandocListMarkers';

export interface PandocListAnalysisRegion {
    lines: string[];
    sourceIndices: number[];
}

export interface PandocFootnoteBody extends PandocListAnalysisRegion {
    label: string;
}

export interface PandocFootnoteProjection {
    documentLines: string[];
    sourceLines: string[];
    footnoteBodies: PandocFootnoteBody[];
}

interface FootnoteOpening {
    label: string;
    body: string;
    blockQuoteDepth: number;
}

const FOOTNOTE_DEFINITION = /^ {0,3}\[\^([^\]\s]+)\]:(.*)$/;

/**
 * Projects block footnote bodies into independent Markdown-reader regions.
 * Projected lines retain their document indices for validation and DOM matching.
 */
export function projectPandocFootnoteBodies(lines: string[]): PandocFootnoteProjection {
    const documentLines = [...lines];
    const sourceLines = [...lines];
    const footnoteBodies: PandocFootnoteBody[] = [];
    const openings = findFootnoteOpenings(lines);

    for (let index = 0; index < lines.length; index++) {
        const opening = openings.get(index);
        if (!opening) {
            continue;
        }

        const body = collectFootnoteBody(lines, index, opening, openings);
        footnoteBodies.push(body);
        body.sourceIndices.forEach((sourceIndex, bodyIndex) => {
            sourceLines[sourceIndex] = body.lines[bodyIndex];
            if (sourceIndex !== index) {
                documentLines[sourceIndex] = '';
            }
        });
        index = body.sourceIndices[body.sourceIndices.length - 1] ?? index;
    }

    return { documentLines, sourceLines, footnoteBodies };
}

function parseFootnoteOpening(line: string): FootnoteOpening | null {
    const blockQuoteDepth = getBlockQuoteDepth(line);
    const match = stripBlockQuoteDepth(line, blockQuoteDepth).match(FOOTNOTE_DEFINITION);
    return match ? {
        label: match[1], body: stripFootnoteContinuationIndent(match[2]), blockQuoteDepth
    } : null;
}

function collectFootnoteBody(
    lines: string[],
    startIndex: number,
    opening: FootnoteOpening,
    openings: Map<number, FootnoteOpening>
): PandocFootnoteBody {
    const bodyLines = [opening.body];
    const sourceIndices = [startIndex];
    let pendingBlankIndices: number[] = [];

    for (let index = startIndex + 1; index < lines.length; index++) {
        const line = lines[index];
        if (openings.has(index)) {
            break;
        }
        const bodyLine = stripBlockQuoteDepth(line, opening.blockQuoteDepth);
        if (!bodyLine.trim()) {
            pendingBlankIndices.push(index);
            continue;
        }
        if (pendingBlankIndices.length > 0 && !isIndentedFootnoteContinuation(bodyLine)) {
            break;
        }

        pendingBlankIndices.forEach(blankIndex => {
            bodyLines.push('');
            sourceIndices.push(blankIndex);
        });
        pendingBlankIndices = [];
        bodyLines.push(stripFootnoteContinuationIndent(bodyLine));
        sourceIndices.push(index);
    }

    return { label: opening.label, lines: bodyLines, sourceIndices };
}

function findFootnoteOpenings(lines: string[]): Map<number, FootnoteOpening> {
    const openings = new Map<number, FootnoteOpening>();
    let fence: FenceState | null = null;
    let inYaml = false;
    let opaqueEndIndex: number | null = null;
    let rawTexEnvironment: string | null = null;
    let inlineCodeEndIndex: number | null = null;

    for (let index = 0; index < lines.length; index++) {
        const content = getPandocContainerContent(lines[index]);
        if (inlineCodeEndIndex !== null && index <= inlineCodeEndIndex) {
            continue;
        }
        inlineCodeEndIndex = null;
        if (opaqueEndIndex !== null && index <= opaqueEndIndex) {
            continue;
        }
        opaqueEndIndex = null;
        if (inYaml) {
            inYaml = !/^(?:---|\.\.\.)[ \t]*$/.test(content);
            continue;
        }
        if (rawTexEnvironment) {
            if (content.includes(`\\end{${rawTexEnvironment}}`)) {
                rawTexEnvironment = null;
            }
            continue;
        }
        if (fence) {
            if (isFenceClosing(content, fence)) {
                fence = null;
            }
            continue;
        }
        if (isYamlMetadataStart(lines, index, content)) {
            inYaml = true;
            continue;
        }

        const openingFence = getFenceOpening(lines, index, content);
        if (openingFence) {
            fence = openingFence;
            continue;
        }
        const standaloneOpaqueEnd = getStandaloneOpaqueBlockEndIndex(lines, index, content);
        if (standaloneOpaqueEnd !== null) {
            opaqueEndIndex = standaloneOpaqueEnd;
            continue;
        }
        const rawTexOpening = getRawTexEnvironmentOpening(lines, index, content);
        if (rawTexOpening) {
            rawTexEnvironment = content.includes(`\\end{${rawTexOpening}}`)
                ? null
                : rawTexOpening;
            continue;
        }

        const footnote = parseFootnoteOpening(lines[index]);
        if (footnote) {
            openings.set(index, footnote);
        }
        inlineCodeEndIndex = getMultilineBacktickCodeSpanEndIndex(lines, index, content);
    }
    return openings;
}

function isIndentedFootnoteContinuation(line: string): boolean {
    const indent = line.match(/^([ \t]*)/)?.[1] ?? '';
    return getIndentColumns(indent) >= 4;
}

function stripFootnoteContinuationIndent(line: string): string {
    let offset = 0;
    let columns = 0;
    while (offset < line.length && columns < 4) {
        if (line[offset] === ' ') {
            columns++;
            offset++;
            continue;
        }
        if (line[offset] === '\t') {
            columns += 4 - (columns % 4);
            offset++;
            continue;
        }
        break;
    }
    return columns >= 4 ? line.slice(offset) : line;
}
