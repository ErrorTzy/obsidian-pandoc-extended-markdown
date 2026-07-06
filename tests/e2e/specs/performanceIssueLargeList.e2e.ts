import { existsSync, readFileSync } from 'fs';
import { browser, expect } from '@wdio/globals';

interface SampleSummary {
    pluginState: 'enabled' | 'disabled';
    sampleCount: number;
    avgMs: number;
    maxMs: number;
    p95Ms: number;
    samplesMs: number[];
}

interface PerformanceComparison {
    enabled: SampleSummary;
    disabled: SampleSummary;
    ratio: number;
}

const SOURCE_PATH = '/home/scott/Documents/OBtest/test/Performance Issue.md';
const WORKING_PATH = 'performance-issue-large-list-working.md';
const SAMPLE_COUNT = 5;
const MAX_ENABLED_TO_DISABLED_RATIO = 1.5;

describe('Performance issue large-list baseline', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });
        await configurePluginForPerformanceBaseline();
        await createOrReplaceFile(WORKING_PATH, getPerformanceIssueContent());
    });

    after(async () => {
        await configurePluginForPerformanceBaseline();
        await deleteFileIfExists(WORKING_PATH);
    });

    it('keeps large-list editing and scrolling close to Obsidian baseline', async function () {
        this.timeout(180000);

        await configurePluginForPerformanceBaseline();
        const enabledEdit = await measureEditingSamples('enabled');
        const enabledScroll = await measureScrollSamples('enabled');

        await disablePlugin();
        const disabledEdit = await measureEditingSamples('disabled');
        const disabledScroll = await measureScrollSamples('disabled');

        const editComparison = compareSummaries(enabledEdit, disabledEdit);
        const scrollComparison = compareSummaries(enabledScroll, disabledScroll);

        console.log(`PERFORMANCE_ISSUE_LARGE_LIST ${JSON.stringify({
            edit: editComparison,
            scroll: scrollComparison
        })}`);

        expect(enabledEdit.sampleCount).toBe(SAMPLE_COUNT);
        expect(enabledScroll.sampleCount).toBe(SAMPLE_COUNT);
        expect(disabledEdit.sampleCount).toBe(SAMPLE_COUNT);
        expect(disabledScroll.sampleCount).toBe(SAMPLE_COUNT);
        expect(editComparison.ratio).toBeLessThan(MAX_ENABLED_TO_DISABLED_RATIO);
        expect(scrollComparison.ratio).toBeLessThan(MAX_ENABLED_TO_DISABLED_RATIO);
    });
});

async function measureEditingSamples(pluginState: 'enabled' | 'disabled'): Promise<SampleSummary> {
    await openWorkingFile();
    const targetLine = await findLineContaining('The body of the jersey shall contain only');
    const samples: number[] = [];

    for (let index = 0; index < SAMPLE_COUNT; index++) {
        samples.push(await measureSingleCharacterEdit(targetLine));
    }

    return summarizeSamples(pluginState, samples);
}

async function measureScrollSamples(pluginState: 'enabled' | 'disabled'): Promise<SampleSummary> {
    await openWorkingFile();
    const upperLine = await findLineContaining('Helmet and Face Mask');
    const lowerLine = await findLineContaining('Nonremovable cleats are limited');
    const samples: number[] = [];

    for (let index = 0; index < SAMPLE_COUNT; index++) {
        const targetLine = index % 2 === 0 ? lowerLine : upperLine;
        samples.push(await measureScrollToLine(targetLine));
    }

    return summarizeSamples(pluginState, samples);
}

async function measureSingleCharacterEdit(lineNumber: number): Promise<number> {
    return browser.execute(async (targetLine: number) => {
        const waitForEditorFrames = async (): Promise<void> => {
            await new Promise<void>(resolve => {
                requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
            });
        };

        // @ts-ignore
        const cm = app.workspace.getLeaf()?.view?.editor?.cm;
        if (!cm) {
            throw new Error('CodeMirror editor was not available');
        }

        const line = cm.state.doc.line(targetLine);
        const insertPosition = line.to;
        const started = performance.now();

        cm.dispatch({
            changes: { from: insertPosition, to: insertPosition, insert: 'x' },
            selection: { anchor: insertPosition + 1 }
        });
        await waitForEditorFrames();

        cm.dispatch({
            changes: { from: insertPosition, to: insertPosition + 1, insert: '' },
            selection: { anchor: insertPosition }
        });
        await waitForEditorFrames();

        // The live-preview plugin schedules its doc-change rebuild after 100ms.
        // Waiting on the UI thread here captures that delayed rebuild cost.
        await new Promise(resolve => window.setTimeout(resolve, 130));
        await waitForEditorFrames();

        return performance.now() - started;
    }, lineNumber);
}

