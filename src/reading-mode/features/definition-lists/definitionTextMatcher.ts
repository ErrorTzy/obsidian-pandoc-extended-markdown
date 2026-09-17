import { parsePandocListMarker } from '../../../shared/utils/pandocListMarkers';

import {
    type DefinitionDomSignature,
    normalizeCandidateText
} from './definitionSignature';

// Source/DOM comparison normalizes markup-specific noise but preserves ordering.
export function matchesDefinitionBlockText(
    element: HTMLElement,
    signature: DefinitionDomSignature
): boolean {
    const text = normalizeCandidateText(element.textContent ?? '');
    return signature.termTexts.some(term => text.includes(normalizeCandidateText(term))) ||
        signature.definitionTexts.some(definition => text.includes(normalizeCandidateText(definition)));
}

export function matchesDefinitionMarkerText(text: string, definitionTexts: string[]): boolean {
    const markerMatch = normalizeCandidateText(text).match(/^[:~•]\s*(.*)$/);
    if (!markerMatch) {
        return false;
    }

    const content = normalizeCandidateText(markerMatch[1]);
    return definitionTexts.some(definition => content === normalizeCandidateText(definition));
}

export function matchesLiteralMarkerTermText(text: string, termTexts: string[]): boolean {
    const normalizedText = normalizeCandidateText(text);
    return /^[:~]\s+\S/.test(normalizedText) && termTexts.some(term =>
        normalizedText === normalizeCandidateText(term)
    );
}

export function matchesCompleteRawDefinitionText(
    text: string,
    signature: DefinitionDomSignature
): boolean {
    const lines = text.split('\n')
        .map(normalizeCandidateText)
        .filter(line => line.length > 0);
    return matchRawDefinitionItem(lines, 0, signature.items, 0) === lines.length;
}

function matchRawDefinitionItem(
    lines: string[],
    lineIndex: number,
    items: DefinitionDomSignature['items'],
    itemIndex: number
): number {
    const item = items[itemIndex];
    if (!item || lines[lineIndex] !== normalizeCandidateText(item.termText)) {
        return -1;
    }
    return matchRawDefinitionDescription(
        lines,
        lineIndex + 1,
        items,
        itemIndex,
        0
    );
}

function matchRawDefinitionDescription(
    lines: string[],
    markerLine: number,
    items: DefinitionDomSignature['items'],
    itemIndex: number,
    definitionIndex: number
): number {
    const item = items[itemIndex];
    const expected = item?.definitionTexts[definitionIndex];
    const marker = lines[markerLine]?.match(/^[:~•]\s*(.*)$/);
    if (expected === undefined || !marker) {
        return -1;
    }

    for (let end = markerLine + 1; end <= lines.length; end++) {
        const content = normalizeCandidateText([
            marker[1],
            ...lines.slice(markerLine + 1, end).map(getRenderedBlockContent)
        ].join(' '));
        if (content !== normalizeCandidateText(expected)) {
            continue;
        }

        const next = definitionIndex + 1 < item.definitionTexts.length
            ? matchRawDefinitionDescription(
                lines,
                end,
                items,
                itemIndex,
                definitionIndex + 1
            )
            : itemIndex + 1 < items.length
                ? matchRawDefinitionItem(lines, end, items, itemIndex + 1)
                : end;
        if (next >= 0) {
            return next;
        }
    }
    return -1;
}

export function matchesRawDefinitionParagraphText(
    text: string,
    signature: DefinitionDomSignature
): boolean {
    const lines = text.split('\n')
        .map(normalizeCandidateText)
        .filter(line => line.length > 0);
    if (lines.length < 2) {
        return false;
    }
    return signature.items.some(item =>
        lines[0] === normalizeCandidateText(item.termText) &&
        matchesDefinitionDescriptions(
            lines.slice(1).join('\n'),
            item.definitionTexts
        )
    );
}

export function matchesDefinitionDescriptions(text: string, expected: string[]): boolean {
    const definitions = getRawDefinitionDescriptions(text);
    return definitions !== null && definitions.length === expected.length &&
        definitions.every((definition, index) =>
            definition === normalizeCandidateText(expected[index])
        );
}

export function getRawDefinitionDescriptions(text: string): string[] | null {
    const lines = text.split('\n')
        .map(normalizeCandidateText)
        .filter(line => line.length > 0);
    const definitions: string[] = [];
    let current: string | null = null;
    for (const line of lines) {
        const marker = line.match(/^[:~•]\s*(.*)$/);
        if (marker) {
            if (current !== null) {
                definitions.push(normalizeCandidateText(current));
            }
            current = marker[1];
            continue;
        }
        if (current === null) {
            return null;
        }
        current += ` ${getRenderedBlockContent(line)}`;
    }
    if (current !== null) {
        definitions.push(normalizeCandidateText(current));
    }
    return definitions;
}

function getRenderedBlockContent(line: string): string {
    const listMarker = parsePandocListMarker(line, true);
    if (listMarker && listMarker.kind !== 'definition') {
        return line.slice(listMarker.markerEnd)
            .trimStart()
            .replace(/^\[[ xX]\]\s*/, '');
    }

    let content = line;
    while (/^ {0,3}>[ \t]?/.test(content)) {
        content = content.replace(/^ {0,3}>[ \t]?/, '');
    }
    return content;
}

export function getTextWithLineBreaks(elem: Element): string {
    const parts: string[] = [];
    elem.childNodes.forEach(node => appendNodeText(node, parts));
    return parts.join('');
}

export function getTextFromNodes(nodes: Node[]): string {
    const parts: string[] = [];
    nodes.forEach(node => appendNodeText(node, parts));
    return parts.join('');
}

function appendNodeText(node: Node, parts: string[]): void {
    if (node.nodeName === 'BR') {
        parts.push('\n');
        return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.textContent || '');
        return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
    }
    const element = node as Element;
    if (element.nodeName === 'PRE') {
        return;
    }
    if (element.nodeName === 'CODE') {
        parts.push(element.textContent ?? '');
        return;
    }
    node.childNodes.forEach(child => appendNodeText(child, parts));
}
