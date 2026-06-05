import { browser, expect } from '@wdio/globals';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { unzipSync } from 'fflate';
import {
    access,
    mkdir,
    rm,
    writeFile
} from 'fs/promises';
import {
    dirname,
    resolve,
    sep
} from 'path';

import {
    createOrReplaceFile,
    deleteFileIfExists,
    openFileInActiveLeaf
} from '../helpers/pandocSyntaxParity';

const vaultDir = resolve('tests/e2e/vaults/test-vault');
const outputDir = resolve('tests/e2e/.tmp/pandoc-page-preview-shapes');
const vaultNotePath = 'pandoc-page-preview-shapes.md';
const vaultImagePath = 'pandoc-page-preview-shapes.png';
const profileBaseId = 'e2e-page-preview-shapes';
const webOdfVersion = '0.5.9';
const webOdfUrl = 'https://webodf.org/download/webodf.js-0.5.9.zip';
const webOdfSha256 = '115d5994f23b6d1503559c7f4e982555ad3f3b6a52383ac8a311d536cb9ad6ca';
const addonInstallPath = resolve(
    vaultDir,
    '.obsidian',
    'pandoc-preview-addons',
    `webodf-${webOdfVersion}`
);
const embeddedPngBase64 = [
    'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAZElEQVR4nO3RwQkAIBDAQHX9',
    'd24I0kPBBQKZfXnWnPMDQE7OTgAAgDAAAEDf+q1zAgAAAACA3QMAAAAAAAAgAQAA',
    'AAAAAEACAAAAAAAABAAAAAAAAIAEAAAAAAAAgAQAAAAAAACABAAAAAAAAPgDFAAB',
    '0xbUiQAAAABJRU5ErkJggg=='
].join('');

type PreviewKind = 'docx' | 'markdown' | 'odt' | 'pdf' | 'pptx';

interface PageShapeState {
    status: string;
    pageCount: number;
    visiblePageCount: number;
    page: {
        width: number;
        height: number;
        ratio: number;
        background: string;
        shadow: string;
    };
    content?: {
        leftInset: number;
        topInset: number;
        secondLeftInset?: number;
        secondTopInset?: number;
        background: string;
        paintedBackground?: string;
        paintedElement?: string;
        paintedLocalName?: string;
        paintedNamespace?: string;
        paintedNodeName?: string;
        paintedStyle?: string;
    };
    canvas?: {
        cssWidth: number;
        cssHeight: number;
        widthAttribute: number;
        heightAttribute: number;
        transform: string;
    };
    html: string;
}

interface OdtTextClipState {
    pageCount: number;
    clippedLines: Array<{
        pageIndex: number;
        text: string;
        rectTop: number;
        rectBottom: number;
        viewportTop: number;
        viewportBottom: number;
    }>;
    html: string;
}

interface OdtFrameArchitectureState {
    previewFrameCount: number;
    obsoleteWrapperCount: number;
    internalPageCount: number;
    internalVisiblePageCount: number;
    internalShadowedPageCount: number;
    internalGrayPageCount: number;
    html: string;
}

interface OdtPageSwitchState {
    pageCount: number;
    visiblePageIndex: number;
    visiblePageCount: number;
    visibleText: string;
}

interface SideNavState {
    pageCount: number;
    hostRect: RectState;
    viewportRect: RectState;
    viewportScrollLeft: number;
    previous: SideNavButtonState;
    next: SideNavButtonState;
}

interface SideNavButtonState {
    disabled: boolean;
    opacity: string;
    pointerEvents: string;
    rect: RectState;
    svgCount: number;
    text: string;
}

interface PreviewFitState {
    zoomValue: string;
    fitScale: string;
    appliedZoom: string;
    overflowsX: boolean;
    overflowsY: boolean;
    viewport: {
        clientWidth: number;
        clientHeight: number;
        scrollWidth: number;
        scrollHeight: number;
    };
    html: string;
}

interface NonPagedTextPreviewState {
    flowPreviewCount: number;
    pagedPreviewCount: number;
    pageControlCount: number;
    sideNavButtonCount: number;
    zoomInputCount: number;
    overflowsX: boolean;
    canScrollY: boolean;
    flowCanScrollY: boolean;
    bodyCanScrollY: boolean;
    text: string;
    html: string;
}

interface OdtFallbackNoticeLayoutState {
    status: string;
    noticeText: string;
    noticeHeight: number;
    headerHeight: number;
    bodyHeight: number;
    paneHeight: number;
    flowPreviewHeight: number;
    viewportHeight: number;
    viewportGap: number;
    frameTopGap: number;
    flowPreviewCount: number;
    pagedPreviewCount: number;
    frameCount: number;
    legacyPaneNoticeCount: number;
    html: string;
}

interface PreviewFrameworkState {
    bodyHeight: number;
    paneHeight: number;
    flowPreviewCount: number;
    pagedPreviewCount: number;
    fallbackNoticeCount: number;
    html: string;
}

interface RectState {
    left: number;
    right: number;
    width: number;
}

