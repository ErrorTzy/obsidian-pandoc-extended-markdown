import {
    escapePandocListMarker,
    InterruptedListParagraph,
    ListBlockValidator
} from '../../../shared/utils/listBlockValidator';
import { getBlockQuoteDepth } from '../../../shared/utils/pandocBlockBoundaries';
import { waitForFencedDivRun } from '../../features/fenced-divs/processingCoordinator';
import { reconcileLazyBlockQuoteContent } from '../../features/native-lists/lazyBlockQuoteContent';
import { reconcileLiteralListContinuations } from '../../features/native-lists/literalContinuationReconciler';
import {
    replaceInterruptedListParagraph
} from '../../features/native-lists/interruptedParagraphRenderer';
import {
    createSourceOwnedSuffixMatch,
    getSourceOwnedSuffixCandidate,
    matchSourceOwnedBlockSuffix,
    SourceOwnedSuffixMatch
} from '../../features/native-lists/sourceOwnedBlockSuffix';
import {
    findLazyBlockQuoteListRelocations,
    MatchedLazyBlockQuoteRelocation,
    relocateLazyBlockQuoteListItems
} from '../../features/native-lists/blockQuoteRelocation';
import {
    findFootnoteListRelocations,
    MatchedFootnoteListRelocation,
    relocateFootnoteListItems
} from '../../features/native-lists/footnoteRelocation';
import {
    renderBlockQuoteLeadText,
    renderNativeListLeadText,
    renderParagraphText
} from '../../features/native-lists/sourceSignature';
import {
    findNativeListGroup,
    findNativeListItem,
    getRootNativeListElements,
    hasMaterializedTailInsideMatchedItem,
    markNativeListGroupScheduled,
    NativeListGroupMatch,
    NativeListReplacementLine,
    NativeListSourceLine
} from '../../features/native-lists/sourceDomMatcher';
import { getDirectListItems } from '../../features/native-lists/nativeListDom';
import {
    escapeExcessBlockQuoteMarkers,
    findInterruptedSourceSubtreeEnd,
    findSourceItemSubtreeEnd,
    getComparableNativeListText,
    normalizeNativeListText,
    ParsedNativeListLine,
    parseNativeListLine,
    rewriteIndentedBacktickCodeSpans,
    stripBlockQuotePrefix
} from '../../features/native-lists/sourceLine';
import { readFullSourceText } from '../sourceText';
import { BlockDomProcessor, ReadingModeContext } from '../types';

type CurrentRunCheck = () => boolean;

const alwaysCurrent: CurrentRunCheck = () => true;
const rootGenerations = new WeakMap<HTMLElement, number>();

export class NativeListSpacingProcessor implements BlockDomProcessor {
    name = 'native-list-spacing';
    phase = 'block' as const;
    priority = 70;

    isEnabled(context: ReadingModeContext): boolean {
        return Boolean(context.sectionInfo?.text);
    }

    process(context: ReadingModeContext): void {
        if (context.app) {
            runAfterPreviewSettles(() => {
                const root = getPreviewRoot(context);
                const isCurrent = beginRootGeneration(root);
                void this.processWithFullSource(context, root, isCurrent);
            });
            return;
        }

        this.processWithSourceResolver(context, list => getSourceTextForList(list, context));
    }

    private async processWithFullSource(
        context: ReadingModeContext,
        root: HTMLElement,
        isCurrent: CurrentRunCheck
    ): Promise<void> {
        await waitForFencedDivRun(root);
        if (!isCurrent()) {
            return;
        }
        const fullSourceText = await readFullSourceText(context.sourcePath, context.app);
        if (!isCurrent()) {
            return;
        }
        if (fullSourceText) {
            await this.processWithRenderedSourceResolver(
                context,
                () => fullSourceText,
                root,
                isCurrent
            );
            return;
        }

        await this.processWithRenderedSourceResolver(
            context,
            list => getSourceTextForList(list, context),
            root,
            isCurrent
        );
    }

