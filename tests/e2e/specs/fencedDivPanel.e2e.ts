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
    itemColumns: string;
    titleFits: boolean;
    labelFits: boolean;
    identityTop: number;
    identityBottom: number;
    contentTop: number;
    contentLeft: number;
    identityLeft: number;
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

    it('shows complete metadata and responds to the panel container width', async () => {
        const filePath = 'fenced-div-panel-layout.md';
        const content = [
            '::: {.theorem #thm:a-very-long-semantic-label-that-must-wrap-completely}',
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
            label: '@thm:a-very-long-semantic-label-that-must-wrap-completely',
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

        const narrowLayout = await getFirstRowLayout('28rem');
        expect(narrowLayout.titleFits).toBe(true);
        expect(narrowLayout.labelFits).toBe(true);
        expect(narrowLayout.itemColumns.split(' ')).toHaveLength(1);
        expect(narrowLayout.contentTop).toBeGreaterThanOrEqual(narrowLayout.identityBottom);
        expect(narrowLayout.contentWidth).toBeGreaterThan(200);

        const wideLayout = await getFirstRowLayout('40rem');
        expect(wideLayout.itemColumns.split(' ').length).toBeGreaterThan(1);
        expect(wideLayout.contentLeft).toBeGreaterThan(wideLayout.identityLeft);
        expect(wideLayout.contentWidth).toBeGreaterThan(250);

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

    it('renders complete display math and expansion exposes the full body', async () => {
        const filePath = 'fenced-div-panel-display-math.md';
        const content = [
            '::: {.theorem #thm:display-math}',
            '$$',
            '\\frac{a_1 + a_2 + a_3 + a_4 + a_5 + a_6 + a_7 + a_8 + a_9 + a_{10}}{b_1 + b_2 + b_3 + b_4 + b_5 + b_6 + b_7 + b_8 + b_9 + b_{10}} = c',
            '$$',
            'This trailing sentence keeps the fenced div content long enough to overflow the collapsed three-line preview.',
            '',
            'A final paragraph proves that the full rendered source remains available after expansion.',
            ':::'
        ].join('\n');

        await createOrReplaceFile(filePath, content);
        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();
        await openFencedDivPanel();

        await browser.waitUntil(async () => {
            const state = await getPanelMathRenderInfo();
            const hasVisibleToggle = await browser.execute(() => {
                const toggle = document.querySelector<HTMLButtonElement>('.pem-panel-item-toggle');
                return Boolean(toggle && !toggle.hidden);
            });
            return hasVisibleToggle && state.rawDollarCount === 0 && state.mathErrorCount === 0;
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected a valid overflowing fenced div preview with rendered display math'
        });

        let state = await getPanelMathRenderInfo();
        expect(state.text).toContain('A final paragraph proves that the full rendered source remains available');
        expect(state.text).not.toContain('…');
        expect(state.rawDollarCount).toBe(0);
        expect(state.mathErrorCount).toBe(0);
        expect(state.html).not.toContain('mjx-merror');

        await clickPanelCell('.pem-panel-item-toggle');
        state = await getPanelMathRenderInfo();
        const expanded = await $('.pem-panel-item-toggle').getAttribute('aria-expanded');
        expect(expanded).toBe('true');
        expect(state.text).toContain('A final paragraph proves that the full rendered source remains available');

        await deleteFileIfExists(filePath);
    });

    it('supports bulk expansion and collapse for overflowing items', async () => {
        const filePath = 'fenced-div-panel-bulk-expansion.md';
        const longContent = 'This fenced div body has enough rendered prose to wrap across several lines in the sidebar. It retains every character while collapsed and continues with another sentence for reliable overflow detection.';
        const content = [
            '::: {.theorem #thm:first-long-item}',
            longContent,
            '',
            longContent,
            ':::',
            '',
            '::: {.lemma #lemma:second-long-item}',
            longContent,
            '',
            longContent,
            ':::'
        ].join('\n');

        await createOrReplaceFile(filePath, content);
        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();
        await openFencedDivPanel();

        await browser.waitUntil(async () => {
            return browser.execute(() => {
                const toggles = Array.from(document.querySelectorAll<HTMLButtonElement>('.pem-panel-item-toggle'));
                return toggles.length === 2 && toggles.every(toggle => !toggle.hidden);
            });
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected both fenced div items to overflow'
        });

        await clickPanelCell('.pem-panel-expand-all');
        let states = await getExpansionStates();
        expect(states).toEqual(['true', 'true']);

        await clickPanelCell('.pem-panel-collapse-all');
        states = await getExpansionStates();
        expect(states).toEqual(['false', 'false']);

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

    await browser.execute(() => {
        const container = document.querySelector('.pem-list-panel-content-container') as HTMLElement | null;
        if (container) {
            container.style.removeProperty('flex');
            container.style.removeProperty('width');
        }
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

async function getFirstRowLayout(width: string): Promise<PanelLayoutInfo> {
    return browser.execute((containerWidth: string): PanelLayoutInfo => {
        const container = document.querySelector('.pem-list-panel-content-container') as HTMLElement | null;
        if (container) {
            container.style.flex = '0 0 auto';
            container.style.width = containerWidth;
        }
        const row = document.querySelector('.pem-fenced-div-panel-row');
        const identity = row?.querySelector('.pem-panel-item-identity') as HTMLElement | null;
        const title = row?.querySelector('.pem-fenced-div-panel-title') as HTMLElement | null;
        const label = row?.querySelector('.pem-fenced-div-panel-label') as HTMLElement | null;
        const content = row?.querySelector('.pem-fenced-div-panel-content') as HTMLElement | null;
        const identityRect = identity?.getBoundingClientRect();
        const contentRect = content?.getBoundingClientRect();

        const result = {
            itemColumns: row ? getComputedStyle(row).gridTemplateColumns : '',
            titleFits: Boolean(title && title.scrollWidth <= title.clientWidth),
            labelFits: Boolean(label && label.scrollWidth <= label.clientWidth),
            identityTop: identityRect?.top ?? 0,
            identityBottom: identityRect?.bottom ?? 0,
            contentTop: contentRect?.top ?? 0,
            contentLeft: contentRect?.left ?? 0,
            identityLeft: identityRect?.left ?? 0,
            contentWidth: contentRect?.width ?? 0
        };
        if (container) {
            container.style.removeProperty('flex');
            container.style.removeProperty('width');
        }
        return result;
    }, width);
}

async function getExpansionStates(): Promise<string[]> {
    return browser.execute(() => Array.from(
        document.querySelectorAll('.pem-panel-item-toggle'),
        toggle => toggle.getAttribute('aria-expanded') ?? ''
    ));
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
