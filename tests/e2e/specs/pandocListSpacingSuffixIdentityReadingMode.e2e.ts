import { browser, expect } from '@wdio/globals';

import { ensureActiveFileReadingMode } from '../helpers/readingMode';

const filePath = 'pandoc-list-spacing-suffix-identity-reading-mode.md';
const parentText = 'PARENT_BECOMES_TEXT';
const childText = 'CHILD_MUST_STAY';

describe('Pandoc list-spacing source-owned suffix identity in Reading mode', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });
        await setListSpacing(false);
    });

    after(async () => {
        await clearIdentityProbe();
        await setListSpacing(true);
        await deleteFileIfExists(filePath);
    });

    it('promotes a blank-separated valid child without replacing its list or item', async () => {
        await createOrReplaceFile(filePath, [
            'Paragraph',
            `- ${parentText}`,
            '',
            `  - ${childText}`
        ].join('\n'));
        await openFileInActiveLeaf(filePath);
        await installIdentityProbe(parentText, childText);
        await ensureActiveFileReadingMode();

        await browser.waitUntil(async () => {
            const state = await getIdentityState(parentText, childText);
            return state.capturedBeforeReconciliation &&
                state.invalidText.includes(`- ${parentText}`) &&
                state.childOccurrences === 1 &&
                state.listPreserved &&
                state.itemPreserved &&
                state.promotedOutsideConsumedParent;
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected the source-owned child list to be promoted intact'
        });

        expect(await getIdentityState(parentText, childText)).toEqual({
            capturedBeforeReconciliation: true,
            childOccurrences: 1,
            directItemCount: 1,
            invalidText: `Paragraph - ${parentText}`,
            itemPreserved: true,
            listPreserved: true,
            promotedOutsideConsumedParent: true
        });
        expect(await clickProbedChild()).toBe(1);
    });

    it('promotes every blank-separated list block without consuming a later sibling', async () => {
        const secondChild = 'CHILD_TWO_MUST_STAY';
        await createOrReplaceFile(filePath, [
            'Paragraph',
            `- ${parentText}`,
            '',
            '  - CHILD_ONE_MUST_STAY',
            `  1. ${secondChild}`
        ].join('\n'));
        await openFileInActiveLeaf(filePath);
        await ensureActiveFileReadingMode();

        await browser.waitUntil(async () => {
            const state = await getSemanticBlockState();
            return state.blocks.map(block => block.tag).join(',') === 'P,UL,OL' &&
                state.occurrences.CHILD_ONE_MUST_STAY === 1 &&
                state.occurrences.CHILD_TWO_MUST_STAY === 1;
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected every source-owned list block to survive promotion'
        });

        expect(await getSemanticBlockState()).toEqual({
            blocks: [
                { tag: 'P', text: `Paragraph - ${parentText}` },
                { tag: 'UL', text: 'CHILD_ONE_MUST_STAY' },
                { start: 1, tag: 'OL', text: secondChild }
            ],
            occurrences: {
                CHILD_ONE_MUST_STAY: 1,
                CHILD_TWO_MUST_STAY: 1
            }
        });
    });

    it('promotes a blank-separated block quote without consuming it', async () => {
        const quoteText = 'QUOTE_MUST_STAY';
        await createOrReplaceFile(filePath, [
            'Paragraph',
            `- ${parentText}`,
            '',
            `  > ${quoteText}`
        ].join('\n'));
        await openFileInActiveLeaf(filePath);
        await ensureActiveFileReadingMode();

        await browser.waitUntil(async () => {
            const state = await getSemanticBlockState();
            return state.blocks.some(block => block.tag === 'BLOCKQUOTE' &&
                block.text === quoteText);
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected the source-owned block quote to survive reconciliation'
        });

        expect(await getSemanticBlockState()).toEqual({
            blocks: [
                { tag: 'P', text: `Paragraph - ${parentText}` },
                { tag: 'BLOCKQUOTE', text: quoteText }
            ],
            occurrences: {
                CHILD_ONE_MUST_STAY: 0,
                CHILD_TWO_MUST_STAY: 0
            }
        });
    });

    it('keeps incompatible ordered delimiters as separate Pandoc list groups', async () => {
        await createOrReplaceFile(filePath, [
            'Paragraph',
            `1. ${parentText}`,
            '',
            '   1) CHILD_ONE_MUST_STAY',
            '7. CHILD_TWO_MUST_STAY'
        ].join('\n'));
        await openFileInActiveLeaf(filePath);
        await ensureActiveFileReadingMode();

        await browser.waitUntil(async () => {
            const state = await getSemanticBlockState();
            return state.blocks.filter(block => block.tag === 'OL').length === 2;
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected incompatible ordered delimiters to remain separate lists'
        });

        expect(await getSemanticBlockState()).toEqual({
            blocks: [
                { tag: 'P', text: `Paragraph 1. ${parentText}` },
                { start: 1, tag: 'OL', text: 'CHILD_ONE_MUST_STAY' },
                { start: 7, tag: 'OL', text: 'CHILD_TWO_MUST_STAY' }
            ],
            occurrences: {
                CHILD_ONE_MUST_STAY: 1,
                CHILD_TWO_MUST_STAY: 1
            }
        });
    });

    it('joins a compatible ordered suffix and following sibling into one Pandoc group', async () => {
        await createOrReplaceFile(filePath, [
            'Paragraph',
            `1. ${parentText}`,
            '',
            '   1. CHILD_ONE_MUST_STAY',
            '7. CHILD_TWO_MUST_STAY'
        ].join('\n'));
        await openFileInActiveLeaf(filePath);
        await ensureActiveFileReadingMode();

        await browser.waitUntil(async () => {
            const state = await getSemanticBlockState();
            return state.blocks.map(block => block.tag).join(',') === 'P,OL' &&
                state.occurrences.CHILD_ONE_MUST_STAY === 1 &&
                state.occurrences.CHILD_TWO_MUST_STAY === 1;
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected compatible ordered markers to share one list'
        });

        expect(await getSemanticBlockState()).toEqual({
            blocks: [
                { tag: 'P', text: `Paragraph 1. ${parentText}` },
                {
                    start: 1,
                    tag: 'OL',
                    text: 'CHILD_ONE_MUST_STAY CHILD_TWO_MUST_STAY'
                }
            ],
            occurrences: {
                CHILD_ONE_MUST_STAY: 1,
                CHILD_TWO_MUST_STAY: 1
            }
        });
    });
});