    private processWithSourceResolver(
        context: ReadingModeContext,
        getSourceText: (list: HTMLElement) => string,
        root: HTMLElement = context.section ?? context.element
    ): void {
        const lists = getRootNativeListElements(root, context.element)
            .filter(list => root.contains(list));
        const processedSources = new Set<string>();

        lists.forEach(list => {
            const sourceText = getSourceText(list);
            if (!sourceText || processedSources.has(sourceText)) {
                return;
            }

            processedSources.add(sourceText);
            processSourceText(sourceText, context, root);
        });
    }

    private async processWithRenderedSourceResolver(
        context: ReadingModeContext,
        getSourceText: (list: HTMLElement) => string,
        root: HTMLElement,
        isCurrent: CurrentRunCheck
    ): Promise<void> {
        if (!isCurrent()) {
            return;
        }
        const lists = getRootNativeListElements(root, context.element)
            .filter(list => root.contains(list));
        const processedSources = new Set<string>();

        // Source-aware container repair also handles list markers which the host
        // materialized as code, so a native list is not a prerequisite.
        for (const list of lists.length ? lists : [root]) {
            if (!isCurrent()) {
                return;
            }
            const sourceText = getSourceText(list);
            if (!sourceText || processedSources.has(sourceText)) {
                continue;
            }

            processedSources.add(sourceText);
            await processSourceTextWithRenderedSignatures(
                sourceText,
                context,
                root,
                isCurrent
            );
        }
    }
}

function processSourceText(
    sourceText: string,
    context: ReadingModeContext,
    root: HTMLElement
): void {
    const sourceLines = sourceText.split('\n');
    const analysis = ListBlockValidator.analyzeListBlocks(sourceLines, context.config);
    relocateLazyBlockQuoteLists(sourceLines, analysis.invalidLines, context, root);
    const relocatedFootnoteLists = relocateFootnoteLists(sourceLines, root);
    const analysisLines = analysis.sourceLines;
    const currentLists = getRootNativeListElements(root, context.element)
        .filter(list => root.contains(list));

    analysis.interruptedParagraphs.forEach(paragraph => {
        const rootLines = getRootNativeLines(analysisLines, analysis.invalidLines, paragraph);
        const matchLines = rootLines.map(sourceLine => ({
            sourceLine,
            expectedLeadText: normalizeNativeListText(
                getComparableNativeListText(sourceLine.itemText)
            )
        }));
        const paragraphText = getUnrenderedParagraphText(analysisLines, paragraph);
        scheduleInterruptedParagraph(
            analysisLines,
            analysis.invalidLines,
            paragraph,
            matchLines,
            paragraphText,
            currentLists,
            context,
            root,
            alwaysCurrent,
            relocatedFootnoteLists.get(paragraph.listStartIndex),
            createSourceOwnedSuffixMatch(getSourceOwnedSuffixCandidate(
                analysisLines,
                analysis.invalidLines,
                paragraph,
                rootLines
            ))
        );
    });
}

function getUnrenderedParagraphText(
    sourceLines: string[],
    paragraph: InterruptedListParagraph
): string {
    const paragraphDepth = getBlockQuoteDepth(sourceLines[paragraph.paragraphStartIndex]);
    const visibleLines = sourceLines
        .slice(paragraph.paragraphStartIndex, paragraph.listStartIndex)
        .filter(line => getBlockQuoteDepth(line) <= paragraphDepth)
        .map(stripBlockQuotePrefix);
    return normalizeNativeListText(getComparableNativeListText(visibleLines.join(' ')));
}

