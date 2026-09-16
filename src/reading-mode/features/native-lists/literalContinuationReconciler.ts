import { MarkdownRenderChild, MarkdownRenderer } from 'obsidian';

import { LiteralListContinuation } from '../../../shared/utils/pandocListItemContinuations';
import {
    escapePandocListMarker,
    getPandocContainerContent,
    parsePandocListMarker
} from '../../../shared/utils/pandocListMarkers';

import { ReadingModeContext } from '../../pipeline/types';
import { renderMarkdownFragment } from '../../utils/fragmentRenderer';
import {
    findNativeListItem,
    getDirectItems,
    NativeListItemMatch,
    NativeListReplacementLine
} from './sourceDomMatcher';
import { getNativeListItemLeadText, renderNativeListLeadText } from './sourceSignature';
import {
    normalizeNativeListText,
    parseNativeListLine
} from './sourceLine';

type CurrentRunCheck = () => boolean;

interface PreparedLiteralContinuation {
    parentMatch: NativeListItemMatch;
    materializedBlock: HTMLElement;
    inlineNodes: Node[];
    inlineText: string;
    tailMatch: NativeListItemMatch | null;
}

/**
 * Repairs paragraph continuations which Pandoc keeps in a wide-marker list
 * item but which the host materializes as a root indented-code block.
 */
export async function reconcileLiteralListContinuations(
    sourceLines: string[],
    ranges: LiteralListContinuation[],
    context: ReadingModeContext,
    root: HTMLElement,
    isCurrent: CurrentRunCheck
): Promise<void> {
    if (!context.app || typeof MarkdownRenderer?.render !== 'function') {
        return;
    }

    for (const range of ranges) {
        if (!isCurrent()) {
            return;
        }
        const prepared = await prepareUnderIndentedContinuation(
            sourceLines,
            range,
            context,
            root,
            isCurrent
        );
        if (prepared && isPreparedContinuationCurrent(prepared, root, isCurrent)) {
            applyPreparedContinuation(prepared);
        }
    }
}

async function prepareUnderIndentedContinuation(
    sourceLines: string[],
    range: LiteralListContinuation,
    context: ReadingModeContext,
    root: HTMLElement,
    isCurrent: CurrentRunCheck
): Promise<PreparedLiteralContinuation | null> {
    const parentSource = sourceLines[range.parentIndex];
    const firstMarkerSource = sourceLines[range.markerIndices[0]];
    const parentMarker = parentSource
        ? parsePandocListMarker(parentSource, true)
        : null;
    const firstMarker = firstMarkerSource
        ? parsePandocListMarker(firstMarkerSource, true)
        : null;
    // The host's split-code mismatch is caused by indentation which cannot
    // enter the parent item's content parser. Other literal continuations are
    // already represented in place and must retain their live DOM identity.
    if (range.kind !== 'paragraph' || !parentMarker || !firstMarker ||
        firstMarker.indentColumns >= parentMarker.contentIndentColumns) {
        return null;
    }

    const parentLine = parseNativeListLine(parentSource);
    if (!parentLine) {
        return null;
    }
    const parentLead = await renderNativeListLeadText(parentSource, context);
    if (!isCurrent() || parentLead === null) {
        return null;
    }
    const parentMatch = findNativeListItem(root, {
        sourceLine: { ...parentLine, index: range.parentIndex, source: parentSource },
        expectedLeadText: parentLead
    }, sourceLines);
    if (!parentMatch) {
        return null;
    }

    const fragment = await renderLiteralParagraph(sourceLines, range, context);
    if (!isCurrent() || !fragment) {
        return null;
    }
    const actualLead = normalizeNativeListText(getNativeListItemLeadText(parentMatch.item));
    const expectedLead = normalizeNativeListText(`${parentLead} ${fragment.inlineText}`);
    if (actualLead === expectedLead && !hasParagraphCodeBeforeNestedContent(parentMatch.item)) {
        return null;
    }

    const parentBlock = getListBlock(parentMatch.list);
    const materializedBlock = parentBlock.nextElementSibling;
    if (!materializedBlock?.instanceOf(HTMLElement) ||
        !matchesMaterializedCodeBlock(materializedBlock, sourceLines, range)) {
        return null;
    }

    const nextSibling = findNextSameListSibling(sourceLines, range, parentMarker);
    let tailMatch: NativeListItemMatch | null = null;
    if (nextSibling) {
        tailMatch = await findRenderedSiblingMatch(nextSibling, sourceLines, context, root);
        if (!isCurrent() || !tailMatch ||
            tailMatch.item !== getDirectItems(tailMatch.list)[0] ||
            tailMatch.list.tagName !== parentMatch.list.tagName ||
            getListBlock(tailMatch.list) !== materializedBlock.nextElementSibling) {
            return null;
        }
    } else if (materializedBlock.nextElementSibling?.matches('.el-ul, .el-ol, ul, ol')) {
        // Do not remove an intervening block when a following list cannot be
        // proven to be the next Pandoc sibling of this exact source item.
        return null;
    }

    return {
        parentMatch,
        materializedBlock,
        inlineNodes: fragment.inlineNodes,
        inlineText: fragment.inlineText,
        tailMatch
    };
}

