import { MarkdownRenderChild } from 'obsidian';

import { escapePandocListMarker, parsePandocListMarker } from '../../../shared/utils/pandocListMarkers';
import { ListBlockValidator } from '../../../shared/utils/listBlockValidator';
import { getBlockQuoteDepth, getFenceOpening, isFenceClosing } from '../../../shared/utils/pandocBlockBoundaries';
import { ReadingModeContext } from '../../pipeline/types';
import { renderMarkdownFragment } from '../../utils/fragmentRenderer';
import { findNativeListItem } from './sourceDomMatcher';
import { renderBlockQuoteLeadText, renderNativeListLeadText, renderParagraphText } from './sourceSignature';
import { restoreLiteralQuotePrefixes } from './quoteInlineContent';
import {
    escapeExcessBlockQuoteMarkers,
    findSourceItemSubtreeEnd,
    getComparableNativeListText,
    getNativeListSourceTextOccurrence,
    getRenderableNativeListLineIndices,
    getRenderableSourceLineIndices,
    normalizeNativeListText,
    parseNativeListLine,
    stripBlockQuotePrefix
} from './sourceLine';

export interface LazyBlockQuoteSourceRegion {
    startIndex: number;
    endIndex: number;
    depth: number;
}

/** Explicit quote prefixes make Pandoc's lazy container ownership visible to
 * Obsidian. Physical blanks and Pandoc endline lookahead end that ownership. */
export function findLazyBlockQuoteSourceRegions(
    lines: string[],
    enabled: boolean
): LazyBlockQuoteSourceRegion[] {
    const regions: LazyBlockQuoteSourceRegion[] = [];
    const visibleIndices = getRenderableSourceLineIndices(lines);
    let listParagraph = false;
    for (let index = 0; index < lines.length; index++) {
        if (!visibleIndices.has(index)) {
            continue;
        }
        if (!lines[index].trim()) {
            listParagraph = false;
            continue;
        }
        const depth = getBlockQuoteDepth(lines[index]);
        if (!depth || listParagraph) {
            listParagraph ||= parsePandocListMarker(lines[index], false) !== null;
            continue;
        }
        const startIndex = index;
        let fence: ReturnType<typeof getFenceOpening> = null;
        while (index + 1 < lines.length) {
            const next = lines[index + 1];
            const explicitDepth = getBlockQuoteDepth(next);
            const content = stripBlockQuotePrefix(next);
            if (!next.trim()) {
                break;
            }
            if (fence) {
                index++;
                if (isFenceClosing(content, fence)) {
                    fence = null;
                }
                continue;
            }
            const opening = getFenceOpening(lines, index + 1, content);
            if (explicitDepth < depth && (
                /^ {0,3}(?:=+|-+)[ \t]*$/.test(content) ||
                opening?.character === '`' ||
                (enabled && parsePandocListMarker(next, false))
            )) {
                break;
            }
            fence = opening;
            index++;
        }
        regions.push({ startIndex, endIndex: index, depth });
    }
    return regions;
}

export async function reconcileLazyBlockQuoteContent(
    lines: string[],
    context: ReadingModeContext,
    root: HTMLElement,
    isCurrent: () => boolean,
    invalidLines = ListBlockValidator.validateListBlocks(lines, context.config)
): Promise<void> {
    await reconcileListQuoteContinuations(lines, context, root, isCurrent);
    const regions = findLazyBlockQuoteSourceRegions(
        lines,
        context.config.enableListsWithoutPrecedingBlankline
    );
    // Resolve occurrences against the same DOM snapshot. Earlier replacements
    // must not change the occurrence number for a later repeated paragraph.
    const matches: Array<HTMLElement | null> = [];
    const paragraphOccurrences = new Map<string, number>();
    for (const region of regions) {
        matches.push(await findSourceQuote(lines, region, context, root, paragraphOccurrences));
        if (!isCurrent()) {
            return;
        }
    }
    for (const [index, region] of regions.entries()) {
        if (!isCurrent()) {
            return;
        }
        const quote = matches[index];
        if (!quote || !isCurrent() || !root.contains(quote)) {
            continue;
        }
        await reconcileQuoteRegion(lines, region, quote, context, root, isCurrent, invalidLines);
    }
}