async function processSourceTextWithRenderedSignatures(
    sourceText: string,
    context: ReadingModeContext,
    root: HTMLElement,
    isCurrent: CurrentRunCheck
): Promise<void> {
    const sourceLines = sourceText.split('\n');
    const analysis = ListBlockValidator.analyzeListBlocks(sourceLines, context.config);
    const renderedLeadTextCache = new Map<string, Promise<string | null>>();
    await reconcileLazyBlockQuoteContent(sourceLines, context, root, isCurrent, analysis.invalidLines);
    if (!isCurrent()) {
        return;
    }
    await relocateLazyBlockQuoteListsWithRenderedSignatures(
        sourceLines,
        analysis.invalidLines,
        context,
        root,
        renderedLeadTextCache,
        isCurrent
    );
    const relocatedFootnoteLists = await relocateFootnoteListsWithRenderedSignatures(
        sourceLines,
        context,
        root,
        renderedLeadTextCache,
        isCurrent
    );
    if (!isCurrent()) {
        return;
    }
    const analysisLines = analysis.sourceLines;
    await reconcileLiteralListContinuations(
        analysisLines,
        analysis.literalListContinuations,
        context,
        root,
        isCurrent
    );
    if (!isCurrent()) {
        return;
    }
    const currentLists = getRootNativeListElements(root, context.element)
        .filter(list => root.contains(list));

    for (const paragraph of analysis.interruptedParagraphs) {
        if (!isCurrent()) {
            return;
        }
        const rootLines = getRootNativeLines(analysisLines, analysis.invalidLines, paragraph);
        const renderedLeadTexts: Array<string | null> = [];
        for (const line of rootLines) {
            const itemEndIndex = findSourceItemSubtreeEnd(
                line.index,
                line.indentColumns,
                analysisLines
            );
            const subtreeSource = analysisLines
                .slice(line.index, itemEndIndex + 1)
                .join('\n');
            const subtreeLeadText = await getRenderedLeadText(
                subtreeSource,
                context,
                renderedLeadTextCache
            );
            if (!isCurrent()) {
                return;
            }
            renderedLeadTexts.push(subtreeLeadText ?? await getRenderedLeadText(
                line.source,
                context,
                renderedLeadTextCache
            ));
            if (!isCurrent()) {
                return;
            }
        }
        if (renderedLeadTexts.some(text => text === null)) {
            continue;
        }

        const paragraphText = await renderParagraphText(
            analysisLines.slice(paragraph.paragraphStartIndex, paragraph.listStartIndex).join('\n'),
            context
        );
        if (!isCurrent()) {
            return;
        }
        if (paragraphText === null) {
            continue;
        }

        const matchLines = rootLines.map((sourceLine, index) => ({
            sourceLine,
            expectedLeadText: renderedLeadTexts[index] as string
        }));
        const suffixCandidate = getSourceOwnedSuffixCandidate(
            analysisLines,
            analysis.invalidLines,
            paragraph,
            rootLines
        );
        let suffixMatch: SourceOwnedSuffixMatch | null = null;
        if (suffixCandidate) {
            const suffixLeadText = suffixCandidate.kind === 'list'
                ? await getRenderedLeadText(
                    suffixCandidate.source,
                    context,
                    renderedLeadTextCache
                )
                : await renderBlockQuoteLeadText(suffixCandidate.source, context);
            if (!isCurrent()) {
                return;
            }
            if (suffixLeadText !== null) {
                suffixMatch = { ...suffixCandidate, expectedLeadText: suffixLeadText };
            }
        }
        scheduleInterruptedParagraph(
            analysisLines,
            analysis.invalidLines,
            paragraph,
            matchLines,
            paragraphText,
            currentLists,
            context,
            root,
            isCurrent,
            relocatedFootnoteLists.get(paragraph.listStartIndex),
            suffixMatch
        );
    }
}

function relocateLazyBlockQuoteLists(
    sourceLines: string[],
    invalidLines: Set<number>,
    context: ReadingModeContext,
    root: HTMLElement
): void {
    const relocations = findLazyBlockQuoteListRelocations(
        sourceLines,
        invalidLines,
        context.config.enableListsWithoutPrecedingBlankline
    );
    const matched = relocations.map(relocation => {
        const expectedLeadText = normalizeNativeListText(
            getComparableNativeListText(relocation.sourceLine.itemText)
        );
        const match = findNativeListItem(root, {
            sourceLine: relocation.sourceLine,
            expectedLeadText
        }, sourceLines);
        return match ? { ...relocation, match } : null;
    });
    if (matched.every((item): item is MatchedLazyBlockQuoteRelocation => item !== null)) {
        relocateLazyBlockQuoteListItems(root, matched);
    }
}