async function getSemanticBlockState(): Promise<{
    blocks: Array<{ tag: string; text: string; start?: number }>;
    occurrences: Record<string, number>;
}> {
    return browser.execute(() => {
        // @ts-ignore
        const activeFile = app.workspace.getActiveFile?.();
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType?.('markdown') ?? [];
        const leaf = leaves.find((candidate: {
            view?: { file?: { path?: string }, containerEl?: HTMLElement }
        }) => candidate.view?.file?.path === activeFile?.path);
        const section = leaf?.view?.containerEl?.querySelector('.markdown-preview-section') ??
            document.querySelector('.workspace-leaf.mod-active .markdown-preview-section');
        const semanticBlocks = Array.from(section?.children ?? []).flatMap(child => {
            if (!(child instanceof HTMLElement)) {
                return [];
            }
            if (child.matches('.el-p, .el-ul, .el-ol, .el-blockquote')) {
                const semantic = Array.from(child.children).find(candidate =>
                    candidate.matches('p, ul, ol, blockquote')
                );
                return semantic instanceof HTMLElement ? [semantic] : [];
            }
            return child.matches('p, ul, ol, blockquote') ? [child] : [];
        });
        const text = section?.textContent ?? '';
        const count = (target: string): number => text.split(target).length - 1;
        return {
            blocks: semanticBlocks.map(block => ({
                ...(block.tagName === 'OL'
                    ? { start: (block as HTMLOListElement).start }
                    : {}),
                tag: block.tagName,
                text: (block.textContent ?? '').replace(/\s+/g, ' ').trim()
            })),
            occurrences: {
                CHILD_ONE_MUST_STAY: count('CHILD_ONE_MUST_STAY'),
                CHILD_TWO_MUST_STAY: count('CHILD_TWO_MUST_STAY')
            }
        };
    });
}

