import { browser, expect } from '@wdio/globals';

import {
    createOrReplaceFile,
    deleteFileIfExists,
    ensureReadingMode,
    openFileInActiveLeaf
} from '../helpers/pandocSyntaxParity';

interface ReadableFencedDivState {
    blockCount: number;
    headerTexts: string[];
    blockLabels: string[];
    blockClasses: string[];
    blockTexts: string[];
    referenceTexts: string[];
    referenceLabels: string[];
    rawText: string;
    atTextNodes: string[];
}

const shorthandContent = [
    '::: class1 class2 class3',
    'Multiple classes',
    ':::',
    '',
    '::: class #id1',
    'class and id',
    ':::',
    '',
    'Reference to @id1',
    '',
    '::: class data=1 #id2',
    'class, data and id',
    ':::',
    '',
    'Reference to @id2',
    '',
    '::: #id3 class data=1 ',
    'id, class and data',
    ':::',
    '',
    'Reference to @id3',
    '',
    '::: dataA=1 dataB=1',
    'multiple data, no class',
    ':::'
].join('\n');

describe('Readable fenced div shorthand rendering', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });
        await enableReadableFencedDivs();
    });

    it('renders shorthand cases and references in Live Preview', async () => {
        const filePath = 'readable-fenced-div-shorthand-live.md';

        await createOrReplaceFile(filePath, shorthandContent);
        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();
        await moveCursorToLine(9);

        await browser.waitUntil(async () => {
            const state = await getLivePreviewState();
            return state.blockCount === 5 &&
                state.referenceLabels.join('|') === 'id1|id2|id3';
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected readable shorthand fenced divs in Live Preview'
        });

        const state = await getLivePreviewState();

        expect(state.blockCount).toBe(5);
        expect(state.headerTexts).toEqual(['Class1', 'Class', 'Class', 'Class', 'Div']);
        expect(state.blockLabels).toEqual(['id1', 'id2', 'id3']);
        expect(state.referenceTexts).toEqual(['Class', 'Class', 'Class']);
        expect(state.referenceLabels).toEqual(['id1', 'id2', 'id3']);
        expect(state.blockClasses[0]).toContain('cm-pem-fenced-div-class1');
        expect(state.blockClasses[1]).toContain('cm-pem-fenced-div-class');
        expect(state.blockClasses[2]).toContain('cm-pem-fenced-div-class');
        expect(state.blockClasses[3]).toContain('cm-pem-fenced-div-class');
        expect(state.blockTexts).toEqual([
            'Multiple classes',
            'class and id',
            'class, data and id',
            'id, class and data',
            'multiple data, no class'
        ]);
        expect(state.rawText).not.toContain('@id1');
        expect(state.rawText).not.toContain('@id2');
        expect(state.rawText).not.toContain('@id3');

        await deleteFileIfExists(filePath);
    });

    it('renders shorthand cases and references in Reading mode', async () => {
        const filePath = 'readable-fenced-div-shorthand-reading.md';

        await createOrReplaceFile(filePath, shorthandContent);
        await openFileInActiveLeaf(filePath);
        await ensureReadingMode();

        try {
            await browser.waitUntil(async () => {
                const state = await getReadingModeState();
                return state.blockCount === 5 &&
                    state.referenceLabels.join('|') === 'id1|id2|id3';
            }, {
                timeout: 5000,
                timeoutMsg: 'Expected readable shorthand fenced divs in Reading mode'
            });
        } catch (error) {
            const state = await getReadingModeState();
            throw new Error(`${(error as Error).message}\nState: ${JSON.stringify(state, null, 2)}`);
        }

        const state = await getReadingModeState();

        expect(state.blockCount).toBe(5);
        expect(state.headerTexts).toEqual(['Class1:', 'Class:', 'Class:', 'Class:', 'Div:']);
        expect(state.blockLabels).toEqual(['', 'id1', 'id2', 'id3', '']);
        expect(state.referenceTexts).toEqual(['Class', 'Class', 'Class']);
        expect(state.referenceLabels).toEqual(['id1', 'id2', 'id3']);
        expect(state.blockClasses[0]).toContain('pem-fenced-div-class1');
        expect(state.blockClasses[1]).toContain('pem-fenced-div-class');
        expect(state.blockClasses[2]).toContain('pem-fenced-div-class');
        expect(state.blockClasses[3]).toContain('pem-fenced-div-class');
        expect(state.blockTexts).toEqual([
            'Class1:Multiple classes',
            'Class:class and id',
            'Class:class, data and id',
            'Class:id, class and data',
            'Div:multiple data, no class'
        ]);
        expect(state.rawText).not.toContain('::: class1 class2 class3');
        expect(state.rawText).not.toContain('@id1');
        expect(state.rawText).not.toContain('@id2');
        expect(state.rawText).not.toContain('@id3');

        await deleteFileIfExists(filePath);
    });
});

