import { MarkdownRenderChild, MarkdownRenderer } from 'obsidian';

import { ReadingModeContext } from '../../pipeline/types';
import { renderMarkdownFragment } from '../../utils/fragmentRenderer';

import { PandocDefinitionListBlock } from './sourceParser';
import { renderPandocDefinitionListBlock } from './sourceRenderer';

interface PendingInlineFragment {
    anchor: Comment;
    extractListItem: boolean;
    hardBreakToken?: string;
    normalizeLineBreaks: boolean;
    source: string;
    unwrapSingleParagraph: boolean;
}

interface PreparedLineBreakSource {
    source: string;
    token: string;
}

interface FenceState {
    marker: '`' | '~';
    length: number;
}

let nextHardBreakToken = 0;

/** Build definition-list structure while delegating every inline fragment to Obsidian. */
export async function renderDefinitionBlockWithHost(
    block: PandocDefinitionListBlock,
    context: ReadingModeContext
): Promise<HTMLElement | null> {
    if (!context.app || typeof MarkdownRenderer?.render !== 'function') {
        return null;
    }

    const pending: PendingInlineFragment[] = [];
    const list = renderPandocDefinitionListBlock(
        block,
        context.renderContext,
        (target, source) => queueFragment(target, source, true, pending),
        (target, source, _renderContext, unwrapSingleParagraph) =>
            queueDefinitionBodyFragment(
                target,
                source,
                unwrapSingleParagraph,
                pending
            )
    );
    const child = new MarkdownRenderChild(list);
    context.postProcessorContext.addChild?.(child);

    try {
        await Promise.all(pending.map(fragment =>
            renderInlineFragment(fragment, context, child)
        ));
        return list;
    } catch {
        child.unload();
        return null;
    }
}

function queueFragment(
    target: HTMLElement,
    source: string,
    unwrapSingleParagraph: boolean,
    pending: PendingInlineFragment[]
): void {
    const anchor = target.ownerDocument.createComment('pem-inline-fragment');
    target.appendChild(anchor);
    pending.push({
        anchor,
        extractListItem: false,
        normalizeLineBreaks: false,
        source,
        unwrapSingleParagraph
    });
}

function queueDefinitionBodyFragment(
    target: HTMLElement,
    source: string,
    unwrapSingleParagraph: boolean,
    pending: PendingInlineFragment[]
): void {
    const prepared = preparePandocLineBreaks(source);
    const lines = prepared.source.split('\n');
    const wrappedSource = [
        `- ${lines[0]}`,
        ...lines.slice(1).map(line => `  ${line}`)
    ].join('\n');
    const anchor = target.ownerDocument.createComment('pem-definition-body-fragment');
    target.appendChild(anchor);
    pending.push({
        anchor,
        extractListItem: true,
        hardBreakToken: prepared.token,
        normalizeLineBreaks: true,
        source: wrappedSource,
        unwrapSingleParagraph
    });
}

async function renderInlineFragment(
    fragment: PendingInlineFragment,
    context: ReadingModeContext,
    child: MarkdownRenderChild
): Promise<void> {
    if (!fragment.source) {
        fragment.anchor.remove();
        return;
    }

    const target = document.createElement('div');
    await renderMarkdownFragment(fragment.source, target, context, child);
    const renderedNodes = fragment.extractListItem
        ? getRenderedListItemNodes(target, fragment.unwrapSingleParagraph)
        : getRenderedFragmentNodes(target, fragment.unwrapSingleParagraph);
    const nodes = fragment.normalizeLineBreaks
        ? normalizeRenderedLineBreaks(renderedNodes, fragment.hardBreakToken as string)
        : renderedNodes;
    if (nodes.length === 0 && fragment.source.trim()) {
        throw new Error('MarkdownRenderer returned no inline definition content');
    }
    fragment.anchor.replaceWith(...nodes);
}

/**
 * Obsidian emits every inline newline as `<br>`, while Pandoc's default
 * writer treats a soft break as collapsible whitespace. Replace explicit
 * Markdown/HTML hard breaks with an inert token before host rendering so the
 * resulting DOM can distinguish the two without guessing from its shape.
 */
