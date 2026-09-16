import { browser, expect } from '@wdio/globals';

import { ensureActiveFileReadingMode } from '../helpers/readingMode';

interface NativeDefinitionFixture {
    name: string;
    marker: string;
    definitionIndent: string;
    listTag: 'ul' | 'ol';
    listStart: number | null;
}

interface NativeDefinitionState {
    capturedBeforeNormalization: boolean;
    definitionText: string;
    directDefinitionCount: number;
    directItemCount: number;
    itemPreserved: boolean;
    listPreserved: boolean;
    listStart: number | null;
    listTag: string;
    rootTailOccurrences: number;
    tailOccurrences: number;
    tailPreserved: boolean;
    termText: string;
}

interface NestedNativeDefinitionState {
    capturedBeforeNormalization: boolean;
    childOccurrences: number;
    childPreserved: boolean;
    definitionOccurrences: number;
    directDefinitionCount: number;
    itemPreserved: boolean;
    listPreserved: boolean;
    nestedListPreserved: boolean;
    nestedListTag: string;
    orderIsDefinitionThenChildList: boolean;
    tailOccurrences: number;
    tailPreserved: boolean;
    termOccurrences: number;
}

const fixtures: NativeDefinitionFixture[] = [
    { name: 'bullet', marker: '- ', definitionIndent: '  ', listTag: 'ul', listStart: null },
    { name: 'decimal', marker: '1. ', definitionIndent: '   ', listTag: 'ol', listStart: 1 },
    { name: 'wide-decimal', marker: '100. ', definitionIndent: '     ', listTag: 'ol', listStart: 100 }
];
const fixturePaths = fixtures.map(fixture => `native-definition-${fixture.name}-reading-mode.md`);
const nestedFixturePaths = [
    ...fixtures.map(fixture => `native-definition-nested-${fixture.name}-reading-mode.md`),
    'native-definition-nested-bullet-disabled-reading-mode.md'
];
const modeFixturePath = 'native-definition-mode-dependent-reading-mode.md';
const enabledModeFixturePath = 'native-definition-mode-dependent-enabled-reading-mode.md';

