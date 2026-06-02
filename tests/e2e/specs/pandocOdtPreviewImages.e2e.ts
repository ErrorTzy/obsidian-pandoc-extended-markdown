import { browser, expect } from '@wdio/globals';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { unzipSync } from 'fflate';
import { inflateSync } from 'zlib';
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
const outputDir = resolve('tests/e2e/.tmp/pandoc-odt-preview-images');
const vaultNotePath = 'pandoc-odt-preview-images.md';
const vaultImagePath = 'pandoc-odt-preview-image.png';
const profileId = 'e2e-odt-preview-images';
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
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP4z8Dwn6Hh',
    '/38GEAJBAFHGCXhFlKCCAAAAAElFTkSuQmCC'
].join('');

interface OdtPreviewImageState {
    status: string;
    hasPreview: boolean;
    iframeCount: number;
    odtImageElementCount: number;
    imageBackgroundRuleCount: number;
    brokenHtmlImageCount: number;
    visibleText: string;
    visibleTextElementCount: number;
    previewRect: {
        width: number;
        height: number;
    };
    visibleElementSamples: string[];
    imageLikeElements: string[];
    bodyHtml: string;
    iframeSrcdoc: string;
    html: string;
}

interface PaintedPixelStats {
    width: number;
    height: number;
    nonWhitePixels: number;
    sampledPixels: number;
}

describe('Pandoc ODT preview images', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });
    });

    after(async () => {
        await closePandocExportModal();
        await deleteFileIfExists(vaultNotePath);
        await deleteFileIfExists(vaultImagePath);
        await rm(addonInstallPath, { recursive: true, force: true });
        await rm(outputDir, { recursive: true, force: true });
    });

    it('renders wikilinked image attachments from the generated ODT', async function () {
        const pandocPath = getPandocPath();
        if (!pandocPath) {
            this.skip();
        }

        const installPath = await installWebOdfAddonForE2E();
        if (!installPath) {
            this.skip();
        }

        await rm(outputDir, { recursive: true, force: true });
        await mkdir(outputDir, { recursive: true });
        await createOrReplaceBinaryFile(vaultImagePath, embeddedPngBase64);
        await createOrReplaceFile(vaultNotePath, [
            '# ODT image preview',
            '',
            `![[${vaultImagePath}]]`,
            ''
        ].join('\n'));
        await openFileInActiveLeaf(vaultNotePath);
        await waitForActiveFile(vaultNotePath);
        await configurePandocOdtExport(pandocPath, installPath);

        await executeCommandBySuffix('pandoc-export');
        await waitForExportModal();
        await waitForHydratedOdtImage();

        const state = await getOdtPreviewImageState();
        expect(state.status).toBe('Preview ready');
        expect(state.hasPreview).toBe(true);
        expect(state.iframeCount).toBe(1);
        expect(state.odtImageElementCount).toBeGreaterThan(0);
        expect(state.imageBackgroundRuleCount).toBeGreaterThan(0);
        expect(state.visibleText).toContain('ODT image preview');
        expect(state.visibleTextElementCount).toBeGreaterThan(0);
        expect(state.brokenHtmlImageCount).toBe(0);
        await expectWebOdfFramePainted();
    });
});

function getPandocPath(): string | undefined {
    try {
        const pandocPath = execFileSync('which', ['pandoc'], { encoding: 'utf8' }).trim();
        execFileSync(pandocPath, ['--version'], { stdio: 'ignore' });
        return pandocPath;
    } catch {
        return undefined;
    }
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
        console.warn(`Skipping ODT image preview E2E: ${error instanceof Error ? error.message : String(error)}`);
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

async function configurePandocOdtExport(pandocPath: string, installPath: string): Promise<void> {
    await browser.execute(async (
        executable: string,
        folder: string,
        profile: string,
        addonPath: string,
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
            lastExportProfileId: profile,
            showOverwriteConfirmation: false,
            openOutputFile: false,
            revealOutputFile: false,
            showProgress: false,
            preview: {
                ...(previous.preview ?? {}),
                enabled: true,
                debounceMs: 250,
                odtAddon: {
                    enabled: true,
                    status: 'installed',
                    version: addonVersion,
                    checksum: addonChecksum,
                    installPath: addonPath
                }
            },
            profiles: [{
                id: profile,
                name: 'E2E ODT preview images',
                type: 'pandoc',
                from: 'markdown+wikilinks_title_after_pipe',
                to: 'odt',
                extension: '.odt',
                standalone: false,
                luaFilters: [],
                resourcePaths: [
                    '${currentDir}',
                    '${attachmentFolderPath}',
                    '${vaultDir}'
                ]
            }]
        };

        await plugin.saveSettings();
    }, pandocPath, outputDir, profileId, installPath, webOdfVersion, webOdfSha256);
}