async function measureScrollToLine(lineNumber: number): Promise<number> {
    return browser.execute(async (targetLine: number) => {
        const waitForEditorFrames = async (): Promise<void> => {
            await new Promise<void>(resolve => {
                requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
            });
        };

        // @ts-ignore
        const cm = app.workspace.getLeaf()?.view?.editor?.cm;
        if (!cm) {
            throw new Error('CodeMirror editor was not available');
        }

        const line = cm.state.doc.line(targetLine);
        const started = performance.now();
        cm.dispatch({
            effects: [cm.constructor.scrollIntoView(line.from, { y: 'center' })]
        });
        await waitForEditorFrames();

        return performance.now() - started;
    }, lineNumber);
}

async function openWorkingFile(): Promise<void> {
    await openFileInActiveLeaf(WORKING_PATH);
    await ensureLivePreviewMode();
    await waitForEditor();
}

async function findLineContaining(text: string): Promise<number> {
    return browser.execute((needle: string) => {
        // @ts-ignore
        const cm = app.workspace.getLeaf()?.view?.editor?.cm;
        if (!cm) {
            throw new Error('CodeMirror editor was not available');
        }

        for (let lineNumber = 1; lineNumber <= cm.state.doc.lines; lineNumber++) {
            if (cm.state.doc.line(lineNumber).text.includes(needle)) {
                return lineNumber;
            }
        }

        throw new Error(`Could not find line containing: ${needle}`);
    }, text);
}

function compareSummaries(enabled: SampleSummary, disabled: SampleSummary): PerformanceComparison {
    return {
        enabled,
        disabled,
        ratio: enabled.avgMs / disabled.avgMs
    };
}

function summarizeSamples(
    pluginState: 'enabled' | 'disabled',
    samplesMs: number[]
): SampleSummary {
    return {
        pluginState,
        sampleCount: samplesMs.length,
        avgMs: average(samplesMs),
        maxMs: Math.max(...samplesMs),
        p95Ms: percentile(samplesMs, 0.95),
        samplesMs
    };
}

function average(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: number[], percentileValue: number): number {
    const sorted = [...values].sort((left, right) => left - right);
    const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue) - 1);
    return sorted[index];
}

async function configurePluginForPerformanceBaseline(): Promise<void> {
    await browser.execute(async () => {
        // @ts-ignore
        let plugin = app.plugins.plugins['pandoc-extended-markdown'];
        if (!plugin) {
            // @ts-ignore
            await app.plugins.enablePlugin('pandoc-extended-markdown');
            // @ts-ignore
            plugin = app.plugins.plugins['pandoc-extended-markdown'];
        }

        if (plugin?.settings) {
            plugin.settings.enforcePandocListSpacing = false;
            plugin.settings.enableCustomLabelLists = true;
            plugin.settings.enableFancyLists = true;
            plugin.settings.enableHashAutoNumber = true;
            plugin.settings.enableExampleLists = true;
            plugin.settings.enableDefinitionLists = true;
            plugin.settings.enableFencedDivs = true;
            plugin.settings.enableFencedDivExtras = true;
            plugin.settings.enableSuperscript = true;
            plugin.settings.enableSubscript = true;
            plugin.settings.enableUnorderedListMarkerStyles = true;
            await plugin.saveSettings();
            // @ts-ignore
            app.workspace.updateOptions();
        }
    });
    await browser.pause(300);
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

async function createOrReplaceFile(path: string, data: string): Promise<void> {
    await browser.execute(async (filePath: string, fileContent: string) => {
        // @ts-ignore
        const existing = app.vault.getAbstractFileByPath(filePath);
        if (existing) {
            // @ts-ignore
            await app.vault.modify(existing, fileContent);
            return;
        }

        // @ts-ignore
        await app.vault.create(filePath, fileContent);
    }, path, data);
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

function getPerformanceIssueContent(): string {
    if (existsSync(SOURCE_PATH)) {
        return readFileSync(SOURCE_PATH, 'utf8');
    }

    return createFallbackLargeListContent();
}

function createFallbackLargeListContent(): string {
    const lines = [
        '# Player Equipment',
        '## Article 1',
        'a. Helmet and Face Mask'
    ];

    for (let index = 1; index <= 120; index++) {
        lines.push(`    ${index}. The body of the jersey shall contain only generated filler ${index}.`);
        lines.push(`        a. Generated child item ${index}.`);
        lines.push(`        b. Generated child item ${index}.`);
        lines.push(`            i. Generated roman child item ${index}.`);
    }

    lines.push('    999. Nonremovable cleats are limited to generated filler.');
    return lines.join('\n');
}