function preparePandocLineBreaks(source: string): PreparedLineBreakSource {
    const token = createHardBreakToken(source);
    const lines = source.split('\n');
    const output: string[] = [];
    let fence: FenceState | null = null;
    let inlineCodeDelimiter = 0;

    lines.forEach((sourceLine, index) => {
        const boundary = parseFenceBoundary(sourceLine);
        if (fence) {
            output.push(sourceLine);
            if (boundary?.marker === fence.marker &&
                boundary.length >= fence.length &&
                boundary.closing) {
                fence = null;
            }
            return;
        }
        if (boundary) {
            fence = { marker: boundary.marker, length: boundary.length };
            output.push(sourceLine);
            return;
        }

        const rawBreaks = replaceRawHtmlBreaks(
            sourceLine,
            token,
            inlineCodeDelimiter
        );
        inlineCodeDelimiter = rawBreaks.inlineCodeDelimiter;
        const hardBreak = index < lines.length - 1 && inlineCodeDelimiter === 0
            ? stripMarkdownHardBreak(rawBreaks.line)
            : null;
        output.push(hardBreak ? `${hardBreak}${token}` : rawBreaks.line);
    });

    return {
        source: output.join('\n').split(`${token}\n`).join(token),
        token
    };
}

function createHardBreakToken(source: string): string {
    let token: string;
    do {
        token = `\uE000pem-hard-break-${nextHardBreakToken++}\uE001`;
    } while (source.includes(token));
    return token;
}

function parseFenceBoundary(line: string): {
    closing: boolean;
    length: number;
    marker: '`' | '~';
} | null {
    const match = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (!match) {
        return null;
    }
    return {
        closing: match[2].trim().length === 0,
        length: match[1].length,
        marker: match[1][0] as '`' | '~'
    };
}

function replaceRawHtmlBreaks(
    line: string,
    token: string,
    startingCodeDelimiter: number
): { inlineCodeDelimiter: number, line: string } {
    let inlineCodeDelimiter = startingCodeDelimiter;
    let result = '';
    let index = 0;

    while (index < line.length) {
        if (line[index] === '`') {
            let end = index + 1;
            while (line[end] === '`') {
                end++;
            }
            const length = end - index;
            if (inlineCodeDelimiter === 0) {
                inlineCodeDelimiter = length;
            } else if (length === inlineCodeDelimiter) {
                inlineCodeDelimiter = 0;
            }
            result += line.slice(index, end);
            index = end;
            continue;
        }

        const rawBreak = inlineCodeDelimiter === 0 && !isEscaped(line, index)
            ? line.slice(index).match(/^<br\b[^>]*>/i)?.[0]
            : undefined;
        if (rawBreak) {
            result += token;
            index += rawBreak.length;
            continue;
        }

        result += line[index];
        index++;
    }

    return { inlineCodeDelimiter, line: result };
}

function isEscaped(source: string, index: number): boolean {
    let backslashes = 0;
    for (let offset = index - 1; offset >= 0 && source[offset] === '\\'; offset--) {
        backslashes++;
    }
    return backslashes % 2 === 1;
}

function stripMarkdownHardBreak(line: string): string | null {
    if (/ {2,}$/.test(line)) {
        return line.replace(/ +$/, '');
    }

    const trailingBackslashes = line.match(/\\+$/)?.[0].length ?? 0;
    return trailingBackslashes % 2 === 1 ? line.slice(0, -1) : null;
}

function normalizeRenderedLineBreaks(nodes: Node[], hardBreakToken: string): Node[] {
    const fragment = document.createDocumentFragment();
    fragment.append(...nodes);
    fragment.querySelectorAll('br').forEach(br => br.replaceWith(' '));
    fragment.normalize();

    const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        if (node.data.includes(hardBreakToken)) {
            textNodes.push(node);
        }
    }
    textNodes.forEach(node => replaceHardBreakTokens(node, hardBreakToken));
    normalizePandocListStructure(fragment);
    return Array.from(fragment.childNodes);
}

