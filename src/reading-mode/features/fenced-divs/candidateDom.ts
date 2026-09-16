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

export function getCandidateBlock(element: Element): Element {
    if (!element.matches('li')) {
        return element;
    }

    let list = element.parentElement?.matches('ul, ol')
        ? element.parentElement
        : null;
    while (list?.parentElement?.closest('ul, ol')) {
        list = list.parentElement.closest('ul, ol');
    }

    if (!list) {
        return element;
    }
    return list.parentElement?.matches('.el-ul, .el-ol')
        ? list.parentElement
        : list;
}

/**
 * Remove a final fenced-div delimiter that Obsidian folded into a list item.
 * Only the delimiter line (and its own line break) is removed; the list and all
 * of its content nodes retain their identity.
 */
export function removeTrailingFencedDivClosing(element: Element): string | null {
    const text = getTextWithLineBreaks(element);
    const closing = text.match(/(?:^|\n):{3,}[ \t]*(?:\n[ \t]*)*$/);
    if (!closing || closing.index === undefined) {
        return null;
    }

    const suffix = text.slice(closing.index);
    if (!removeTextSuffix(element, suffix)) {
        return null;
    }
    return text.slice(0, text.length - suffix.length);
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

function removeTextSuffix(element: Element, suffix: string): boolean {
    const contributors: Node[] = [];
    collectTextContributors(element, contributors);
    let remaining = suffix.length;
    const removals: Array<{ node: Node; consumed: number }> = [];

    for (let index = contributors.length - 1; index >= 0 && remaining > 0; index--) {
        const node = contributors[index];
        const contribution = node.nodeName === 'BR' ? '\n' : node.textContent ?? '';
        const consumed = Math.min(remaining, contribution.length);
        const expected = suffix.slice(remaining - consumed, remaining);
        const actual = contribution.slice(contribution.length - consumed);
        if (actual !== expected) {
            return false;
        }

        removals.push({ node, consumed });
        remaining -= consumed;
    }

    if (remaining !== 0) {
        return false;
    }
    // Validate the complete suffix before changing any live node.
    for (const { node, consumed } of removals) {
        if (node.nodeName === 'BR') {
            node.parentNode?.removeChild(node);
        } else if (node.nodeType === Node.TEXT_NODE) {
            const textNode = node as Text;
            textNode.deleteData(textNode.length - consumed, consumed);
            if (textNode.length === 0) {
                textNode.remove();
            }
        }
    }

    return true;
}

function collectTextContributors(element: Element, contributors: Node[]): void {
    element.childNodes.forEach(node => {
        if (node.nodeName === 'BR' || node.nodeType === Node.TEXT_NODE) {
            contributors.push(node);
            return;
        }
        if (node.nodeType === Node.ELEMENT_NODE && !isCodeElement(node as Element)) {
            collectTextContributors(node as Element, contributors);
        }
    });
}

function isCodeElement(element: Element): boolean {
    return element.nodeName === 'CODE' || element.nodeName === 'PRE';
}