describe('Pandoc page-based preview shapes', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });
    });

    afterEach(async () => {
        await closePandocExportModal();
    });

    after(async () => {
        await deleteFileIfExists(vaultNotePath);
        await deleteFileIfExists(vaultImagePath);
        await rm(outputDir, { recursive: true, force: true });
    });

    it('renders DOCX preview inside a page-shaped shell', async function () {
        await openPreviewFor('docx', this);
        const state = await waitForPageShape('docx');

        expect(state.pageCount).toBeGreaterThan(1);
        expect(state.page.ratio).toBeCloseTo(8.5 / 11, 1);
        expect(state.page.background).toBe('rgb(255, 255, 255)');
        expect(state.page.shadow).not.toBe('none');
        expect(state.visiblePageCount).toBe(1);
        expect(state.content?.leftInset).toBeGreaterThan(state.page.width * 0.07);
        expect(state.content?.topInset).toBeGreaterThan(state.page.height * 0.05);
    });

    it('fits the initial DOCX preview page to the viewport at 100%', async function () {
        await openPreviewFor('docx', this);
        await waitForPageShape('docx');
        const state = await waitForPreviewFit();

        expect(state.zoomValue).toBe('100%');
        if (state.overflowsX || state.overflowsY) {
            throw new Error(`Expected initial 100% preview to fit without scroll overflow.\n${JSON.stringify(state, null, 2)}`);
        }
    });

    it('renders Markdown text preview as non-paged scrollable content', async function () {
        await openPreviewFor('markdown', this);
        const state = await waitForNonPagedTextPreview();

        expect(state.flowPreviewCount).toBe(1);
        expect(state.pagedPreviewCount).toBe(0);
        expect(state.pageControlCount).toBe(0);
        expect(state.sideNavButtonCount).toBe(0);
        expect(state.zoomInputCount).toBe(0);
        expect(state.overflowsX).toBe(false);
        expect(state.canScrollY).toBe(true);
        expect(state.text).toContain('Markdown text preview');
    });

    it('keeps the ODT fallback notice compact above the unpaged preview', async function () {
        await openOdtFallbackPreview(this);
        const state = await waitForOdtFallbackNoticeLayout();

        expect(state.flowPreviewCount).toBe(1);
        expect(state.pagedPreviewCount).toBe(0);
        expect(state.frameCount).toBe(1);
        expect(state.noticeText).toContain('This preview is a fallback.');
        expect(state.noticeHeight).toBeGreaterThan(0);
        expect(state.noticeHeight).toBeLessThan(56);
        expect(state.bodyHeight).toBeGreaterThan(state.paneHeight * 0.65);
        expect(state.viewportHeight).toBeGreaterThan(state.flowPreviewHeight - state.noticeHeight - 40);
        expect(state.viewportGap).toBeLessThanOrEqual(12);
        expect(state.frameTopGap).toBeLessThanOrEqual(2);
        expect(state.legacyPaneNoticeCount).toBe(0);
    });

    it('keeps PDF preview on the paginated framework without fallback notice', async function () {
        await openPreviewFor('pdf', this);
        const state = await waitForPageShape('pdf');
        const framework = await getPreviewFrameworkState();

        expect(state.pageCount).toBeGreaterThan(0);
        expect(state.visiblePageCount).toBe(1);
        expect(state.page.ratio).toBeGreaterThan(0.6);
        expect(framework.pagedPreviewCount).toBe(1);
        expect(framework.flowPreviewCount).toBe(0);
        expect(framework.fallbackNoticeCount).toBe(0);
        expect(framework.bodyHeight).toBeGreaterThan(framework.paneHeight * 0.65);
    });

    it('renders WebODF preview inside a page-shaped canvas', async function () {
        await openPreviewFor('odt', this);
        const state = await waitForPageShape('odt');

        expect(state.pageCount).toBeGreaterThan(1);
        expect(state.page.ratio).toBeCloseTo(8.5 / 11, 1);
        expect(state.page.background).toBe('rgb(255, 255, 255)');
        expect(state.page.shadow).not.toBe('none');
        expect(state.content?.leftInset).toBeGreaterThan(state.page.width * 0.07);
        expect(state.content?.topInset).toBeGreaterThan(state.page.height * 0.05);
    });

    it('renders WebODF preview with one outer frame and no nested page chrome', async function () {
        await openPreviewFor('odt', this);
        const state = await getOdtFrameArchitectureState();

        expect(state.previewFrameCount).toBe(1);
        expect(state.obsoleteWrapperCount).toBe(0);
        expect(state.internalPageCount).toBeGreaterThan(1);
        expect(state.internalVisiblePageCount).toBe(1);
        if (state.internalShadowedPageCount > 0 || state.internalGrayPageCount > 0) {
            throw new Error(`Expected ODT iframe pages to be layout slices, not nested visual frames.\n${JSON.stringify(state, null, 2)}`);
        }
    });

    it('switches visible WebODF content when the preview page changes', async function () {
        await openPreviewFor('odt', this);
        const firstPage = await getOdtPageSwitchState();

        expect(firstPage.pageCount).toBeGreaterThan(1);
        expect(firstPage.visiblePageCount).toBe(1);
        expect(firstPage.visiblePageIndex).toBe(0);

        await setPreviewPage(2);
        await browser.waitUntil(async () => {
            const state = await getOdtPageSwitchState();
            return state.visiblePageIndex === 1 && state.visibleText !== firstPage.visibleText;
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected ODT preview page 2 to show different visible content'
        });
        const secondPage = await getOdtPageSwitchState();
        expect(secondPage.visiblePageCount).toBe(1);
        expect(secondPage.visiblePageIndex).toBe(1);
    });

    it('shows shared side navigation over the WebODF iframe preview', async function () {
        await openPreviewFor('odt', this);
        const firstPage = await getOdtPageSwitchState();

        expect(firstPage.pageCount).toBeGreaterThan(1);
        expect(firstPage.visiblePageIndex).toBe(0);

        await hoverPreviewSide('right');
        await browser.waitUntil(async () => {
            const state = await getSideNavState();
            return !state.next.disabled && Number.parseFloat(state.next.opacity) > 0;
        }, {
            timeout: 1000,
            timeoutMsg: 'Expected ODT next page button to become visible on right hover'
        });

        const nextButton = await browser.$('.pem-pandoc-paged-preview-side-nav.is-right');
        await nextButton.click();
        await browser.waitUntil(async () => {
            const state = await getOdtPageSwitchState();
            return state.visiblePageIndex === 1 && state.visibleText !== firstPage.visibleText;
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected ODT next page button to show page 2'
        });
    });

    it('does not clip WebODF text lines across page boundaries', async function () {
        await openPreviewFor('odt', this);
        let state = await getOdtTextClipState();

        expect(state.pageCount).toBeGreaterThan(1);
        if (state.clippedLines.length > 0) {
            throw new Error(`Expected ODT page breaks not to clip text lines.\n${JSON.stringify(state, null, 2)}`);
        }

        await setPreviewPage(2);
        await browser.waitUntil(async () => {
            return (await getOdtPageSwitchState()).visiblePageIndex === 1;
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected ODT preview to switch to page 2 before clip inspection'
        });
        state = await getOdtTextClipState();
        if (state.clippedLines.length > 0) {
            throw new Error(`Expected ODT page 2 not to clip text lines.\n${JSON.stringify(state, null, 2)}`);
        }
    });

    it('keeps side page navigation pinned to the frame and uses SVG buttons', async function () {
        await openPreviewFor('docx', this);
        await waitForPageShape('docx');

        await hoverPreviewSide('left');
        let state = await getSideNavState();
        expect(state.pageCount).toBeGreaterThan(1);
        expect(state.previous.disabled).toBe(true);
        expect(state.previous.opacity).toBe('0');
        expect(state.next.svgCount).toBe(1);
        expect(state.next.text).toBe('');
        expect(state.previous.svgCount).toBe(1);
        expect(state.previous.text).toBe('');

        await hoverPreviewSide('right');
        await browser.waitUntil(async () => {
            const nextState = await getSideNavState();
            return !nextState.next.disabled && Number.parseFloat(nextState.next.opacity) > 0;
        }, {
            timeout: 1000,
            timeoutMsg: 'Expected next page button to become visible on right hover'
        });
        state = await getSideNavState();
        expect(state.next.disabled).toBe(false);
        expect(Number.parseFloat(state.next.opacity)).toBeGreaterThan(0);

        await setPreviewPage(state.pageCount);
        await hoverPreviewSide('right');
        await browser.waitUntil(async () => {
            const nextState = await getSideNavState();
            return nextState.next.disabled && nextState.next.opacity === '0';
        }, {
            timeout: 1000,
            timeoutMsg: 'Expected next page button to hide on the last page'
        });
        state = await getSideNavState();
        expect(state.next.disabled).toBe(true);
        expect(state.next.opacity).toBe('0');

        await hoverPreviewSide('left');
        await browser.waitUntil(async () => {
            const nextState = await getSideNavState();
            return !nextState.previous.disabled && Number.parseFloat(nextState.previous.opacity) > 0;
        }, {
            timeout: 1000,
            timeoutMsg: 'Expected previous page button to become visible on left hover'
        });
        state = await getSideNavState();
        expect(state.previous.disabled).toBe(false);
        expect(Number.parseFloat(state.previous.opacity)).toBeGreaterThan(0);

        const pinned = await scrollPreviewViewportHorizontally();
        expect(pinned.viewportScrollLeft).toBeGreaterThanOrEqual(0);
        expect(Math.abs(pinned.previous.rect.left - (pinned.viewportRect.left + 8))).toBeLessThan(3);
        expect(Math.abs(pinned.next.rect.right - (pinned.viewportRect.right - 8))).toBeLessThan(3);
    });

    it('renders PPTX preview using the slide aspect ratio without shrinking the render canvas first', async function () {
        await openPreviewFor('pptx', this);
        const state = await waitForPageShape('pptx');

        expect(state.pageCount).toBeGreaterThan(0);
        expect(state.page.ratio).toBeCloseTo(16 / 9, 1);
        expect(state.page.background).toBe('rgb(255, 255, 255)');
        expect(state.page.shadow).not.toBe('none');
        expect(state.canvas?.cssWidth).toBeGreaterThan(900);
        expect(state.canvas?.cssHeight).toBeGreaterThan(500);
        expect(state.canvas?.widthAttribute).toBeGreaterThanOrEqual(state.canvas?.cssWidth ?? 0);
    });
});

