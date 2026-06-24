import { browser, expect } from '@wdio/globals';

interface EditTiming {
    lineNumber: number;
    selectMs: number;
    insertMs: number;
    deleteMs: number;
    longTaskMs: number;
    totalMs: number;
}

interface EditTimingSummary {
    pluginState: 'enabled' | 'disabled';
    editCount: number;
    lineCount: number;
    totalAvgMs: number;
    totalMaxMs: number;
    totalP95Ms: number;
    longTaskTotalMs: number;
    longTaskMaxMs: number;
    timings: EditTiming[];
}

interface ClickTargetLine {
    lineNumber: number;
    x: number;
    y: number;
}

const FIXTURE_PATH = 'long-document-performance.md';
const WORKING_PATH = 'long-document-performance-working.md';
const EDIT_COUNT = 2;
const INTER_KEY_PAUSE_MS = 50;
const MAX_ENABLED_TO_DISABLED_RATIO = 1.5;

describe('Long document editing performance', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });

        await configurePluginForPerformanceBaseline();
    });

    after(async () => {
        await configurePluginForPerformanceBaseline();
        await deleteFileIfExists(WORKING_PATH);
    });

    it('keeps middle-document list editing close to Obsidian baseline', async function () {
        this.timeout(180000);

        await configurePluginForPerformanceBaseline();
        const enabledSummary = await measureListEditingWorkflow('enabled');

        await disablePlugin();
        const disabledSummary = await measureListEditingWorkflow('disabled');

        const ratio = enabledSummary.totalAvgMs / disabledSummary.totalAvgMs;

        console.log(`LONG_DOCUMENT_EDIT_COMPARISON ${JSON.stringify({
            enabled: enabledSummary,
            disabled: disabledSummary,
            ratio
        })}`);

        expect(enabledSummary.lineCount).toBeGreaterThan(1000);
        expect(enabledSummary.editCount).toBe(EDIT_COUNT);
        expect(disabledSummary.editCount).toBe(EDIT_COUNT);
        expect(ratio).toBeLessThan(MAX_ENABLED_TO_DISABLED_RATIO);
    });
});

async function measureListEditingWorkflow(
    pluginState: 'enabled' | 'disabled'
): Promise<EditTimingSummary> {
    await resetWorkingCopy();
    await openFileInActiveLeaf(WORKING_PATH);
    await ensureLivePreviewMode();
    await waitForEditor();

    const lineCount = await getEditorLineCount();
    const middleLine = Math.floor(lineCount / 2);
    const timings: EditTiming[] = [];

    for (let index = 0; index < EDIT_COUNT; index++) {
        const currentLineCount = await getEditorLineCount();
        const lineNumber = Math.min(currentLineCount - 20, middleLine + index * 3);
        const replacement = createReplacementLine(index);

        await startLongTaskObserver();
        const operationStart = Date.now();

        const targetLine = await clickLineWithMouse(lineNumber);
        await sendMeasuredKey(['Home']);
        await sendMeasuredKey(['Shift', 'End', 'NULL']);
        const selectionSettled = Date.now();
        const selectMs = selectionSettled - operationStart;

        const insertMs = await typeTextAsIndividualKeystrokes(replacement);

        const deleteMs = await deleteCharactersWithBackspace(replacement.length);
        const longTasks = await stopLongTaskObserver();

        timings.push({
            lineNumber: targetLine.lineNumber,
            selectMs,
            insertMs,
            deleteMs,
            longTaskMs: longTasks.totalMs,
            totalMs: selectMs + insertMs + deleteMs
        });
    }

    return summarizeTimings(pluginState, lineCount, timings);
}

