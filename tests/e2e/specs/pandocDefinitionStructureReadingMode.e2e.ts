import { browser, expect } from '@wdio/globals';

import { ensureActiveFileReadingMode } from '../helpers/readingMode';

const quotedPaths = [false, true].map(enabled =>
    `pandoc-definition-quoted-${enabled ? 'enabled' : 'disabled'}-reading-mode.md`
);
const mixedPaths = [false, true].map(enabled =>
    `pandoc-definition-mixed-${enabled ? 'enabled' : 'disabled'}-reading-mode.md`
);
const duplicatePaths = [false, true].map(enabled =>
    `pandoc-definition-duplicate-${enabled ? 'enabled' : 'disabled'}-reading-mode.md`
);
const nativeCodePaths = [false, true].map(enabled =>
    `pandoc-definition-native-code-${enabled ? 'enabled' : 'disabled'}-reading-mode.md`
);
const nestedDefinitionPaths = [false, true].map(enabled =>
    `pandoc-definition-nested-${enabled ? 'enabled' : 'disabled'}-reading-mode.md`
);
const paddedDefinitionPaths = [false, true].map(enabled =>
    `pandoc-definition-padding-${enabled ? 'enabled' : 'disabled'}-reading-mode.md`
);
const invalidCandidatePath = 'pandoc-definition-invalid-native-candidate-reading-mode.md';