describe('Definitions contained by native lists in Reading mode', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });
        await setSyntaxSettings({
            enableDefinitionLists: true,
            enableListsWithoutPrecedingBlankline: true
        });
    });

    after(async () => {
        await clearIdentityProbe();
        await clearNestedIdentityProbe();
        await setSyntaxSettings({
            enableDefinitionLists: true,
            enableListsWithoutPrecedingBlankline: true
        });
        await deleteFilesIfExist([
            ...fixturePaths,
            ...nestedFixturePaths,
            modeFixturePath,
            enabledModeFixturePath
        ]);
    });

    for (const fixture of fixtures) {
        it(`keeps the native ${fixture.name} list, item, and tail while normalizing its definition`, async () => {
            const path = `native-definition-${fixture.name}-reading-mode.md`;
            const term = `TERM_${fixture.name.toUpperCase().replace('-', '_')}`;
            const definition = `DEFINITION_${fixture.name.toUpperCase().replace('-', '_')}`;
            const tail = `LIST_TAIL_${fixture.name.toUpperCase().replace('-', '_')}`;
            const rootTail = `ROOT_TAIL_${fixture.name.toUpperCase().replace('-', '_')}`;
            const nextMarker = fixture.listStart === null ? '- ' : `${fixture.listStart + 1}. `;
            const markdown = [
                `${fixture.marker}${term}`,
                `${fixture.definitionIndent}: ${definition}`,
                `${nextMarker}${tail}`,
                '',
                rootTail
            ].join('\n');

            await createOrReplaceFile(path, markdown);
            await openFileInActiveLeaf(path);
            await installIdentityProbe(term, definition, tail);
            await ensureActiveFileReadingMode();

            try {
                await browser.waitUntil(async () => {
                    const state = await getNativeDefinitionState(term, tail, rootTail);
                    return state.directDefinitionCount === 1 &&
                        state.termText === term &&
                        state.definitionText === definition;
                }, {
                    timeout: 5000,
                    timeoutMsg: `Expected the ${fixture.name} definition list to normalize`
                });
            } catch (error) {
                const html = await getActivePreviewHtml();
                throw new Error(`${(error as Error).message}\nPreview: ${html}`);
            }

            const state = await getNativeDefinitionState(term, tail, rootTail);
            expect(state).toEqual({
                capturedBeforeNormalization: true,
                definitionText: definition,
                directDefinitionCount: 1,
                directItemCount: 2,
                itemPreserved: true,
                listPreserved: true,
                listStart: fixture.listStart,
                listTag: fixture.listTag,
                rootTailOccurrences: 1,
                tailOccurrences: 1,
                tailPreserved: true,
                termText: term
            });
            await clearIdentityProbe();
        });
    }

    for (const testCase of [
        ...fixtures.map(fixture => ({ fixture, enabled: true })),
        { fixture: fixtures[0], enabled: false }
    ]) {
        const { fixture, enabled } = testCase;
        const modeName = enabled ? 'enabled' : 'disabled';
        it(`preserves a nested child under the ${fixture.name} parent with the extension ${modeName}`, async () => {
            const suffix = enabled ? fixture.name : `${fixture.name}-disabled`;
            const path = `native-definition-nested-${suffix}-reading-mode.md`;
            const token = suffix.toUpperCase().replace('-', '_');
            const term = `NESTED_TERM_${token}`;
            const definition = `NESTED_DEFINITION_${token}`;
            const child = `CHILD_MUST_STAY_${token}`;
            const tail = `NESTED_TAIL_${token}`;
            const nextMarker = fixture.listStart === null ? '- ' : `${fixture.listStart + 1}. `;
            const markdown = [
                `${fixture.marker}${term}`,
                `${fixture.definitionIndent}: ${definition}`,
                `${fixture.definitionIndent}- ${child}`,
                `${nextMarker}${tail}`
            ].join('\n');

            await setSyntaxSettings({ enableListsWithoutPrecedingBlankline: enabled });
            await createOrReplaceFile(path, markdown);
            await openFileInActiveLeaf(path);
            await installNestedIdentityProbe(term, definition, child, tail);
            await ensureActiveFileReadingMode();

            try {
                await browser.waitUntil(async () => {
                    const state = await getNestedNativeDefinitionState(
                        term,
                        definition,
                        child,
                        tail
                    );
                    return state.directDefinitionCount === 1 &&
                        state.orderIsDefinitionThenChildList;
                }, {
                    timeout: 5000,
                    timeoutMsg: `Expected nested ${fixture.name} definition ownership to reconcile`
                });
            } catch (error) {
                const html = await getActivePreviewHtml();
                throw new Error(`${(error as Error).message}\nPreview: ${html}`);
            }

            expect(await getNestedNativeDefinitionState(
                term,
                definition,
                child,
                tail
            )).toEqual({
                capturedBeforeNormalization: true,
                childOccurrences: 1,
                childPreserved: true,
                definitionOccurrences: 1,
                directDefinitionCount: 1,
                itemPreserved: true,
                listPreserved: true,
                nestedListPreserved: true,
                nestedListTag: 'ul',
                orderIsDefinitionThenChildList: true,
                tailOccurrences: 1,
                tailPreserved: true,
                termOccurrences: 1
            });
            await clearNestedIdentityProbe();
        });
    }

    it('does not normalize a definition inside an outer list rejected by the current extension mode', async () => {
        const term = 'MODE_DEPENDENT_TERM';
        const definition = 'MODE_DEPENDENT_DEFINITION';
        const tail = 'MODE_DEPENDENT_TAIL';
        const markdown = [
            'OPEN_PARAGRAPH',
            `- ${term}`,
            `  : ${definition}`,
            `- ${tail}`
        ].join('\n');
        await setSyntaxSettings({ enableListsWithoutPrecedingBlankline: false });
        await createOrReplaceFile(modeFixturePath, markdown);
        await openFileInActiveLeaf(modeFixturePath);
        await ensureActiveFileReadingMode();

        await browser.waitUntil(async () => {
            const state = await getModeDependentState(term, definition, tail);
            return state.text.includes(term) && state.text.includes(definition) &&
                state.text.includes(tail);
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected the mode-dependent source to render'
        });

        const disabled = await getModeDependentState(term, definition, tail);
        expect(disabled.definitionCount).toBe(0);
        expect(disabled.termOccurrences).toBe(1);
        expect(disabled.definitionOccurrences).toBe(1);
        expect(disabled.tailOccurrences).toBe(1);

        await setSyntaxSettings({ enableListsWithoutPrecedingBlankline: true });
        await createOrReplaceFile(enabledModeFixturePath, markdown);
        await openFileInActiveLeaf(enabledModeFixturePath);
        await ensureActiveFileReadingMode();
        await browser.waitUntil(async () =>
            (await getModeDependentState(term, definition, tail)).definitionCount === 1,
        {
            timeout: 5000,
            timeoutMsg: 'Expected the mode-dependent definition after enabling the extension'
        });

        const enabled = await getModeDependentState(term, definition, tail);
        expect(enabled.definitionCount).toBe(1);
        expect(enabled.termOccurrences).toBe(1);
        expect(enabled.definitionOccurrences).toBe(1);
        expect(enabled.tailOccurrences).toBe(1);
    });
});