function summarizeTimings(
    pluginState: 'enabled' | 'disabled',
    lineCount: number,
    timings: EditTiming[]
): EditTimingSummary {
    const totalTimes = timings.map(timing => timing.totalMs);
    const longTaskTimes = timings.map(timing => timing.longTaskMs);

    return {
        pluginState,
        editCount: timings.length,
        lineCount,
        totalAvgMs: average(totalTimes),
        totalMaxMs: Math.max(...totalTimes),
        totalP95Ms: percentile(totalTimes, 0.95),
        longTaskTotalMs: longTaskTimes.reduce((sum, value) => sum + value, 0),
        longTaskMaxMs: Math.max(...longTaskTimes),
        timings
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

function createReplacementLine(index: number): string {
    const replacements = [
        `#. Perf hash ${index} ^sup^ ~sub~`,
        `A. Perf fancy ${index} [ref](target)`,
        `(@perf-${index}) Perf example ^x^ ~y~`
    ];

    return replacements[index % replacements.length];
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

async function resetWorkingCopy(): Promise<void> {
    await browser.execute(async (fixturePath: string, workingPath: string) => {
        // @ts-ignore
        const fixture = app.vault.getAbstractFileByPath(fixturePath);
        if (!fixture) {
            throw new Error(`Missing fixture: ${fixturePath}`);
        }

        // @ts-ignore
        const content = await app.vault.read(fixture);
        // @ts-ignore
        const existing = app.vault.getAbstractFileByPath(workingPath);
        if (existing) {
            // @ts-ignore
            await app.vault.modify(existing, content);
        } else {
            // @ts-ignore
            await app.vault.create(workingPath, content);
        }
    }, FIXTURE_PATH, WORKING_PATH);
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
    await setSourceViewState(false);
}

async function setSourceViewState(source: boolean): Promise<void> {
    await browser.execute(async (sourceMode: boolean) => {
        // @ts-ignore
        const leaf = app.workspace.getLeaf();
        const state = leaf.getViewState();
        state.state = {
            ...(state.state ?? {}),
            mode: 'source',
            source: sourceMode
        };
        await leaf.setViewState(state);
        // @ts-ignore
        app.workspace.updateOptions();
    }, source);
    await browser.pause(500);
}

async function waitForEditor(): Promise<void> {
    const contentEl = await browser.$('.markdown-source-view.mod-cm6 .cm-content');
    await contentEl.waitForExist({ timeout: 5000 });
}

async function getEditorLineCount(): Promise<number> {
    return browser.execute(() => {
        // @ts-ignore
        const cm = app.workspace.getLeaf()?.view?.editor?.cm;
        if (!cm) {
            throw new Error('CodeMirror editor was not available');
        }

        return cm.state.doc.lines;
    });
}

async function waitForEditorFrames(): Promise<void> {
    await browser.execute(async () => {
        await new Promise<void>(resolve => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
    });
}

async function clickLineWithMouse(lineNumber: number): Promise<ClickTargetLine> {
    const targetLine = await browser.execute((targetLineNumber: number) => {
        // @ts-ignore
        const cm = app.workspace.getLeaf()?.view?.editor?.cm;
        if (!cm) {
            throw new Error('CodeMirror editor was not available');
        }

        const line = cm.state.doc.line(Math.max(1, Math.min(targetLineNumber, cm.state.doc.lines)));
        cm.dispatch({
            effects: [cm.constructor.scrollIntoView(line.from, { y: 'center' })]
        });
        return { lineNumber: line.number };
    }, lineNumber);

    await waitForEditorFrames();

    const clickTarget = await browser.execute((targetLineNumber: number) => {
        // @ts-ignore
        const cm = app.workspace.getLeaf()?.view?.editor?.cm;
        if (!cm) {
            throw new Error('CodeMirror editor was not available');
        }

        const line = cm.state.doc.line(Math.max(1, Math.min(targetLineNumber, cm.state.doc.lines)));
        const coords = cm.coordsAtPos(line.from);
        if (!coords) {
            throw new Error(`Could not resolve coordinates for line ${line.number}`);
        }

        return {
            lineNumber: line.number,
            x: Math.max(4, Math.min(window.innerWidth - 4, Math.round(coords.left + 4))),
            y: Math.max(4, Math.min(window.innerHeight - 4, Math.round(coords.top + ((coords.bottom - coords.top) / 2))))
        };
    }, targetLine.lineNumber);

    await browser.action('pointer', { parameters: { pointerType: 'mouse' } })
        .move({ origin: 'viewport', x: clickTarget.x, y: clickTarget.y })
        .down('left')
        .up('left')
        .perform();
    await waitForEditorFrames();

    return clickTarget;
}

async function typeTextAsIndividualKeystrokes(text: string): Promise<number> {
    let totalMs = 0;
    for (const character of text) {
        totalMs += await sendMeasuredKey(character);
    }
    return totalMs;
}

async function deleteCharactersWithBackspace(count: number): Promise<number> {
    let totalMs = 0;
    for (let index = 0; index < count; index++) {
        totalMs += await sendMeasuredKey(['Backspace']);
    }
    return totalMs;
}

async function sendMeasuredKey(key: string | string[]): Promise<number> {
    const started = Date.now();
    await browser.keys(key);
    await waitForEditorFrames();
    const elapsed = Date.now() - started;
    await browser.pause(INTER_KEY_PAUSE_MS);
    return elapsed;
}

async function startLongTaskObserver(): Promise<void> {
    await browser.execute(() => {
        const targetWindow = window as unknown as {
            __pemLongTasks?: Array<{ duration: number }>;
            __pemLongTaskObserver?: PerformanceObserver;
        };

        targetWindow.__pemLongTasks = [];
        targetWindow.__pemLongTaskObserver?.disconnect();

        try {
            targetWindow.__pemLongTaskObserver = new PerformanceObserver(list => {
                for (const entry of list.getEntries()) {
                    targetWindow.__pemLongTasks?.push({ duration: entry.duration });
                }
            });
            targetWindow.__pemLongTaskObserver.observe({ entryTypes: ['longtask'] });
        } catch {
            targetWindow.__pemLongTaskObserver = undefined;
        }
    });
}

async function stopLongTaskObserver(): Promise<{ totalMs: number; maxMs: number; count: number }> {
    return browser.execute(() => {
        const targetWindow = window as unknown as {
            __pemLongTasks?: Array<{ duration: number }>;
            __pemLongTaskObserver?: PerformanceObserver;
        };
        targetWindow.__pemLongTaskObserver?.disconnect();
        const durations = (targetWindow.__pemLongTasks ?? []).map(entry => entry.duration);

        return {
            totalMs: durations.reduce((sum, duration) => sum + duration, 0),
            maxMs: durations.length > 0 ? Math.max(...durations) : 0,
            count: durations.length
        };
    });
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