async function openPreviewFor(kind: PreviewKind, context: Mocha.Context): Promise<void> {
    const pandocPath = getPandocPath();
    if (!pandocPath) {
        context.skip();
        return;
    }
    if (kind === 'pdf' && !getPdfEnginePath()) {
        context.skip();
        return;
    }

    const addonPath = kind === 'odt' ? await installWebOdfAddonForE2E() : undefined;
    if (kind === 'odt' && !addonPath) {
        context.skip();
        return;
    }

    await rm(outputDir, { recursive: true, force: true });
    await mkdir(outputDir, { recursive: true });
    await createOrReplaceBinaryFile(vaultImagePath, embeddedPngBase64);
    await createOrReplaceFile(vaultNotePath, markdownForPreview(kind));
    await openFileInActiveLeaf(vaultNotePath);
    await waitForActiveFile(vaultNotePath);
    await configurePandocExport(pandocPath, kind, addonPath);

    await executeCommandBySuffix('pandoc-export');
    await waitForExportModal();
    if (kind === 'markdown') {
        await waitForTextPreviewReady();
        return;
    }
    await waitForPreviewReady(kind);
}

async function openOdtFallbackPreview(context: Mocha.Context): Promise<void> {
    const pandocPath = getPandocPath();
    if (!pandocPath) {
        context.skip();
        return;
    }

    await rm(outputDir, { recursive: true, force: true });
    await mkdir(outputDir, { recursive: true });
    await createOrReplaceBinaryFile(vaultImagePath, embeddedPngBase64);
    await createOrReplaceFile(vaultNotePath, markdownForPreview('odt'));
    await openFileInActiveLeaf(vaultNotePath);
    await waitForActiveFile(vaultNotePath);
    await configurePandocExport(pandocPath, 'odt');

    await executeCommandBySuffix('pandoc-export');
    await waitForExportModal();
    await waitForOdtFallbackNoticeLayout();
}

function markdownForPreview(kind: PreviewKind): string {
    if (kind === 'markdown') {
        return [
            '# Markdown text preview',
            '',
            ...Array.from({ length: 80 }, (_value, index) => [
                `## Warning ${index + 1}`,
                '',
                `This is Markdown preview line ${index + 1}. It should stay readable at the initial fitted zoom.`,
                ''
            ]).flat()
        ].join('\n');
    }

    if (kind === 'pptx') {
        return [
            '# Preview page shape',
            '',
            'This paragraph should stay inside a slide.',
            '',
            `![[${vaultImagePath}]]`,
            '',
            'Second paragraph for text rendering.'
        ].join('\n');
    }

    if (kind === 'pdf') {
        return [
            '# PDF preview page shape',
            '',
            ...Array.from({ length: 8 }, (_value, index) => [
                `## Section ${index + 1}`,
                '',
                `This is PDF preview paragraph ${index + 1}. It should stay in the paginated preview framework.`,
                ''
            ]).flat()
        ].join('\n');
    }

    if (kind === 'odt') {
        const repeatedLine = 'Natural ODT pagination must keep every rendered text line whole.';
        return [
            '# Case 1.1',
            '',
            ...Array.from({ length: 260 }, (_value, index) => `${index + 1}. ${repeatedLine}`)
        ].join('\n');
    }

    return [
        '# Preview page shape',
        '',
        `![[${vaultImagePath}]]`,
        '',
        ...Array.from({ length: 90 }, (_value, index) => [
            `## Section ${index + 1}`,
            '',
            `This is paragraph ${index + 1}. It should flow across real preview pages rather than stretching one page.`,
            ''
        ]).flat()
    ].join('\n');
}

function getPandocPath(): string | undefined {
    try {
        const pandocPath = execFileSync('which', ['pandoc'], { encoding: 'utf8' }).trim();
        execFileSync(pandocPath, ['--version'], { stdio: 'ignore' });
        return pandocPath;
    } catch {
        return undefined;
    }
}