async function findSourceQuote(
    lines: string[],
    region: LazyBlockQuoteSourceRegion,
    context: ReadingModeContext,
    root: HTMLElement,
    paragraphOccurrences: Map<string, number>
): Promise<HTMLElement | null> {
    const source = lines[region.startIndex];
    const parsed = parseNativeListLine(source);
    if (parsed) {
        const expectedLeadText = context.app
            ? await renderNativeListLeadText(source, context)
            : normalizeNativeListText(getComparableNativeListText(parsed.itemText));
        if (expectedLeadText === null) {
            return null;
        }
        return findNativeListItem(root, {
            sourceLine: { ...parsed, source, index: region.startIndex },
            expectedLeadText
        }, lines)?.item.closest('blockquote') ?? null;
    }
    const expectedText = context.app
        ? await renderBlockQuoteLeadText(lines.slice(region.startIndex, region.endIndex + 1).join('\n'), context)
        : getUnrenderedQuoteLeadText(lines, region);
    if (expectedText === null) {
        return null;
    }
    const occurrenceKey = `${region.depth}:${expectedText}`;
    const sourceOccurrence = paragraphOccurrences.get(occurrenceKey) ?? 0;
    paragraphOccurrences.set(occurrenceKey, sourceOccurrence + 1);
    const matchingParagraphs = Array.from(root.querySelectorAll('blockquote > p'))
        .filter(paragraph => normalizeNativeListText(paragraph.textContent ?? '') === expectedText &&
            getQuoteDomDepth(paragraph, root) === region.depth);
    return matchingParagraphs[sourceOccurrence]?.parentElement ?? null;
}

