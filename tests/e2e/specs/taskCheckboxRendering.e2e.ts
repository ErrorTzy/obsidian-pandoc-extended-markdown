import { browser, expect } from '@wdio/globals';

import {
    SyntaxParityFixture,
    createOrReplaceFile,
    deleteFileIfExists,
    ensureReadingMode,
    getSyntaxParity,
    openFileInActiveLeaf,
    waitForSyntax
} from '../helpers/pandocSyntaxParity';

const FILE_PATH = 'extended-task-checkbox-rendering.md';
const MARKDOWN = [
    'A.  [ ] alpha',
    'B.  plain',
    'C.  [x] gamma',
    '',
    '#. [x] hash',
    '',
    '(@ex) [ ] example'
].join('\n');

describe('Extended task checkbox rendering', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });
        await configureSyntaxSettings();
    });

    afterEach(async () => {
        await deleteFileIfExists(FILE_PATH);
    });

    it('renders interactive native-style checkboxes in Live Preview', async () => {
        await createOrReplaceFile(FILE_PATH, MARKDOWN);
        await openFileInActiveLeaf(FILE_PATH);
        await ensureLivePreview();
        await waitForLivePreviewCheckboxes(4);

        const initialState = await getLivePreviewTaskState();
        expect(initialState.checked).toEqual([false, true, true, false]);
        expect(initialState.taskCharacters).toEqual([' ', 'x', 'x', ' ']);
        expect(initialState.rawCheckboxTextCount).toBe(0);

        await clickLivePreviewCheckbox(0);
        await waitForFileText('A.  [x] alpha');

        await clickLivePreviewCheckbox(2);
        await waitForFileText('#. [ ] hash');

        const source = await readFileText();
        expect(source).toContain('A.  [x] alpha');
        expect(source).toContain('C.  [x] gamma');
        expect(source).toContain('#. [ ] hash');
        expect(source).toContain('(@ex) [ ] example');
    });

    it('expands the checkbox source when keyboard navigation reaches it', async () => {
        await createOrReplaceFile(FILE_PATH, MARKDOWN);
        await openFileInActiveLeaf(FILE_PATH);
        await ensureLivePreview();
        await waitForLivePreviewCheckboxes(4);
        await placeCursorBeforeFirstItemContent();

        await browser.keys(['ArrowLeft']);
        await waitForLivePreviewCheckboxes(3);

        const expandedState = await getLivePreviewTaskState();
        expect(expandedState.rawCheckboxTextCount).toBe(1);

        await browser.keys(['ArrowRight']);
        await waitForLivePreviewCheckboxes(4);
    });

    it('matches Pandoc task-list DOM and toggles source in Reading Mode', async () => {
        await createOrReplaceFile(FILE_PATH, MARKDOWN);
        await openFileInActiveLeaf(FILE_PATH);
        await ensureReadingMode();
        await waitForSyntax('.task-list-item-checkbox');

        const fixture: SyntaxParityFixture = {
            name: 'extended-task-lists',
            markdown: MARKDOWN,
            waitForSelector: '.task-list-item-checkbox',
            expectedSelector: 'ol',
            actualKind: 'ordered-list'
        };
        const parity = await getSyntaxParity(fixture);
        expect(parity.actual).toEqual(parity.expected);

        const readingState = await getReadingModeTaskState();
        expect(readingState.checked).toEqual([false, true, true, false]);
        expect(readingState.dataLines).toEqual(['0', '2', '0', '0']);
        expect(readingState.taskItemCount).toBe(4);

        await clickReadingModeCheckbox(0);
        await waitForFileText('A.  [x] alpha');

        await clickReadingModeCheckbox(2);
        await waitForFileText('#. [ ] hash');

        await clickReadingModeCheckbox(3);
        await waitForFileText('(@ex) [x] example');

        const source = await readFileText();
        expect(source).toContain('A.  [x] alpha');
        expect(source).toContain('B.  plain');
        expect(source).toContain('#. [ ] hash');
        expect(source).toContain('(@ex) [x] example');
    });
});

async function configureSyntaxSettings(): Promise<void> {
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
            plugin.settings.enableFancyLists = true;
            plugin.settings.enableHashAutoNumber = true;
            plugin.settings.enableExampleLists = true;
            await plugin.saveSettings();
            // @ts-ignore
            app.workspace.updateOptions();
        }
    });
}

