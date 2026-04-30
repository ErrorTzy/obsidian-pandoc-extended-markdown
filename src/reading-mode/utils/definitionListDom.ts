import { CSS_CLASSES } from '../../core/constants';

export function normalizeExistingDefinitionLists(element: HTMLElement): void {
    const lists = getDefinitionLists(element);
    lists.forEach(list => {
        const firstTerm = list.querySelector('dt');
        if (!firstTerm || firstTerm.textContent?.trim()) {
            return;
        }

        const termText = extractDroppedDefinitionTerm(list);
        if (termText) {
            firstTerm.textContent = termText;
        }
    });
}

function getDefinitionLists(element: HTMLElement): HTMLElement[] {
    const lists = Array.from(
        element.querySelectorAll<HTMLElement>(`dl.${CSS_CLASSES.DEFINITION_LIST}`)
    );
    if (element.matches(`dl.${CSS_CLASSES.DEFINITION_LIST}`)) {
        return [element, ...lists];
    }
    return lists;
}

function extractDroppedDefinitionTerm(list: HTMLElement): string | null {
    const parent = list.parentElement;
    if (parent?.nodeName === 'P') {
        return extractTermBeforeList(parent, list);
    }

    const previous = list.previousElementSibling;
    if (previous?.nodeName === 'P') {
        const termText = getLastNonEmptyLine(getTextWithLineBreaks(previous));
        if (!termText) {
            return null;
        }

        previous.replaceChildren(list);
        removeEmptyParagraphSibling(previous.nextElementSibling);
        return termText;
    }

    return null;
}

function extractTermBeforeList(paragraph: Element, list: HTMLElement): string | null {
    const precedingNodes = getPrecedingSiblingNodes(paragraph, list);
    const termText = getLastNonEmptyLine(getTextFromNodes(precedingNodes));
    if (!termText) {
        return null;
    }

    precedingNodes.forEach(node => node.parentNode?.removeChild(node));
    return termText;
}

function getPrecedingSiblingNodes(parent: Element, target: Node): Node[] {
    const nodes: Node[] = [];
    let current = parent.firstChild;
    while (current && current !== target) {
        nodes.push(current);
        current = current.nextSibling;
    }
    return nodes;
}

function getTextWithLineBreaks(elem: Element): string {
    const parts: string[] = [];
    elem.childNodes.forEach(node => appendNodeText(node, parts));
    return parts.join('');
}

function getTextFromNodes(nodes: Node[]): string {
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

    if (node.nodeType === Node.ELEMENT_NODE && !isCodeElement(node as Element)) {
        node.childNodes.forEach(child => appendNodeText(child, parts));
    }
}

function isCodeElement(element: Element): boolean {
    return element.nodeName === 'CODE' || element.nodeName === 'PRE';
}

function getLastNonEmptyLine(text: string): string | null {
    const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    return lines.length > 0 ? lines[lines.length - 1] : null;
}

function removeEmptyParagraphSibling(element: Element | null): void {
    if (element?.nodeName === 'P' && !element.textContent?.trim()) {
        element.remove();
    }
}
