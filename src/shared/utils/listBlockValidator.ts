import { Text } from '@codemirror/state';

import {
    FenceState,
    getBlockQuoteDepth,
    getFenceOpening,
    getIndentedBacktickCodeSpan,
    getMultilineBacktickCodeSpanEndIndex,
    getPipeTableEndIndex,
    getRawHtmlBlockEndIndex,
    getRawTexEnvironmentOpening,
    getStandaloneOpaqueBlockEndIndex,
    isBlankContainerLine,
    isFenceClosing,
    isFencedDivClosing,
    isFencedDivOpening,
    isHtmlBlockBoundary,
    isLineBlock,
    isLineBlockContinuation,
    isPipeTableDelimiter,
    isSetextHeading,
    isStandaloneBlock,
    isYamlMetadataStart
} from './pandocBlockBoundaries';
import { getIndentColumns } from './orderedListMarkers';
import {
    PandocListAnalysisRegion,
    projectPandocFootnoteBodies
} from './pandocFootnoteBodies';
import {
    getPandocContainerContent,
    PandocListMarkerKind,
    parsePandocListMarker
} from './pandocListMarkers';
import { getReferenceDefinitionEndIndex } from './pandocReferenceDefinitions';
import { PandocBlockEntryWhitespace } from './pandocBlockEntryWhitespace';
import {
    LiteralListContinuation,
    PandocListItemContinuations
} from './pandocListItemContinuations';

export { escapePandocListMarker } from './pandocListMarkers';

interface ListSpacingSettings {
    enableListsWithoutPrecedingBlankline: boolean;
}

export interface InterruptedListParagraph {
    paragraphStartIndex: number;
    listStartIndex: number;
    endIndex: number;
}

export interface ListBlockAnalysis {
    invalidLines: Set<number>;
    interruptedParagraphs: InterruptedListParagraph[];
    literalListContinuations: LiteralListContinuation[];
    sourceLines: string[];
    referenceDefinitionRanges: { startIndex: number; endIndex: number }[];
    candidateListLines?: Set<number>;
}

interface FlatListBlockAnalysis extends Omit<ListBlockAnalysis, 'sourceLines' | 'candidateListLines'> {
    normalizedLines: Map<number, string>;
    candidateListLines: Set<number>;
}

export class ListBlockValidator {
    static isListItemForValidation(line: string): boolean {
        return parsePandocListMarker(line, true) !== null;
    }

    static isListContinuation(line: string, prevWasListItem: boolean): boolean {
        if (!prevWasListItem || this.isListItemForValidation(line)) {
            return false;
        }

        const indent = line.match(/^(\s+)/)?.[1];
        return Boolean(indent && (getIndentColumns(indent) >= 2 || indent.includes('\t')));
    }

    static analyzeListBlocks(
        lines: string[],
        settings: ListSpacingSettings,
        includeCandidateListLines: boolean = false
    ): ListBlockAnalysis {
        const projection = projectPandocFootnoteBodies(lines);
        const documentAnalysis = this.analyzeFlatListBlocks(
            projection.documentLines,
            settings
        );
        projection.footnoteBodies.forEach(body => mergeRegionAnalysis(
            documentAnalysis,
            this.analyzeFlatListBlocks(body.lines, settings),
            body
        ));
        documentAnalysis.interruptedParagraphs.sort(
            (left, right) => left.listStartIndex - right.listStartIndex
        );
        documentAnalysis.literalListContinuations.sort(
            (left, right) => left.startIndex - right.startIndex
        );
        documentAnalysis.referenceDefinitionRanges.sort((left, right) => left.startIndex - right.startIndex);
        documentAnalysis.normalizedLines.forEach((line, index) => {
            projection.sourceLines[index] = line;
        });
        const analysis: ListBlockAnalysis = {
            invalidLines: documentAnalysis.invalidLines,
            interruptedParagraphs: documentAnalysis.interruptedParagraphs,
            literalListContinuations: documentAnalysis.literalListContinuations,
            sourceLines: projection.sourceLines,
            referenceDefinitionRanges: documentAnalysis.referenceDefinitionRanges
        };
        if (includeCandidateListLines) {
            analysis.candidateListLines = documentAnalysis.candidateListLines;
        }
        return analysis;
    }