function getPdfEnginePath(): string | undefined {
    try {
        const enginePath = execFileSync('which', ['pdflatex'], { encoding: 'utf8' }).trim();
        execFileSync(enginePath, ['--version'], { stdio: 'ignore' });
        return enginePath;
    } catch {
        return undefined;
    }
}

async function configurePandocExport(
    pandocPath: string,
    kind: PreviewKind,
    addonPath?: string
): Promise<void> {
    await browser.execute(async (
        executable: string,
        folder: string,
        profileId: string,
        toFormat: string,
        extension: string,
        addonInstallPath: string | undefined,
        addonVersion: string,
        addonChecksum: string
    ) => {
        // @ts-ignore
        const plugin = app.plugins.plugins['pandoc-extended-markdown'];
        if (!plugin?.settings) {
            throw new Error('Pandoc Extended Markdown plugin did not load.');
        }

        const previous = plugin.settings.pandocExport ?? {};
        const extraArgs = toFormat === 'pdf' ? ['--pdf-engine=pdflatex'] : undefined;
        plugin.settings.pandocExport = {
            ...previous,
            enabled: true,
            pandocPath: executable,
            defaultOutputFolderMode: 'custom',
            customOutputFolder: folder,
            lastOutputFolder: folder,
            lastExportProfileId: profileId,
            showOverwriteConfirmation: false,
            openOutputFile: false,
            revealOutputFile: false,
            showProgress: false,
            preview: {
                ...(previous.preview ?? {}),
                enabled: true,
                debounceMs: 250,
                odtAddon: {
                    enabled: Boolean(addonInstallPath),
                    status: addonInstallPath ? 'installed' : 'not-installed',
                    version: addonInstallPath ? addonVersion : undefined,
                    checksum: addonInstallPath ? addonChecksum : undefined,
                    installPath: addonInstallPath
                }
            },
            profiles: [{
                id: profileId,
                name: `E2E ${toFormat.toUpperCase()} page preview`,
                type: 'pandoc',
                from: 'markdown+wikilinks_title_after_pipe',
                to: toFormat,
                extension,
                standalone: false,
                luaFilters: [
                    '${luaFilterDir}/FencedDivExtendedSyntax.lua',
                    '${luaFilterDir}/CustomLabelList.lua'
                ],
                resourcePaths: [
                    '${currentDir}',
                    '${attachmentFolderPath}',
                    '${vaultDir}'
                ],
                ...(extraArgs ? { extraArgs } : {})
            }]
        };

        await plugin.saveSettings();
    }, pandocPath, outputDir, `${profileBaseId}-${kind}`, toFormatForPreview(kind), extensionForPreview(kind), addonPath, webOdfVersion, webOdfSha256);
}

function toFormatForPreview(kind: PreviewKind): string {
    return kind === 'markdown' ? 'commonmark' : kind;
}

function extensionForPreview(kind: PreviewKind): string {
    return kind === 'markdown' ? '.md' : `.${kind}`;
}

async function waitForPreviewReady(kind: PreviewKind): Promise<void> {
    await browser.waitUntil(async () => {
        const state = await getPageShapeState(kind);
        return state.status === 'Preview ready' && state.pageCount > 0 && state.page.width > 100 && state.page.height > 100;
    }, {
        timeout: 30000,
        interval: 500,
        timeoutMsg: `Expected ${kind} preview to render a page shape`
    });
}

async function waitForTextPreviewReady(): Promise<void> {
    await browser.waitUntil(async () => {
        const state = await getNonPagedTextPreviewState();
        return state.flowPreviewCount === 1 && state.text.includes('Markdown text preview');
    }, {
        timeout: 30000,
        interval: 500,
        timeoutMsg: 'Expected Markdown text preview to render'
    });
}

async function waitForPageShape(kind: PreviewKind): Promise<PageShapeState> {
    try {
        await waitForPreviewReady(kind);
        return await getPageShapeState(kind);
    } catch (error) {
        const state = await getPageShapeState(kind);
        throw new Error(`Expected ${kind} page preview shape.\n${JSON.stringify(state, null, 2)}`, {
            cause: error
        });
    }
}

async function waitForNonPagedTextPreview(): Promise<NonPagedTextPreviewState> {
    try {
        await browser.waitUntil(async () => {
            const state = await getNonPagedTextPreviewState();
            return (
                state.flowPreviewCount === 1 &&
                state.pagedPreviewCount === 0 &&
                state.pageControlCount === 0 &&
                state.sideNavButtonCount === 0 &&
                state.zoomInputCount === 0 &&
                !state.overflowsX &&
                state.canScrollY
            );
        }, {
            timeout: 5000,
            interval: 250,
            timeoutMsg: 'Expected Markdown text preview to render without page controls'
        });
    } catch (error) {
        const state = await getNonPagedTextPreviewState();
        throw new Error(`Expected Markdown text preview to render without page controls.\n${JSON.stringify(state, null, 2)}`, {
            cause: error
        });
    }

    return getNonPagedTextPreviewState();
}

async function waitForOdtFallbackNoticeLayout(): Promise<OdtFallbackNoticeLayoutState> {
    try {
        await browser.waitUntil(async () => {
            const state = await getOdtFallbackNoticeLayoutState();
            return (
                state.status === 'Preview ready' &&
                state.flowPreviewCount === 1 &&
                state.pagedPreviewCount === 0 &&
                state.frameCount === 1 &&
                state.noticeHeight > 0 &&
                state.noticeHeight < 56 &&
                state.bodyHeight > state.paneHeight * 0.65 &&
                state.viewportHeight > state.flowPreviewHeight - state.noticeHeight - 40 &&
                state.viewportGap <= 12 &&
                state.frameTopGap <= 2 &&
                state.legacyPaneNoticeCount === 0
            );
        }, {
            timeout: 30000,
            interval: 500,
            timeoutMsg: 'Expected ODT fallback notice to stay compact above the unpaged preview'
        });
    } catch (error) {
        const state = await getOdtFallbackNoticeLayoutState();
        throw new Error(`Expected compact ODT fallback notice layout.\n${JSON.stringify(state, null, 2)}`, {
            cause: error
        });
    }

    return getOdtFallbackNoticeLayoutState();
}