describe('Pandoc definition structure in Reading mode', () => {
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
        await clearProbe();
        await setSyntaxSettings({
            enableDefinitionLists: true,
            enableListsWithoutPrecedingBlankline: true
        });
        await deleteFilesIfExist([
            ...quotedPaths,
            ...mixedPaths,
            ...duplicatePaths,
            ...nativeCodePaths,
            ...nestedDefinitionPaths,
            ...paddedDefinitionPaths,
            invalidCandidatePath
        ]);
    });

    for (const enabled of [false, true]) {
        const mode = enabled ? 'enabled' : 'disabled';

        it(`retains the quoted container by identity with the extension ${mode}`, async () => {
            const path = `pandoc-definition-quoted-${mode}-reading-mode.md`;
            const term = `QUOTED_TERM_${mode.toUpperCase()}`;
            const definition = `QUOTED_DEFINITION_${mode.toUpperCase()}`;
            await setSyntaxSettings({ enableListsWithoutPrecedingBlankline: enabled });
            await createOrReplaceFile(path, `> ${term}\n> : ${definition}`);
            await installQuotedIdentityProbe(term, definition);
            await openFileInActiveLeaf(path);
            await ensureActiveFileReadingMode();

            await browser.waitUntil(async () =>
                (await getQuotedState(term, definition)).definitionCount === 1,
            {
                timeout: 5000,
                timeoutMsg: `Expected quoted definition normalization with extension ${mode}`
            });

            expect(await getQuotedState(term, definition)).toEqual({
                capturedBeforeNormalization: true,
                definitionCount: 1,
                definitionOccurrences: 1,
                quoteCount: 1,
                quotePreserved: true,
                rootDefinitionCount: 0,
                termOccurrences: 1
            });
        });

        it(`keeps mixed paragraph and nested-list blocks in one dd with the extension ${mode}`, async () => {
            const path = `pandoc-definition-mixed-${mode}-reading-mode.md`;
            const term = `MIXED_TERM_${mode.toUpperCase()}`;
            const child = `MIXED_CHILD_${mode.toUpperCase()}`;
            const sentinel = `SENTINEL_${mode.toUpperCase()}`;
            const source = [
                term,
                ': one **bold**',
                `    - [${child}](https://example.com)`,
                '',
                sentinel
            ].join('\n');
            await setSyntaxSettings({ enableListsWithoutPrecedingBlankline: enabled });
            await createOrReplaceFile(path, source);
            await installSentinelIdentityProbe(sentinel);
            await openFileInActiveLeaf(path);
            await ensureActiveFileReadingMode();

            try {
                await browser.waitUntil(async () => {
                    const state = await getMixedState(term, child, sentinel);
                    return state.definitionCount === 1 && state.childOccurrences === 1;
                }, {
                    timeout: 5000,
                    timeoutMsg: `Expected mixed definition blocks with extension ${mode}`
                });
            } catch (error) {
                const html = await getActivePreviewHtml();
                throw new Error(`${(error as Error).message}\n${html}`);
            }

            const mixedState = await getMixedState(term, child, sentinel);
            expect(mixedState).toEqual({
                boldText: 'bold',
                childOccurrences: 1,
                childText: child,
                definitionCount: 1,
                directDescriptionTags: ['STRONG', 'UL'],
                leadingText: 'one bold',
                sentinelOccurrences: 1,
                sentinelPreserved: true,
                termOccurrences: 1
            });
        });

        it(`keeps duplicate definitions in separate quote containers with the extension ${mode}`, async () => {
            const path = `pandoc-definition-duplicate-${mode}-reading-mode.md`;
            const term = `DUPLICATE_TERM_${mode.toUpperCase()}`;
            const definition = `DUPLICATE_DEFINITION_${mode.toUpperCase()}`;
            const middle = `DUPLICATE_MIDDLE_${mode.toUpperCase()}`;
            const source = [
                `> ${term}`,
                `> : ${definition}`,
                '',
                middle,
                '',
                `> ${term}`,
                `> : ${definition}`
            ].join('\n');
            await setSyntaxSettings({ enableListsWithoutPrecedingBlankline: enabled });
            await createOrReplaceFile(path, source);
            await openFileInActiveLeaf(path);
            await ensureActiveFileReadingMode();

            try {
                await browser.waitUntil(async () =>
                    (await getDuplicateQuotedState(term, definition, middle)).definitionCount === 2,
                {
                    timeout: 5000,
                    timeoutMsg: `Expected both quoted definitions with extension ${mode}`
                });
            } catch (error) {
                throw new Error(`${(error as Error).message}\n${await getActivePreviewHtml()}`);
            }

            expect(await getDuplicateQuotedState(term, definition, middle)).toEqual({
                definitionCount: 2,
                definitionOccurrences: 2,
                middleOccurrences: 1,
                quoteCount: 2,
                termOccurrences: 2
            });
        });

        it(`preserves inline code and the native child list with the extension ${mode}`, async () => {
            const path = `pandoc-definition-native-code-${mode}-reading-mode.md`;
            const term = `NATIVE_CODE_TERM_${mode.toUpperCase()}`;
            const definition = `NATIVE_CODE_DEFINITION_${mode.toUpperCase()}`;
            const child = `NATIVE_CODE_CHILD_${mode.toUpperCase()}`;
            const source = `- \`${term}\`\n  : \`${definition}\`\n  - ${child}`;
            await setSyntaxSettings({ enableListsWithoutPrecedingBlankline: enabled });
            await createOrReplaceFile(path, source);
            await openFileInActiveLeaf(path);
            await ensureActiveFileReadingMode();

            await browser.waitUntil(async () =>
                (await getNativeCodeState(term, definition, child)).definitionCount === 1,
            {
                timeout: 5000,
                timeoutMsg: `Expected native inline-code definition with extension ${mode}`
            });

            expect(await getNativeCodeState(term, definition, child)).toEqual({
                childCount: 1,
                childOccurrences: 1,
                definitionCode: definition,
                definitionCount: 1,
                termCode: term
            });
        });

        it(`renders a nested definition list with Pandoc topology with the extension ${mode}`, async () => {
            const path = `pandoc-definition-nested-${mode}-reading-mode.md`;
            const outerTerm = `NESTED_OUTER_${mode.toUpperCase()}`;
            const nestedTerm = `NESTED_TERM_${mode.toUpperCase()}`;
            const nestedDefinition = `NESTED_DEFINITION_${mode.toUpperCase()}`;
            const source = `${outerTerm}\n: ${nestedTerm}\n  : ${nestedDefinition}`;
            await setSyntaxSettings({ enableListsWithoutPrecedingBlankline: enabled });
            await createOrReplaceFile(path, source);
            await openFileInActiveLeaf(path);
            await ensureActiveFileReadingMode();

            await browser.waitUntil(async () =>
                (await getNestedDefinitionState(
                    outerTerm,
                    nestedTerm,
                    nestedDefinition
                )).nestedListCount === 1,
            {
                timeout: 5000,
                timeoutMsg: `Expected nested definition topology with extension ${mode}`
            });

            expect(await getNestedDefinitionState(
                outerTerm,
                nestedTerm,
                nestedDefinition
            )).toEqual({
                nestedDefinitionOccurrences: 1,
                nestedListCount: 1,
                nestedTermOccurrences: 1,
                outerDefinitionCount: 1,
                outerTermOccurrences: 1
            });
        });

        it(`preserves excess definition padding as a code block with the extension ${mode}`, async () => {
            const path = `pandoc-definition-padding-${mode}-reading-mode.md`;
            const term = `PADDED_TERM_${mode.toUpperCase()}`;
            const code = `PADDED_CODE_${mode.toUpperCase()}`;
            const literal = `PADDED_LITERAL_${mode.toUpperCase()}`;
            const source = `${term}\n:     ${code}\n  : ${literal}`;
            await setSyntaxSettings({ enableListsWithoutPrecedingBlankline: enabled });
            await createOrReplaceFile(path, source);
            await openFileInActiveLeaf(path);
            await ensureActiveFileReadingMode();

            await browser.waitUntil(async () =>
                (await getPaddedDefinitionState(term, code, literal)).definitionCount === 1,
            {
                timeout: 5000,
                timeoutMsg: `Expected padded definition topology with extension ${mode}`
            });

            expect(await getPaddedDefinitionState(term, code, literal)).toEqual({
                codeOccurrences: 1,
                codeText: code,
                definitionCount: 1,
                literalOccurrences: 1,
                nestedDefinitionCount: 0,
                termOccurrences: 1
            });
        });
    }

    it('does not let an extension-disabled native candidate steal a quoted definition', async () => {
        const term = 'INVALID_NATIVE_CANDIDATE_TERM';
        const definition = 'INVALID_NATIVE_CANDIDATE_DEFINITION';
        const source = [
            'Paragraph',
            `- ${term}`,
            `  : ${definition}`,
            '',
            `> ${term}`,
            `> : ${definition}`
        ].join('\n');
        await setSyntaxSettings({ enableListsWithoutPrecedingBlankline: false });
        await createOrReplaceFile(invalidCandidatePath, source);
        await openFileInActiveLeaf(invalidCandidatePath);
        await ensureActiveFileReadingMode();

        try {
            await browser.waitUntil(async () =>
                (await getInvalidCandidateState(term, definition)).quotedDefinitionCount === 1,
            {
                timeout: 5000,
                timeoutMsg: 'Expected the quoted definition to own its matching DOM candidate'
            });
        } catch (error) {
            throw new Error(`${(error as Error).message}\n${await getActivePreviewHtml()}`);
        }

        expect(await getInvalidCandidateState(term, definition)).toEqual({
            definitionOccurrences: 2,
            rootDefinitionCount: 0,
            rootListCount: 0,
            quotedDefinitionCount: 1,
            termOccurrences: 2
        });
    });
});