    static getListMarkerCandidateLines(
        lines: string[],
        settings: ListSpacingSettings
    ): Set<number> {
        return this.analyzeListBlocks(lines, settings, true).candidateListLines ?? new Set();
    }

    private static analyzeFlatListBlocks(
        inputLines: string[],
        settings: ListSpacingSettings
    ): FlatListBlockAnalysis {
        const invalidLines = new Set<number>();
        const candidateListLines = new Set<number>();
        const interruptedParagraphs: InterruptedListParagraph[] = [];
        const literalListContinuations: LiteralListContinuation[] = [];
        const referenceDefinitionRanges: ListBlockAnalysis['referenceDefinitionRanges'] = [];
        const normalizedLines = new Map<number, string>();
        const lines = [...inputLines];
        const blockEntryWhitespace = new PandocBlockEntryWhitespace();
        const listItems = new PandocListItemContinuations();
        let paragraphStartIndex: number | null = null;
        let interruptedParagraph: InterruptedListParagraph | null = null;
        let inListBlock = false;
        let listPendingBlank = false;
        let listContainerDepth = 0;
        let listBlankContainerDepth = 0;
        let listRootIndentColumns = 0;
        let listContinuationIndentColumns = 0;
        let listRootKind: PandocListMarkerKind = 'bullet';
        let fence: FenceState | null = null;
        let fencedDivDepth = 0;
        let rawTexEnvironment: string | null = null;
        let inlineCodeSpanEndIndex: number | null = null;
        let opaqueBlockEndIndex: number | null = null;
        let inLineBlock = false;
        let inYamlMetadata = false;
        let inIndentedCodeBlock = false;
        let definitionTermBeforeBlank: number | null = null;
        let definitionTermContainerDepth: number | null = null;
        let definitionBlankContainerDepth: number | null = null;

        const finishInterruptedParagraph = (endIndex: number): void => {
            if (!interruptedParagraph) {
                return;
            }
            interruptedParagraph.endIndex = endIndex;
            interruptedParagraphs.push(interruptedParagraph);
            interruptedParagraph = null;
            paragraphStartIndex = null;
        };

        const parseMarker = (
            candidateLine: string,
            allowNested: boolean,
            index: number
        ): ReturnType<typeof parsePandocListMarker> => {
            const marker = parsePandocListMarker(candidateLine, allowNested);
            if (marker) {
                candidateListLines.add(index);
            }
            return marker;
        };

        for (let index = 0; index < lines.length; index++) {
            let line = lines[index];
            let content = getPandocContainerContent(line);

            if (inlineCodeSpanEndIndex !== null && index <= inlineCodeSpanEndIndex) {
                if (index === inlineCodeSpanEndIndex) {
                    inlineCodeSpanEndIndex = null;
                }
                continue;
            }

            if (opaqueBlockEndIndex !== null && index <= opaqueBlockEndIndex) {
                continue;
            }
            opaqueBlockEndIndex = null;

            if (inYamlMetadata) {
                if (/^(?:---|\.\.\.)[ \t]*$/.test(content)) {
                    inYamlMetadata = false;
                }
                continue;
            }

            if (isYamlMetadataStart(lines, index, content)) {
                paragraphStartIndex = null;
                inListBlock = false;
                inYamlMetadata = true;
                continue;
            }

            if (rawTexEnvironment) {
                if (content.includes(`\\end{${rawTexEnvironment}}`)) {
                    rawTexEnvironment = null;
                }
                continue;
            }

            if (inLineBlock) {
                if (isLineBlock(content) || isLineBlockContinuation(content)) {
                    continue;
                }
                inLineBlock = false;
            }

            if (fence) {
                if (isFenceClosing(content, fence)) {
                    fence = null;
                }
                continue;
            }

            if (inIndentedCodeBlock) {
                if (/^(?: {4}|\t)/.test(content) || isBlankContainerLine(content)) {
                    continue;
                }
                inIndentedCodeBlock = false;
            }

            if (blockEntryWhitespace.closeHtml(content)) {
                finishInterruptedParagraph(index - 1);
                paragraphStartIndex = null;
                inListBlock = false;
                continue;
            }

            const isBlockEntry = paragraphStartIndex === null && !interruptedParagraph &&
                (!inListBlock || (listPendingBlank && !continuesListAfterBlank(
                    line, listRootIndentColumns, listContinuationIndentColumns
                )));
            line = blockEntryWhitespace.normalize(line, index, isBlockEntry);
            if (line !== lines[index]) {
                lines[index] = line;
                normalizedLines.set(index, line);
                content = getPandocContainerContent(line);
            }

            if (fencedDivDepth > 0 && isFencedDivClosing(content)) {
                finishInterruptedParagraph(index - 1);
                paragraphStartIndex = null;
                inListBlock = false;
                fencedDivDepth--;
                continue;
            }

            const activeParagraphStart: number | null = interruptedParagraph === null
                ? paragraphStartIndex
                : interruptedParagraph.paragraphStartIndex;
            if (activeParagraphStart !== null &&
                getBlockQuoteDepth(line) > getBlockQuoteDepth(lines[activeParagraphStart])) {
                const deeperMarker = parseMarker(line, true, index);
                if (deeperMarker) {
                    invalidLines.add(index);
                    if (!interruptedParagraph && deeperMarker.hasValidMarkerSpacing) {
                        interruptedParagraph = {
                            paragraphStartIndex: activeParagraphStart,
                            listStartIndex: index,
                            endIndex: index
                        };
                    }
                }
                if (interruptedParagraph) {
                    interruptedParagraph.endIndex = index;
                }
                continue;
            }

            const openingFence = getFenceOpening(lines, index, content);
            const paragraphInterruptingFence = openingFence?.character === '`' &&
                openingFence.indentColumns === 0
                ? openingFence
                : null;
            const inlineCodeSpan = getIndentedBacktickCodeSpan(lines, index, content);
            const multilineCodeSpanEndIndex = getMultilineBacktickCodeSpanEndIndex(
                lines,
                index,
                content
            );
            const rawTexOpening = getRawTexEnvironmentOpening(lines, index, content);
            if (interruptedParagraph && rawTexOpening) {
                interruptedParagraph.endIndex = index;
                if (!content.includes(`\\end{${rawTexOpening}}`)) {
                    rawTexEnvironment = rawTexOpening;
                }
                continue;
            }
            if (interruptedParagraph &&
                settings.enableListsWithoutPrecedingBlankline &&
                getBlockQuoteDepth(line) <= getBlockQuoteDepth(
                    lines[interruptedParagraph.paragraphStartIndex]
                )) {
                const markerLeavingRejectedQuote = parseMarker(line, false, index);
                if (markerLeavingRejectedQuote?.kind !== 'definition' &&
                    markerLeavingRejectedQuote?.hasValidMarkerSpacing) {
                    finishInterruptedParagraph(index - 1);
                }
            }
            if (interruptedParagraph) {
                if (inlineCodeSpan || multilineCodeSpanEndIndex !== null) {
                    interruptedParagraph.endIndex = index;
                    inlineCodeSpanEndIndex = inlineCodeSpan?.endIndex ??
                        multilineCodeSpanEndIndex;
                    continue;
                }
                if (isBlankContainerLine(content) ||
                    paragraphInterruptingFence ||
                    isHtmlBlockBoundary(content)) {
                    finishInterruptedParagraph(index - 1);
                    if (paragraphInterruptingFence) {
                        fence = paragraphInterruptingFence;
                    } else if (isHtmlBlockBoundary(content)) {
                        opaqueBlockEndIndex = blockEntryWhitespace.openHtml(lines, index, content) ??
                            getRawHtmlBlockEndIndex(lines, index, content);
                    }
                    continue;
                }

                if (parseMarker(line, true, index)) {
                    invalidLines.add(index);
                }
                interruptedParagraph.endIndex = index;
                continue;
            }

            if (isBlankContainerLine(content)) {
                // An unindented quote marker cannot open a new container in a
                // list's lazy continuation. It is literal item content, not a
                // blank line in the list's own container.
                if (inListBlock && !listPendingBlank &&
                    getBlockQuoteDepth(line) > listContainerDepth) {
                    continue;
                }
                definitionTermBeforeBlank = paragraphStartIndex === index - 1
                    ? paragraphStartIndex
                    : null;
                definitionTermContainerDepth = definitionTermBeforeBlank !== null
                    ? getBlockQuoteDepth(lines[definitionTermBeforeBlank])
                    : null;
                definitionBlankContainerDepth = definitionTermBeforeBlank !== null
                    ? getBlockQuoteDepth(line)
                    : null;
                paragraphStartIndex = null;
                listPendingBlank = inListBlock;
                if (inListBlock) {
                    listItems.blank();
                }
                listBlankContainerDepth = getBlockQuoteDepth(line);
                continue;
            }

            if (openingFence && !inListBlock &&
                (paragraphStartIndex === null || paragraphInterruptingFence)) {
                paragraphStartIndex = null;
                inListBlock = false;
                fence = openingFence;
                continue;
            }

            const nestedMarker = parseMarker(line, true, index);
            if (nestedMarker && !nestedMarker.hasValidMarkerSpacing) {
                invalidLines.add(index);
            }

            // A physical blank ends lazy quote membership. Continuation
            // indentation measured in the old quote must not keep a new root
            // paragraph inside that quote's list.
            if (inListBlock && listPendingBlank &&
                listBlankContainerDepth < listContainerDepth &&
                getBlockQuoteDepth(line) < listContainerDepth) {
                inListBlock = false;
                listPendingBlank = false;
            }

            if (inListBlock) {
                const currentListMarker = parseMarker(line, true, index);
                if (openingFence) {
                    if (openingFence.indentColumns >= listContinuationIndentColumns) {
                        listPendingBlank = false;
                        fence = openingFence;
                        continue;
                    }
                    inListBlock = false;
                    listPendingBlank = false;
                    fence = openingFence;
                    continue;
                }
                if (currentListMarker?.kind === 'definition' &&
                    listRootKind === 'definition' &&
                    !isDefinitionMarkerInListContainer(
                        listContainerDepth,
                        line,
                        settings.enableListsWithoutPrecedingBlankline
                    )) {
                    inListBlock = false;
                    listPendingBlank = false;
                    invalidLines.add(index);
                    paragraphStartIndex = index;
                    continue;
                }
                if (currentListMarker?.kind === 'definition' &&
                    currentListMarker.indentColumns < listContinuationIndentColumns &&
                    currentListMarker.indentColumns < 4 &&
                    listRootKind !== 'definition') {
                    inListBlock = false;
                    listPendingBlank = false;
                    invalidLines.add(index);
                    paragraphStartIndex = index;
                    continue;
                }
                if (!listPendingBlank || continuesListAfterBlank(
                    line,
                    listRootIndentColumns,
                    listContinuationIndentColumns
                )) {
                    listItems.append(line, index);
                    listPendingBlank = false;
                    if (currentListMarker?.indentColumns === listRootIndentColumns) {
                        listContinuationIndentColumns = currentListMarker.contentIndentColumns;
                    }
                    if (rawTexOpening && !content.includes(`\\end{${rawTexOpening}}`)) {
                        rawTexEnvironment = rawTexOpening;
                    }
                    continue;
                }
                inListBlock = false;
                listPendingBlank = false;
            }

            const isLazyQuoteContinuation = paragraphStartIndex !== null &&
                getBlockQuoteDepth(lines[paragraphStartIndex]) > getBlockQuoteDepth(line);
            const marker = parseMarker(line, isLazyQuoteContinuation, index);

            if (paragraphStartIndex !== null) {
                if (inlineCodeSpan || multilineCodeSpanEndIndex !== null) {
                    inlineCodeSpanEndIndex = inlineCodeSpan?.endIndex ??
                        multilineCodeSpanEndIndex;
                    continue;
                }
                if (rawTexOpening) {
                    if (!content.includes(`\\end{${rawTexOpening}}`)) {
                        rawTexEnvironment = rawTexOpening;
                    }
                    continue;
                }

                if (isSetextHeading(lines, paragraphStartIndex, index)) {
                    paragraphStartIndex = null;
                    continue;
                }

                if (paragraphStartIndex === index - 1 &&
                    isPipeTableDelimiter(lines, index, content)) {
                    paragraphStartIndex = null;
                    opaqueBlockEndIndex = getPipeTableEndIndex(lines, index);
                    continue;
                }

                if (marker?.kind === 'definition') {
                    if (marker.hasValidMarkerSpacing && isDefinitionListStart(
                        lines,
                        paragraphStartIndex,
                        index,
                        settings.enableListsWithoutPrecedingBlankline
                    )) {
                        paragraphStartIndex = null;
                        inListBlock = true;
                        listContainerDepth = getBlockQuoteDepth(line);
                        listRootIndentColumns = marker.indentColumns;
                        listContinuationIndentColumns = marker.contentIndentColumns;
                        listRootKind = marker.kind;
                        listItems.startRoot(line, index, marker);
                        definitionTermBeforeBlank = null;
                        definitionTermContainerDepth = null;
                        definitionBlankContainerDepth = null;
                    } else {
                        invalidLines.add(index);
                        if (settings.enableListsWithoutPrecedingBlankline) {
                            paragraphStartIndex = index;
                        }
                    }
                    continue;
                }

                if (marker && marker.hasValidMarkerSpacing) {
                    if (settings.enableListsWithoutPrecedingBlankline) {
                        paragraphStartIndex = null;
                        inListBlock = true;
                        listContainerDepth = isLazyQuoteContinuation && marker.indentColumns > 3
                            ? getBlockQuoteDepth(lines[activeParagraphStart ?? index])
                            : getBlockQuoteDepth(line);
                        listRootIndentColumns = marker.indentColumns;
                        listContinuationIndentColumns = marker.contentIndentColumns;
                        listRootKind = marker.kind;
                        listItems.startRoot(line, index, marker);
                    } else {
                        invalidLines.add(index);
                        interruptedParagraph = {
                            paragraphStartIndex,
                            listStartIndex: index,
                            endIndex: index
                        };
                    }
                    continue;
                }

                if (isHtmlBlockBoundary(content)) {
                    paragraphStartIndex = null;
                    opaqueBlockEndIndex = blockEntryWhitespace.openHtml(lines, index, content) ??
                        getRawHtmlBlockEndIndex(lines, index, content);
                }
                continue;
            }

            if (marker?.kind === 'definition' &&
                marker.hasValidMarkerSpacing &&
                definitionTermBeforeBlank === index - 2 &&
                isDefinitionListContainerTransition(
                    lines[definitionTermBeforeBlank],
                    line,
                    settings.enableListsWithoutPrecedingBlankline
                ) &&
                definitionBlankContainerDepth !== null &&
                definitionBlankContainerDepth >= definitionTermContainerDepth) {
                inListBlock = true;
                listContainerDepth = getBlockQuoteDepth(line);
                listRootIndentColumns = marker.indentColumns;
                listContinuationIndentColumns = marker.contentIndentColumns;
                listRootKind = marker.kind;
                listItems.startRoot(line, index, marker);
                definitionTermBeforeBlank = null;
                definitionTermContainerDepth = null;
                definitionBlankContainerDepth = null;
                continue;
            }

            definitionTermBeforeBlank = null;
            definitionTermContainerDepth = null;
            definitionBlankContainerDepth = null;

            const referenceEndIndex = getReferenceDefinitionEndIndex(lines, index);
            if (referenceEndIndex !== null) {
                referenceDefinitionRanges.push({ startIndex: index, endIndex: referenceEndIndex });
                opaqueBlockEndIndex = referenceEndIndex;
                continue;
            }

            if (rawTexOpening) {
                paragraphStartIndex = index;
                if (!content.includes(`\\end{${rawTexOpening}}`)) {
                    rawTexEnvironment = rawTexOpening;
                }
                continue;
            }

            if (marker?.kind === 'definition') {
                invalidLines.add(index);
                paragraphStartIndex = index;
                continue;
            }

            const rawHtmlOpeningEnd = blockEntryWhitespace.openHtml(lines, index, content);
            if (rawHtmlOpeningEnd !== null) {
                opaqueBlockEndIndex = rawHtmlOpeningEnd;
                continue;
            }

            const standaloneOpaqueEndIndex = getStandaloneOpaqueBlockEndIndex(
                lines,
                index,
                content
            );
            if (standaloneOpaqueEndIndex !== null) {
                opaqueBlockEndIndex = standaloneOpaqueEndIndex;
                blockEntryWhitespace.afterOpaqueBlock(lines, index, standaloneOpaqueEndIndex);
                continue;
            }

            if (isStandaloneBlock(lines, index, content)) {
                inIndentedCodeBlock = /^(?: {4}|\t)/.test(content);
                if (isFencedDivOpening(content)) {
                    fencedDivDepth++;
                }
                if (isLineBlock(content)) {
                    inLineBlock = true;
                }
                continue;
            }

            if (marker?.hasValidMarkerSpacing) {
                inListBlock = true;
                listContainerDepth = getBlockQuoteDepth(line);
                listRootIndentColumns = marker.indentColumns;
                listContinuationIndentColumns = marker.contentIndentColumns;
                listRootKind = marker.kind;
                listItems.startRoot(line, index, marker);
                continue;
            }

            paragraphStartIndex = index;
            if (multilineCodeSpanEndIndex !== null) {
                inlineCodeSpanEndIndex = multilineCodeSpanEndIndex;
            }
        }

        finishInterruptedParagraph(lines.length - 1);
        listItems.ranges.forEach(range => {
            literalListContinuations.push({
                ...range,
                markerIndices: [...range.markerIndices]
            });
            range.markerIndices.forEach(index => invalidLines.add(index));
        });
        return {
            invalidLines,
            candidateListLines,
            interruptedParagraphs,
            literalListContinuations,
            normalizedLines,
            referenceDefinitionRanges
        };
    }

