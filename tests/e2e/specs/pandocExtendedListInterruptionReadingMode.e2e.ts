import { browser, expect } from '@wdio/globals';

import {
    createOrReplaceFile,
    deleteFileIfExists,
    ensureReadingMode,
    openFileInActiveLeaf,
    renderPandocHtml
} from '../helpers/pandocSyntaxParity';

interface ListTopology {
    tag: 'P' | 'OL' | 'UL';
    text?: string;
    type?: string;
    example?: boolean;
    items?: Array<{
        text: string;
        children: ListTopology[];
    }>;
}

const cases = [
    { name: 'upper-alpha', marker: 'A.  ', target: 'ALPHA_CHILD' },
    { name: 'default-ordered', marker: '#. ', target: 'HASH_CHILD' },
    { name: 'example', marker: '(@example) ', target: 'EXAMPLE_CHILD' }
] as const;
const paths = cases.map(testCase => `pandoc-extended-interruption-${testCase.name}.md`);
const nestedPath = 'pandoc-extended-interruption-native-parent.md';

describe('Pandoc extended-list paragraph interruption in Reading mode', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });
    });

    after(async () => {
        await setListExtension(true);
        for (const path of [...paths, nestedPath]) {
            await deleteFileIfExists(path);
        }
    });

    for (const enabled of [false, true]) {
        it(`matches Pandoc for every extended marker when the extension is ${
            enabled ? 'enabled' : 'disabled'}`, async () => {
            await setListExtension(enabled);

            for (let index = 0; index < cases.length; index++) {
                const testCase = cases[index];
                const source = `Paragraph\n${testCase.marker}${testCase.target}`;
                await expectReadingModeToMatchPandoc(paths[index], source, enabled);
            }
        });

        it(`matches Pandoc for an extended child under an interrupting native parent when the ` +
            `extension is ${enabled ? 'enabled' : 'disabled'}`, async () => {
            await setListExtension(enabled);
            await expectReadingModeToMatchPandoc(
                nestedPath,
                'Paragraph\n- NATIVE_PARENT\n  A.  NESTED_CHILD_MUST_STAY',
                enabled
            );
        });
    }
});

async function expectReadingModeToMatchPandoc(
    path: string,
    source: string,
    enabled: boolean
): Promise<void> {
    const pandocHtml = renderPandocHtml(source, [
        '-f', `markdown${enabled ? '+' : '-'}lists_without_preceding_blankline`,
        '-t', 'html'
    ]);

    await createOrReplaceFile(path, source);
    await openFileInActiveLeaf(path);
    await ensureReadingMode();

    try {
        await browser.waitUntil(async () => {
            const parity = await getTopologyParity(pandocHtml);
            return JSON.stringify(parity.actual) === JSON.stringify(parity.expected);
        }, {
            timeout: 7000,
            timeoutMsg: `Expected ${path} to match Pandoc with extension=${enabled}`
        });
    } catch (error) {
        const parity = await getTopologyParity(pandocHtml);
        throw new Error(
            `${(error as Error).message}\nParity: ${JSON.stringify(parity, null, 2)}`,
            { cause: error }
        );
    }

    const parity = await getTopologyParity(pandocHtml);
    expect(parity.actual).toEqual(parity.expected);
    expect(parity.previewText.match(/CHILD(?:_MUST_STAY)?/g)?.length ?? 0)
        .toBe(parity.expectedText.match(/CHILD(?:_MUST_STAY)?/g)?.length ?? 0);
}

async function getTopologyParity(pandocHtml: string): Promise<{
    expected: ListTopology[];
    actual: ListTopology[];
    expectedText: string;
    previewText: string;
    previewHtml: string;
}> {
    return browser.execute((expectedHtml: string) => {
        type BrowserTopology = {
            tag: 'P' | 'OL' | 'UL';
            text?: string;
            type?: string;
            example?: boolean;
            items?: Array<{ text: string; children: BrowserTopology[] }>;
        };

        const parser = new DOMParser();
        const expectedDocument = parser.parseFromString(
            `<main>${expectedHtml}</main>`,
            'text/html'
        );
        const expectedRoot = expectedDocument.querySelector('main');

        // @ts-ignore
        const activePath = app.workspace.getActiveFile()?.path;
        // @ts-ignore
        const activeLeaf = app.workspace.getLeavesOfType('markdown').find(
            (leaf: { view?: { file?: { path?: string } } }) =>
                leaf.view?.file?.path === activePath
        );
        const preview = activeLeaf?.view?.containerEl?.querySelector(
            '.markdown-preview-view'
        ) as HTMLElement | null;

        const normalizeText = (text: string): string => text.replace(/\s+/g, ' ').trim();
        const directText = (element: Element): string => {
            const parts: string[] = [];
            const visit = (node: Node): void => {
                if (node.nodeType === Node.ELEMENT_NODE &&
                    (node.nodeName === 'OL' || node.nodeName === 'UL')) {
                    return;
                }
                if (node.nodeType === Node.TEXT_NODE) {
                    parts.push(node.textContent ?? '');
                    return;
                }
                node.childNodes.forEach(visit);
            };
            element.childNodes.forEach(visit);
            return normalizeText(parts.join(' '));
        };
        const normalizeElement = (element: Element): BrowserTopology => {
            const tag = element.tagName as BrowserTopology['tag'];
            if (tag === 'P') {
                return { tag, text: normalizeText(element.textContent ?? '') };
            }

            const topology: BrowserTopology = {
                tag,
                items: Array.from(element.children)
                    .filter(child => child.tagName === 'LI')
                    .map(item => ({
                        text: directText(item),
                        children: Array.from(item.children)
                            .filter(child => child.tagName === 'OL' || child.tagName === 'UL')
                            .map(normalizeElement)
                    }))
            };
            if (tag === 'OL') {
                const type = element.getAttribute('type');
                if (type) {
                    topology.type = type;
                }
                if (element.classList.contains('example')) {
                    topology.example = true;
                }
            }
            return topology;
        };
        const normalizeExpected = (): BrowserTopology[] => Array.from(
            expectedRoot?.children ?? []
        )
            .filter(element => ['P', 'OL', 'UL'].includes(element.tagName))
            .map(normalizeElement);
        const normalizeActual = (): BrowserTopology[] => Array.from(
            preview?.querySelectorAll('p, ol, ul') ?? []
        )
            .filter(element => !element.parentElement?.closest('p, ol, ul'))
            .map(normalizeElement);

        return {
            expected: normalizeExpected(),
            actual: normalizeActual(),
            expectedText: normalizeText(expectedRoot?.textContent ?? ''),
            previewText: normalizeText(preview?.textContent ?? ''),
            previewHtml: preview?.innerHTML ?? ''
        };
    }, pandocHtml);
}

async function setListExtension(enabled: boolean): Promise<void> {
    await browser.execute(async value => {
        // @ts-ignore
        const plugin = app.plugins.plugins['pandoc-extended-markdown'];
        if (plugin?.settings) {
            plugin.settings.enableListsWithoutPrecedingBlankline = value;
            await plugin.saveSettings();
            // @ts-ignore
            app.workspace.updateOptions();
        }
    }, enabled);
    await browser.pause(250);
}