async function getPaddedDefinitionState(
    term: string,
    code: string,
    literal: string
): Promise<{
    codeOccurrences: number;
    codeText: string;
    definitionCount: number;
    literalOccurrences: number;
    nestedDefinitionCount: number;
    termOccurrences: number;
}> {
    return browser.execute((termText: string, codeText: string, literalText: string) => {
        const preview = document.querySelector<HTMLElement>(
            '.workspace-leaf.mod-active .markdown-preview-view'
        );
        const text = preview?.textContent ?? '';
        const count = (target: string): number => text.split(target).length - 1;
        const list = Array.from(preview?.querySelectorAll<HTMLElement>(
            'dl.pem-definition-list'
        ) ?? []).find(candidate =>
            candidate.querySelector(':scope > dt')?.textContent === termText
        );
        const description = list?.querySelector(':scope > dd');
        return {
            codeOccurrences: count(codeText),
            codeText: description?.querySelector(':scope > pre > code')?.textContent?.trim() ?? '',
            definitionCount: list ? 1 : 0,
            literalOccurrences: count(literalText),
            nestedDefinitionCount: description?.querySelectorAll(
                ':scope > dl.pem-definition-list'
            ).length ?? 0,
            termOccurrences: count(termText)
        };
    }, term, code, literal);
}