async function createOrReplaceBinaryFile(path: string, base64: string): Promise<void> {
    await browser.execute(async (filePath: string, data: string) => {
        const binary = Uint8Array.from(atob(data), char => char.charCodeAt(0));
        // @ts-ignore
        const existing = app.vault.getAbstractFileByPath(filePath);
        if (existing) {
            // @ts-ignore
            await app.vault.delete(existing);
        }

        // @ts-ignore
        if (typeof app.vault.createBinary === 'function') {
            // @ts-ignore
            await app.vault.createBinary(filePath, binary.buffer);
            return;
        }

        // @ts-ignore
        await app.vault.adapter.writeBinary(filePath, binary.buffer);
    }, path, base64);
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

async function waitForHydratedOdtImage(): Promise<void> {
    try {
        await browser.waitUntil(async () => {
            const state = await getOdtPreviewImageState();
            return state.status === 'Preview ready' &&
                state.hasPreview &&
                state.iframeCount === 1 &&
                state.odtImageElementCount > 0 &&
                state.imageBackgroundRuleCount > 0 &&
                state.visibleText.includes('ODT image preview') &&
                state.visibleTextElementCount > 0 &&
                state.brokenHtmlImageCount === 0;
        }, {
            timeout: 30000,
            interval: 500,
            timeoutMsg: 'Expected ODT preview image to be hydrated from the generated ODT'
        });
    } catch (error) {
        const state = await getOdtPreviewImageState();
        throw new Error(`Expected ODT preview image to be hydrated.\n${JSON.stringify(state, null, 2)}`, {
            cause: error
        });
    }
}

async function getOdtPreviewImageState(): Promise<OdtPreviewImageState> {
    return browser.execute(() => {
        const preview = document.querySelector('iframe.pem-pandoc-odt-preview') as HTMLIFrameElement | null;
        const body = document.querySelector('.pem-pandoc-preview-body');
        const iframes = body ? Array.from(body.querySelectorAll('iframe')) : [];
        const frameDocument = preview?.contentDocument ?? null;
        const odtCanvas = frameDocument?.getElementById('odf-canvas') as HTMLElement | null;
        const odtImageElements = frameDocument ?
            Array.from(frameDocument.getElementsByTagNameNS(
                'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0',
                'image'
            )) :
            [];
        const imageBackgroundRuleCount = frameDocument ?
            Array.from(frameDocument.styleSheets)
                .flatMap(sheet => {
                    try {
                        return Array.from(sheet.cssRules);
                    } catch {
                        return [];
                    }
                })
                .filter(rule => rule.cssText.includes('draw|image') &&
                    rule.cssText.includes('background-image') &&
                    rule.cssText.includes('data:')).length :
            0;
        const previewRect = preview?.getBoundingClientRect();
        const hasVisibleBox = (element: Element): boolean => {
            const elementWindow = element.ownerDocument.defaultView ?? window;
            const style = elementWindow.getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
                return false;
            }
            return Array.from(element.getClientRects())
                .some(rect => rect.width > 0 &&
                    rect.height > 0);
        };
        const visibleTextElements = odtCanvas ?
            Array.from(odtCanvas.getElementsByTagName('*'))
                .filter(element => (element.textContent ?? '').includes('ODT image preview') && hasVisibleBox(element)) :
            [];
        const brokenHtmlImages = frameDocument ?
            Array.from(frameDocument.querySelectorAll('img'))
                .filter(image => !image.complete || image.naturalWidth === 0) :
            [];

        return {
            status: document.querySelector('.pem-pandoc-preview-status')?.textContent ?? '',
            hasPreview: Boolean(preview),
            iframeCount: iframes.length,
            odtImageElementCount: odtImageElements.length,
            imageBackgroundRuleCount,
            brokenHtmlImageCount: brokenHtmlImages.length,
            visibleText: odtCanvas?.innerText?.trim() ?? '',
            visibleTextElementCount: visibleTextElements.length,
            previewRect: {
                width: previewRect?.width ?? 0,
                height: previewRect?.height ?? 0
            },
            visibleElementSamples: Array.from(odtCanvas?.getElementsByTagName('*') ?? [])
                .filter(hasVisibleBox)
                .slice(0, 12)
                .map(element => element.outerHTML.slice(0, 500)),
            imageLikeElements: Array.from(odtCanvas?.getElementsByTagName('*') ?? [])
                .filter(element => /image|picture|png|jpg|jpeg|gif/i.test(element.outerHTML))
                .slice(0, 12)
                .map(element => element.outerHTML.slice(0, 500)),
            bodyHtml: body?.innerHTML.slice(0, 4000) ?? '',
            iframeSrcdoc: iframes[0]?.getAttribute('srcdoc')?.slice(0, 4000) ?? '',
            html: frameDocument?.body.outerHTML.slice(0, 4000) ?? ''
        };
    });
}

