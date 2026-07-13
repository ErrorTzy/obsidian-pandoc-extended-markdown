import { browser, expect } from '@wdio/globals';

interface FoldedDocumentState {
    lineCount: number;
    viewportStartLine: number;
    viewportEndLine: number;
    visibleRangeCount: number;
    visibleHeadingLines: number[];
}

interface SelectionTimingSummary {
    pluginState: 'enabled' | 'disabled';
    avgMs: number;
    maxMs: number;
    samplesMs: number[];
}

const WORKING_PATH = 'folded-heading-performance-working.md';
const SECTION_COUNT = 5;
const ITEMS_PER_SECTION = 140;
const SAMPLE_COUNT = 8;
const MAX_ENABLED_TO_DISABLED_RATIO = 1.5;

describe('Folded heading performance', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });
    });

    after(async () => {
        await enablePlugin();
        await deleteFileIfExists(WORKING_PATH);
    });

    it('keeps selection updates close to Obsidian baseline when large sections are folded', async function () {
        this.timeout(180000);

        await enablePlugin();
        const enabled = await measureFoldedSelectionUpdates('enabled');

        await disablePlugin();
        const disabled = await measureFoldedSelectionUpdates('disabled');
        const ratio = enabled.avgMs / disabled.avgMs;

        console.log(`FOLDED_HEADING_PERFORMANCE ${JSON.stringify({ enabled, disabled, ratio })}`);

        expect(enabled.samplesMs).toHaveLength(SAMPLE_COUNT);
        expect(disabled.samplesMs).toHaveLength(SAMPLE_COUNT);
        expect(ratio).toBeLessThan(MAX_ENABLED_TO_DISABLED_RATIO);
    });
});

async function measureFoldedSelectionUpdates(
    pluginState: 'enabled' | 'disabled'
): Promise<SelectionTimingSummary> {
    await createOrReplaceFile(WORKING_PATH, createFoldedHeadingFixture());
    await openFileInActiveLeaf(WORKING_PATH);
    await ensureLivePreviewMode();
    await waitForEditor();
    const state = await foldAllSections();

    expect(state.lineCount).toBeGreaterThan(700);
    expect(state.visibleHeadingLines).toHaveLength(SECTION_COUNT);
    expect(state.visibleRangeCount).toBeGreaterThanOrEqual(SECTION_COUNT);
    expect(state.viewportStartLine).toBe(1);
    expect(state.viewportEndLine).toBeGreaterThanOrEqual(state.lineCount - 1);

    const samplesMs = await browser.execute(async (headingLines: number[], sampleCount: number) => {
        // @ts-ignore
        const cm = app.workspace.getLeaf()?.view?.editor?.cm;
        if (!cm) {
            throw new Error('CodeMirror editor was not available');
        }

        const waitForFrame = async (): Promise<void> => {
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        };
        const samples: number[] = [];

        for (let index = 0; index < sampleCount; index++) {
            const lineNumber = headingLines[(index + 1) % headingLines.length];
            const started = performance.now();
            cm.dispatch({ selection: { anchor: cm.state.doc.line(lineNumber).from } });
            await waitForFrame();
            samples.push(performance.now() - started);
        }

        return samples;
    }, state.visibleHeadingLines, SAMPLE_COUNT);

    return {
        pluginState,
        avgMs: average(samplesMs),
        maxMs: Math.max(...samplesMs),
        samplesMs
    };
}

async function foldAllSections(): Promise<FoldedDocumentState> {
    return browser.execute(async () => {
        // @ts-ignore
        const cm = app.workspace.getLeaf()?.view?.editor?.cm;
        if (!cm) {
            throw new Error('CodeMirror editor was not available');
        }

        // @ts-ignore
        app.commands.executeCommandById('editor:unfold-all');

        const headingLines: number[] = [];
        for (let lineNumber = 1; lineNumber <= cm.state.doc.lines; lineNumber++) {
            if (cm.state.doc.line(lineNumber).text.startsWith('# ')) {
                headingLines.push(lineNumber);
            }
        }

        for (const lineNumber of headingLines) {
            cm.dispatch({ selection: { anchor: cm.state.doc.line(lineNumber).from } });
            // @ts-ignore
            const commandExecuted = app.commands.executeCommandById('editor:toggle-fold');
            if (!commandExecuted) {
                throw new Error('Obsidian toggle-fold command was not available');
            }
        }

        cm.dispatch({
            selection: { anchor: cm.state.doc.line(headingLines[0]).from },
            effects: [cm.constructor.scrollIntoView(cm.state.doc.line(headingLines[0]).from, { y: 'start' })]
        });
        await new Promise<void>(resolve => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });

        const visibleHeadingLines = headingLines.filter(lineNumber => {
            const line = cm.state.doc.line(lineNumber);
            return cm.visibleRanges.some((range: { from: number; to: number }) =>
                range.from <= line.from && range.to >= line.to
            );
        });

        return {
            lineCount: cm.state.doc.lines,
            viewportStartLine: cm.state.doc.lineAt(cm.viewport.from).number,
            viewportEndLine: cm.state.doc.lineAt(Math.max(cm.viewport.from, cm.viewport.to - 1)).number,
            visibleRangeCount: cm.visibleRanges.length,
            visibleHeadingLines
        };
    });
}

function createFoldedHeadingFixture(): string {
    const lines: string[] = [];
    for (let section = 1; section <= SECTION_COUNT; section++) {
        lines.push(`# Section ${section}`);
        for (let item = 1; item <= ITEMS_PER_SECTION; item++) {
            lines.push(`- Item ${section}.${item} with ^superscript^, ~subscript~, and -- smart dash`);
        }
        lines.push('');
    }
    return lines.join('\n');
}

function average(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function enablePlugin(): Promise<void> {
    await browser.execute(async () => {
        // @ts-ignore
        if (!app.plugins.plugins['pandoc-extended-markdown']) {
            // @ts-ignore
            await app.plugins.enablePlugin('pandoc-extended-markdown');
            // @ts-ignore
            app.workspace.updateOptions();
        }
    });
    await browser.pause(500);
}

async function disablePlugin(): Promise<void> {
    await browser.execute(async () => {
        // @ts-ignore
        if (app.plugins.plugins['pandoc-extended-markdown']) {
            // @ts-ignore
            await app.plugins.disablePlugin('pandoc-extended-markdown');
            // @ts-ignore
            app.workspace.updateOptions();
        }
    });
    await browser.pause(500);
}

async function createOrReplaceFile(path: string, content: string): Promise<void> {
    await browser.execute(async (filePath: string, fileContent: string) => {
        // @ts-ignore
        const existing = app.vault.getAbstractFileByPath(filePath);
        if (existing) {
            // @ts-ignore
            await app.vault.modify(existing, fileContent);
        } else {
            // @ts-ignore
            await app.vault.create(filePath, fileContent);
        }
    }, path, content);
}

async function openFileInActiveLeaf(path: string): Promise<void> {
    await browser.execute(async (filePath: string) => {
        // @ts-ignore
        const file = app.vault.getAbstractFileByPath(filePath);
        if (!file) {
            throw new Error(`Missing file: ${filePath}`);
        }
        // @ts-ignore
        await app.workspace.getLeaf().openFile(file);
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

async function waitForEditor(): Promise<void> {
    const contentEl = await browser.$('.markdown-source-view.mod-cm6 .cm-content');
    await contentEl.waitForExist({ timeout: 5000 });
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