async function getNonPagedTextPreviewState(): Promise<NonPagedTextPreviewState> {
    return browser.execute(() => {
        const flowPreview = document.querySelector<HTMLElement>('.pem-pandoc-flow-preview');
        const flowViewport = document.querySelector<HTMLElement>('.pem-pandoc-flow-preview-viewport');
        const previewBody = document.querySelector<HTMLElement>('.pem-pandoc-preview-body');
        const flowCanScrollY = flowViewport ? flowViewport.scrollHeight > flowViewport.clientHeight + 2 : false;
        const bodyCanScrollY = previewBody ? previewBody.scrollHeight > previewBody.clientHeight + 2 : false;
        return {
            flowPreviewCount: document.querySelectorAll('.pem-pandoc-flow-preview').length,
            pagedPreviewCount: document.querySelectorAll('.pem-pandoc-paged-preview').length,
            pageControlCount: document.querySelectorAll('.pem-pandoc-paged-preview-page-controls').length,
            sideNavButtonCount: document.querySelectorAll('.pem-pandoc-paged-preview-side-nav').length,
            zoomInputCount: document.querySelectorAll('.pem-pandoc-paged-preview-zoom-value').length,
            overflowsX: flowViewport ? flowViewport.scrollWidth > flowViewport.clientWidth + 2 : false,
            canScrollY: flowCanScrollY || bodyCanScrollY,
            flowCanScrollY,
            bodyCanScrollY,
            text: flowPreview?.textContent ?? '',
            html: document.querySelector('.pem-pandoc-preview-body')?.innerHTML.slice(0, 2000) ?? ''
        };
    });
}

async function getOdtFallbackNoticeLayoutState(): Promise<OdtFallbackNoticeLayoutState> {
    return browser.execute(() => {
        const pane = document.querySelector<HTMLElement>('.pem-pandoc-preview-pane');
        const header = document.querySelector<HTMLElement>('.pem-pandoc-preview-header');
        const flowPreview = document.querySelector<HTMLElement>('.pem-pandoc-flow-preview');
        const notice = document.querySelector<HTMLElement>('.pem-pandoc-flow-preview-notice');
        const viewport = document.querySelector<HTMLElement>('.pem-pandoc-flow-preview-viewport');
        const body = document.querySelector<HTMLElement>('.pem-pandoc-preview-body');
        const frame = document.querySelector<HTMLElement>('.pem-pandoc-flow-preview-frame');
        const paneRect = pane?.getBoundingClientRect();
        const headerRect = header?.getBoundingClientRect();
        const flowPreviewRect = flowPreview?.getBoundingClientRect();
        const noticeRect = notice?.getBoundingClientRect();
        const viewportRect = viewport?.getBoundingClientRect();
        const bodyRect = body?.getBoundingClientRect();
        const frameRect = frame?.getBoundingClientRect();

        return {
            status: document.querySelector('.pem-pandoc-preview-status')?.textContent ?? '',
            noticeText: notice?.textContent ?? '',
            noticeHeight: noticeRect?.height ?? 0,
            headerHeight: headerRect?.height ?? 0,
            bodyHeight: bodyRect?.height ?? 0,
            paneHeight: paneRect?.height ?? 0,
            flowPreviewHeight: flowPreviewRect?.height ?? 0,
            viewportHeight: viewportRect?.height ?? 0,
            viewportGap: noticeRect && viewportRect ? Math.round((viewportRect.top - noticeRect.bottom) * 100) / 100 : 0,
            frameTopGap: viewportRect && frameRect ? Math.round((frameRect.top - viewportRect.top) * 100) / 100 : 0,
            flowPreviewCount: document.querySelectorAll('.pem-pandoc-flow-preview').length,
            pagedPreviewCount: document.querySelectorAll('.pem-pandoc-paged-preview').length,
            frameCount: document.querySelectorAll('.pem-pandoc-flow-preview-frame').length,
            legacyPaneNoticeCount: document.querySelectorAll('.pem-pandoc-preview-fallback-notice').length,
            html: pane?.outerHTML.slice(0, 3000) ?? ''
        };
    });
}

async function getPreviewFrameworkState(): Promise<PreviewFrameworkState> {
    return browser.execute(() => {
        const pane = document.querySelector<HTMLElement>('.pem-pandoc-preview-pane');
        const body = document.querySelector<HTMLElement>('.pem-pandoc-preview-body');
        const paneRect = pane?.getBoundingClientRect();
        const bodyRect = body?.getBoundingClientRect();

        return {
            bodyHeight: bodyRect?.height ?? 0,
            paneHeight: paneRect?.height ?? 0,
            flowPreviewCount: document.querySelectorAll('.pem-pandoc-flow-preview').length,
            pagedPreviewCount: document.querySelectorAll('.pem-pandoc-paged-preview').length,
            fallbackNoticeCount: document.querySelectorAll('.pem-pandoc-flow-preview-notice').length +
                document.querySelectorAll('.pem-pandoc-preview-fallback-notice').length,
            html: pane?.outerHTML.slice(0, 2000) ?? ''
        };
    });
}