async function relocateLazyBlockQuoteListsWithRenderedSignatures(
    sourceLines: string[],
    invalidLines: Set<number>,
    context: ReadingModeContext,
    root: HTMLElement,
    cache: Map<string, Promise<string | null>>,
    isCurrent: CurrentRunCheck
): Promise<void> {
    const relocations = findLazyBlockQuoteListRelocations(
        sourceLines,
        invalidLines,
        context.config.enableListsWithoutPrecedingBlankline
    );
    const matched: MatchedLazyBlockQuoteRelocation[] = [];
    for (const relocation of relocations) {
        const expectedLeadText = await getRenderedLeadText(
            relocation.sourceLine.source,
            context,
            cache
        );
        if (!isCurrent() || expectedLeadText === null) {
            return;
        }
        const match = findNativeListItem(root, {
            sourceLine: relocation.sourceLine,
            expectedLeadText
        }, sourceLines);
        if (!match) {
            return;
        }
        matched.push({ ...relocation, match });
    }
    if (isCurrent()) {
        relocateLazyBlockQuoteListItems(root, matched);
    }
}

function relocateFootnoteLists(
    sourceLines: string[],
    root: HTMLElement
): Map<number, HTMLElement> {
    const matched = findFootnoteListRelocations(sourceLines).map(relocation => {
        const expectedLeadText = normalizeNativeListText(
            getComparableNativeListText(relocation.sourceLine.itemText)
        );
        return {
            ...relocation,
            match: findNativeListItem(root, {
                sourceLine: relocation.sourceLine,
                expectedLeadText
            }, sourceLines)
        };
    });
    return relocateFootnoteListItems(root, matched);
}

async function relocateFootnoteListsWithRenderedSignatures(
    sourceLines: string[],
    context: ReadingModeContext,
    root: HTMLElement,
    cache: Map<string, Promise<string | null>>,
    isCurrent: CurrentRunCheck
): Promise<Map<number, HTMLElement>> {
    const matched: MatchedFootnoteListRelocation[] = [];
    for (const relocation of findFootnoteListRelocations(sourceLines)) {
        const expectedLeadText = await getRenderedLeadText(
            relocation.sourceLine.source,
            context,
            cache
        );
        if (!isCurrent()) {
            return new Map();
        }
        matched.push({
            ...relocation,
            match: expectedLeadText === null ? null : findNativeListItem(root, {
                sourceLine: relocation.sourceLine,
                expectedLeadText
            }, sourceLines)
        });
    }
    return relocateFootnoteListItems(root, matched);
}

function getRenderedLeadText(
    source: string,
    context: ReadingModeContext,
    cache: Map<string, Promise<string | null>>
): Promise<string | null> {
    const cached = cache.get(source);
    if (cached) {
        return cached;
    }

    const rendered = renderNativeListLeadText(source, context);
    cache.set(source, rendered);
    return rendered;
}

function scheduleInterruptedParagraph(
    sourceLines: string[],
    invalidLines: Set<number>,
    paragraph: InterruptedListParagraph,
    rootLines: NativeListReplacementLine[],
    paragraphText: string,
    lists: HTMLElement[],
    context: ReadingModeContext,
    root: HTMLElement,
    isCurrent: CurrentRunCheck,
    preferredList?: HTMLElement,
    sourceOwnedSuffix?: SourceOwnedSuffixMatch | null
): void {
    if (!isCurrent()) {
        return;
    }
    const match = findNativeListGroup(
        lists,
        rootLines,
        sourceLines,
        paragraphText,
        root,
        preferredList
    );
    if (!match) {
        return;
    }

    const sourceOwnedBlockSuffix = matchSourceOwnedBlockSuffix(
        match,
        sourceOwnedSuffix ?? null,
        sourceLines,
        root,
        rootLines[0].sourceLine.indentColumns
    );
    const endIndex = sourceOwnedBlockSuffix
        ? paragraph.endIndex
        : findInterruptedSourceSubtreeEnd(
            match.lines[match.lines.length - 1].sourceLine.index,
            rootLines[0].sourceLine.indentColumns,
            paragraph.endIndex,
            hasMaterializedTailInsideMatchedItem(match),
            sourceLines
        );
    const didSchedule = replaceInterruptedListParagraph({
        listSegments: match.segments,
        sourceLines: sourceLines.slice(paragraph.paragraphStartIndex, endIndex + 1),
        listStartOffset: paragraph.listStartIndex - paragraph.paragraphStartIndex,
        transformedParagraphSource: transformInterruptedParagraph(
            sourceLines,
            invalidLines,
            paragraph,
            endIndex
        ),
        remainingListStart: findRemainingOrderedListStart(
            match,
            sourceLines,
            endIndex,
            rootLines[0].sourceLine.indentColumns
        ),
        sourceOwnedBlockSuffix,
        root,
        context,
        isCurrent
    });

    if (didSchedule) {
        markNativeListGroupScheduled(match, isCurrent);
    }
}