async function enableReadableFencedDivs(): Promise<void> {
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
            plugin.settings.strictPandocMode = false;
            plugin.settings.enableFencedDivs = true;
            await plugin.saveSettings();
            // @ts-ignore
            app.workspace.updateOptions();
        }
    });
}

async function ensureLivePreviewMode(): Promise<void> {
    await browser.execute(async () => {
        // @ts-ignore
        const leaf = app.workspace.getLeaf();
        if (!leaf) {
            return;
        }

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

    await browser.waitUntil(async () => {
        return browser.execute(() => Boolean(document.querySelector('.markdown-source-view')));
    }, {
        timeout: 5000,
        timeoutMsg: 'Expected Live Preview editor to be visible'
    });
    await browser.pause(500);
}

async function moveCursorToLine(lineNumber: number): Promise<void> {
    await browser.execute((targetLineNumber: number) => {
        // @ts-ignore
        const leaf = app.workspace.getLeaf();
        const view = leaf?.view;
        const cm = view?.editor?.cm;
        if (!cm) {
            return;
        }

        const line = cm.state.doc.line(targetLineNumber);
        cm.dispatch({
            selection: { anchor: line.from }
        });
        cm.focus();
    }, lineNumber);
    await browser.pause(250);
}

async function getLivePreviewState(): Promise<ReadableFencedDivState> {
    return browser.execute((): ReadableFencedDivState => {
        const openLines = Array.from(document.querySelectorAll('.cm-line.cm-pem-fenced-div-open')) as HTMLElement[];
        const contentLines = Array.from(document.querySelectorAll('.cm-line.cm-pem-fenced-div-content')) as HTMLElement[];
        const headers = Array.from(document.querySelectorAll('.pem-fenced-div-header')) as HTMLElement[];
        const references = Array.from(document.querySelectorAll('.pem-fenced-div-reference')) as HTMLElement[];
        const editor = document.querySelector('.markdown-source-view') as HTMLElement | null;

        return {
            blockCount: openLines.length,
            headerTexts: headers.map(header => header.textContent ?? ''),
            blockLabels: headers
                .map(header => header.dataset.pandocDivId)
                .filter((label): label is string => Boolean(label)),
            blockClasses: openLines.map(line => line.className),
            blockTexts: contentLines
                .map(line => line.textContent?.trim() ?? '')
                .filter(Boolean),
            referenceTexts: references.map(reference => reference.textContent ?? ''),
            referenceLabels: references
                .map(reference => reference.dataset.pandocDivRef)
                .filter((label): label is string => Boolean(label)),
            rawText: editor?.textContent ?? '',
            atTextNodes: []
        };
    });
}

async function getReadingModeState(): Promise<ReadableFencedDivState> {
    return browser.execute((): ReadableFencedDivState => {
        const preview = document.querySelector('.markdown-preview-view') as HTMLElement | null;
        const blocks = Array.from(preview?.querySelectorAll('.pem-fenced-div') ?? []) as HTMLElement[];
        const references = Array.from(preview?.querySelectorAll('.pem-fenced-div-reference') ?? []) as HTMLElement[];
        const atTextNodes: string[] = [];
        const walker = document.createTreeWalker(preview ?? document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            const text = walker.currentNode.textContent ?? '';
            if (text.includes('@')) {
                atTextNodes.push(text);
            }
        }

        return {
            blockCount: blocks.length,
            headerTexts: blocks.map(block => block.querySelector('.pem-fenced-div-title')?.textContent ?? ''),
            blockLabels: blocks.map(block => block.dataset.pandocDivId ?? ''),
            blockClasses: blocks.map(block => block.className),
            blockTexts: blocks.map(block => block.textContent ?? ''),
            referenceTexts: references.map(reference => reference.textContent ?? ''),
            referenceLabels: references.map(reference => reference.dataset.pandocDivRef ?? ''),
            rawText: preview?.textContent ?? '',
            atTextNodes
        };
    });
}
