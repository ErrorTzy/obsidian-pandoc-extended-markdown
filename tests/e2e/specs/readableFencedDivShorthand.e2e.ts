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

interface FencedDivCssHookState {
    blockCount: number;
    blockClasses: string[];
    styles: Array<{
        accent: string;
        background: string;
        backgroundColor: string;
        borderBottomColor: string;
        borderBottomWidth: string;
        borderLeftColor: string;
        borderLeftWidth: string;
        borderRadiusVar: string;
        borderRadius: string;
        borderRightColor: string;
        borderRightWidth: string;
        borderTopColor: string;
        borderTopWidth: string;
        borderWidthVar: string;
        boxShadow: string;
        railWidth: string;
    }>;
    closeStyles: Array<{
        borderBottomColor: string;
        borderBottomWidth: string;
        borderWidthVar: string;
    }>;
    contentStyles: Array<{
        background: string;
        backgroundColor: string;
    }>;
}

type RenderMode = 'live' | 'reading';

const cssSnippetName = 'pem-e2e-fenced-div-css-hooks';
const cssSnippetPath = `.obsidian/snippets/${cssSnippetName}.css`;

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
const cssHookContent = [
    '::: {.theorem .transparent .framed #native}',
    'Native theorem classes.',
    ':::',
    '',
    '::: axiom transparent #readable',
    'Readable axiom classes.',
    ':::',
    '',
    '::: {.lemma .transparent #after} title after attributes',
    'Title-after lemma classes.',
    ':::',
    '',
    '::: title before attributes {.claim .theorem #before}',
    'Title-before claim classes.',
    ':::',
    '',
    '::: Case & transparent #placeholder',
    'Placeholder classes.',
    ':::'
].join('\n');

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

        it(`exposes every semantic fenced-div class as a custom CSS hook in ${renderModeName(mode)}`, async () => {
            const filePath = `readable-fenced-div-css-hooks-${mode}.md`;

            try {
                await openReadableFixture(filePath, cssHookContent, mode, cssHookCursorLine(mode));
                await enableCssHookSnippet(mode);
                await waitForCssHookState(
                    mode,
                    state => state.blockCount === 5 &&
                        hasColor(state.styles[0]?.boxShadow, '0, 128, 0') &&
                        state.styles[0]?.railWidth === '5px' &&
                        hasColor(state.styles[0]?.borderLeftColor, '255, 165, 0') &&
                        hasColor(state.styles[0]?.borderRightColor, '255, 165, 0') &&
                        hasColor(state.styles[0]?.borderTopColor, '255, 165, 0') &&
                        state.styles[0]?.borderWidthVar === '2px' &&
                        state.styles[0]?.borderRadiusVar === '6px' &&
                        hasVisibleBorderWidth(state.styles[0]?.borderLeftWidth) &&
                        hasVisibleBorderWidth(state.styles[0]?.borderRightWidth) &&
                        hasVisibleBorderWidth(state.styles[0]?.borderTopWidth) &&
                        state.styles[0]?.borderRadius.includes('6px') &&
                        hasBottomFrame(mode, state) &&
                        hasColor(state.styles[1]?.boxShadow, '0, 0, 0') &&
                        hasColor(state.styles[2]?.boxShadow, '128, 0, 128') &&
                        hasColor(state.styles[3]?.boxShadow, '0, 0, 255') &&
                        isTransparentBackground(state.styles[4]) &&
                        hasTransparentContentLine(mode, state),
                    `Expected every fenced-div source class to be available to custom CSS in ${renderModeName(mode)}`
                );

                const state = await getCssHookState(mode);

                expect(state.blockClasses[0]).toContain(`${classPrefix(mode)}theorem`);
                expect(state.blockClasses[0]).toContain(`${classPrefix(mode)}transparent`);
                expect(state.blockClasses[0]).toContain(`${classPrefix(mode)}framed`);
                expect(state.blockClasses[1]).toContain(`${classPrefix(mode)}axiom`);
                expect(state.blockClasses[1]).toContain(`${classPrefix(mode)}transparent`);
                expect(state.blockClasses[2]).toContain(`${classPrefix(mode)}lemma`);
                expect(state.blockClasses[2]).toContain(`${classPrefix(mode)}transparent`);
                expect(state.blockClasses[3]).toContain(`${classPrefix(mode)}claim`);
                expect(state.blockClasses[3]).toContain(`${classPrefix(mode)}theorem`);
                expect(state.blockClasses[4]).toContain(`${classPrefix(mode)}case`);
                expect(state.blockClasses[4]).toContain(`${classPrefix(mode)}transparent`);
                expect(hasColor(state.styles[0].boxShadow, '0, 128, 0')).toBe(true);
                expect(state.styles[0].railWidth).toBe('5px');
                expect(hasColor(state.styles[0].borderLeftColor, '255, 165, 0')).toBe(true);
                expect(hasColor(state.styles[0].borderRightColor, '255, 165, 0')).toBe(true);
                expect(hasColor(state.styles[0].borderTopColor, '255, 165, 0')).toBe(true);
                expect(state.styles[0].borderWidthVar).toBe('2px');
                expect(state.styles[0].borderRadiusVar).toBe('6px');
                expect(hasVisibleBorderWidth(state.styles[0].borderLeftWidth)).toBe(true);
                expect(hasVisibleBorderWidth(state.styles[0].borderRightWidth)).toBe(true);
                expect(hasVisibleBorderWidth(state.styles[0].borderTopWidth)).toBe(true);
                expect(state.styles[0].borderRadius).toContain('6px');
                expect(hasBottomFrame(mode, state)).toBe(true);
                expect(hasColor(state.styles[1].boxShadow, '0, 0, 0')).toBe(true);
                expect(hasColor(state.styles[2].boxShadow, '128, 0, 128')).toBe(true);
                expect(hasColor(state.styles[3].boxShadow, '0, 0, 255')).toBe(true);
                expect(isTransparentBackground(state.styles[0])).toBe(true);
                expect(isTransparentBackground(state.styles[1])).toBe(true);
                expect(isTransparentBackground(state.styles[2])).toBe(true);
                expect(isTransparentBackground(state.styles[4])).toBe(true);
                expect(hasTransparentContentLine(mode, state)).toBe(true);

                if (mode === 'reading') {
                    expect(state.blockClasses[0].split(/\s+/)).toEqual(expect.arrayContaining(['theorem', 'transparent', 'framed']));
                    expect(state.blockClasses[1].split(/\s+/)).toEqual(expect.arrayContaining(['axiom', 'transparent']));
                    expect(state.blockClasses[2].split(/\s+/)).toEqual(expect.arrayContaining(['lemma', 'transparent']));
                    expect(state.blockClasses[3].split(/\s+/)).toEqual(expect.arrayContaining(['claim', 'theorem']));
                    expect(state.blockClasses[4].split(/\s+/)).toEqual(expect.arrayContaining(['Case', '&', 'transparent']));
                }
            } finally {
                await disableCssHookSnippet();
                await deleteFileIfExists(filePath);
            }
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
            plugin.settings.enforcePandocListSpacing = false;
            plugin.settings.enableReadableFencedDivSyntax = true;
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

async function waitForCssHookState(
    mode: RenderMode,
    predicate: (state: FencedDivCssHookState) => boolean,
    timeoutMsg: string
): Promise<void> {
    try {
        await browser.waitUntil(async () => predicate(await getCssHookState(mode)), {
            timeout: 5000,
            timeoutMsg
        });
    } catch (error) {
        const state = await getCssHookState(mode);
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

function cssHookCursorLine(mode: RenderMode): number | undefined {
    return mode === 'live'
        ? 1
        : undefined;
}

function hasColor(value: string | undefined, colorFragment: string): boolean {
    return Boolean(value?.includes(colorFragment));
}

function isTransparentBackground(style: { background: string; backgroundColor: string } | undefined): boolean {
    return style?.background === 'transparent' &&
        /^(rgba\(0,\s*0,\s*0,\s*0\)|transparent)$/.test(style.backgroundColor);
}

function hasVisibleBorderWidth(width: string | undefined): boolean {
    return Number.parseFloat(width ?? '0') > 0;
}

function hasBottomFrame(mode: RenderMode, state: FencedDivCssHookState): boolean {
    if (mode === 'live') {
        const closeStyle = state.closeStyles[0];
        return hasColor(closeStyle?.borderBottomColor, '255, 165, 0') &&
            closeStyle?.borderWidthVar === '2px' &&
            hasVisibleBorderWidth(closeStyle?.borderBottomWidth);
    }

    return hasColor(state.styles[0]?.borderBottomColor, '255, 165, 0') &&
        state.styles[0]?.borderWidthVar === '2px' &&
        hasVisibleBorderWidth(state.styles[0]?.borderBottomWidth);
}

function hasTransparentContentLine(mode: RenderMode, state: FencedDivCssHookState): boolean {
    if (mode === 'reading') {
        return true;
    }

    return isTransparentBackground(state.contentStyles[0]);
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

async function enableCssHookSnippet(mode: RenderMode): Promise<void> {
    await browser.execute(async (
        renderMode: RenderMode,
        snippetName: string,
        snippetPath: string
    ) => {
        const selector = (className: string): string => renderMode === 'live'
            ? `.cm-pem-fenced-div-${className}`
            : `.pem-fenced-div-${className}`;
        const snippetCss = [
            `${selector('theorem')} { --pem-fenced-div-accent: rgb(0, 128, 0); }`,
            `${selector('axiom')} { --pem-fenced-div-accent: rgb(0, 0, 0); }`,
            `${selector('lemma')} { --pem-fenced-div-accent: rgb(128, 0, 128); }`,
            `${selector('claim')} { --pem-fenced-div-accent: rgb(0, 0, 255); }`,
            `${selector('framed')} { --pem-fenced-div-border-color: rgb(255, 165, 0); --pem-fenced-div-border-radius: 6px; --pem-fenced-div-border-width: 2px; --pem-fenced-div-rail-width: 5px; }`,
            `${selector('transparent')} { --pem-fenced-div-bg: transparent; --pem-fenced-div-inner-bg: transparent; }`
        ].join('\n');

        // @ts-ignore
        if (!await app.vault.adapter.exists('.obsidian')) {
            // @ts-ignore
            await app.vault.adapter.mkdir('.obsidian');
        }
        // @ts-ignore
        if (!await app.vault.adapter.exists('.obsidian/snippets')) {
            // @ts-ignore
            await app.vault.adapter.mkdir('.obsidian/snippets');
        }
        // @ts-ignore
        await app.vault.adapter.write(snippetPath, snippetCss);

        // @ts-ignore Obsidian's public typings do not expose the custom CSS manager.
        const customCss = app.customCss;
        customCss?.setCssEnabledStatus?.(snippetName, true);
        await customCss?.requestLoadSnippets?.();
    }, mode, cssSnippetName, cssSnippetPath);
}

async function disableCssHookSnippet(): Promise<void> {
    await browser.execute(async (snippetName: string, snippetPath: string) => {
        // @ts-ignore Obsidian's public typings do not expose the custom CSS manager.
        const customCss = app.customCss;
        customCss?.setCssEnabledStatus?.(snippetName, false);
        await customCss?.requestLoadSnippets?.();

        // @ts-ignore
        if (await app.vault.adapter.exists(snippetPath)) {
            // @ts-ignore
            await app.vault.adapter.remove(snippetPath);
        }
    }, cssSnippetName, cssSnippetPath);
}

async function getCssHookState(mode: RenderMode): Promise<FencedDivCssHookState> {
    return browser.execute((renderMode: RenderMode): FencedDivCssHookState => {
        const blocks = renderMode === 'live'
            ? Array.from(document.querySelectorAll('.cm-line.cm-pem-fenced-div-open')) as HTMLElement[]
            : Array.from(document.querySelectorAll('.markdown-preview-view .pem-fenced-div')) as HTMLElement[];
        const closeBlocks = renderMode === 'live'
            ? Array.from(document.querySelectorAll('.cm-line.cm-pem-fenced-div-close')) as HTMLElement[]
            : [];
        const contentBlocks = renderMode === 'live'
            ? Array.from(document.querySelectorAll('.cm-line.cm-pem-fenced-div-content')) as HTMLElement[]
            : [];

        return {
            blockCount: blocks.length,
            blockClasses: blocks.map(block => block.className),
            styles: blocks.map(block => {
                const styles = window.getComputedStyle(block);
                return {
                    accent: styles.getPropertyValue('--pem-fenced-div-accent').trim(),
                    background: styles.getPropertyValue('--pem-fenced-div-bg').trim(),
                    backgroundColor: styles.backgroundColor,
                    borderBottomColor: styles.borderBottomColor,
                    borderBottomWidth: styles.borderBottomWidth,
                    borderLeftColor: styles.borderLeftColor,
                    borderLeftWidth: styles.borderLeftWidth,
                    borderRadiusVar: styles.getPropertyValue('--pem-fenced-div-border-radius').trim(),
                    borderRadius: styles.borderRadius,
                    borderRightColor: styles.borderRightColor,
                    borderRightWidth: styles.borderRightWidth,
                    borderTopColor: styles.borderTopColor,
                    borderTopWidth: styles.borderTopWidth,
                    borderWidthVar: styles.getPropertyValue('--pem-fenced-div-border-width').trim(),
                    boxShadow: styles.boxShadow,
                    railWidth: styles.getPropertyValue('--pem-fenced-div-rail-width').trim()
                };
            }),
            closeStyles: closeBlocks.map(block => {
                const styles = window.getComputedStyle(block);
                return {
                    borderBottomColor: styles.borderBottomColor,
                    borderBottomWidth: styles.borderBottomWidth,
                    borderWidthVar: styles.getPropertyValue('--pem-fenced-div-border-width').trim()
                };
            }),
            contentStyles: contentBlocks.map(block => {
                const styles = window.getComputedStyle(block);
                return {
                    background: styles.getPropertyValue('--pem-fenced-div-bg').trim(),
                    backgroundColor: styles.backgroundColor
                };
            })
        };
    }, mode);
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
