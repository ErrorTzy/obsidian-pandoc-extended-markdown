import { browser, expect } from '@wdio/globals';

interface PanelRowInfo {
    title: string;
    label: string;
    content: string;
}

interface PanelClickState {
    clipboardWrites: string[];
    cursorLine: number;
    cursorCh: number;
}

interface PanelLayoutInfo {
    tableLayout: string;
    titleFits: boolean;
    labelFits: boolean;
    titleWidth: number;
    labelWidth: number;
    contentWidth: number;
}

interface PanelMathRenderInfo {
    text: string;
    html: string;
    mathCount: number;
    mathErrorCount: number;
    rawDollarCount: number;
}

describe('Fenced div list panel', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });

        await browser.execute(async () => {
            // @ts-ignore
            const plugin = app.plugins.plugins['pandoc-extended-markdown'];
            if (!plugin) {
                // @ts-ignore
                await app.plugins.enablePlugin('pandoc-extended-markdown');
            }

            // @ts-ignore
            const loadedPlugin = app.plugins.plugins['pandoc-extended-markdown'];
            if (loadedPlugin?.settings) {
                loadedPlugin.settings.enableListPanel = true;
                loadedPlugin.settings.enableFencedDivs = true;
                loadedPlugin.settings.panelOrder = [
                    'custom-labels',
                    'example-lists',
                    'definition-lists',
                    'fenced-divs',
                    'footnotes'
                ];
                await loadedPlugin.saveSettings();
                loadedPlugin.updateListPanelAvailability?.();
                // @ts-ignore
                app.workspace.updateOptions();
            }
        });
    });

    it('shows title metadata, citation label, and content columns', async () => {
        const filePath = 'fenced-div-panel-layout.md';
        const content = [
            '::: {.theorem #thm:compact}',
            'Every compact metric space is complete.',
            ':::',
            '',
            '::: {#standalone}',
            'A labeled block without a class title.',
            ':::',
            '',
            '::: {.proposition #prop:numbered title="Proposition &"}',
            'A numbered proposition.',
            ':::',
            '',
            '::: Warning',
            'Admonition content without a citation label.',
            ':::'
        ].join('\n');

        await createOrReplaceFile(filePath, content);
        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();
        await openFencedDivPanel();

        const rows = await getPanelRows();

        expect(rows).toHaveLength(4);
        expect(rows[0]).toEqual({
            title: 'Theorem',
            label: '@thm:compact',
            content: 'Every compact metric space is complete.'
        });
        expect(rows[1]).toEqual({
            title: '',
            label: '@standalone',
            content: 'A labeled block without a class title.'
        });
        expect(rows[2]).toEqual({
            title: 'Proposition 1',
            label: '@prop:numbered',
            content: 'A numbered proposition.'
        });
        expect(rows[3]).toEqual({
            title: 'Warning',
            label: '',
            content: 'Admonition content without a citation label.'
        });

        const layout = await getFirstRowLayout();
        expect(layout.titleFits).toBe(true);
        expect(layout.labelFits).toBe(true);
        expect(layout.tableLayout).toBe('auto');
        expect(layout.contentWidth).toBeGreaterThan(0);

        await deleteFileIfExists(filePath);
    });

    it('copies labels from the label column and jumps to content from the content column', async () => {
        const filePath = 'fenced-div-panel-interactions.md';
        const content = [
            '::: {.lemma #lemma:jump}',
            'Jump target content.',
            ':::'
        ].join('\n');

        await createOrReplaceFile(filePath, content);
        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();
        await installClipboardRecorder();
        await openFencedDivPanel();

        await browser.waitUntil(async () => {
            const rows = await getPanelRows();
            return rows.length === 1 && rows[0].label === '@lemma:jump';
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected fenced div panel row for lemma'
        });

        await clickPanelCell('.pem-fenced-div-panel-title');
        let state = await getPanelClickState();
        expect(state.clipboardWrites).toEqual([]);

        await clickPanelCell('.pem-fenced-div-panel-label');
        state = await getPanelClickState();
        expect(state.clipboardWrites).toEqual(['@lemma:jump']);

        await clickPanelCell('.pem-fenced-div-panel-content');
        state = await getPanelClickState();
        expect(state.cursorLine).toBe(1);
        expect(state.cursorCh).toBe(0);

        await deleteFileIfExists(filePath);
    });

    it('does not cut display math in the content preview', async () => {
        const filePath = 'fenced-div-panel-display-math.md';
        const content = [
            '::: {.theorem #thm:display-math}',
            '$$',
            '\\frac{a_1 + a_2 + a_3 + a_4 + a_5 + a_6 + a_7 + a_8 + a_9 + a_{10}}{b_1 + b_2 + b_3 + b_4 + b_5 + b_6 + b_7 + b_8 + b_9 + b_{10}} = c',
            '$$',
            'This trailing sentence keeps the fenced div content long enough to require truncation.',
            ':::'
        ].join('\n');

        await createOrReplaceFile(filePath, content);
        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();
        await openFencedDivPanel();

        await browser.waitUntil(async () => {
            const state = await getPanelMathRenderInfo();
            return state.text.includes('…') && state.rawDollarCount === 0 && state.mathErrorCount === 0;
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected fenced div panel preview to truncate without raw or errored display math'
        });

        const state = await getPanelMathRenderInfo();
        expect(state.text).toContain('…');
        expect(state.rawDollarCount).toBe(0);
        expect(state.mathErrorCount).toBe(0);
        expect(state.html).not.toContain('mjx-merror');

        await deleteFileIfExists(filePath);
    });
});