async function expectWebOdfFramePainted(): Promise<void> {
    const frame = await $('iframe.pem-pandoc-odt-preview');
    const elementId = await frame.elementId;
    const screenshot = await browser.takeElementScreenshot(elementId);
    const stats = paintedPixelStats(Buffer.from(screenshot, 'base64'));

    expect(stats.width).toBeGreaterThan(100);
    expect(stats.height).toBeGreaterThan(100);
    expect(stats.nonWhitePixels).toBeGreaterThan(1000);
}

function paintedPixelStats(png: Buffer): PaintedPixelStats {
    const image = decodePng(png);
    let nonWhitePixels = 0;
    let sampledPixels = 0;

    for (let offset = 0; offset < image.pixels.length; offset += image.channels) {
        const alpha = image.channels === 4 ? image.pixels[offset + 3] : 255;
        if (alpha === 0) continue;

        sampledPixels += 1;
        const red = image.pixels[offset];
        const green = image.pixels[offset + 1];
        const blue = image.pixels[offset + 2];
        if (red < 245 || green < 245 || blue < 245) nonWhitePixels += 1;
    }

    return {
        width: image.width,
        height: image.height,
        nonWhitePixels,
        sampledPixels
    };
}

function decodePng(png: Buffer): { width: number; height: number; channels: number; pixels: Buffer } {
    const signature = png.subarray(0, 8).toString('hex');
    if (signature !== '89504e470d0a1a0a') {
        throw new Error('Preview screenshot was not a PNG.');
    }

    let offset = 8;
    let width = 0;
    let height = 0;
    let colorType = 0;
    const idatChunks: Buffer[] = [];

    while (offset < png.length) {
        const length = png.readUInt32BE(offset);
        const type = png.subarray(offset + 4, offset + 8).toString('ascii');
        const data = png.subarray(offset + 8, offset + 8 + length);
        offset += 12 + length;

        if (type === 'IHDR') {
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            colorType = data[9];
        } else if (type === 'IDAT') {
            idatChunks.push(data);
        } else if (type === 'IEND') {
            break;
        }
    }

    const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
    if (!width || !height || !channels) {
        throw new Error(`Unsupported PNG screenshot format: colorType=${colorType}.`);
    }

    return {
        width,
        height,
        channels,
        pixels: unfilterPng(inflateSync(Buffer.concat(idatChunks)), width, height, channels)
    };
}

function unfilterPng(data: Buffer, width: number, height: number, channels: number): Buffer {
    const stride = width * channels;
    const output = Buffer.alloc(stride * height);
    let inputOffset = 0;

    for (let y = 0; y < height; y += 1) {
        const filter = data[inputOffset];
        inputOffset += 1;
        const row = data.subarray(inputOffset, inputOffset + stride);
        inputOffset += stride;

        for (let x = 0; x < stride; x += 1) {
            const left = x >= channels ? output[y * stride + x - channels] : 0;
            const up = y > 0 ? output[(y - 1) * stride + x] : 0;
            const upLeft = y > 0 && x >= channels ? output[(y - 1) * stride + x - channels] : 0;
            output[y * stride + x] = (row[x] + pngFilterValue(filter, left, up, upLeft)) & 0xff;
        }
    }

    return output;
}

function pngFilterValue(filter: number, left: number, up: number, upLeft: number): number {
    if (filter === 0) return 0;
    if (filter === 1) return left;
    if (filter === 2) return up;
    if (filter === 3) return Math.floor((left + up) / 2);
    if (filter === 4) return paethPredictor(left, up, upLeft);
    throw new Error(`Unsupported PNG filter: ${filter}.`);
}

function paethPredictor(left: number, up: number, upLeft: number): number {
    const estimate = left + up - upLeft;
    const leftDistance = Math.abs(estimate - left);
    const upDistance = Math.abs(estimate - up);
    const upLeftDistance = Math.abs(estimate - upLeft);

    if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
    if (upDistance <= upLeftDistance) return up;
    return upLeft;
}