/** Normalize the host renderer's list DOM to the structure emitted by Pandoc's HTML writer. */
function normalizePandocListStructure(fragment: DocumentFragment): void {
    fragment.querySelectorAll('ol').forEach(list => {
        if (!list.hasAttribute('type')) {
            list.setAttribute('type', '1');
        }
    });

    fragment.querySelectorAll('ul').forEach(list => {
        const taskItems = Array.from(list.children)
            .filter((child): child is HTMLLIElement => child.tagName === 'LI')
            .filter(item => findTaskCheckbox(item) !== null);
        if (taskItems.length === 0) {
            return;
        }

        list.classList.add('task-list');
        taskItems.forEach(wrapTaskItemContentInLabel);
    });
}

function findTaskCheckbox(item: HTMLLIElement): HTMLInputElement | null {
    return item.querySelector<HTMLInputElement>(
        ':scope > input[type="checkbox"], :scope > label > input[type="checkbox"], ' +
        ':scope > p > input[type="checkbox"], :scope > p > label > input[type="checkbox"]'
    );
}

function wrapTaskItemContentInLabel(item: HTMLLIElement): void {
    const checkbox = findTaskCheckbox(item);
    const container = checkbox?.parentElement;
    if (!checkbox || !container || container.tagName === 'LABEL') {
        return;
    }

    const label = document.createElement('label');
    container.insertBefore(label, checkbox);
    let node: Node | null = checkbox;
    while (node) {
        const nextNode: Node | null = node.nextSibling as Node | null;
        if (node !== checkbox && isBlockElement(node)) {
            break;
        }
        label.appendChild(node);
        node = nextNode;
    }
}

function replaceHardBreakTokens(node: Text, token: string): void {
    const parts = node.data.split(token);
    if (parts.length === 1) {
        return;
    }

    const replacement = document.createDocumentFragment();
    parts.forEach((part, index) => {
        if (index > 0) {
            replacement.appendChild(document.createElement('br'));
        }
        if (part) {
            replacement.appendChild(document.createTextNode(part));
        }
    });
    node.replaceWith(replacement);
}

function getRenderedListItemNodes(
    target: HTMLElement,
    unwrapSingleParagraph: boolean
): Node[] {
    const meaningful = getMeaningfulNodes(target);
    const list = meaningful.length === 1 && isList(meaningful[0])
        ? meaningful[0]
        : null;
    const items = list
        ? Array.from(list.children).filter(child => child.tagName === 'LI')
        : [];
    if (items.length !== 1) {
        return [];
    }

    const nodes = getMeaningfulNodes(items[0]);
    if (unwrapSingleParagraph) {
        return unwrapOnlyParagraph(nodes);
    }
    if (nodes.some(isParagraph)) {
        return nodes;
    }

    const firstBlockIndex = nodes.findIndex(isBlockElement);
    const inlineEnd = firstBlockIndex < 0 ? nodes.length : firstBlockIndex;
    if (inlineEnd === 0) {
        return nodes;
    }
    const paragraph = document.createElement('p');
    paragraph.append(...nodes.slice(0, inlineEnd));
    return [paragraph, ...nodes.slice(inlineEnd)];
}

function getRenderedFragmentNodes(
    target: HTMLElement,
    unwrapSingleParagraph: boolean
): Node[] {
    const meaningful = getMeaningfulNodes(target);
    return unwrapSingleParagraph ? unwrapOnlyParagraph(meaningful) : meaningful;
}

function getMeaningfulNodes(target: ParentNode): Node[] {
    return Array.from(target.childNodes).filter(node =>
        node.nodeType !== Node.TEXT_NODE || Boolean(node.textContent?.trim())
    );
}

function unwrapOnlyParagraph(nodes: Node[]): Node[] {
    if (nodes.length === 1 && isParagraph(nodes[0])) {
        return Array.from(nodes[0].childNodes);
    }
    return nodes;
}

function isParagraph(node: Node): node is HTMLParagraphElement {
    return node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'P';
}

function isList(node: Node): node is HTMLOListElement | HTMLUListElement {
    return node.nodeType === Node.ELEMENT_NODE &&
        ((node as Element).tagName === 'UL' || (node as Element).tagName === 'OL');
}

function isBlockElement(node: Node): boolean {
    return node.nodeType === Node.ELEMENT_NODE && [
        'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DETAILS', 'DIV', 'DL',
        'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2',
        'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'MAIN', 'NAV', 'OL', 'P',
        'PRE', 'SECTION', 'TABLE', 'UL'
    ].includes((node as Element).tagName);
}
