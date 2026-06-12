import { browser, expect } from '@wdio/globals';

import { ensureActiveFileReadingMode } from '../helpers/readingMode';

interface NonNativeSyntaxState {
    enableCustomLabelLists: boolean | null;
    enableFencedDivExtras: boolean | null;
    enableFencedDivs: boolean | null;
    customMarkers: string[];
    customRefs: string[];
    fencedBlockCount: number;
    fencedTitles: string[];
    fencedRefs: string[];
    rawText: string;
}

const filePath = 'list-spacing-non-native-syntax-toggles-e2e.md';
const readingCustomOffPath = 'list-spacing-non-native-syntax-custom-off-e2e.md';
const readingExtrasOffPath = 'list-spacing-non-native-syntax-extras-off-e2e.md';
const readingFencedOffPath = 'list-spacing-non-native-syntax-fenced-off-e2e.md';
const content = [
    '{::P(#a)} Custom premise.',
    '',
    'Therefore {::P(#a)}.',
    '',
    '::: {.theorem #thm:strict title="Theorem &"}',
    'List-spacing theorem.',
    ':::',
    '',
    'See @thm:strict.'
].join('\n');

describe('Pandoc list spacing non-native syntax toggles', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });
        await setSyntaxSettings({
            enforcePandocListSpacing: true,
            enableCustomLabelLists: true,
            enableFencedDivs: true,
            enableFencedDivExtras: true
        });
        await createOrReplaceFile(filePath, content);
    });

    after(async () => {
        await setSyntaxSettings({
            enforcePandocListSpacing: false,
            enableCustomLabelLists: true,
            enableFencedDivs: true,
            enableFencedDivExtras: true
        });
        await deleteFileIfExists(filePath);
        await deleteFileIfExists(readingCustomOffPath);
        await deleteFileIfExists(readingExtrasOffPath);
        await deleteFileIfExists(readingFencedOffPath);
    });

    it('keeps custom labels and fenced div extras rendering in Live Preview with list spacing enforcement', async () => {
        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();
        await moveCursorToLine(6);

        await waitForState('live', state =>
            state.customMarkers.includes('(P1)') &&
            state.customRefs.includes('(P1)') &&
            state.fencedTitles.includes('Theorem 1') &&
            state.fencedRefs.includes('Theorem 1')
        );

        let state = await getState('live');
        expect(state.customMarkers).toContain('(P1)');
        expect(state.customRefs).toContain('(P1)');
        expect(state.fencedBlockCount).toBe(1);
        expect(state.fencedTitles).toContain('Theorem 1');
        expect(state.fencedRefs).toContain('Theorem 1');

        await setSyntaxSettings({ enableCustomLabelLists: false });
        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();
        await moveCursorToLine(6);
        await waitForState('live', next =>
            next.customMarkers.length === 0 &&
            next.customRefs.length === 0 &&
            next.rawText.includes('{::P(#a)}')
        );

        state = await getState('live');
        expect(state.customMarkers).toEqual([]);
        expect(state.customRefs).toEqual([]);
        expect(state.rawText).toContain('{::P(#a)}');

        await setSyntaxSettings({
            enableCustomLabelLists: true,
            enableFencedDivExtras: false
        });
        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();
        await moveCursorToLine(6);
        await waitForState('live', next =>
            next.fencedBlockCount === 1 &&
            next.fencedTitles.length === 0 &&
            next.fencedRefs.length === 0 &&
            next.rawText.includes('@thm:strict')
        );

        state = await getState('live');
        expect(state.fencedBlockCount).toBe(1);
        expect(state.fencedTitles).toEqual([]);
        expect(state.fencedRefs).toEqual([]);
        expect(state.rawText).toContain('@thm:strict');

        await setSyntaxSettings({ enableFencedDivs: false });
        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();
        await moveCursorToLine(6);
        await waitForState('live', next =>
            next.fencedBlockCount === 0 &&
            next.fencedRefs.length === 0 &&
            next.rawText.includes('::: {.theorem #thm:strict title="Theorem &"}')
        );

        state = await getState('live');
        expect(state.fencedBlockCount).toBe(0);
        expect(state.rawText).toContain('::: {.theorem #thm:strict title="Theorem &"}');
    });

    it('keeps custom labels and fenced div extras rendering in Reading mode with list spacing enforcement', async () => {
        await setSyntaxSettings({
            enforcePandocListSpacing: true,
            enableCustomLabelLists: true,
            enableFencedDivs: true,
            enableFencedDivExtras: true
        });
        await createOrReplaceFile(filePath, content);
        await openFileInActiveLeaf(filePath);
        await ensureReadingMode();

        await waitForState('reading', state =>
            state.customMarkers.includes('(P1)') &&
            state.customRefs.includes('(P1)') &&
            state.fencedTitles.includes('Theorem 1') &&
            state.fencedRefs.includes('Theorem 1')
        );

        let state = await getState('reading');
        expect(state.customMarkers).toContain('(P1)');
        expect(state.customRefs).toContain('(P1)');
        expect(state.fencedBlockCount).toBe(1);
        expect(state.fencedTitles).toEqual(['Theorem 1']);
        expect(state.fencedRefs).toEqual(['Theorem 1']);

        await setSyntaxSettings({ enableCustomLabelLists: false });
        await createOrReplaceFile(readingCustomOffPath, content);
        await openFileInActiveLeaf(readingCustomOffPath);
        await ensureReadingMode();
        await waitForState('reading', next =>
            next.customMarkers.length === 0 &&
            next.customRefs.length === 0 &&
            next.rawText.includes('{::P(#a)}')
        );

        state = await getState('reading');
        expect(state.customMarkers).toEqual([]);
        expect(state.customRefs).toEqual([]);
        expect(state.rawText).toContain('{::P(#a)}');

        await setSyntaxSettings({
            enableCustomLabelLists: true,
            enableFencedDivExtras: false
        });
        await createOrReplaceFile(readingExtrasOffPath, content);
        await openFileInActiveLeaf(readingExtrasOffPath);
        await ensureReadingMode();
        await waitForState('reading', next =>
            next.fencedBlockCount === 1 &&
            next.fencedTitles.length === 0 &&
            next.fencedRefs.length === 0 &&
            next.rawText.includes('@thm:strict')
        );

        state = await getState('reading');
        expect(state.fencedBlockCount).toBe(1);
        expect(state.fencedTitles).toEqual([]);
        expect(state.fencedRefs).toEqual([]);
        expect(state.rawText).toContain('@thm:strict');

        await setSyntaxSettings({ enableFencedDivs: false });
        await createOrReplaceFile(readingFencedOffPath, content);
        await openFileInActiveLeaf(readingFencedOffPath);
        await ensureReadingMode();
        await waitForState('reading', next =>
            next.fencedBlockCount === 0 &&
            next.fencedRefs.length === 0 &&
            next.rawText.includes('::: {.theorem #thm:strict title="Theorem &"}')
        );

        state = await getState('reading');
        expect(state.fencedBlockCount).toBe(0);
        expect(state.rawText).toContain('::: {.theorem #thm:strict title="Theorem &"}');
    });
});