async function getPageShapeState(kind: PreviewKind): Promise<PageShapeState> {
    return browser.execute((previewKind: PreviewKind) => {
        const status = document.querySelector('.pem-pandoc-preview-status')?.textContent ?? '';

        if (previewKind === 'docx') {
            const pages = Array.from(document.querySelectorAll<HTMLElement>(
                '.pem-pandoc-docx-page-shell'
            ));
            return shapeState(status, pages, '', docxContentState(pages));
        }

        if (previewKind === 'odt') {
            const frame = document.querySelector('iframe.pem-pandoc-odt-preview') as HTMLIFrameElement | null;
            const frameDocument = frame?.contentDocument;
            const pages = Array.from(frameDocument?.querySelectorAll<HTMLElement>('.odf-page-shell') ?? []);
            const visiblePages = pages.filter(isVisiblePage);
            const frameRect = frame?.getBoundingClientRect();
            const frameStyle = frame ? window.getComputedStyle(frame) : undefined;
            return {
                status,
                pageCount: pages.length,
                visiblePageCount: visiblePages.length,
                page: {
                    width: frameRect?.width ?? 0,
                    height: frameRect?.height ?? 0,
                    ratio: frameRect && frameRect.height > 0 ? frameRect.width / frameRect.height : 0,
                    background: frameStyle?.backgroundColor ?? '',
                    shadow: frameStyle?.boxShadow ?? ''
                },
                content: odtContentState(visiblePages[0] ?? pages[0]),
                html: frameDocument?.body.outerHTML ?? ''
            };
        }

        if (previewKind === 'pdf') {
            const pages = Array.from(document.querySelectorAll<HTMLElement>('.pem-pandoc-pdf-page'));
            return shapeState(status, pages);
        }

        const pages = Array.from(document.querySelectorAll<HTMLElement>('.pem-pandoc-pptx-page-shell'));
        const canvas = document.querySelector<HTMLCanvasElement>('.pem-pandoc-pptx-canvas');
        const canvasStyle = canvas ? window.getComputedStyle(canvas) : undefined;
        return {
            ...shapeState(status, pages),
            canvas: canvas && canvasStyle ? {
                cssWidth: Number.parseFloat(canvasStyle.width),
                cssHeight: Number.parseFloat(canvasStyle.height),
                widthAttribute: canvas.width,
                heightAttribute: canvas.height,
                transform: canvasStyle.transform
            } : undefined
        };

        function shapeState(
            currentStatus: string,
            elements: HTMLElement[],
            html = '',
            content?: PageShapeState['content']
        ): PageShapeState {
            const visibleElements = elements.filter(isVisiblePage);
            const element = visibleElements[0] ?? elements[0];
            const rect = element?.getBoundingClientRect();
            const elementWindow = element?.ownerDocument.defaultView ?? window;
            const style = element ? elementWindow.getComputedStyle(element) : undefined;
            return {
                status: currentStatus,
                pageCount: elements.length,
                visiblePageCount: visibleElements.length,
                page: {
                    width: rect?.width ?? 0,
                    height: rect?.height ?? 0,
                    ratio: rect && rect.height > 0 ? rect.width / rect.height : 0,
                    background: style?.backgroundColor ?? '',
                    shadow: style?.boxShadow ?? ''
                },
                content,
                html: html || document.querySelector('.pem-pandoc-preview-body')?.innerHTML.slice(0, 2000) || ''
            };
        }

        function isVisiblePage(element: HTMLElement): boolean {
            const rect = element.getBoundingClientRect();
            const style = (element.ownerDocument.defaultView ?? window).getComputedStyle(element);
            return !element.hidden && style.display !== 'none' && rect.width > 0 && rect.height > 0;
        }

        function docxContentState(pages: HTMLElement[]): PageShapeState['content'] {
            const page = pages.find(isVisiblePage) ?? pages[0];
            if (!page) return undefined;

            const viewport = page.querySelector<HTMLElement>('.pem-pandoc-docx-page-viewport');
            const text = page.querySelector<HTMLElement>('p, h1, h2, h3, span');
            const pageRect = page.getBoundingClientRect();
            const textRect = (viewport ?? text)?.getBoundingClientRect();
            const style = text ? window.getComputedStyle(text) : undefined;
            return {
                leftInset: textRect ? textRect.left - pageRect.left : 0,
                topInset: textRect ? textRect.top - pageRect.top : 0,
                background: style?.backgroundColor ?? ''
            };
        }

        function odtContentState(page: HTMLElement | undefined): PageShapeState['content'] {
            if (!page) return undefined;

            const pageDocument = page.ownerDocument;
            const pageWindow = pageDocument.defaultView ?? window;
            const pageRect = page.getBoundingClientRect();
            const viewport = page.querySelector<HTMLElement>('.odf-page-content-viewport');
            const content = page.querySelector<HTMLElement>('.odf-page-content');
            const contentRect = viewport?.getBoundingClientRect();
            const target = viewport ?? content ?? page;
            const style = pageWindow.getComputedStyle(target);
            return {
                leftInset: contentRect ? contentRect.left - pageRect.left : 0,
                topInset: contentRect ? contentRect.top - pageRect.top : 0,
                background: style.backgroundColor,
                ...paintedBackgroundAt(
                    page,
                    pageRect.left + pageRect.width * 0.5,
                    pageRect.top + pageRect.height * 0.08
                )
            };
        }

        function paintedBackgroundAt(
            page: HTMLElement,
            x: number,
            y: number
        ): Pick<NonNullable<PageShapeState['content']>, 'paintedBackground' | 'paintedElement'> {
            const pageDocument = page.ownerDocument;
            const pageWindow = pageDocument.defaultView ?? window;
            let element = pageDocument.elementFromPoint(x, y) as HTMLElement | null;
            while (element && element !== page.parentElement) {
                const background = pageWindow.getComputedStyle(element).backgroundColor;
                if (background && background !== 'rgba(0, 0, 0, 0)') {
                    return {
                        paintedBackground: background,
                        paintedElement: `${element.tagName}.${Array.from(element.classList).join('.')}`,
                        paintedLocalName: element.localName,
                        paintedNamespace: element.namespaceURI ?? '',
                        paintedNodeName: element.nodeName,
                        paintedStyle: element.getAttribute('style') ?? ''
                    };
                }
                element = element.parentElement;
            }
            return {
                paintedBackground: '',
                paintedElement: ''
            };
        }
    }, kind);
}

async function getOdtFrameArchitectureState(): Promise<OdtFrameArchitectureState> {
    return browser.execute(() => {
        const frame = document.querySelector('iframe.pem-pandoc-odt-preview') as HTMLIFrameElement | null;
        const frameDocument = frame?.contentDocument;
        const pages = Array.from(frameDocument?.querySelectorAll<HTMLElement>('.odf-page-shell') ?? []);
        const obsoleteWrapperCount = document.querySelectorAll(
            '.pem-pandoc-scrollable-page.pem-pandoc-odt-page-preview'
        ).length;
        const internalShadowedPageCount = pages.filter(page => {
            const style = frameDocument?.defaultView?.getComputedStyle(page);
            return Boolean(style?.boxShadow && style.boxShadow !== 'none');
        }).length;
        const internalGrayPageCount = pages.filter(page => {
            const style = frameDocument?.defaultView?.getComputedStyle(page);
            return Boolean(style?.backgroundColor && ![
                'rgba(0, 0, 0, 0)',
                'transparent'
            ].includes(style.backgroundColor));
        }).length;
        const visiblePages = pages.filter(page => {
            const style = frameDocument?.defaultView?.getComputedStyle(page);
            const rect = page.getBoundingClientRect();
            return !page.hidden && style?.display !== 'none' && rect.width > 0 && rect.height > 0;
        });

        return {
            previewFrameCount: document.querySelectorAll('iframe.pem-pandoc-odt-preview').length,
            obsoleteWrapperCount,
            internalPageCount: pages.length,
            internalVisiblePageCount: visiblePages.length,
            internalShadowedPageCount,
            internalGrayPageCount,
            html: frameDocument?.body.outerHTML.slice(0, 3000) ?? ''
        };
    });
}

