import { CSS_CLASSES } from '../../../core/constants';

import type { PandocDefinitionListBlock } from './sourceParser';

export interface DefinitionDomSignature {
    termTexts: string[];
    definitionTexts: string[];
    sequence: string[];
    items: Array<{
        termText: string;
        definitionTexts: string[];
    }>;
}

const BLOCK_CONTENT_TAGS = new Set([
    'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DETAILS', 'DIV', 'DL',
    'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2',
    'H3', 'H4', 'H5', 'H6', 'HEADER', 'HGROUP', 'HR', 'LI', 'MAIN',
    'MENU', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'UL'
]);

/** Build the normalized source/DOM signature used to select replacement candidates. */
export function getDefinitionDomSignature(
    nodes: Node[],
    block: PandocDefinitionListBlock
): DefinitionDomSignature {
    const list = nodes.find((node): node is HTMLElement =>
        isHtmlElement(node) &&
        node.matches(`dl.${CSS_CLASSES.DEFINITION_LIST}`)
    );
    const items = list
        ? getDefinitionListItemSignatures(list)
        : block.items.map(item => ({
            termText: normalizeCandidateText(item.term),
            definitionTexts: item.definitions.map(definition =>
                normalizeCandidateText(definition.plainText)
            )
        }));

    return {
        termTexts: items.map(item => item.termText),
        definitionTexts: items.flatMap(item => item.definitionTexts),
        sequence: items.flatMap(item => [item.termText, ...item.definitionTexts]),
        items
    };
}

export function getDefinitionListItemSignatures(
    list: HTMLElement
): DefinitionDomSignature['items'] {
    const items: DefinitionDomSignature['items'] = [];
    Array.from(list.children).forEach(child => {
        if (child.tagName === 'DT') {
            items.push({
                termText: normalizeCandidateText(getComparableElementText(child)),
                definitionTexts: []
            });
            return;
        }
        if (child.tagName === 'DD' && items.length > 0) {
            items[items.length - 1].definitionTexts.push(
                normalizeCandidateText(getComparableElementText(child))
            );
        }
    });
    return items;
}

export function getDefinitionListSequence(list: HTMLElement): string[] {
    return Array.from(list.children)
        .filter(child => child.tagName === 'DT' || child.tagName === 'DD')
        .map(child => normalizeCandidateText(getComparableElementText(child)));
}

export function getDefinitionBlockSequence(block: PandocDefinitionListBlock): string[] {
    return block.items.flatMap(item => [
        normalizeCandidateText(item.term),
        ...item.definitions.map(definition => normalizeCandidateText(definition.plainText))
    ]);
}

export function isDefinitionBlockContentElement(element: HTMLElement): boolean {
    return BLOCK_CONTENT_TAGS.has(element.tagName);
}

export function normalizeCandidateText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

function getComparableElementText(element: Element): string {
    const parts: string[] = [];
    element.childNodes.forEach(node => appendComparableNodeText(node, parts));
    return parts.join('');
}

function appendComparableNodeText(node: Node, parts: string[]): void {
    if (node.nodeName === 'BR') {
        parts.push(' ');
        return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.textContent ?? '');
        return;
    }
    if (!isHtmlElement(node)) {
        return;
    }

    const separatesText = isDefinitionBlockContentElement(node);
    if (separatesText) {
        parts.push(' ');
    }
    node.childNodes.forEach(child => appendComparableNodeText(child, parts));
    if (separatesText) {
        parts.push(' ');
    }
}

function isHtmlElement(node: Node): node is HTMLElement {
    return node.instanceOf(HTMLElement);
}