async function getDuplicateQuotedState(
    term: string,
    definition: string,
    middle: string
): Promise<{
    definitionCount: number;
    definitionOccurrences: number;
    middleOccurrences: number;
    quoteCount: number;
    termOccurrences: number;
}> {
    return browser.execute((termText: string, definitionText: string, middleText: string) => {
        const preview = document.querySelector<HTMLElement>(
            '.workspace-leaf.mod-active .markdown-preview-view'
        );
        const text = preview?.textContent ?? '';
        const count = (target: string): number => text.split(target).length - 1;
        return {
            definitionCount: preview?.querySelectorAll(
                'blockquote > dl.pem-definition-list'
            ).length ?? 0,
            definitionOccurrences: count(definitionText),
            middleOccurrences: count(middleText),
            quoteCount: preview?.querySelectorAll('blockquote').length ?? 0,
            termOccurrences: count(termText)
        };
    }, term, definition, middle);
}

async function getNativeCodeState(
    term: string,
    definition: string,
    child: string
): Promise<{
    childCount: number;
    childOccurrences: number;
    definitionCode: string;
    definitionCount: number;
    termCode: string;
}> {
    return browser.execute((termText: string, definitionText: string, childText: string) => {
        const preview = document.querySelector<HTMLElement>(
            '.workspace-leaf.mod-active .markdown-preview-view'
        );
        const text = preview?.textContent ?? '';
        const count = (target: string): number => text.split(target).length - 1;
        const list = Array.from(preview?.querySelectorAll<HTMLElement>(
            'li > dl.pem-definition-list'
        ) ?? []).find(candidate =>
            candidate.querySelector('dt')?.textContent === termText &&
            candidate.querySelector('dd')?.textContent === definitionText
        );
        return {
            childCount: list?.parentElement?.querySelectorAll(':scope > ul > li').length ?? 0,
            childOccurrences: count(childText),
            definitionCode: list?.querySelector('dd > code')?.textContent ?? '',
            definitionCount: list ? 1 : 0,
            termCode: list?.querySelector('dt > code')?.textContent ?? ''
        };
    }, term, definition, child);
}

async function getInvalidCandidateState(
    term: string,
    definition: string
): Promise<{
    definitionOccurrences: number;
    rootDefinitionCount: number;
    rootListCount: number;
    quotedDefinitionCount: number;
    termOccurrences: number;
}> {
    return browser.execute((termText: string, definitionText: string) => {
        const preview = document.querySelector<HTMLElement>(
            '.workspace-leaf.mod-active .markdown-preview-view'
        );
        const text = preview?.textContent ?? '';
        const count = (target: string): number => text.split(target).length - 1;
        return {
            definitionOccurrences: count(definitionText),
            rootDefinitionCount: preview?.querySelectorAll(
                ':scope > dl.pem-definition-list, .markdown-preview-sizer > dl.pem-definition-list'
            ).length ?? 0,
            rootListCount: preview?.querySelectorAll(
                ':scope > ul, .markdown-preview-sizer > ul'
            ).length ?? 0,
            quotedDefinitionCount: preview?.querySelectorAll(
                'blockquote > dl.pem-definition-list'
            ).length ?? 0,
            termOccurrences: count(termText)
        };
    }, term, definition);
}