async function getOdtPageSwitchState(): Promise<OdtPageSwitchState> {
    return browser.execute(() => {
        const frame = document.querySelector('iframe.pem-pandoc-odt-preview') as HTMLIFrameElement | null;
        const frameDocument = frame?.contentDocument;
        const pages = Array.from(frameDocument?.querySelectorAll<HTMLElement>('.odf-page-shell') ?? []);
        const visiblePages = pages
            .map((page, index) => ({ page, index }))
            .filter(({ page }) => {
                const style = frameDocument?.defaultView?.getComputedStyle(page);
                const rect = page.getBoundingClientRect();
                return !page.hidden && style?.display !== 'none' && rect.width > 0 && rect.height > 0;
            });
        const visiblePage = visiblePages[0]?.page;

        return {
            pageCount: pages.length,
            visiblePageIndex: visiblePages[0]?.index ?? -1,
            visiblePageCount: visiblePages.length,
            visibleText: visiblePage && frameDocument ? renderedTextInPageSlice(frameDocument, visiblePage) : ''
        };

        function renderedTextInPageSlice(pageDocument: Document, page: HTMLElement): string {
            const viewport = page.querySelector<HTMLElement>('.odf-page-content-viewport');
            const content = page.querySelector<HTMLElement>('.odf-page-content');
            if (!viewport || !content) return '';

            const viewportRect = viewport.getBoundingClientRect();
            const walker = pageDocument.createTreeWalker(content, NodeFilter.SHOW_TEXT);
            const values: string[] = [];
            let node = walker.nextNode();
            while (node) {
                const text = node.textContent?.trim() ?? '';
                if (text) {
                    const range = pageDocument.createRange();
                    range.selectNodeContents(node);
                    const isVisible = Array.from(range.getClientRects()).some(rect => (
                        rect.width > 1 &&
                        rect.height > 3 &&
                        rect.bottom > viewportRect.top &&
                        rect.top < viewportRect.bottom
                    ));
                    if (isVisible) values.push(text);
                    range.detach();
                }
                node = walker.nextNode();
            }
            return values.join(' ').replace(/\s+/g, ' ').slice(0, 500);
        }
    });
}

async function getOdtTextClipState(): Promise<OdtTextClipState> {
    return browser.execute(() => {
        const frame = document.querySelector('iframe.pem-pandoc-odt-preview') as HTMLIFrameElement | null;
        const frameDocument = frame?.contentDocument;
        const pages = Array.from(frameDocument?.querySelectorAll<HTMLElement>('.odf-page-shell') ?? []);
        const clippedLines: OdtTextClipState['clippedLines'] = [];

        for (const [pageIndex, page] of pages.entries()) {
            const viewport = page.querySelector<HTMLElement>('.odf-page-content-viewport');
            const content = page.querySelector<HTMLElement>('.odf-page-content');
            if (!viewport || !content) continue;

            const viewportRect = viewport.getBoundingClientRect();
            const walker = frameDocument?.createTreeWalker(content, NodeFilter.SHOW_TEXT);
            let node = walker?.nextNode();
            while (node) {
                const text = node.textContent?.trim() ?? '';
                if (text) {
                    const range = frameDocument?.createRange();
                    range?.selectNodeContents(node);
                    for (const rect of Array.from(range?.getClientRects() ?? [])) {
                        if (isClippedLineRect(rect, viewportRect)) {
                            clippedLines.push({
                                pageIndex,
                                text: text.slice(0, 80),
                                rectTop: Math.round(rect.top * 100) / 100,
                                rectBottom: Math.round(rect.bottom * 100) / 100,
                                viewportTop: Math.round(viewportRect.top * 100) / 100,
                                viewportBottom: Math.round(viewportRect.bottom * 100) / 100
                            });
                        }
                    }
                    range?.detach();
                }
                node = walker?.nextNode();
            }
        }

        return {
            pageCount: pages.length,
            clippedLines: clippedLines.slice(0, 10),
            html: frameDocument?.body.outerHTML.slice(0, 3000) ?? ''
        };

        function isClippedLineRect(rect: DOMRect, viewportRect: DOMRect): boolean {
            if (rect.width <= 1 || rect.height <= 3) return false;
            if (rect.bottom <= viewportRect.top + 0.5 || rect.top >= viewportRect.bottom - 0.5) return false;
            return rect.top < viewportRect.top - 0.5 || rect.bottom > viewportRect.bottom + 0.5;
        }
    });
}

async function setPreviewPage(pageNumber: number): Promise<void> {
    await browser.execute((nextPage: number) => {
        const input = document.querySelector<HTMLInputElement>('.pem-pandoc-paged-preview-page-controls input');
        if (!input) {
            throw new Error('Preview page input was not found.');
        }
        input.value = String(nextPage);
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }, pageNumber);
}

async function hoverPreviewSide(side: 'left' | 'right'): Promise<void> {
    const zone = await browser.$(`.pem-pandoc-paged-preview-side-nav-zone.is-${side}`);
    await zone.moveTo();
}

async function getSideNavState(): Promise<SideNavState> {
    return browser.execute(() => {
        const host = document.querySelector<HTMLElement>('.pem-pandoc-paged-preview');
        const viewport = document.querySelector<HTMLElement>('.pem-pandoc-paged-preview-viewport-shell');
        const scrollViewport = document.querySelector<HTMLElement>('.pem-pandoc-paged-preview-viewport');
        const previous = document.querySelector<HTMLButtonElement>('.pem-pandoc-paged-preview-side-nav.is-left');
        const next = document.querySelector<HTMLButtonElement>('.pem-pandoc-paged-preview-side-nav.is-right');
        const total = document.querySelector<HTMLElement>('.pem-pandoc-paged-preview-page-total');

        if (!host || !viewport || !scrollViewport || !previous || !next) {
            throw new Error('Preview side navigation was not found.');
        }

        return {
            pageCount: Number.parseInt(total?.textContent?.replace(/\D+/g, '') ?? '1', 10),
            hostRect: rectState(host.getBoundingClientRect()),
            viewportRect: rectState(viewport.getBoundingClientRect()),
            viewportScrollLeft: scrollViewport.scrollLeft,
            previous: buttonState(previous),
            next: buttonState(next)
        };

        function buttonState(button: HTMLButtonElement): SideNavButtonState {
            const style = window.getComputedStyle(button);
            return {
                disabled: button.disabled,
                opacity: style.opacity,
                pointerEvents: style.pointerEvents,
                rect: rectState(button.getBoundingClientRect()),
                svgCount: button.querySelectorAll('svg').length,
                text: button.textContent ?? ''
            };
        }

        function rectState(rect: DOMRect): RectState {
            return {
                left: rect.left,
                right: rect.right,
                width: rect.width
            };
        }
    });
}

