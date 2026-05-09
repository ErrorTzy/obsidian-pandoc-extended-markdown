import { ActiveFencedDiv, CandidateLine } from './types';

export function getTextWithLineBreaks(elem: Element): string {
    const parts: string[] = [];
    elem.childNodes.forEach(node => appendNodeText(node, parts));
    return parts.join('');
}

export function splitCandidateIntoLines(candidate: Element): CandidateLine[] {
    const lines: CandidateLine[] = [createCandidateLine()];

    Array.from(candidate.childNodes).forEach(node => appendNodeToCandidateLines(node, lines));

    return lines;
}

export function appendContentLine(
    line: string | CandidateLine,
    fragments: Node[],
    stack: ActiveFencedDiv[]
): void {
    const paragraph = document.createElement('p');
    const text = typeof line === 'string' ? line : line.text;
    if (typeof line === 'string') {
        paragraph.textContent = line;
    } else {
        paragraph.append(...line.nodes);
    }

    if (stack.length > 0) {
        for (const active of stack) {
            active.contentLines.push(text);
            active.reference.content = active.contentLines.join('\n').trim();
        }
    }

    appendRenderedLineNode(paragraph, fragments, stack);
}

export function appendRenderedLineNode(
    node: Node,
    fragments: Node[],
    stack: ActiveFencedDiv[]
): void {
    const active = stack[stack.length - 1];
    if (active) {
        active.contentElement.appendChild(node);
        return;
    }

    fragments.push(node);
}

export function replaceCandidateWithFragments(
    candidate: Element,
    fragments: Node[]
): void {
    const parent = candidate.parentNode;
    if (!parent) {
        return;
    }

    if (fragments.length === 0) {
        candidate.remove();
        return;
    }

    for (const fragment of fragments) {
        parent.insertBefore(fragment, candidate);
    }
    parent.removeChild(candidate);
}

export function insertFencedDiv(
    sourceElement: Element,
    fencedDiv: HTMLElement,
    stack: ActiveFencedDiv[]
): void {
    const active = stack[stack.length - 1];
    if (active) {
        active.contentElement.appendChild(fencedDiv);
        sourceElement.remove();
        return;
    }

    sourceElement.parentNode?.insertBefore(fencedDiv, sourceElement);
    sourceElement.remove();
}

export function shouldSkipElement(element: Element): boolean {
    return Boolean(
        element.closest('h1, h2, h3, h4, h5, h6') ||
        element.closest('pre, code') ||
        element.closest('.pem-fenced-div')
    );
}

function appendNodeToCandidateLines(node: Node, lines: CandidateLine[]): void {
    if (node.nodeName === 'BR') {
        lines.push(createCandidateLine());
        return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
        appendTextToCandidateLines(node.textContent || '', lines);
        return;
    }

    const currentLine = lines[lines.length - 1];
    currentLine.text += getTextWithLineBreaks(node as Element);
    currentLine.nodes.push(node);
}

function appendTextToCandidateLines(text: string, lines: CandidateLine[]): void {
    const parts = text.split('\n');
    for (const [index, part] of parts.entries()) {
        if (index > 0) {
            lines.push(createCandidateLine());
        }
        if (!part) {
            continue;
        }

        const currentLine = lines[lines.length - 1];
        currentLine.text += part;
        currentLine.nodes.push(document.createTextNode(part));
    }
}

function createCandidateLine(): CandidateLine {
    return {
        text: '',
        nodes: []
    };
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
