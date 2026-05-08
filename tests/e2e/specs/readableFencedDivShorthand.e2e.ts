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

type RenderMode = 'live' | 'reading';

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
    '::: title before attributes & {.theorem}',
    'title before content',
    ':::',
    '',
    '::: {.theorem} title after attributes &',
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

const placeholderShorthandContent = [
    '::: Case & #c1',
    'Top-level case.',
    ':::',
    '',
    '::: Case &.& #c1a',
    'Nested case.',
    ':::',
    '',
    '::: & Note #n1',
    'Front-numbered note.',
    ':::',
    '',
    '::: Case_& #c2',
    'Classname as title.',
    ':::',
    '',
    '::: Case_&.& #c2a',
    'Classname as nested title.',
    ':::',
    '',
    '::: Case & #cn no-num',
    'Numbering disabled.',
    ':::',
    '',
    '::: & Note #nn no-num',
    'Front numbering disabled.',
    ':::',
    '',
    'Refs @c1 @c1a @n1 @c2 @c2a @cn @nn.'
].join('\n');

const visiblePlaceholderContent = [
    '::: {.case title="Case &"}',
    'Top-level case.',
    ':::',
    '',
    '::: {.case title="Case &.&"}',
    'Nested case.',
    ':::',
    '',
    '::: {.note title="& Note"}',
    'Front-numbered note.',
    ':::',
    '',
    '::: Case & {.case}',
    'Top-level case shortcut',
    ':::',
    '',
    '::: Case &.& {.case}',
    'Nested case shortcut',
    ':::',
    '',
    '::: & Note {.note}',
    'Front-numbered note shortcut',
    ':::',
    '',
    '::: Case_&',
    'Classname as title (top-level)',
    ':::',
    '',
    '::: Case_&.&',
    'Classname as title (nested)',
    ':::',
    '',
    '::: & Case_&',
    'Classname as title (top-level, front number)',
    ':::',
    '',
    '::: {.case .no-num title="Case &"}',
    'Top-level case, numbering disabled',
    ':::'
].join('\n');

const renderModes: RenderMode[] = ['live', 'reading'];
const shorthandHeaders = [
    'Class1',
    'Class',
    'Class',
    'Class',
    '',
    'explicit title with space',
    'explicit title before attributes'
];
const shorthandReferences = [
    'Class',
    'Class',
    'Class',
    'explicit title with space',
    'explicit title before attributes'
];
const shorthandBlockTexts = [
    'Multiple classes',
    'class and id',
    'class, data and id',
    'id, class and data',
    'multiple data, no class',
    'title after braced attributes',
    'title before braced attributes'
];
const titleRenderingHeaders = [
    'title before attributes 1',
    'title after attributes 1',
    'Classname',
    'titlename',
    ''
];
const titleRenderingBlockTexts = [
    'title before content',
    'title after content',
    'class-only content',
    'title-only content',
    'id-only content'
];
const placeholderReferences = [
    'Case 1',
    'Case 1.1',
    '1 Note',
    'Case 2',
    'Case 2.1',
    'Case &',
    '& Note'
];
const visiblePlaceholderHeaders = [
    'Case 1',
    'Case 1.1',
    '1 Note',
    'Case 2',
    'Case 2.1',
    '2 Note',
    'Case 3',
    'Case 3.1',
    '4 Case &',
    'Case &'
];