async function scrollPreviewViewportHorizontally(): Promise<SideNavState> {
    await browser.execute(() => {
        const viewport = document.querySelector<HTMLElement>('.pem-pandoc-paged-preview-viewport');
        if (!viewport) {
            throw new Error('Preview scroll viewport was not found.');
        }
        viewport.scrollLeft = viewport.scrollWidth;
    });
    return getSideNavState();
}

async function waitForPreviewFit(): Promise<PreviewFitState> {
    try {
        await browser.waitUntil(async () => {
            const state = await getPreviewFitState();
            return state.zoomValue === '100%' && !state.overflowsX && !state.overflowsY;
        }, {
            timeout: 5000,
            interval: 250,
            timeoutMsg: 'Expected initial 100% preview to fit inside the viewport'
        });
    } catch (error) {
        const state = await getPreviewFitState();
        throw new Error(`Expected initial 100% preview to fit inside the viewport.\n${JSON.stringify(state, null, 2)}`, {
            cause: error
        });
    }

    return getPreviewFitState();
}

async function getPreviewFitState(): Promise<PreviewFitState> {
    return browser.execute(() => {
        const host = document.querySelector<HTMLElement>('.pem-pandoc-paged-preview');
        const viewport = document.querySelector<HTMLElement>('.pem-pandoc-paged-preview-viewport');
        const zoomInput = document.querySelector<HTMLInputElement>('.pem-pandoc-paged-preview-zoom-value');
        if (!host || !viewport || !zoomInput) {
            throw new Error('Preview fit controls were not found.');
        }

        return {
            zoomValue: zoomInput.value,
            fitScale: host.style.getPropertyValue('--pem-pandoc-preview-fit-scale'),
            appliedZoom: host.style.getPropertyValue('--pem-pandoc-preview-zoom'),
            overflowsX: viewport.scrollWidth > viewport.clientWidth + 2,
            overflowsY: viewport.scrollHeight > viewport.clientHeight + 2,
            viewport: {
                clientWidth: viewport.clientWidth,
                clientHeight: viewport.clientHeight,
                scrollWidth: viewport.scrollWidth,
                scrollHeight: viewport.scrollHeight
            },
            html: document.querySelector('.pem-pandoc-preview-body')?.innerHTML.slice(0, 2000) ?? ''
        };
    });
}

async function executeCommandBySuffix(suffix: string): Promise<void> {
    await browser.execute(async (commandSuffix: string) => {
        // @ts-ignore
        const commands = app.commands.commands ?? {};
        const commandId = Object.keys(commands).find(id =>
            id === commandSuffix || id.endsWith(`:${commandSuffix}`)
        );
        if (!commandId) {
            throw new Error(`Command not registered: ${commandSuffix}`);
        }

        const command = commands[commandId];
        if (typeof command.callback === 'function') {
            await command.callback();
            return;
        }

        // @ts-ignore
        await app.commands.executeCommandById(commandId);
    }, suffix);
}

async function waitForActiveFile(path: string): Promise<void> {
    await browser.waitUntil(async () => {
        return browser.execute((filePath: string) => {
            // @ts-ignore
            return app.workspace.getActiveFile()?.path === filePath;
        }, path);
    }, {
        timeout: 5000,
        timeoutMsg: `Expected active file ${path}`
    });
}

async function waitForExportModal(): Promise<void> {
    await browser.waitUntil(async () => await hasExportModal(), {
        timeout: 5000,
        timeoutMsg: 'Expected Pandoc export modal to open'
    });
}

async function hasExportModal(): Promise<boolean> {
    return browser.execute(() => {
        return Array.from(document.querySelectorAll('.modal-title'))
            .some(title => title.textContent === 'Export with pandoc');
    });
}

async function closePandocExportModal(): Promise<void> {
    await browser.execute(() => {
        const modalTitle = Array.from(document.querySelectorAll('.modal-title'))
            .find(title => title.textContent === 'Export with pandoc');
        const modal = modalTitle?.closest('.modal');
        const closeButton = modal?.querySelector('.modal-close-button') as HTMLButtonElement | undefined;
        closeButton?.click();
    });
}

async function createOrReplaceBinaryFile(path: string, base64: string): Promise<void> {
    await browser.execute(async (filePath: string, data: string) => {
        const binary = Uint8Array.from(atob(data), char => char.charCodeAt(0));
        // @ts-ignore
        await app.vault.adapter.writeBinary(filePath, binary.buffer);
    }, path, base64);
}

async function installWebOdfAddonForE2E(): Promise<string | undefined> {
    const scriptPath = resolve(addonInstallPath, `webodf.js-${webOdfVersion}`, 'webodf.js');
    try {
        await access(scriptPath);
        return addonInstallPath;
    } catch {
        // Continue with install.
    }

    try {
        const archive = await downloadWebOdfArchive();
        const checksum = createHash('sha256').update(archive).digest('hex');
        if (checksum !== webOdfSha256) {
            throw new Error('Downloaded WebODF archive checksum did not match.');
        }

        await rm(addonInstallPath, { recursive: true, force: true });
        await extractWebOdfArchive(archive);
        return addonInstallPath;
    } catch (error) {
        console.warn(`Skipping ODT page preview E2E: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
    }
}

async function downloadWebOdfArchive(): Promise<Uint8Array> {
    const response = await fetch(webOdfUrl);
    if (!response.ok) {
        throw new Error(`WebODF download failed with status ${response.status}.`);
    }

    return new Uint8Array(await response.arrayBuffer());
}

async function extractWebOdfArchive(archive: Uint8Array): Promise<void> {
    const entries = unzipSync(archive);
    for (const [entryPath, content] of Object.entries(entries)) {
        if (entryPath.endsWith('/')) continue;

        const outputPath = safeAddonEntryPath(entryPath);
        if (!outputPath) continue;

        await mkdir(dirname(outputPath), { recursive: true });
        await writeFile(outputPath, content);
    }
}

function safeAddonEntryPath(entryPath: string): string | undefined {
    const parts = entryPath
        .split(/[\\/]/)
        .filter(part => part.length > 0 && part !== '.' && part !== '..');
    if (parts.length === 0) return undefined;

    const outputPath = resolve(addonInstallPath, ...parts);
    if (outputPath !== addonInstallPath && !outputPath.startsWith(`${addonInstallPath}${sep}`)) {
        throw new Error(`Unsafe WebODF archive path: ${entryPath}`);
    }

    return outputPath;
}