    static validateListBlocks(lines: string[], settings: ListSpacingSettings): Set<number> {
        return this.analyzeListBlocks(lines, settings).invalidLines;
    }
}

function mergeRegionAnalysis(
    target: FlatListBlockAnalysis,
    regionAnalysis: FlatListBlockAnalysis,
    region: PandocListAnalysisRegion
): void {
    regionAnalysis.literalListContinuations.forEach(range => {
        const parentIndex = region.sourceIndices[range.parentIndex];
        const startIndex = region.sourceIndices[range.startIndex];
        const endIndex = region.sourceIndices[range.endIndex];
        const markerIndices = range.markerIndices.map(index => region.sourceIndices[index]);
        if (parentIndex !== undefined && startIndex !== undefined && endIndex !== undefined &&
            markerIndices.every((index): index is number => index !== undefined)) {
            target.literalListContinuations.push({
                ...range,
                parentIndex,
                startIndex,
                endIndex,
                markerIndices
            });
        }
    });
    regionAnalysis.referenceDefinitionRanges.forEach(range => {
        const startIndex = region.sourceIndices[range.startIndex];
        const endIndex = region.sourceIndices[range.endIndex];
        if (startIndex !== undefined && endIndex !== undefined) {
            target.referenceDefinitionRanges.push({ startIndex, endIndex });
        }
    });
    regionAnalysis.normalizedLines.forEach((line, index) => {
        const sourceIndex = region.sourceIndices[index];
        if (sourceIndex !== undefined) {
            target.normalizedLines.set(sourceIndex, line);
        }
    });
    regionAnalysis.invalidLines.forEach(index => {
        const sourceIndex = region.sourceIndices[index];
        if (sourceIndex !== undefined) {
            target.invalidLines.add(sourceIndex);
        }
    });
    regionAnalysis.candidateListLines.forEach(index => {
        const sourceIndex = region.sourceIndices[index];
        if (sourceIndex !== undefined) {
            target.candidateListLines.add(sourceIndex);
        }
    });
    regionAnalysis.interruptedParagraphs.forEach(paragraph => {
        const paragraphStartIndex = region.sourceIndices[paragraph.paragraphStartIndex];
        const listStartIndex = region.sourceIndices[paragraph.listStartIndex];
        const endIndex = region.sourceIndices[paragraph.endIndex];
        if (paragraphStartIndex !== undefined && listStartIndex !== undefined &&
            endIndex !== undefined) {
            target.interruptedParagraphs.push({
                paragraphStartIndex,
                listStartIndex,
                endIndex
            });
        }
    });
}