async function getNestedDefinitionState(
    outerTerm: string,
    nestedTerm: string,
    nestedDefinition: string
): Promise<{
    nestedDefinitionOccurrences: number;
    nestedListCount: number;
    nestedTermOccurrences: number;
    outerDefinitionCount: number;
    outerTermOccurrences: number;
}> {
    return browser.execute((outerText: string, nestedText: string, definitionText: string) => {
        const preview = document.querySelector<HTMLElement>(
            '.workspace-leaf.mod-active .markdown-preview-view'
        );
        const text = preview?.textContent ?? '';
        const count = (target: string): number => text.split(target).length - 1;
        const outer = Array.from(preview?.querySelectorAll<HTMLElement>(
            'dl.pem-definition-list'
        ) ?? []).find(candidate =>
            candidate.querySelector(':scope > dt')?.textContent === outerText
        );
        const nested = outer?.querySelector<HTMLElement>(
            ':scope > dd > dl.pem-definition-list'
        );
        return {
            nestedDefinitionOccurrences: count(definitionText),
            nestedListCount: nested ? 1 : 0,
            nestedTermOccurrences: count(nestedText),
            outerDefinitionCount: outer?.querySelectorAll(':scope > dd').length ?? 0,
            outerTermOccurrences: count(outerText)
        };
    }, outerTerm, nestedTerm, nestedDefinition);
}

async function installQuotedIdentityProbe(term: string, definition: string): Promise<void> {
    await browser.execute((termText: string, definitionText: string) => {
        interface DefinitionProbe {
            observer: MutationObserver;
            quote: HTMLElement | null;
            sentinel: HTMLElement | null;
        }
        const key = '__pemDefinitionStructureProbe';
        const record = window as unknown as Record<string, DefinitionProbe | undefined>;
        record[key]?.observer.disconnect();

        const capture = (probe: DefinitionProbe): void => {
            const quote = Array.from(document.querySelectorAll<HTMLElement>(
                '.markdown-preview-view blockquote'
            )).find(candidate => {
                const text = candidate.textContent ?? '';
                return text.includes(termText) && text.includes(definitionText) &&
                    !candidate.querySelector('dl.pem-definition-list');
            });
            if (quote) {
                probe.quote = quote;
                probe.observer.disconnect();
            }
        };
        const observer = new MutationObserver(() => capture(probe));
        const probe: DefinitionProbe = { observer, quote: null, sentinel: null };
        record[key] = probe;
        observer.observe(document.body, { childList: true, subtree: true });
        capture(probe);
    }, term, definition);
}

async function installSentinelIdentityProbe(sentinel: string): Promise<void> {
    await browser.execute((sentinelText: string) => {
        interface DefinitionProbe {
            observer: MutationObserver;
            quote: HTMLElement | null;
            sentinel: HTMLElement | null;
        }
        const key = '__pemDefinitionStructureProbe';
        const record = window as unknown as Record<string, DefinitionProbe | undefined>;
        record[key]?.observer.disconnect();

        const capture = (probe: DefinitionProbe): void => {
            const sentinelElement = Array.from(document.querySelectorAll<HTMLElement>(
                '.markdown-preview-view p'
            )).find(candidate => (candidate.textContent ?? '').trim() === sentinelText);
            if (sentinelElement) {
                probe.sentinel = sentinelElement;
                probe.observer.disconnect();
            }
        };
        const observer = new MutationObserver(() => capture(probe));
        const probe: DefinitionProbe = { observer, quote: null, sentinel: null };
        record[key] = probe;
        observer.observe(document.body, { childList: true, subtree: true });
        capture(probe);
    }, sentinel);
}