async function installIdentityProbe(
    term: string,
    definition: string,
    tail: string
): Promise<void> {
    await browser.execute((termText: string, definitionText: string, tailText: string) => {
        type IdentityProbe = {
            list: HTMLElement | null;
            item: HTMLElement | null;
            tail: HTMLElement | null;
            observer: MutationObserver;
        };
        const probeKey = '__pemNativeDefinitionIdentityProbe';
        const existing = (window as unknown as Record<string, IdentityProbe | undefined>)[probeKey];
        existing?.observer.disconnect();

        const capture = (probe: IdentityProbe): void => {
            const lists = Array.from(document.querySelectorAll<HTMLElement>(
                '.markdown-preview-view ul, .markdown-preview-view ol'
            ));
            for (const list of lists) {
                const items = Array.from(list.children)
                    .filter((child): child is HTMLLIElement => child instanceof HTMLLIElement);
                const item = items.find(candidate => {
                    const text = candidate.textContent ?? '';
                    return text.includes(termText) && text.includes(definitionText);
                });
                const tailItem = items.find(candidate =>
                    (candidate.textContent ?? '').includes(tailText)
                );
                if (!item || !tailItem || item.querySelector('dl.pem-definition-list')) {
                    continue;
                }
                probe.list = list;
                probe.item = item;
                probe.tail = tailItem;
                probe.observer.disconnect();
                return;
            }
        };

        const observer = new MutationObserver(() => capture(probe));
        const probe: IdentityProbe = { list: null, item: null, tail: null, observer };
        (window as unknown as Record<string, IdentityProbe>)[probeKey] = probe;
        observer.observe(document.body, { childList: true, subtree: true });
        capture(probe);
    }, term, definition, tail);
}

async function clearIdentityProbe(): Promise<void> {
    await browser.execute(() => {
        const probeKey = '__pemNativeDefinitionIdentityProbe';
        const record = window as unknown as Record<string, {
            observer?: MutationObserver;
        } | undefined>;
        record[probeKey]?.observer?.disconnect();
        delete record[probeKey];
    });
}