async function waitForState(
    mode: 'live' | 'reading',
    predicate: (state: NonNativeSyntaxState) => boolean
): Promise<void> {
    try {
        await browser.waitUntil(async () => predicate(await getState(mode)), {
            timeout: 5000,
            timeoutMsg: `Expected ${mode} state to match non-native syntax assertion`
        });
    } catch (error) {
        const state = await getState(mode);
        throw new Error(`${(error as Error).message}\nState: ${JSON.stringify(state, null, 2)}`);
    }
}

async function getState(mode: 'live' | 'reading'): Promise<NonNativeSyntaxState> {
    return browser.execute((renderMode: 'live' | 'reading'): NonNativeSyntaxState => {
        // @ts-ignore
        const plugin = app.plugins.plugins['pandoc-extended-markdown'];
        const root = renderMode === 'live'
            ? document.querySelector('.markdown-source-view')
            : document.querySelector('.markdown-preview-view');
        const fencedSelector = renderMode === 'live'
            ? '.cm-line.cm-pem-fenced-div-open'
            : '.pem-fenced-div';

        return {
            enableCustomLabelLists: plugin?.settings?.enableCustomLabelLists ?? null,
            enableFencedDivExtras: plugin?.settings?.enableFencedDivExtras ?? null,
            enableFencedDivs: plugin?.settings?.enableFencedDivs ?? null,
            customMarkers: Array.from(root?.querySelectorAll('.pem-list-marker') ?? [])
                .map(element => (element.textContent ?? '').trim()),
            customRefs: Array.from(root?.querySelectorAll('.pem-custom-label-reference-processed, [data-custom-label-ref]') ?? [])
                .map(element => (element.textContent ?? '').trim()),
            fencedBlockCount: root?.querySelectorAll(fencedSelector).length ?? 0,
            fencedTitles: Array.from(root?.querySelectorAll('.pem-fenced-div-title') ?? [])
                .map(element => element.textContent ?? ''),
            fencedRefs: Array.from(root?.querySelectorAll('.pem-fenced-div-reference') ?? [])
                .map(element => element.textContent ?? ''),
            rawText: root?.textContent ?? ''
        };
    }, mode);
}

async function setSyntaxSettings(settings: Partial<{
    enforcePandocListSpacing: boolean;
    enableCustomLabelLists: boolean;
    enableFencedDivs: boolean;
    enableFencedDivExtras: boolean;
}>): Promise<void> {
    await browser.execute(async (nextSettings) => {
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

async function createOrReplaceFile(path: string, data: string): Promise<void> {
    await browser.execute(async (filePath: string, content: string) => {
        // @ts-ignore
        const existing = app.vault.getAbstractFileByPath(filePath);
        if (existing) {
            // @ts-ignore
            await app.vault.modify(existing, content);
            return;
        }
        // @ts-ignore
        await app.vault.create(filePath, content);
    }, path, data);
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
        const state = leaf.getViewState();
        state.state = {
            ...(state.state ?? {}),
            mode: 'source',
            source: false
        };
        await leaf.setViewState(state);
        // @ts-ignore
        app.workspace.updateOptions();
    });
    await browser.pause(500);
}

async function ensureReadingMode(): Promise<void> {
    await ensureActiveFileReadingMode();
    await browser.pause(500);
}

async function moveCursorToLine(lineNumber: number): Promise<void> {
    await browser.execute((targetLineNumber: number) => {
        // @ts-ignore
        const leaf = app.workspace.getLeaf();
        const cm = leaf?.view?.editor?.cm;
        if (!cm) return;
        const line = cm.state.doc.line(targetLineNumber);
        cm.dispatch({ selection: { anchor: line.from } });
        cm.focus();
    }, lineNumber);
    await browser.pause(250);
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