async function renderLiteralParagraph(
    sourceLines: string[],
    range: LiteralListContinuation,
    context: ReadingModeContext
): Promise<{ inlineNodes: Node[]; inlineText: string } | null> {
    const markerIndices = new Set(range.markerIndices);
    const source = sourceLines.slice(range.startIndex, range.endIndex + 1)
        .map((line, offset) => {
            const index = range.startIndex + offset;
            const content = getPandocContainerContent(line).trimStart();
            return markerIndices.has(index) ? escapePandocListMarker(content) : content;
        })
        .join('\n');
    const target = document.createElement('div');
    const child = new MarkdownRenderChild(target);
    context.postProcessorContext.addChild?.(child);
    await renderMarkdownFragment(source, target, context, child);
    const visibleChildren = Array.from(target.children)
        .filter(element => element.textContent?.trim());
    if (visibleChildren.length !== 1 || !visibleChildren[0].matches('p')) {
        child.unload();
        return null;
    }
    const paragraph = visibleChildren[0] as HTMLParagraphElement;
    return {
        inlineNodes: Array.from(paragraph.childNodes),
        inlineText: paragraph.textContent ?? ''
    };
}

function matchesMaterializedCodeBlock(
    block: HTMLElement,
    sourceLines: string[],
    range: LiteralListContinuation
): boolean {
    const code = block.matches('pre')
        ? block.querySelector(':scope > code')
        : block.querySelector(':scope > pre > code');
    if (!code || block.querySelectorAll('pre > code').length !== 1) {
        return false;
    }
    const expected = sourceLines.slice(range.startIndex, range.endIndex + 1)
        .map(line => stripIndentColumns(getPandocContainerContent(line), 4))
        .join('\n')
        .replace(/\n+$/, '');
    return (code.textContent ?? '').replace(/\n+$/, '') === expected;
}

function stripIndentColumns(line: string, columnsToStrip: number): string {
    let offset = 0;
    let columns = 0;
    while (offset < line.length && columns < columnsToStrip) {
        if (line[offset] === ' ') {
            columns++;
            offset++;
            continue;
        }
        if (line[offset] === '\t') {
            columns += 4 - columns % 4;
            offset++;
            continue;
        }
        break;
    }
    return columns >= columnsToStrip ? line.slice(offset) : line;
}

function findNextSameListSibling(
    sourceLines: string[],
    range: LiteralListContinuation,
    parentMarker: NonNullable<ReturnType<typeof parsePandocListMarker>>
): NativeListReplacementLine['sourceLine'] | null {
    for (let index = range.endIndex + 1; index < sourceLines.length; index++) {
        if (!sourceLines[index].trim()) {
            continue;
        }
        const marker = parsePandocListMarker(sourceLines[index], true);
        if (!marker || marker.indentColumns !== parentMarker.indentColumns ||
            marker.kind !== parentMarker.kind ||
            marker.orderedGroup !== parentMarker.orderedGroup) {
            return null;
        }
        const native = parseNativeListLine(sourceLines[index]);
        return native ? { ...native, index, source: sourceLines[index] } : null;
    }
    return null;
}

async function findRenderedSiblingMatch(
    sourceLine: NativeListReplacementLine['sourceLine'],
    sourceLines: string[],
    context: ReadingModeContext,
    root: HTMLElement
): Promise<NativeListItemMatch | null> {
    const expectedLeadText = await renderNativeListLeadText(sourceLine.source, context);
    return expectedLeadText === null ? null : findNativeListItem(root, {
        sourceLine,
        expectedLeadText
    }, sourceLines);
}

function isPreparedContinuationCurrent(
    prepared: PreparedLiteralContinuation,
    root: HTMLElement,
    isCurrent: CurrentRunCheck
): boolean {
    const { parentMatch, materializedBlock, tailMatch } = prepared;
    return isCurrent() && root.contains(parentMatch.item) &&
        parentMatch.item.parentElement === parentMatch.list &&
        root.contains(materializedBlock) &&
        (!tailMatch || root.contains(tailMatch.item) &&
            tailMatch.item.parentElement === tailMatch.list);
}

function applyPreparedContinuation(prepared: PreparedLiteralContinuation): void {
    const { parentMatch, materializedBlock, inlineNodes, tailMatch } = prepared;
    appendInlineContinuation(parentMatch.item, inlineNodes);
    materializedBlock.remove();
    if (!tailMatch || tailMatch.list === parentMatch.list) {
        return;
    }
    getDirectItems(tailMatch.list).forEach(item => parentMatch.list.appendChild(item));
    removeEmptyListBlock(tailMatch.list);
}

function appendInlineContinuation(item: HTMLLIElement, nodes: Node[]): void {
    const directParagraph = Array.from(item.children)
        .find((child): child is HTMLParagraphElement => child.matches('p'));
    const destination = directParagraph ?? item;
    const anchor = directParagraph
        ? directParagraph.querySelector(':scope > a.footnote-back, :scope > a.footnote-backref')
        : Array.from(item.children).find(child =>
            child.matches('ul, ol, pre, blockquote, table, dl, hr, div, a.footnote-back, a.footnote-backref')
        ) ?? null;
    destination.insertBefore(document.createTextNode('\n'), anchor);
    nodes.forEach(node => destination.insertBefore(node, anchor));
}

function hasParagraphCodeBeforeNestedContent(item: HTMLLIElement): boolean {
    return Array.from(item.children).some(child => child.matches('pre'));
}

function getListBlock(list: HTMLElement): HTMLElement {
    const parent = list.parentElement;
    return parent?.matches('.el-ul, .el-ol') ? parent : list;
}

function removeEmptyListBlock(list: HTMLElement): void {
    const block = getListBlock(list);
    if (getDirectItems(list).length > 0 || list.textContent?.trim()) {
        return;
    }
    list.remove();
    if (block !== list && block.childElementCount === 0 && !block.textContent?.trim()) {
        block.remove();
    }
}
