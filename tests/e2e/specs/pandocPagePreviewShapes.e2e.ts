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

type PreviewKind = 'docx' | 'odt' | 'pptx';

interface PageShapeState {
    status: string;
    pageCount: number;
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
        expect(state.content?.leftInset).toBeGreaterThan(state.page.width * 0.07);
        expect(state.content?.topInset).toBeGreaterThan(state.page.height * 0.05);
        expect(state.content?.secondLeftInset).toBeGreaterThan(state.page.width * 0.07);
        expect(state.content?.secondTopInset).toBeGreaterThan(state.page.height * 0.05);
    });

    it('renders WebODF preview inside a page-shaped canvas', async function () {
        await openPreviewFor('odt', this);
        const state = await waitForPageShape('odt');

        expect(state.pageCount).toBeGreaterThan(1);
        expect(state.page.ratio).toBeCloseTo(8.5 / 11, 1);
        expect(state.page.background).toBe('rgb(255, 255, 255)');
        expect(state.page.shadow).not.toBe('none');
        expect(state.content?.background).toBe('rgb(255, 255, 255)');
        if (state.content?.paintedBackground !== 'rgb(255, 255, 255)') {
            throw new Error(`Expected white ODT page paint.\n${JSON.stringify(state.content, null, 2)}`);
        }
        expect(state.content?.paintedBackground).toBe('rgb(255, 255, 255)');
        expect(state.content?.leftInset).toBeGreaterThan(state.page.width * 0.07);
        expect(state.content?.topInset).toBeGreaterThan(state.page.height * 0.05);
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
    await waitForPreviewReady(kind);
}

function markdownForPreview(kind: PreviewKind): string {
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
                ]
            }]
        };

        await plugin.saveSettings();
    }, pandocPath, outputDir, `${profileBaseId}-${kind}`, kind, `.${kind}`, addonPath, webOdfVersion, webOdfSha256);
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
            return shapeState(status, pages, frameDocument?.body.outerHTML ?? '', odtContentState(pages[0]));
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
            const element = elements[0];
            const rect = element?.getBoundingClientRect();
            const elementWindow = element?.ownerDocument.defaultView ?? window;
            const style = element ? elementWindow.getComputedStyle(element) : undefined;
            return {
                status: currentStatus,
                pageCount: elements.length,
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

        function docxContentState(pages: HTMLElement[]): PageShapeState['content'] {
            const page = pages[0];
            if (!page) return undefined;

            const secondPage = pages[1];
            const viewport = page.querySelector<HTMLElement>('.pem-pandoc-docx-page-viewport');
            const secondViewport = secondPage?.querySelector<HTMLElement>('.pem-pandoc-docx-page-viewport');
            const text = page.querySelector<HTMLElement>('p, h1, h2, h3, span');
            const pageRect = page.getBoundingClientRect();
            const textRect = (viewport ?? text)?.getBoundingClientRect();
            const secondPageRect = secondPage?.getBoundingClientRect();
            const secondTextRect = secondViewport?.getBoundingClientRect();
            const style = text ? window.getComputedStyle(text) : undefined;
            return {
                leftInset: textRect ? textRect.left - pageRect.left : 0,
                topInset: textRect ? textRect.top - pageRect.top : 0,
                secondLeftInset: secondPageRect && secondTextRect ? secondTextRect.left - secondPageRect.left : 0,
                secondTopInset: secondPageRect && secondTextRect ? secondTextRect.top - secondPageRect.top : 0,
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