async function openFencedDivPanel(): Promise<void> {
    await browser.execute(async () => {
        // @ts-ignore
        const plugin = app.plugins.plugins['pandoc-extended-markdown'];
        await plugin.activateListPanelView();
    });

    await browser.waitUntil(async () => {
        const hasTab = await browser.execute(() =>
            Boolean(document.querySelector('.pem-list-panel-icon-button[data-panel-id="fenced-divs"]'))
        );
        return hasTab;
    }, {
        timeout: 5000,
        timeoutMsg: 'Expected fenced div panel tab to exist'
    });

    await browser.execute(() => {
        const button = document.querySelector<HTMLElement>('.pem-list-panel-icon-button[data-panel-id="fenced-divs"]');
        button?.click();
    });

    await browser.waitUntil(async () => {
        const hasPanel = await browser.execute(() =>
            Boolean(document.querySelector('.pem-fenced-div-panel-container, .pem-fenced-div-panel-empty'))
        );
        return hasPanel;
    }, {
        timeout: 5000,
        timeoutMsg: 'Expected fenced div panel content to render'
    });
}

async function getPanelRows(): Promise<PanelRowInfo[]> {
    return browser.execute((): PanelRowInfo[] => {
        const rows = Array.from(document.querySelectorAll('.pem-fenced-div-panel-row'));
        return rows.map(row => ({
            title: row.querySelector('.pem-fenced-div-panel-title')?.textContent ?? '',
            label: row.querySelector('.pem-fenced-div-panel-label')?.textContent ?? '',
            content: row.querySelector('.pem-fenced-div-panel-content')?.textContent ?? ''
        }));
    });
}

async function getFirstRowLayout(): Promise<PanelLayoutInfo> {
    return browser.execute((): PanelLayoutInfo => {
        const row = document.querySelector('.pem-fenced-div-panel-row');
        const table = document.querySelector('.pem-fenced-div-panel-container') as HTMLElement | null;
        const title = row?.querySelector('.pem-fenced-div-panel-title') as HTMLElement | null;
        const label = row?.querySelector('.pem-fenced-div-panel-label') as HTMLElement | null;
        const content = row?.querySelector('.pem-fenced-div-panel-content') as HTMLElement | null;

        return {
            tableLayout: table ? getComputedStyle(table).tableLayout : '',
            titleFits: Boolean(title && title.scrollWidth <= title.clientWidth),
            labelFits: Boolean(label && label.scrollWidth <= label.clientWidth),
            titleWidth: title?.getBoundingClientRect().width ?? 0,
            labelWidth: label?.getBoundingClientRect().width ?? 0,
            contentWidth: content?.getBoundingClientRect().width ?? 0
        };
    });
}

async function getPanelMathRenderInfo(): Promise<PanelMathRenderInfo> {
    return browser.execute((): PanelMathRenderInfo => {
        const content = document.querySelector('.pem-fenced-div-panel-content') as HTMLElement | null;
        const text = content?.textContent ?? '';
        const html = content?.innerHTML ?? '';
        return {
            text,
            html,
            mathCount: content?.querySelectorAll('.math, mjx-container').length ?? 0,
            mathErrorCount: content?.querySelectorAll('mjx-merror, .math-error').length ?? 0,
            rawDollarCount: (text.match(/\$/g) ?? []).length
        };
    });
}

async function clickPanelCell(selector: string): Promise<void> {
    await browser.execute((cellSelector: string) => {
        const cell = document.querySelector<HTMLElement>(cellSelector);
        cell?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }, selector);
    await browser.pause(250);
}

async function installClipboardRecorder(): Promise<void> {
    await browser.execute(() => {
        (window as unknown as { __pemClipboardWrites: string[] }).__pemClipboardWrites = [];
        const recorder = async (text: string) => {
            (window as unknown as { __pemClipboardWrites: string[] }).__pemClipboardWrites.push(text);
        };
        if (navigator.clipboard) {
            Object.defineProperty(navigator.clipboard, 'writeText', {
                configurable: true,
                value: recorder
            });
        }
    });
}

async function getPanelClickState(): Promise<PanelClickState> {
    return browser.execute((): PanelClickState => {
        // @ts-ignore
        const leaf = app.workspace.getLeavesOfType('markdown')[0];
        const view = leaf?.view;
        const cursor = view?.editor?.getCursor?.() ?? { line: -1, ch: -1 };
        return {
            clipboardWrites: (window as unknown as { __pemClipboardWrites?: string[] }).__pemClipboardWrites ?? [],
            cursorLine: cursor.line,
            cursorCh: cursor.ch
        };
    });
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
        if (file) {
            // @ts-ignore
            await app.workspace.getLeaf().openFile(file);
        }
    }, path);
}

async function ensureLivePreviewMode(): Promise<void> {
    await browser.execute(async () => {
        // @ts-ignore
        const leaf = app.workspace.getLeaf();
        // @ts-ignore
        const state = leaf.getViewState();
        state.state.mode = 'source';
        state.state.source = false;
        // @ts-ignore
        await leaf.setViewState(state);
    });

    await browser.waitUntil(async () => {
        const hasEditor = await browser.execute(() =>
            Boolean(document.querySelector('.markdown-source-view.mod-cm6 .cm-content'))
        );
        return hasEditor;
    }, { timeout: 5000 });
    await browser.pause(500);
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
