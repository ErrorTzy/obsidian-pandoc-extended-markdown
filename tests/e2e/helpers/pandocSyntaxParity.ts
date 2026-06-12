import { browser } from '@wdio/globals';
import { execFileSync } from 'child_process';

import { ensureActiveFileReadingMode } from './readingMode';

export type ActualSyntaxKind =
    | 'fenced-div'
    | 'fenced-div-cross-reference'
    | 'ordered-list'
    | 'custom-label-list'
    | 'super-sub';

export type NormalizedNode = {
    tag: string;
    text?: string;
    attrs?: Record<string, string | boolean>;
    children?: NormalizedNode[];
};

export interface SyntaxParityFixture {
    name: string;
    markdown: string;
    waitForSelector: string;
    expectedSelector: string;
    actualKind: ActualSyntaxKind;
    expectedHtml?: string;
    pandocArgs?: string[];
}

export const PANDOC_MARKDOWN_FORMAT = [
    'markdown',
    '+task_lists',
    '+fancy_lists',
    '+example_lists',
    '+definition_lists',
    '+fenced_divs',
    '+superscript',
    '+subscript'
].join('');

export function renderPandocHtml(markdown: string, pandocArgs?: string[]): string {
    return execFileSync(
        'pandoc',
        pandocArgs ?? ['-f', PANDOC_MARKDOWN_FORMAT, '-t', 'html'],
        { input: markdown, encoding: 'utf8' }
    );
}

export async function getSyntaxParity(fixture: SyntaxParityFixture): Promise<{
    expected: NormalizedNode[];
    actual: NormalizedNode[];
    pandocHtml: string;
    previewHtml: string;
}> {
    const pandocHtml = fixture.expectedHtml ?? renderPandocHtml(fixture.markdown, fixture.pandocArgs);

    return browser.execute((
        expectedHtml: string,
        expectedSelector: string,
        actualKind: ActualSyntaxKind
    ) => {
        type BrowserNormalizedNode = {
            tag: string;
            text?: string;
            attrs?: Record<string, string | boolean>;
            children?: BrowserNormalizedNode[];
        };

        const parser = new DOMParser();
        const expectedDoc = parser.parseFromString(`<main>${expectedHtml}</main>`, 'text/html');
        const preview = document.querySelector('.markdown-preview-view') as HTMLElement | null;
        const expected = Array.from(expectedDoc.querySelectorAll(expectedSelector))
            .filter(element => element.parentElement === expectedDoc.body.querySelector('main'))
            .map(element => normalizeElement(element));
        const actual = preview ? getActualComparableNodes(preview, actualKind) : [];

        function getActualComparableNodes(root: HTMLElement, kind: ActualSyntaxKind): BrowserNormalizedNode[] {
            switch (kind) {
                case 'fenced-div':
                    return Array.from(root.querySelectorAll('.pem-fenced-div'))
                        .filter(div => !div.parentElement?.closest('.pem-fenced-div'))
                        .map(div => normalizeFencedDiv(div as HTMLElement));
                case 'fenced-div-cross-reference':
                    return Array.from(root.querySelectorAll('.pem-fenced-div, p'))
                        .filter(element => !element.parentElement?.closest('.pem-fenced-div'))
                        .filter(element =>
                            element.matches('.pem-fenced-div') ||
                            Boolean(element.querySelector('.pem-fenced-div-reference'))
                        )
                        .map(element => element.matches('.pem-fenced-div')
                            ? normalizeFencedDiv(element as HTMLElement)
                            : normalizeElement(element));
                case 'ordered-list':
                    return Array.from(root.querySelectorAll('ol, p'))
                        .filter(element => !element.parentElement?.closest('ol, ul'))
                        .filter(element => element.tagName !== 'P' || !element.querySelector('ol, dl'))
                        .map(element => normalizeElement(element));
                case 'custom-label-list':
                    return Array.from(root.querySelectorAll('p'))
                        .filter(element => hasCustomLabelParagraphContent(element))
                        .map(element => normalizeElement(element));
                case 'super-sub':
                    return [normalizeParagraphWithText(root, 'Water is')];
            }
        }

        function normalizeFencedDiv(div: HTMLElement): BrowserNormalizedNode {
            const title = div.querySelector(':scope > .pem-fenced-div-title') as HTMLElement | null;
            const content = div.querySelector(':scope > .pem-fenced-div-content') as HTMLElement | null;
            const className = Array.from(div.classList)
                .find(name => name.startsWith('pem-fenced-div-') &&
                    name !== 'pem-fenced-div-inner' &&
                    !name.startsWith('pem-fenced-div-depth-'))
                ?.replace('pem-fenced-div-', '');
            const attrs: Record<string, string> = {};

            if (div.dataset.pandocDivId) attrs.id = div.dataset.pandocDivId;
            if (className) attrs.class = className;

            return {
                tag: 'div',
                ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
                children: [
                    ...(title ? [normalizeElement(title)] : []),
                    ...Array.from(content?.childNodes ?? []).map(node => normalizeNode(node))
                ]
                    .filter((node): node is BrowserNormalizedNode => node !== null && !isEmptyElement(node))
            };
        }

        function normalizeParagraphWithText(root: HTMLElement, text: string): BrowserNormalizedNode {
            const paragraph = Array.from(root.querySelectorAll('p'))
                .find(candidate => candidate.textContent?.includes(text));
            return paragraph ? normalizeElement(paragraph) : { tag: 'p' };
        }

        function hasCustomLabelParagraphContent(element: Element): boolean {
            const text = normalizeText(element.textContent ?? '');
            return text.includes('(P1) custom labeled item') || text === 'See (P1).';
        }

        function normalizeElement(element: Element): BrowserNormalizedNode {
            const tag = element.tagName.toLowerCase();
            if (tag === 'p' && element.querySelector('.pem-fenced-div-reference')) {
                return {
                    tag,
                    children: [{ tag: '#text', text: normalizeText(element.textContent ?? '') }]
                };
            }

            const attrs = getComparableAttributes(element);
            const children = coalesceTextNodes(Array.from(element.childNodes)
                .map(node => normalizeNode(node))
                .filter((node): node is BrowserNormalizedNode => node !== null));

            return {
                tag,
                ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
                ...(children.length > 0 ? { children } : {})
            };
        }

        function coalesceTextNodes(nodes: BrowserNormalizedNode[]): BrowserNormalizedNode[] {
            const coalesced: BrowserNormalizedNode[] = [];

            for (const node of nodes) {
                const previous = coalesced[coalesced.length - 1];
                if (node.tag === '#text' && previous?.tag === '#text') {
                    previous.text = normalizeText(`${previous.text ?? ''}${node.text ?? ''}`);
                } else {
                    coalesced.push(node);
                }
            }

            return coalesced
                .map(node => node.tag === '#text' ? { ...node, text: normalizeText(node.text ?? '') } : node)
                .filter(node => node.tag !== '#text' || Boolean(node.text));
        }

        function normalizeNode(node: Node): BrowserNormalizedNode | null {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = normalizeTextFragment(node.textContent ?? '');
                return text.trim() ? { tag: '#text', text } : null;
            }

            if (node.nodeType !== Node.ELEMENT_NODE) return null;

            const element = node as Element;
            if (element.matches('.pem-fenced-div')) {
                return normalizeFencedDiv(element as HTMLElement);
            }

            if (isPluginTextWrapper(element)) {
                const text = normalizeTextFragment(element.textContent ?? '');
                return text.trim() ? { tag: '#text', text } : null;
            }

            return normalizeElement(element);
        }

        function isPluginTextWrapper(element: Element): boolean {
            return element.matches([
                '.pem-example-reference',
                '.pem-custom-label-reference-processed',
                '.pem-fenced-div-reference',
                '.pem-list-marker'
            ].join(','));
        }

        function getComparableAttributes(element: Element): Record<string, string | boolean> {
            const attrs: Record<string, string | boolean> = {};
            const tag = element.tagName.toLowerCase();

            if (tag === 'div' && element.id) attrs.id = element.id;
            if (tag === 'div' && element.className) attrs.class = normalizeClassList(element.className);
            if (tag === 'ol') {
                if (element.classList.contains('example')) attrs.class = 'example';
                if (element.getAttribute('type')) attrs.type = element.getAttribute('type') ?? '';
                if (element.getAttribute('start')) attrs.start = element.getAttribute('start') ?? '';
            }
            if (tag === 'input') {
                const input = element as HTMLInputElement;
                attrs.type = input.type;
                attrs.checked = input.checked;
            }

            return attrs;
        }

        function isEmptyElement(node: BrowserNormalizedNode): boolean {
            return node.tag !== '#text' && !node.text && !node.attrs && !node.children;
        }

        function normalizeClassList(className: string): string {
            return className.split(/\s+/).filter(Boolean).sort().join(' ');
        }

        function normalizeText(text: string): string {
            return text.replace(/\s+/g, ' ').trim();
        }

        function normalizeTextFragment(text: string): string {
            return text.replace(/\s+/g, ' ');
        }

        return {
            expected,
            actual,
            pandocHtml: expectedHtml,
            previewHtml: preview?.innerHTML ?? ''
        };
    }, pandocHtml, fixture.expectedSelector, fixture.actualKind);
}