describe('Readable fenced div shorthand rendering', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });
        await enableReadableFencedDivs();
    });

    for (const mode of renderModes) {
        it(`renders shorthand cases and fenced-div references in ${renderModeName(mode)}`, async () => {
            const filePath = `readable-fenced-div-shorthand-${mode}.md`;

            await openReadableFixture(filePath, shorthandContent, mode, 9);
            await waitForReadableState(
                mode,
                state => state.blockCount === 7 &&
                    state.referenceTexts.join('|') === shorthandReferences.join('|'),
                `Expected readable shorthand fenced divs in ${renderModeName(mode)}`
            );

            const state = await getReadableState(mode);

            expect(state.blockCount).toBe(7);
            expect(state.headerTexts).toEqual(shorthandHeaders);
            expect(state.blockLabels).toEqual(mode === 'live'
                ? ['id1', 'id2', 'id3', 'id4', 'id5']
                : ['', 'id1', 'id2', 'id3', '', 'id4', 'id5']);
            expect(state.referenceTexts).toEqual(shorthandReferences);
            expect(state.referenceLabels).toEqual(['id1', 'id2', 'id3', 'id4', 'id5']);
            expect(state.blockClasses[0]).toContain(`${classPrefix(mode)}class1`);
            for (const index of [1, 2, 3, 5, 6]) {
                expect(state.blockClasses[index]).toContain(`${classPrefix(mode)}class`);
            }
            expect(state.blockTexts).toEqual(shorthandBlockTexts);
            if (mode === 'reading') {
                expect(state.rawText).not.toContain('::: class1 class2 class3');
            }
            expectRenderedReferencesRemoved(state.rawText, ['id1', 'id2', 'id3', 'id4', 'id5']);

            await deleteFileIfExists(filePath);
        });

        it(`renders fenced-div titles independently of reference labels in ${renderModeName(mode)}`, async () => {
            const filePath = `readable-fenced-div-title-rendering-${mode}.md`;

            await openReadableFixture(filePath, titleRenderingContent, mode, 2);
            await waitForReadableState(
                mode,
                state => state.blockCount === 5 &&
                    state.headerTexts.join('|') === titleRenderingHeaders.join('|') &&
                    state.referenceTexts.join('|') === 'Div',
                `Expected fenced div titles to render in ${renderModeName(mode)}`
            );

            const state = await getReadableState(mode);

            expect(state.blockCount).toBe(5);
            expect(state.headerTexts).toEqual(titleRenderingHeaders);
            expect(state.blockLabels).toEqual(mode === 'live'
                ? ['bare']
                : ['', '', '', '', 'bare']);
            expect(state.referenceTexts).toEqual(['Div']);
            expect(state.referenceLabels).toEqual(['bare']);
            expect(state.blockTexts).toEqual(titleRenderingBlockTexts);

            await deleteFileIfExists(filePath);
        });

        it(`renders shorthand placeholder titles in ${renderModeName(mode)}`, async () => {
            const filePath = `readable-fenced-div-placeholder-${mode}.md`;

            await openReadableFixture(filePath, placeholderShorthandContent, mode, 29);
            await waitForReadableState(
                mode,
                state => state.blockCount === 7 &&
                    state.referenceTexts.join('|') === placeholderReferences.join('|'),
                `Expected shorthand placeholder fenced divs in ${renderModeName(mode)}`
            );

            const state = await getReadableState(mode);

            expect(state.headerTexts).toEqual(placeholderReferences);
            expect(state.referenceTexts).toEqual(placeholderReferences);
            expect(state.blockClasses[0]).toContain(`${classPrefix(mode)}case`);
            expect(state.blockClasses[2]).toContain(`${classPrefix(mode)}note`);

            await deleteFileIfExists(filePath);
        });

        it(`renders visible no-id placeholder block titles in ${renderModeName(mode)}`, async () => {
            const filePath = `readable-fenced-div-visible-placeholders-${mode}.md`;

            await openReadableFixture(filePath, visiblePlaceholderContent, mode, 38);
            await waitForReadableState(
                mode,
                state => state.blockCount === 10 &&
                    state.headerTexts.join('|') === visiblePlaceholderHeaders.join('|'),
                `Expected visible no-id shorthand placeholder titles in ${renderModeName(mode)}`
            );

            const state = await getReadableState(mode);

            expect(state.headerTexts).toEqual(visiblePlaceholderHeaders);

            await deleteFileIfExists(filePath);
        });
    }
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

async function openReadableFixture(
    filePath: string,
    content: string,
    mode: RenderMode,
    cursorLine?: number
): Promise<void> {
    await createOrReplaceFile(filePath, content);
    await openFileInActiveLeaf(filePath);

    if (mode === 'live') {
        await ensureLivePreviewMode();
        if (cursorLine !== undefined) {
            await moveCursorToLine(cursorLine);
        }
        return;
    }

    await ensureReadingMode();
}

async function waitForReadableState(
    mode: RenderMode,
    predicate: (state: ReadableFencedDivState) => boolean,
    timeoutMsg: string
): Promise<void> {
    try {
        await browser.waitUntil(async () => predicate(await getReadableState(mode)), {
            timeout: 5000,
            timeoutMsg
        });
    } catch (error) {
        const state = await getReadableState(mode);
        throw new Error(`${(error as Error).message}\nState: ${JSON.stringify(state, null, 2)}`);
    }
}

async function getReadableState(mode: RenderMode): Promise<ReadableFencedDivState> {
    return mode === 'live'
        ? getLivePreviewState()
        : getReadingModeState();
}

function renderModeName(mode: RenderMode): string {
    return mode === 'live'
        ? 'Live Preview'
        : 'Reading mode';
}

function classPrefix(mode: RenderMode): string {
    return mode === 'live'
        ? 'cm-pem-fenced-div-'
        : 'pem-fenced-div-';
}

function expectRenderedReferencesRemoved(rawText: string, labels: string[]): void {
    for (const label of labels) {
        expect(rawText).not.toContain(`@${label}`);
    }
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