async function installNestedIdentityProbe(
    term: string,
    definition: string,
    child: string,
    tail: string
): Promise<void> {
    await browser.execute((
        termText: string,
        definitionText: string,
        childText: string,
        tailText: string
    ) => {
        type IdentityProbe = {
            list: HTMLElement | null;
            item: HTMLLIElement | null;
            nestedList: HTMLElement | null;
            child: HTMLLIElement | null;
            tail: HTMLLIElement | null;
            observer: MutationObserver;
        };
        const probeKey = '__pemNestedNativeDefinitionIdentityProbe';
        const record = window as unknown as Record<string, IdentityProbe | undefined>;
        record[probeKey]?.observer.disconnect();

        const capture = (probe: IdentityProbe): void => {
            const lists = Array.from(document.querySelectorAll<HTMLElement>(
                '.markdown-preview-view ul, .markdown-preview-view ol'
            ));
            for (const list of lists) {
                const items = Array.from(list.children)
                    .filter((node): node is HTMLLIElement => node instanceof HTMLLIElement);
                const item = items.find(node => {
                    const text = node.textContent ?? '';
                    return text.includes(termText) && text.includes(definitionText);
                }) ?? null;
                const tail = items.find(node =>
                    (node.textContent ?? '').includes(tailText)
                ) ?? null;
                const nestedList = item
                    ? Array.from(item.children).find(node =>
                        /^(UL|OL)$/.test(node.tagName) &&
                        (node.textContent ?? '').includes(childText)
                    ) as HTMLElement | undefined
                    : null;
                const child = nestedList
                    ? Array.from(nestedList.children).find(node =>
                        node instanceof HTMLLIElement &&
                        (node.textContent ?? '').includes(childText)
                    ) as HTMLLIElement | undefined
                    : null;
                if (!item || !tail || !nestedList || !child ||
                    item.querySelector(':scope > dl.pem-definition-list')) {
                    continue;
                }
                probe.list = list;
                probe.item = item;
                probe.nestedList = nestedList;
                probe.child = child;
                probe.tail = tail;
                probe.observer.disconnect();
                return;
            }
        };

        const observer = new MutationObserver(() => capture(probe));
        const probe: IdentityProbe = {
            list: null,
            item: null,
            nestedList: null,
            child: null,
            tail: null,
            observer
        };
        record[probeKey] = probe;
        observer.observe(document.body, { childList: true, subtree: true });
        capture(probe);
    }, term, definition, child, tail);
}

async function clearNestedIdentityProbe(): Promise<void> {
    await browser.execute(() => {
        const probeKey = '__pemNestedNativeDefinitionIdentityProbe';
        const record = window as unknown as Record<string, {
            observer?: MutationObserver;
        } | undefined>;
        record[probeKey]?.observer?.disconnect();
        delete record[probeKey];
    });
}

async function getNestedNativeDefinitionState(
    term: string,
    definition: string,
    child: string,
    tail: string
): Promise<NestedNativeDefinitionState> {
    return browser.execute((
        termText: string,
        definitionText: string,
        childText: string,
        tailText: string
    ) => {
        type IdentityProbe = {
            list: HTMLElement | null;
            item: HTMLLIElement | null;
            nestedList: HTMLElement | null;
            child: HTMLLIElement | null;
            tail: HTMLLIElement | null;
        };
        // @ts-ignore
        const activeFile = app.workspace.getActiveFile?.();
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType?.('markdown') ?? [];
        const leaf = leaves.find((candidate: {
            view?: { file?: { path?: string }, containerEl?: HTMLElement }
        }) => candidate.view?.file?.path === activeFile?.path);
        const preview = leaf?.view?.containerEl?.querySelector('.markdown-preview-view') ??
            document.querySelector('.workspace-leaf.mod-active .markdown-preview-view');
        const lists = Array.from(preview?.querySelectorAll<HTMLElement>('ul, ol') ?? []);
        const list = lists.find(candidate =>
            Array.from(candidate.children).some(node =>
                node instanceof HTMLLIElement && (node.textContent ?? '').includes(termText)
            )
        ) ?? null;
        const items = list ? Array.from(list.children)
            .filter((node): node is HTMLLIElement => node instanceof HTMLLIElement) : [];
        const item = items.find(node => (node.textContent ?? '').includes(termText)) ?? null;
        const tailItem = items.find(node => (node.textContent ?? '').includes(tailText)) ?? null;
        const definitionList = item?.querySelector<HTMLElement>(
            ':scope > dl.pem-definition-list'
        ) ?? null;
        const nestedList = item
            ? Array.from(item.children).find(node =>
                /^(UL|OL)$/.test(node.tagName) &&
                (node.textContent ?? '').includes(childText)
            ) as HTMLElement | undefined
            : null;
        const childItem = nestedList
            ? Array.from(nestedList.children).find(node =>
                node instanceof HTMLLIElement && (node.textContent ?? '').includes(childText)
            ) as HTMLLIElement | undefined
            : null;
        const probe = (window as unknown as Record<string, IdentityProbe | undefined>)[
            '__pemNestedNativeDefinitionIdentityProbe'
        ];
        const text = preview?.textContent ?? '';
        const count = (target: string): number => text.split(target).length - 1;

        return {
            capturedBeforeNormalization: Boolean(
                probe?.list && probe.item && probe.nestedList && probe.child && probe.tail
            ),
            childOccurrences: count(childText),
            childPreserved: Boolean(probe?.child && probe.child === childItem),
            definitionOccurrences: count(definitionText),
            directDefinitionCount: item?.querySelectorAll(
                ':scope > dl.pem-definition-list'
            ).length ?? 0,
            itemPreserved: Boolean(probe?.item && probe.item === item),
            listPreserved: Boolean(probe?.list && probe.list === list),
            nestedListPreserved: Boolean(
                probe?.nestedList && probe.nestedList === nestedList
            ),
            nestedListTag: nestedList?.tagName.toLowerCase() ?? '',
            orderIsDefinitionThenChildList: Boolean(
                definitionList && definitionList.nextElementSibling === nestedList
            ),
            tailOccurrences: count(tailText),
            tailPreserved: Boolean(probe?.tail && probe.tail === tailItem),
            termOccurrences: count(termText)
        };
    }, term, definition, child, tail);
}

