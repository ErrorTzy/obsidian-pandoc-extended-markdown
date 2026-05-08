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
    ':::',
    '',
    '::: {.class #id4} explicit title with space',
    'title after braced attributes',
    ':::',
    '',
    'Reference to @id4',
    '',
    '::: explicit title before attributes {.class #id5}',
    'title before braced attributes',
    ':::',
    '',
    'Reference to @id5'
].join('\n');

const titleRenderingContent = [
    '::: title before attributes {.theorem}',
    'title before content',
    ':::',
    '',
    '::: {.theorem} title after attributes',
    'title after content',
    ':::',
    '',
    '::: classname',
    'class-only content',
    ':::',
    '',
    '::: title="titlename"',
    'title-only content',
    ':::',
    '',
    '::: {#bare}',
    'id-only content',
    ':::',
    '',
    'Reference to @bare'
].join('\n');

describe('Readable fenced div shorthand rendering', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });
        await enableReadableFencedDivs();
    });

    it('renders shorthand cases and fenced-div references in Live Preview', async () => {
        const filePath = 'readable-fenced-div-shorthand-live.md';

        await createOrReplaceFile(filePath, shorthandContent);
        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();
        await moveCursorToLine(9);

        await browser.waitUntil(async () => {
            const state = await getLivePreviewState();
            return state.blockCount === 7 &&
                state.referenceTexts.includes('explicit title with space 1') &&
                state.referenceTexts.includes('explicit title before attributes 1');
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected readable shorthand fenced divs in Live Preview'
        });

        const state = await getLivePreviewState();

        expect(state.blockCount).toBe(7);
        expect(state.headerTexts).toEqual([
            'Class1 1',
            'Class 1',
            'Class 2',
            'Class 3',
            '',
            'explicit title with space 1',
            'explicit title before attributes 1'
        ]);
        expect(state.blockLabels).toEqual(['id1', 'id2', 'id3', 'id4', 'id5']);
        expect(state.referenceTexts).toEqual([
            'Class 1',
            'Class 2',
            'Class 3',
            'explicit title with space 1',
            'explicit title before attributes 1'
        ]);
        expect(state.referenceLabels).toEqual(['id1', 'id2', 'id3', 'id4', 'id5']);
        expect(state.blockClasses[0]).toContain('cm-pem-fenced-div-class1');
        expect(state.blockClasses[1]).toContain('cm-pem-fenced-div-class');
        expect(state.blockClasses[2]).toContain('cm-pem-fenced-div-class');
        expect(state.blockClasses[3]).toContain('cm-pem-fenced-div-class');
        expect(state.blockClasses[5]).toContain('cm-pem-fenced-div-class');
        expect(state.blockClasses[6]).toContain('cm-pem-fenced-div-class');
        expect(state.blockTexts).toEqual([
            'Multiple classes',
            'class and id',
            'class, data and id',
            'id, class and data',
            'multiple data, no class',
            'title after braced attributes',
            'title before braced attributes'
        ]);
        expect(state.rawText).not.toContain('@id1');
        expect(state.rawText).not.toContain('@id2');
        expect(state.rawText).not.toContain('@id3');
        expect(state.rawText).not.toContain('@id4');
        expect(state.rawText).not.toContain('@id5');

        await deleteFileIfExists(filePath);
    });

    it('renders fenced-div titles independently of reference labels in Live Preview', async () => {
        const filePath = 'readable-fenced-div-title-rendering-live.md';

        await createOrReplaceFile(filePath, titleRenderingContent);
        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();
        await moveCursorToLine(2);

        await browser.waitUntil(async () => {
            const state = await getLivePreviewState();
            return state.blockCount === 5 &&
                state.headerTexts.join('|') === [
                    'title before attributes 1',
                    'title after attributes 1',
                    'Classname 1',
                    'titlename 1',
                    ''
                ].join('|') &&
                state.referenceTexts.join('|') === 'Div 1';
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected fenced div titles to render in Live Preview'
        });

        const state = await getLivePreviewState();

        expect(state.blockCount).toBe(5);
        expect(state.headerTexts).toEqual([
            'title before attributes 1',
            'title after attributes 1',
            'Classname 1',
            'titlename 1',
            ''
        ]);
        expect(state.blockLabels).toEqual(['bare']);
        expect(state.referenceTexts).toEqual(['Div 1']);
        expect(state.referenceLabels).toEqual(['bare']);
        expect(state.blockTexts).toEqual([
            'title before content',
            'title after content',
            'class-only content',
            'title-only content',
            'id-only content'
        ]);

        await deleteFileIfExists(filePath);
    });

    it('renders shorthand cases and fenced-div references in Reading mode', async () => {
        const filePath = 'readable-fenced-div-shorthand-reading.md';

        await createOrReplaceFile(filePath, shorthandContent);
        await openFileInActiveLeaf(filePath);
        await ensureReadingMode();

        try {
            await browser.waitUntil(async () => {
                const state = await getReadingModeState();
                return state.blockCount === 7 &&
                    state.referenceTexts.join('|') === [
                        'Class 1',
                        'Class 2',
                        'Class 3',
                        'explicit title with space 1',
                        'explicit title before attributes 1'
                    ].join('|');
            }, {
                timeout: 5000,
                timeoutMsg: 'Expected readable shorthand fenced divs in Reading mode'
            });
        } catch (error) {
            const state = await getReadingModeState();
            throw new Error(`${(error as Error).message}\nState: ${JSON.stringify(state, null, 2)}`);
        }

        const state = await getReadingModeState();

        expect(state.blockCount).toBe(7);
        expect(state.headerTexts).toEqual([
            'Class1 1',
            'Class 1',
            'Class 2',
            'Class 3',
            '',
            'explicit title with space 1',
            'explicit title before attributes 1'
        ]);
        expect(state.blockLabels).toEqual(['', 'id1', 'id2', 'id3', '', 'id4', 'id5']);
        expect(state.referenceTexts).toEqual([
            'Class 1',
            'Class 2',
            'Class 3',
            'explicit title with space 1',
            'explicit title before attributes 1'
        ]);
        expect(state.referenceLabels).toEqual(['id1', 'id2', 'id3', 'id4', 'id5']);
        expect(state.blockClasses[0]).toContain('pem-fenced-div-class1');
        expect(state.blockClasses[1]).toContain('pem-fenced-div-class');
        expect(state.blockClasses[2]).toContain('pem-fenced-div-class');
        expect(state.blockClasses[3]).toContain('pem-fenced-div-class');
        expect(state.blockClasses[5]).toContain('pem-fenced-div-class');
        expect(state.blockClasses[6]).toContain('pem-fenced-div-class');
        expect(state.blockTexts).toEqual([
            'Multiple classes',
            'class and id',
            'class, data and id',
            'id, class and data',
            'multiple data, no class',
            'title after braced attributes',
            'title before braced attributes'
        ]);
        expect(state.rawText).not.toContain('::: class1 class2 class3');
        expect(state.rawText).not.toContain('@id1');
        expect(state.rawText).not.toContain('@id2');
        expect(state.rawText).not.toContain('@id3');
        expect(state.rawText).not.toContain('@id4');
        expect(state.rawText).not.toContain('@id5');

        await deleteFileIfExists(filePath);
    });

    it('renders fenced-div titles independently of reference labels in Reading mode', async () => {
        const filePath = 'readable-fenced-div-title-rendering-reading.md';

        await createOrReplaceFile(filePath, titleRenderingContent);
        await openFileInActiveLeaf(filePath);
        await ensureReadingMode();

        try {
            await browser.waitUntil(async () => {
                const state = await getReadingModeState();
                return state.blockCount === 5 &&
                    state.headerTexts.join('|') === [
                        'title before attributes 1',
                        'title after attributes 1',
                        'Classname 1',
                        'titlename 1',
                        ''
                    ].join('|') &&
                    state.referenceTexts.join('|') === 'Div 1';
            }, {
                timeout: 5000,
                timeoutMsg: 'Expected fenced div titles to render in Reading mode'
            });
        } catch (error) {
            const state = await getReadingModeState();
            throw new Error(`${(error as Error).message}\nState: ${JSON.stringify(state, null, 2)}`);
        }

        const state = await getReadingModeState();

        expect(state.blockCount).toBe(5);
        expect(state.headerTexts).toEqual([
            'title before attributes 1',
            'title after attributes 1',
            'Classname 1',
            'titlename 1',
            ''
        ]);
        expect(state.blockLabels).toEqual(['', '', '', '', 'bare']);
        expect(state.referenceTexts).toEqual(['Div 1']);
        expect(state.referenceLabels).toEqual(['bare']);
        expect(state.blockTexts).toEqual([
            'title before content',
            'title after content',
            'class-only content',
            'title-only content',
            'id-only content'
        ]);

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
            blockTexts: blocks.map(block =>
                block.querySelector('.pem-fenced-div-content')?.textContent ?? ''
            ),
            referenceTexts: references.map(reference => reference.textContent ?? ''),
            referenceLabels: references.map(reference => reference.dataset.pandocDivRef ?? ''),
            rawText: preview?.textContent ?? '',
            atTextNodes
        };
    });
}