export async function waitForSyntax(selector: string): Promise<void> {
    try {
        await browser.waitUntil(async () => {
            return browser.execute((targetSelector: string) =>
                Boolean(document.querySelector(`.markdown-preview-view ${targetSelector}`)),
            selector);
        }, {
            timeout: 5000,
            timeoutMsg: `Expected reading mode syntax selector: ${selector}`
        });
    } catch (error) {
        const previewHtml = await browser.execute(() =>
            document.querySelector('.markdown-preview-view')?.innerHTML ?? ''
        );
        throw new Error(`Expected reading mode syntax selector: ${selector}\nPreview HTML: ${previewHtml}`, {
            cause: error
        });
    }
}

export async function createOrReplaceFile(path: string, content: string): Promise<void> {
    await browser.execute(async (filePath: string, data: string) => {
        // @ts-ignore
        const existing = app.vault.getAbstractFileByPath(filePath);
        if (existing) {
            // @ts-ignore
            await app.vault.modify(existing, data);
            return;
        }
        // @ts-ignore
        await app.vault.create(filePath, data);
    }, path, content);
}

export async function openFileInActiveLeaf(path: string): Promise<void> {
    await browser.execute(async (filePath: string) => {
        // @ts-ignore
        const file = app.vault.getAbstractFileByPath(filePath);
        if (file) {
            // @ts-ignore
            await app.workspace.getLeaf().openFile(file);
        }
    }, path);
}

export async function ensureReadingMode(): Promise<void> {
    await ensureActiveFileReadingMode();
    await browser.pause(500);
}

export async function deleteFileIfExists(path: string): Promise<void> {
    await browser.execute(async (filePath: string) => {
        // @ts-ignore
        const file = app.vault.getAbstractFileByPath(filePath);
        if (file) {
            // @ts-ignore
            await app.vault.delete(file);
        }
    }, path);
}
