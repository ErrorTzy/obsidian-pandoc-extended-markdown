import { CSS_CLASSES } from '../../../core/constants';
import { ListPatterns } from '../../../shared/patterns';
import { ListBlockValidator } from '../../../shared/utils/listBlockValidator';
import { readFullSourceText } from '../sourceText';
import { BlockDomProcessor, ReadingModeContext } from '../types';

type NativeListKind = 'ul' | 'ol';

interface ParsedNativeListLine {
    kind: NativeListKind;
    itemText: string;
}

interface NativeListSourceLine {
    index: number;
    kind: NativeListKind;
    source: string;
    itemText: string;
}

interface NativeListReplacementLine {
    sourceLine: NativeListSourceLine;
    trailingText: string;
}

interface NativeListMatch {
    itemStartIndex: number;
    lines: NativeListReplacementLine[];
}

export class NativeListSpacingProcessor implements BlockDomProcessor {
    name = 'native-list-spacing';
    phase = 'block' as const;
    priority = 30;

    isEnabled(context: ReadingModeContext): boolean {
        return Boolean(context.config.enforcePandocListSpacing && context.sectionInfo?.text);
    }

    process(context: ReadingModeContext): void {
        this.processWithSourceResolver(context, list => getSourceTextForList(list, context));

        if (context.app) {
            runAfterPreviewSettles(() => {
                void this.processWithFullSource(context);
            });
        }
    }

    private async processWithFullSource(context: ReadingModeContext): Promise<void> {
        const fullSourceText = await readFullSourceText(context.sourcePath, context.app);
        if (!fullSourceText) {
            return;
        }

        this.processWithSourceResolver(context, () => fullSourceText);
    }

    private processWithSourceResolver(
        context: ReadingModeContext,
        getSourceText: (list: HTMLElement) => string
    ): void {
        const consumedSourceLines = new Set<string>();

        getNativeListElements(context).forEach(list => {
            const sourceText = getSourceText(list);
            const sourceLines = sourceText.split('\n');
            const invalidLines = ListBlockValidator.validateListBlocks(sourceLines, context.config);
            const candidates = getInvalidNativeListLines(sourceLines, invalidLines);
            const match = findMatchingSourceLines(list, candidates, consumedSourceLines, sourceText);
            if (!match) {
                return;
            }

            match.lines.forEach(line =>
                consumedSourceLines.add(getSourceLineKey(sourceText, line.sourceLine.index))
            );
            replaceListSegmentWithPlainText(list, match);
        });
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

function getInvalidNativeListLines(
    sourceLines: string[],
    invalidLines: Set<number>
): NativeListSourceLine[] {
    return sourceLines
        .map((source, index) => ({ source, index, parsed: parseNativeListLine(source) }))
        .filter((line): line is { source: string; index: number; parsed: ParsedNativeListLine } =>
            invalidLines.has(line.index) && line.parsed !== null
        )
        .map(line => ({ ...line.parsed, source: line.source, index: line.index }));
}

function parseNativeListLine(line: string): ParsedNativeListLine | null {
    const unorderedMatch = line.match(ListPatterns.UNORDERED_LIST_MARKER_WITH_SPACE);
    if (unorderedMatch) {
        return {
            kind: 'ul',
            itemText: line.slice(unorderedMatch[0].length).trim()
        };
    }

    const orderedMatch = line.match(/^(\s*)(\d+[.)])(\s+)/);
    if (!orderedMatch) {
        return null;
    }

    return {
        kind: 'ol',
        itemText: line.slice(orderedMatch[0].length).trim()
    };
}

function getNativeListElements(context: ReadingModeContext): HTMLElement[] {
    const root = context.section ?? context.element;
    const lists = Array.from(root.querySelectorAll<HTMLElement>('ul, ol'));

    if (context.element.matches('ul, ol')) {
        lists.unshift(context.element);
    }

    return lists.filter(list => !list.closest('.pem-fenced-div'));
}

function findMatchingSourceLines(
    list: HTMLElement,
    candidates: NativeListSourceLine[],
    consumedSourceLines: Set<string>,
    sourceText: string
): NativeListMatch | null {
    const kind = list.tagName.toLowerCase() as NativeListKind;
    const itemTexts = getDirectListItemTexts(list);

    if (itemTexts.length === 0) {
        return null;
    }

    for (let i = 0; i <= candidates.length - itemTexts.length; i++) {
        const fullListMatch = getReplacementLinesForSlice(
            candidates.slice(i, i + itemTexts.length),
            itemTexts,
            kind,
            consumedSourceLines,
            sourceText
        );
        if (fullListMatch.length > 0) {
            return {
                itemStartIndex: 0,
                lines: fullListMatch
            };
        }
    }

    for (let itemStartIndex = 0; itemStartIndex < itemTexts.length; itemStartIndex++) {
        for (let candidateStartIndex = 0; candidateStartIndex < candidates.length; candidateStartIndex++) {
            const maxLength = Math.min(
                itemTexts.length - itemStartIndex,
                candidates.length - candidateStartIndex
            );
            for (let length = maxLength; length > 0; length--) {
                const sourceSlice = candidates.slice(candidateStartIndex, candidateStartIndex + length);
                if (!isContiguousSourceSlice(sourceSlice)) {
                    continue;
                }

                const itemSlice = itemTexts.slice(itemStartIndex, itemStartIndex + length);
                const partialMatch = getReplacementLinesForSlice(
                    sourceSlice,
                    itemSlice,
                    kind,
                    consumedSourceLines,
                    sourceText
                );
                if (partialMatch.length > 0) {
                    return {
                        itemStartIndex,
                        lines: partialMatch
                    };
                }
            }
        }
    }

    return null;
}

function isContiguousSourceSlice(sourceSlice: NativeListSourceLine[]): boolean {
    return sourceSlice.every((line, index) =>
        index === 0 || line.index === sourceSlice[index - 1].index + 1
    );
}

function getReplacementLinesForSlice(
    sourceSlice: NativeListSourceLine[],
    itemTexts: string[],
    kind: NativeListKind,
    consumedSourceLines: Set<string>,
    sourceText: string
): NativeListReplacementLine[] {
    if (sourceSlice.length !== itemTexts.length) {
        return [];
    }

    const replacementLines: NativeListReplacementLine[] = [];
    for (let index = 0; index < sourceSlice.length; index++) {
        const line = sourceSlice[index];
        const trailingText = getTrailingListItemText(itemTexts[index], line.itemText);
        if (line.kind !== kind ||
            consumedSourceLines.has(getSourceLineKey(sourceText, line.index)) ||
            trailingText === null) {
            return [];
        }
        replacementLines.push({ sourceLine: line, trailingText });
    }

    return replacementLines;
}

function getSourceLineKey(sourceText: string, index: number): string {
    return `${index}:${sourceText}`;
}

function getTrailingListItemText(renderedItemText: string, sourceItemText: string): string | null {
    if (renderedItemText === sourceItemText) {
        return '';
    }

    if (!renderedItemText.startsWith(sourceItemText)) {
        return null;
    }

    const trailingText = renderedItemText.slice(sourceItemText.length).trim();
    return trailingText.length > 0 ? trailingText : null;
}

function getDirectListItemTexts(list: HTMLElement): string[] {
    return Array.from(list.children)
        .filter((child): child is HTMLLIElement => child.tagName === 'LI')
        .map(item => getListItemOwnText(item))
        .map(text => text.trim())
        .filter(Boolean);
}

function getListItemOwnText(item: HTMLLIElement): string {
    const parts: string[] = [];
    item.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
            parts.push(node.textContent ?? '');
        } else if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName !== 'UL' &&
            (node as Element).tagName !== 'OL') {
            parts.push((node.textContent ?? ''));
        }
    });
    return parts.join('');
}