async function ensureLivePreview(): Promise<void> {
    await browser.execute(async () => {
        // @ts-ignore
        const activeFile = app.workspace.getActiveFile();
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType('markdown');
        const leaf = leaves.find((candidate: { view?: { file?: { path?: string } } }) =>
            candidate.view?.file?.path === activeFile?.path
        ) ?? leaves[0];
        if (!leaf || !activeFile) {
            return;
        }

        await leaf.setViewState({
            type: 'markdown',
            state: {
                file: activeFile.path,
                mode: 'source',
                source: false
            }
        });
        // @ts-ignore
        app.workspace.setActiveLeaf(leaf, { focus: true });
        // @ts-ignore
        app.workspace.updateOptions();
    });

    const content = await browser.$('.markdown-source-view.mod-cm6 .cm-content');
    await content.waitForExist({ timeout: 5000 });
    await browser.execute(() => {
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType('markdown');
        const cm = leaves[0]?.view?.editor?.cm;
        if (!cm) {
            return;
        }
        cm.dispatch({ selection: { anchor: cm.state.doc.length } });
        cm.focus();
    });
}

async function waitForLivePreviewCheckboxes(count: number): Promise<void> {
    await browser.waitUntil(async () => browser.execute((expectedCount: number) =>
        document.querySelectorAll(
            '.markdown-source-view.mod-cm6 .task-list-item-checkbox'
        ).length === expectedCount,
    count), {
        timeout: 5000,
        timeoutMsg: `Expected ${count} extended task checkboxes in Live Preview`
    });
}

async function placeCursorBeforeFirstItemContent(): Promise<void> {
    await browser.execute(() => {
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType('markdown');
        const cm = leaves[0]?.view?.editor?.cm;
        if (!cm) {
            return;
        }

        const line = cm.state.doc.line(1);
        const contentOffset = line.text.indexOf('alpha');
        cm.dispatch({
            selection: { anchor: line.from + contentOffset }
        });
        cm.focus();
    });
}

async function getLivePreviewTaskState(): Promise<{
    checked: boolean[];
    taskCharacters: string[];
    rawCheckboxTextCount: number;
}> {
    return browser.execute(() => {
        const root = document.querySelector('.markdown-source-view.mod-cm6');
        const checkboxes = Array.from(
            root?.querySelectorAll<HTMLInputElement>('.task-list-item-checkbox') ?? []
        );
        const taskLines = Array.from(
            root?.querySelectorAll<HTMLElement>('.HyperMD-task-line[data-task]') ?? []
        );

        return {
            checked: checkboxes.map(checkbox => checkbox.checked),
            taskCharacters: taskLines.map(line => line.dataset.task ?? ''),
            rawCheckboxTextCount: Array.from(root?.querySelectorAll('.cm-line') ?? [])
                .filter(line => /\[[ xX]\]/.test(line.textContent ?? ''))
                .length
        };
    });
}

async function clickLivePreviewCheckbox(index: number): Promise<void> {
    await browser.execute((checkboxIndex: number) => {
        const checkboxes = document.querySelectorAll<HTMLInputElement>(
            '.markdown-source-view.mod-cm6 .task-list-item-checkbox'
        );
        checkboxes[checkboxIndex]?.click();
    }, index);
}

async function getReadingModeTaskState(): Promise<{
    checked: boolean[];
    dataLines: string[];
    taskItemCount: number;
}> {
    return browser.execute(() => {
        const preview = document.querySelector('.markdown-preview-view');
        const checkboxes = Array.from(
            preview?.querySelectorAll<HTMLInputElement>('.task-list-item-checkbox') ?? []
        );

        return {
            checked: checkboxes.map(checkbox => checkbox.checked),
            dataLines: checkboxes.map(checkbox => checkbox.dataset.line ?? ''),
            taskItemCount: preview?.querySelectorAll('li.task-list-item').length ?? 0
        };
    });
}

async function clickReadingModeCheckbox(index: number): Promise<void> {
    await browser.execute((checkboxIndex: number) => {
        const checkboxes = document.querySelectorAll<HTMLInputElement>(
            '.markdown-preview-view .task-list-item-checkbox'
        );
        checkboxes[checkboxIndex]?.click();
    }, index);
}

async function waitForFileText(expected: string): Promise<void> {
    await browser.waitUntil(async () => (await readFileText()).includes(expected), {
        timeout: 5000,
        timeoutMsg: `Expected file content to include: ${expected}`
    });
}

async function readFileText(): Promise<string> {
    return browser.execute(async (filePath: string) => {
        // @ts-ignore
        const file = app.vault.getAbstractFileByPath(filePath);
        // @ts-ignore
        return file ? await app.vault.cachedRead(file) : '';
    }, FILE_PATH);
}