function getUnrenderedQuoteLeadText(lines: string[], region: LazyBlockQuoteSourceRegion): string {
    const paragraphLines = [stripBlockQuotePrefix(lines[region.startIndex])];
    for (let index = region.startIndex + 1; index <= region.endIndex; index++) {
        const content = stripBlockQuotePrefix(lines[index]);
        if (!content.trim() || /^(?: {4}|\t| {0,3}#{1,6}\s)/.test(content) ||
            parseNativeListLine(content) || getFenceOpening(lines, index, content)) {
            break;
        }
        paragraphLines.push(content);
    }
    return normalizeNativeListText(getComparableNativeListText(paragraphLines.join('\n')));
}

function getQuoteDomDepth(paragraph: Element, root: HTMLElement): number {
    let depth = 0;
    let current = paragraph.parentElement;
    while (current && current !== root) {
        if (current.matches('blockquote')) {
            depth++;
        }
        current = current.parentElement;
    }
    return depth;
}

async function reconcileQuoteRegion(
    lines: string[],
    region: LazyBlockQuoteSourceRegion,
    quote: HTMLElement,
    context: ReadingModeContext,
    root: HTMLElement,
    isCurrent: () => boolean,
    invalidLines: Set<number>
): Promise<void> {
    const quoteBlock = quote.parentElement?.matches('.el-blockquote')
        ? quote.parentElement : quote;
    for (let index = region.startIndex + 1; index <= region.endIndex; index++) {
        if (getBlockQuoteDepth(lines[index]) >= region.depth) {
            continue;
        }
        const next = quoteBlock.nextElementSibling;
        if (!next?.instanceOf(HTMLElement)) {
            return;
        }
        const source = stripBlockQuotePrefix(lines[index]);
        const pre = next.matches('pre') ? next : next.querySelector(':scope > pre');
        const fence = getFenceOpening(lines, index, source);
        if (fence && pre && fence.character === '~') {
            let endIndex = index + 1;
            while (endIndex <= region.endIndex &&
                !isFenceClosing(stripBlockQuotePrefix(lines[endIndex]), fence)) {
                endIndex++;
            }
            const code = lines.slice(index + 1, endIndex).map(stripBlockQuotePrefix).join('\n');
            if (normalizeCode(pre.querySelector('code')?.textContent ?? '') !== normalizeCode(code)) {
                return;
            }
            if (!isCurrent() || !root.contains(quote) || !root.contains(next)) {
                return;
            }
            quote.appendChild(getOwnedBlock(pre, next));
            index = endIndex;
        } else if (pre && /^[ \t]{4,}/.test(source)) {
            index = await reconcileIndentedCode(
                lines, index, region.endIndex, pre, next, quote, context, root,
                isCurrent, invalidLines
            );
        } else if (/^\s*(?:\*\s*){3,}$|^\s*(?:_\s*){3,}$/.test(source) &&
            (next.matches('hr') || next.querySelector(':scope > hr'))) {
            const finalItem = quote.querySelector('ul:last-child > li:last-child, ol:last-child > li:last-child');
            if (!finalItem || !isCurrent() || !root.contains(next)) {
                return;
            }
            finalItem.appendChild(document.createTextNode(`\n${source.trim()}`));
            const rule = next.matches('hr') ? next : next.querySelector(':scope > hr');
            if (rule) {
                getOwnedBlock(rule, next).remove();
            }
        }
    }
}

async function reconcileIndentedCode(
    lines: string[],
    index: number,
    regionEndIndex: number,
    pre: Element,
    block: HTMLElement,
    quote: HTMLElement,
    context: ReadingModeContext,
    root: HTMLElement,
    isCurrent: () => boolean,
    invalidLines: Set<number>
): Promise<number> {
    let endIndex = index;
    while (endIndex < regionEndIndex && /^[ \t]{4,}\S/.test(lines[endIndex + 1])) {
        endIndex++;
    }
    const codeLines = lines.slice(index, endIndex + 1).map(line => line.replace(/^(?: {4}|\t)/, ''));
    const code = pre.querySelector('code');
    const codeText = code?.textContent ?? '';
    const preParent = pre.parentElement;
    const precedingContent = quote.lastElementChild;
    if (normalizeCode(codeText) !== normalizeCode(codeLines.join('\n'))) {
        return endIndex;
    }
    const content = codeLines.map(line => line.trimStart());
    const source = content.map((line, offset) => invalidLines.has(index + offset)
        ? escapePandocListMarker(line) : line).join('\n');
    const rendered = await renderContent(source, context);
    if (!isCurrent() || !root.contains(block) || !root.contains(quote) ||
        pre.parentElement !== preParent || pre.querySelector('code') !== code ||
        code?.textContent !== codeText || quote.lastElementChild !== precedingContent) {
        return endIndex;
    }
    appendQuoteContent(quote, rendered);
    getOwnedBlock(pre, block).remove();
    return endIndex;
}

async function reconcileListQuoteContinuations(
    lines: string[],
    context: ReadingModeContext,
    root: HTMLElement,
    isCurrent: () => boolean
): Promise<void> {
    const visibleListIndices = getRenderableNativeListLineIndices(lines);
    for (let index = 0; index < lines.length; index++) {
        if (!visibleListIndices.has(index)) {
            continue;
        }
        const parsed = parseNativeListLine(lines[index]);
        if (!parsed || !getBlockQuoteDepth(lines[index + 1] ?? '') ||
            getBlockQuoteDepth(lines[index + 1]) <= getBlockQuoteDepth(lines[index])) {
            continue;
        }
        const endIndex = findSourceItemSubtreeEnd(index, parsed.indentColumns, lines);
        const continuation = lines.slice(index + 1, endIndex + 1);
        if (continuation.some(line => !line.trim())) {
            continue;
        }
        const expectedLeadText = normalizeNativeListText(getComparableNativeListText(parsed.itemText));
        const occurrence = getNativeListSourceTextOccurrence(lines, { ...parsed, index });
        const items = Array.from(root.querySelectorAll<HTMLLIElement>('li')).filter(item => {
            if (item.parentElement?.tagName.toLowerCase() !== parsed.kind) {
                return false;
            }
            const clone = item.cloneNode(true) as HTMLElement;
            clone.querySelectorAll('blockquote, ul, ol').forEach(child => child.remove());
            return normalizeNativeListText(clone.textContent ?? '') === expectedLeadText;
        });
        const item = items[occurrence];
        const quote = item?.querySelector(':scope > blockquote');
        const paragraph = quote?.firstElementChild;
        if (!item || !quote || !paragraph?.matches('p') ||
            getOwnedBlock(paragraph, quote as HTMLElement) !== quote ||
            normalizeNativeListText(quote.textContent ?? '') !== normalizeNativeListText(
                getComparableNativeListText(continuation.map(stripBlockQuotePrefix).join('\n')))) {
            continue;
        }
        const containerDepth = getBlockQuoteDepth(lines[index]);
        const source = continuation.map(line => stripBlockQuotePrefix(
            escapeExcessBlockQuoteMarkers(line.trimStart(), containerDepth)
        )).join('\n');
        const expectedText = context.app ? await renderParagraphText(source, context)
            : getComparableNativeListText(source);
        if (!isCurrent() || !root.contains(item) || quote.parentElement !== item) {
            return;
        }
        if (expectedText === null || !restoreLiteralQuotePrefixes(paragraph as HTMLElement, expectedText)) {
            continue;
        }
        quote.before(document.createTextNode('\n'), ...Array.from(paragraph.childNodes));
        quote.remove();
    }
}

async function renderContent(source: string, context: ReadingModeContext): Promise<HTMLElement> {
    const target = document.createElement('div');
    if (!context.app) {
        const paragraph = target.appendChild(document.createElement('p'));
        paragraph.textContent = source.replace(/\\([>\-*+.()])/g, '$1');
        return target;
    }
    const child = new MarkdownRenderChild(target);
    context.postProcessorContext.addChild?.(child);
    await renderMarkdownFragment(source, target, context, child);
    return target;
}

function getOwnedBlock(content: Element, wrapper: HTMLElement): HTMLElement {
    return content === wrapper || Array.from(wrapper.childNodes).every(node =>
        node === content || (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()))
        ? wrapper : content as HTMLElement;
}

function appendQuoteContent(quote: HTMLElement, rendered: HTMLElement): void {
    const previous = quote.lastElementChild;
    const first = rendered.firstElementChild;
    if (previous?.tagName === first?.tagName && first?.matches('p, ul, ol')) {
        previous?.appendChild(document.createTextNode('\n'));
        previous?.append(...Array.from(first.childNodes));
        first.remove();
    }
    quote.append(...Array.from(rendered.childNodes));
}

function normalizeCode(text: string): string {
    return text.replace(/\n$/, '');
}