async function installIdentityProbe(parent: string, child: string): Promise<void> {
    await browser.execute((parentTarget: string, childTarget: string) => {
        interface SuffixProbe {
            child: HTMLLIElement | null;
            clicks: number;
            list: HTMLElement | null;
            observer: MutationObserver;
            owner: HTMLLIElement | null;
        }
        const key = '__pemSuffixIdentityProbe';
        const record = window as unknown as Record<string, SuffixProbe | undefined>;
        record[key]?.observer.disconnect();

        const capture = (probe: SuffixProbe): void => {
            const nestedLists = Array.from(document.querySelectorAll<HTMLElement>(
                '.markdown-preview-view li > ul, .markdown-preview-view li > ol'
            ));
            for (const list of nestedLists) {
                const owner = list.parentElement;
                const childItem = Array.from(list.children).find(candidate =>
                    candidate.tagName === 'LI' &&
                    (candidate.textContent ?? '').trim() === childTarget
                );
                if (owner?.tagName !== 'LI' || childItem?.tagName !== 'LI' ||
                    !(owner.textContent ?? '').includes(parentTarget)) {
                    continue;
                }
                probe.list = list;
                probe.owner = owner as HTMLLIElement;
                probe.child = childItem as HTMLLIElement;
                probe.child.addEventListener('click', () => probe.clicks++);
                probe.observer.disconnect();
                return;
            }
        };

        const observer = new MutationObserver(() => capture(probe));
        const probe: SuffixProbe = {
            child: null,
            clicks: 0,
            list: null,
            observer,
            owner: null
        };
        record[key] = probe;
        observer.observe(document.body, { childList: true, subtree: true });
        capture(probe);
    }, parent, child);
}

async function getIdentityState(parent: string, child: string): Promise<{
    capturedBeforeReconciliation: boolean;
    childOccurrences: number;
    directItemCount: number;
    invalidText: string;
    itemPreserved: boolean;
    listPreserved: boolean;
    promotedOutsideConsumedParent: boolean;
}> {
    return browser.execute((parentTarget: string, childTarget: string) => {
        interface SuffixProbe {
            child: HTMLLIElement | null;
            list: HTMLElement | null;
            owner: HTMLLIElement | null;
        }
        const key = '__pemSuffixIdentityProbe';
        const probe = (window as unknown as Record<string, SuffixProbe | undefined>)[key];
        // @ts-ignore
        const activeFile = app.workspace.getActiveFile?.();
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType?.('markdown') ?? [];
        const leaf = leaves.find((candidate: {
            view?: { file?: { path?: string }, containerEl?: HTMLElement }
        }) => candidate.view?.file?.path === activeFile?.path);
        const preview = leaf?.view?.containerEl?.querySelector('.markdown-preview-view') ??
            document.querySelector('.workspace-leaf.mod-active .markdown-preview-view');
        const text = preview?.textContent ?? '';
        const invalidText = preview?.querySelector('.pem-pandoc-invalid-native-list')
            ?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        const promotedList = probe?.list && preview?.contains(probe.list)
            ? probe.list
            : null;
        const directItems = promotedList
            ? Array.from(promotedList.children).filter(candidate => candidate.tagName === 'LI')
            : [];

        return {
            capturedBeforeReconciliation: Boolean(probe?.list && probe.child && probe.owner),
            childOccurrences: text.split(childTarget).length - 1,
            directItemCount: directItems.length,
            invalidText,
            itemPreserved: Boolean(probe?.child && directItems[0] === probe.child),
            listPreserved: Boolean(promotedList),
            promotedOutsideConsumedParent: Boolean(
                promotedList && probe?.owner &&
                !probe.owner.contains(promotedList) &&
                !preview?.contains(probe.owner) &&
                invalidText.includes(parentTarget)
            )
        };
    }, parent, child);
}

async function clickProbedChild(): Promise<number> {
    return browser.execute(() => {
        interface SuffixProbe {
            child: HTMLLIElement | null;
            clicks: number;
        }
        const probe = (window as unknown as Record<
            string,
            SuffixProbe | undefined
        >).__pemSuffixIdentityProbe;
        probe?.child?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return probe?.clicks ?? 0;
    });
}

async function clearIdentityProbe(): Promise<void> {
    await browser.execute(() => {
        const record = window as unknown as Record<string, {
            observer?: MutationObserver;
        } | undefined>;
        record.__pemSuffixIdentityProbe?.observer?.disconnect();
        delete record.__pemSuffixIdentityProbe;
    });
}

async function setListSpacing(enabled: boolean): Promise<void> {
    await browser.execute(async (value: boolean) => {
        // @ts-ignore
        const plugin = app.plugins.plugins['pandoc-extended-markdown'];
        if (plugin?.settings) {
            plugin.settings.enableListsWithoutPrecedingBlankline = value;
            await plugin.saveSettings();
            // @ts-ignore
            app.workspace.updateOptions();
        }
    }, enabled);
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

async function deleteFileIfExists(path: string): Promise<void> {
    await browser.execute(async (filePath: string) => {
        // @ts-ignore
        const file = app.vault.getAbstractFileByPath(filePath);
        if (file) {
            // @ts-ignore
            await app.vault.delete(file);
        }
    }, path);
}
