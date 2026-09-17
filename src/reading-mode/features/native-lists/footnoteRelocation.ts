import {
    PandocFootnoteBody,
    projectPandocFootnoteBodies
} from '../../../shared/utils/pandocFootnoteBodies';
import { getIndentColumns } from '../../../shared/utils/orderedListMarkers';

import { NativeListItemMatch, NativeListSourceLine } from './sourceDomMatcher';
import {
    getDirectListItems,
    getOrderedListItemNumber,
    removeEmptyNativeListBlock
} from './nativeListDom';
import {
    getRenderableNativeListLineIndices,
    parseNativeListLine,
    stripBlockQuotePrefix
} from './sourceLine';

export interface FootnoteListRelocation {
    bodyStartIndex: number;
    label: string;
    sourceLine: NativeListSourceLine;
}

export interface MatchedFootnoteListRelocation extends FootnoteListRelocation {
    match: NativeListItemMatch | null;
}

/** Finds native list markers which Pandoc captures lazily into a footnote body. */
export function findFootnoteListRelocations(lines: string[]): FootnoteListRelocation[] {
    return projectPandocFootnoteBodies(lines).footnoteBodies.flatMap(body =>
        findBodyRelocations(lines, body));
}

/**
 * Moves source-matched list items into their generated footnote item.
 * Each footnote is preflighted independently and no unmatched DOM is removed.
 */
export function relocateFootnoteListItems(
    root: HTMLElement,
    relocations: MatchedFootnoteListRelocation[]
): Map<number, HTMLElement> {
    const relocatedLists = new Map<number, HTMLElement>();
    const groups = groupRelocationsByBody(relocations);

    groups.forEach(group => {
        const destination = findFootnoteItem(root, group[0].label);
        const matches = group.map(relocation => relocation.match);
        if (!destination || matches.some(match => !isCurrentMatch(root, match)) || hasDuplicateItems(matches)) {
            return;
        }

        group.forEach(relocation => {
            const match = relocation.match as NativeListItemMatch;
            const destinationList = destination.contains(match.item)
                ? match.list
                : moveItem(match, destination);
            relocatedLists.set(relocation.sourceLine.index, destinationList);
        });
    });

    return relocatedLists;
}

function isCurrentMatch(root: HTMLElement, match: NativeListItemMatch | null): boolean {
    return Boolean(match && root.contains(match.list) && root.contains(match.item) &&
        match.item.parentElement === match.list);
}

function groupRelocationsByBody(
    relocations: MatchedFootnoteListRelocation[]
): Map<number, MatchedFootnoteListRelocation[]> {
    const groups = new Map<number, MatchedFootnoteListRelocation[]>();
    relocations.forEach(relocation => {
        const group = groups.get(relocation.bodyStartIndex) ?? [];
        group.push(relocation);
        groups.set(relocation.bodyStartIndex, group);
    });
    return groups;
}

function findBodyRelocations(
    documentLines: string[],
    body: PandocFootnoteBody
): FootnoteListRelocation[] {
    const visibleListLines = getRenderableNativeListLineIndices(body.lines);
    const bodyStartIndex = body.sourceIndices[0];
    const relocations: FootnoteListRelocation[] = [];

    for (let bodyIndex = 1; bodyIndex < body.lines.length; bodyIndex++) {
        if (!visibleListLines.has(bodyIndex)) {
            continue;
        }
        const sourceIndex = body.sourceIndices[bodyIndex];
        const source = documentLines[sourceIndex];
        const parsed = parseNativeListLine(body.lines[bodyIndex]);
        if (source === undefined || !parsed || !isLazyFootnoteLine(source)) {
            continue;
        }
        relocations.push({
            bodyStartIndex,
            label: body.label,
            sourceLine: { ...parsed, index: sourceIndex, source: body.lines[bodyIndex] }
        });
    }

    return relocations;
}

function isLazyFootnoteLine(line: string): boolean {
    const content = stripBlockQuotePrefix(line);
    const indent = content.match(/^([ \t]*)/)?.[1] ?? '';
    return getIndentColumns(indent) < 4;
}

function findFootnoteItem(root: HTMLElement, label: string): HTMLLIElement | null {
    const targetIds = new Set(Array.from(
        root.querySelectorAll<HTMLAnchorElement>('a[data-footref]')
    ).filter(link => link.getAttribute('data-footref') === label)
        .map(link => getFragmentId(link.getAttribute('href')))
        .filter((id): id is string => id !== null));
    if (targetIds.size !== 1) {
        return null;
    }

    const [targetId] = targetIds;
    const matches = Array.from(
        root.querySelectorAll<HTMLLIElement>('section.footnotes > ol > li[id]')
    ).filter(item => item.id === targetId);
    return matches.length === 1 ? matches[0] : null;
}

function getFragmentId(href: string | null): string | null {
    const hashIndex = href?.lastIndexOf('#') ?? -1;
    if (!href || hashIndex < 0 || hashIndex === href.length - 1) {
        return null;
    }
    try {
        return decodeURIComponent(href.slice(hashIndex + 1));
    } catch {
        return href.slice(hashIndex + 1);
    }
}

function hasDuplicateItems(matches: Array<NativeListItemMatch | null>): boolean {
    const items = matches.flatMap(match => match ? [match.item] : []);
    return new Set(items).size !== items.length;
}

function moveItem(match: NativeListItemMatch, destination: HTMLLIElement): HTMLElement {
    const sourceList = match.list;
    const sourceItems = getDirectListItems(sourceList);
    const sourceIndex = sourceItems.indexOf(match.item);
    const nextOrderedStart = sourceList.instanceOf(HTMLOListElement) && sourceIndex === 0
        ? getOrderedListItemNumber(sourceList, sourceItems, 1)
        : null;
    const destinationList = getOrCreateDestinationList(
        destination,
        sourceList,
        sourceItems,
        sourceIndex
    );
    destinationList.appendChild(match.item);

    if (getDirectListItems(sourceList).length === 0) {
        removeEmptyNativeListBlock(sourceList);
    } else if (nextOrderedStart !== null && sourceList.instanceOf(HTMLOListElement)) {
        sourceList.start = nextOrderedStart;
    }
    return destinationList;
}

function getOrCreateDestinationList(
    destination: HTMLLIElement,
    sourceList: HTMLElement,
    sourceItems: HTMLLIElement[],
    sourceIndex: number
): HTMLElement {
    const trailingList = getTrailingDirectList(destination);
    if (trailingList?.tagName === sourceList.tagName) {
        sourceList.classList.forEach(className => trailingList.classList.add(className));
        return trailingList;
    }

    const list = sourceList.cloneNode(false) as HTMLElement;
    if (list.instanceOf(HTMLOListElement)) {
        list.start = getOrderedListItemNumber(
            sourceList as HTMLOListElement,
            sourceItems,
            sourceIndex
        );
    }
    destination.appendChild(list);
    return list;
}

function getTrailingDirectList(destination: HTMLLIElement): HTMLElement | null {
    const finalChild = destination.lastElementChild;
    return finalChild?.matches('ul, ol') ? finalChild as HTMLElement : null;
}