function getSourceTextForList(list: HTMLElement, context: ReadingModeContext): string {
    return (context.section
        ? context.postProcessorContext.getSectionInfo?.(context.section)?.text
        : null) ??
        context.postProcessorContext.getSectionInfo?.(list)?.text ??
        context.sectionInfo?.text ??
        '';
}

function getRootNativeLines(
    sourceLines: string[],
    invalidLines: Set<number>,
    paragraph: InterruptedListParagraph
): NativeListSourceLine[] {
    const candidates = sourceLines
        .map((source, index) => ({ source, index, parsed: parseNativeListLine(source) }))
        .filter((line): line is {
            source: string;
            index: number;
            parsed: ParsedNativeListLine;
        } => invalidLines.has(line.index) &&
            line.index >= paragraph.listStartIndex &&
            line.index <= paragraph.endIndex &&
            line.parsed !== null)
        .map(line => ({ ...line.parsed, source: line.source, index: line.index }));

    if (candidates.length === 0) {
        return [];
    }

    const rootIndent = Math.min(...candidates.map(line => line.indentColumns));
    return candidates.filter(line => line.indentColumns === rootIndent);
}

function getPreviewRoot(context: ReadingModeContext): HTMLElement {
    return context.element.closest<HTMLElement>('.markdown-preview-section') ??
        context.section?.closest<HTMLElement>('.markdown-preview-section') ??
        context.section ??
        context.element;
}

function findRemainingOrderedListStart(
    match: NativeListGroupMatch,
    sourceLines: string[],
    endIndex: number,
    rootIndentColumns: number
): number | undefined {
    const finalSegment = match.segments[match.segments.length - 1];
    if (!finalSegment || finalSegment.list.tagName !== 'OL' ||
        finalSegment.itemCount >= getDirectListItems(finalSegment.list).length) {
        return undefined;
    }

    for (let index = endIndex + 1; index < sourceLines.length; index++) {
        const parsed = parseNativeListLine(sourceLines[index]);
        if (!parsed || parsed.indentColumns !== rootIndentColumns) {
            continue;
        }
        return parsed.kind === 'ol' ? parsed.startNumber : undefined;
    }

    return undefined;
}

function transformInterruptedParagraph(
    sourceLines: string[],
    invalidLines: Set<number>,
    paragraph: InterruptedListParagraph,
    endIndex: number
): string {
    const paragraphBlockQuoteDepth = getBlockQuoteDepth(
        sourceLines[paragraph.paragraphStartIndex]
    );
    const transformedLines = sourceLines
        .slice(paragraph.paragraphStartIndex, endIndex + 1)
        .map((line, offset) => {
            const lineIndex = paragraph.paragraphStartIndex + offset;
            const escapedMarker = invalidLines.has(lineIndex)
                ? escapePandocListMarker(line)
                : line;
            return escapeExcessBlockQuoteMarkers(
                escapedMarker,
                paragraphBlockQuoteDepth
            );
        });
    return rewriteIndentedBacktickCodeSpans(transformedLines).join('\n');
}

function runAfterPreviewSettles(callback: () => void): void {
    if (typeof window.requestAnimationFrame !== 'function') {
        window.setTimeout(callback, 0);
        return;
    }

    window.requestAnimationFrame(() => window.requestAnimationFrame(callback));
}

function beginRootGeneration(root: HTMLElement): CurrentRunCheck {
    const generation = (rootGenerations.get(root) ?? 0) + 1;
    rootGenerations.set(root, generation);
    return () => rootGenerations.get(root) === generation;
}