async function getNativeDefinitionState(
    term: string,
    tail: string,
    rootTail: string
): Promise<NativeDefinitionState> {
    return browser.execute((termText: string, tailText: string, rootTailText: string) => {
        type IdentityProbe = {
            list: HTMLElement | null;
            item: HTMLElement | null;
            tail: HTMLElement | null;
        };
        // @ts-ignore
        const activeFile = app.workspace.getActiveFile?.();
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType?.('markdown') ?? [];
        const leaf = leaves.find((candidate: {
            view?: { file?: { path?: string }, containerEl?: HTMLElement }
        }) => candidate.view?.file?.path === activeFile?.path);
        const preview = leaf?.view?.containerEl?.querySelector('.markdown-preview-view') ??
            document.querySelector('.workspace-leaf.mod-active .markdown-preview-view');
        const count = (text: string, target: string): number =>
            text.split(target).length - 1;
        const lists = Array.from(preview?.querySelectorAll<HTMLElement>('ul, ol') ?? []);
        const list = lists.find(candidate =>
            Array.from(candidate.children).some(child =>
                child instanceof HTMLLIElement && (child.textContent ?? '').includes(termText)
            )
        ) ?? null;
        const items = list ? Array.from(list.children)
            .filter((child): child is HTMLLIElement => child instanceof HTMLLIElement) : [];
        const item = items.find(candidate => (candidate.textContent ?? '').includes(termText)) ?? null;
        const tailItem = items.find(candidate => (candidate.textContent ?? '').includes(tailText)) ?? null;
        const definitionList = item?.querySelector(':scope > dl.pem-definition-list') ?? null;
        const probe = (window as unknown as Record<string, IdentityProbe | undefined>)[
            '__pemNativeDefinitionIdentityProbe'
        ];
        const text = preview?.textContent ?? '';

        return {
            capturedBeforeNormalization: Boolean(probe?.list && probe.item && probe.tail),
            definitionText: definitionList?.querySelector(':scope > dd')?.textContent?.trim() ?? '',
            directDefinitionCount: item?.querySelectorAll(':scope > dl.pem-definition-list').length ?? 0,
            directItemCount: items.length,
            itemPreserved: Boolean(probe?.item && probe.item === item),
            listPreserved: Boolean(probe?.list && probe.list === list),
            listStart: list instanceof HTMLOListElement ? list.start : null,
            listTag: list?.tagName.toLowerCase() ?? '',
            rootTailOccurrences: count(text, rootTailText),
            tailOccurrences: count(text, tailText),
            tailPreserved: Boolean(probe?.tail && probe.tail === tailItem),
            termText: definitionList?.querySelector(':scope > dt')?.textContent?.trim() ?? ''
        };
    }, term, tail, rootTail);
}