export function validateListBlocks(
    doc: Text,
    settings: ListSpacingSettings = { enableListsWithoutPrecedingBlankline: false }
): Set<number> {
    const lines = doc.toString().split('\n');
    const zeroBasedIndices = ListBlockValidator.validateListBlocks(lines, settings);

    return new Set(Array.from(zeroBasedIndices, index => index + 1));
}

function isDefinitionListStart(
    lines: string[],
    paragraphStartIndex: number,
    markerIndex: number,
    enableListsWithoutPrecedingBlankline: boolean
): boolean {
    if (paragraphStartIndex !== markerIndex - 1) {
        return false;
    }

    return isDefinitionListContainerTransition(
        lines[paragraphStartIndex],
        lines[markerIndex],
        enableListsWithoutPrecedingBlankline
    );
}

function isDefinitionListContainerTransition(
    termLine: string,
    markerLine: string,
    enableListsWithoutPrecedingBlankline: boolean
): boolean {
    const termDepth = getBlockQuoteDepth(termLine);
    const markerDepth = getBlockQuoteDepth(markerLine);
    const marker = parsePandocListMarker(markerLine, true);
    return termDepth === markerDepth ||
        (termDepth > markerDepth && (
            !enableListsWithoutPrecedingBlankline ||
            (marker?.indentColumns ?? 0) >= 4
        ));
}

function isDefinitionMarkerInListContainer(
    listContainerDepth: number,
    markerLine: string,
    enableListsWithoutPrecedingBlankline: boolean
): boolean {
    const marker = parsePandocListMarker(markerLine, true);
    return getBlockQuoteDepth(markerLine) >= listContainerDepth ||
        !enableListsWithoutPrecedingBlankline ||
        (marker?.indentColumns ?? 0) >= 4;
}

function continuesListAfterBlank(
    line: string,
    rootIndentColumns: number,
    continuationIndentColumns: number
): boolean {
    const marker = parsePandocListMarker(line, true);
    if (marker) {
        return marker.indentColumns >= rootIndentColumns;
    }

    const content = getPandocContainerContent(line);
    const indent = content.match(/^([ \t]*)/)?.[1] ?? '';
    return getIndentColumns(indent) >= continuationIndentColumns;
}