function getReplacementTextLines(match: NativeListReplacementLine[]): string[] {
    return match.flatMap(line => [
        line.sourceLine.source,
        ...(line.trailingText ? [line.trailingText] : [])
    ]);
}

function replaceListSegmentWithPlainText(list: HTMLElement, match: NativeListMatch): void {
    const items = Array.from(list.children)
        .filter((child): child is HTMLLIElement => child.tagName === 'LI');
    const matchedItemCount = match.lines.length;
    const beforeItems = items.slice(0, match.itemStartIndex);
    const afterItems = items.slice(match.itemStartIndex + matchedItemCount);
    const replacementNodes: Node[] = [
        ...createListCloneWithItems(list, beforeItems),
        createPlainTextParagraph(getReplacementTextLines(match.lines)),
        ...createListCloneWithItems(list, afterItems)
    ];

    list.replaceWith(...replacementNodes);
}

function createPlainTextParagraph(sourceLines: string[]): HTMLElement {
    const paragraph = document.createElement('p');
    paragraph.classList.add(CSS_CLASSES.PANDOC_INVALID_NATIVE_LIST);

    sourceLines.forEach((line, index) => {
        if (index > 0) {
            paragraph.appendChild(document.createElement('br'));
        }
        paragraph.appendChild(document.createTextNode(line));
    });

    return paragraph;
}

function createListCloneWithItems(list: HTMLElement, items: HTMLLIElement[]): HTMLElement[] {
    if (items.length === 0) {
        return [];
    }

    const clone = document.createElement(list.tagName.toLowerCase());
    Array.from(list.attributes).forEach(attribute => {
        clone.setAttribute(attribute.name, attribute.value);
    });
    items.forEach(item => clone.appendChild(item.cloneNode(true)));
    return [clone];
}

function runAfterPreviewSettles(callback: () => void): void {
    if (typeof window.requestAnimationFrame !== 'function') {
        window.setTimeout(callback, 0);
        return;
    }

    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(callback);
    });
}