async function getQuotedState(term: string, definition: string): Promise<{
    capturedBeforeNormalization: boolean;
    definitionCount: number;
    definitionOccurrences: number;
    quoteCount: number;
    quotePreserved: boolean;
    rootDefinitionCount: number;
    termOccurrences: number;
}> {
    return browser.execute((termText: string, definitionText: string) => {
        // @ts-ignore
        const activeFile = app.workspace.getActiveFile?.();
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType?.('markdown') ?? [];
        const leaf = leaves.find((candidate: {
            view?: { file?: { path?: string }, containerEl?: HTMLElement }
        }) => candidate.view?.file?.path === activeFile?.path);
        const preview = leaf?.view?.containerEl?.querySelector<HTMLElement>(
            '.markdown-preview-view'
        ) ?? document.querySelector<HTMLElement>(
            '.workspace-leaf.mod-active .markdown-preview-view'
        );
        const probe = (window as unknown as Record<string, {
            quote: HTMLElement | null;
        } | undefined>).__pemDefinitionStructureProbe;
        const text = preview?.textContent ?? '';
        const count = (target: string): number => text.split(target).length - 1;
        return {
            capturedBeforeNormalization: Boolean(probe?.quote),
            definitionCount: preview?.querySelectorAll(
                'blockquote > dl.pem-definition-list'
            ).length ?? 0,
            definitionOccurrences: count(definitionText),
            quoteCount: preview?.querySelectorAll('blockquote').length ?? 0,
            quotePreserved: Boolean(probe?.quote && preview?.contains(probe.quote)),
            rootDefinitionCount: preview?.querySelectorAll(
                ':scope > dl.pem-definition-list, :scope > .markdown-preview-sizer > dl.pem-definition-list'
            ).length ?? 0,
            termOccurrences: count(termText)
        };
    }, term, definition);
}

async function getMixedState(term: string, child: string, sentinel: string): Promise<{
    boldText: string;
    childOccurrences: number;
    childText: string;
    definitionCount: number;
    directDescriptionTags: string[];
    leadingText: string;
    sentinelOccurrences: number;
    sentinelPreserved: boolean;
    termOccurrences: number;
}> {
    return browser.execute((termText: string, childText: string, sentinelText: string) => {
        // @ts-ignore
        const activeFile = app.workspace.getActiveFile?.();
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType?.('markdown') ?? [];
        const leaf = leaves.find((candidate: {
            view?: { file?: { path?: string }, containerEl?: HTMLElement }
        }) => candidate.view?.file?.path === activeFile?.path);
        const preview = leaf?.view?.containerEl?.querySelector<HTMLElement>(
            '.markdown-preview-view'
        ) ?? document.querySelector<HTMLElement>(
            '.workspace-leaf.mod-active .markdown-preview-view'
        );
        const probe = (window as unknown as Record<string, {
            sentinel: HTMLElement | null;
        } | undefined>).__pemDefinitionStructureProbe;
        const text = preview?.textContent ?? '';
        const count = (target: string): number => text.split(target).length - 1;
        const list = Array.from(preview?.querySelectorAll<HTMLElement>(
            'dl.pem-definition-list'
        ) ?? []).find(candidate => candidate.querySelector('dt')?.textContent === termText);
        const description = list?.querySelector('dd');
        const leadingNodes = Array.from(description?.childNodes ?? []);
        const firstListIndex = leadingNodes.findIndex(node =>
            node.nodeType === Node.ELEMENT_NODE &&
            ['UL', 'OL'].includes((node as Element).tagName)
        );
        const leadingText = leadingNodes
            .slice(0, firstListIndex < 0 ? leadingNodes.length : firstListIndex)
            .map(node => node.textContent ?? '')
            .join('')
            .replace(/\s+/g, ' ')
            .trim();
        return {
            boldText: description?.querySelector(':scope > strong')?.textContent ?? '',
            childOccurrences: count(childText),
            childText: description?.querySelector(':scope > ul > li > a')?.textContent ?? '',
            definitionCount: list ? 1 : 0,
            directDescriptionTags: Array.from(description?.children ?? [])
                .map(element => element.tagName),
            leadingText,
            sentinelOccurrences: count(sentinelText),
            sentinelPreserved: Boolean(
                probe?.sentinel && preview?.contains(probe.sentinel)
            ),
            termOccurrences: count(termText)
        };
    }, term, child, sentinel);
}

async function clearProbe(): Promise<void> {
    await browser.execute(() => {
        const record = window as unknown as Record<string, {
            observer?: MutationObserver;
        } | undefined>;
        record.__pemDefinitionStructureProbe?.observer?.disconnect();
        delete record.__pemDefinitionStructureProbe;
    });
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
        return leaf?.view?.containerEl?.querySelector('.markdown-preview-view')?.innerHTML ?? '';
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