async function getModeDependentState(
    term: string,
    definition: string,
    tail: string
): Promise<{
    definitionCount: number;
    definitionOccurrences: number;
    tailOccurrences: number;
    termOccurrences: number;
    text: string;
}> {
    return browser.execute((termText: string, definitionText: string, tailText: string) => {
        // @ts-ignore
        const activeFile = app.workspace.getActiveFile?.();
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType?.('markdown') ?? [];
        const leaf = leaves.find((candidate: {
            view?: { file?: { path?: string }, containerEl?: HTMLElement }
        }) => candidate.view?.file?.path === activeFile?.path);
        const preview = leaf?.view?.containerEl?.querySelector('.markdown-preview-view') ??
            document.querySelector('.workspace-leaf.mod-active .markdown-preview-view');
        const count = (text: string, target: string): number =>
            text.split(target).length - 1;
        const text = preview?.textContent ?? '';
        return {
            definitionCount: preview?.querySelectorAll('dl.pem-definition-list').length ?? 0,
            definitionOccurrences: count(text, definitionText),
            tailOccurrences: count(text, tailText),
            termOccurrences: count(text, termText),
            text
        };
    }, term, definition, tail);
}

async function getActivePreviewHtml(): Promise<string> {
    return browser.execute(() => {
        // @ts-ignore
        const activeFile = app.workspace.getActiveFile?.();
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType?.('markdown') ?? [];
        const leaf = leaves.find((candidate: {
            view?: { file?: { path?: string }, containerEl?: HTMLElement }
        }) => candidate.view?.file?.path === activeFile?.path);
        const preview = leaf?.view?.containerEl?.querySelector('.markdown-preview-view') ??
            document.querySelector('.workspace-leaf.mod-active .markdown-preview-view');
        return preview?.innerHTML ?? '';
    });
}

async function setSyntaxSettings(settings: Partial<{
    enableDefinitionLists: boolean;
    enableListsWithoutPrecedingBlankline: boolean;
}>): Promise<void> {
    await browser.execute(async nextSettings => {
        // @ts-ignore
        const plugin = app.plugins.plugins['pandoc-extended-markdown'];
        if (plugin?.settings) {
            Object.assign(plugin.settings, nextSettings);
            await plugin.saveSettings();
            // @ts-ignore
            app.workspace.updateOptions();
        }
    }, settings);
    await browser.pause(300);
}

async function createOrReplaceFile(path: string, content: string): Promise<void> {
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

async function openFileInActiveLeaf(path: string): Promise<void> {
    await browser.execute(async (filePath: string) => {
        // @ts-ignore
        const file = app.vault.getAbstractFileByPath(filePath);
        if (!file) {
            return;
        }
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType('markdown');
        // @ts-ignore
        const leaf = leaves[0] ?? app.workspace.getLeaf();
        await leaf.setViewState({
            type: 'markdown',
            state: { file: filePath, mode: 'source', source: false }
        });
        // @ts-ignore
        app.workspace.setActiveLeaf(leaf, { focus: true });
    }, path);
    await browser.waitUntil(async () => browser.execute((filePath: string) => {
        // @ts-ignore
        return app.workspace.getActiveFile()?.path === filePath;
    }, path), { timeout: 5000 });
}

async function deleteFilesIfExist(paths: string[]): Promise<void> {
    await browser.execute(async filePaths => {
        for (const filePath of filePaths) {
            // @ts-ignore
            const file = app.vault.getAbstractFileByPath(filePath);
            if (file) {
                // @ts-ignore
                await app.vault.delete(file);
            }
        }
    }, paths);
}
