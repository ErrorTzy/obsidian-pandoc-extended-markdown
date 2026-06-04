import type { OdtPreviewAddonSettings } from './types';
import { PreviewPager } from './previewControls';
import {
    installDocxPreviewFit,
    resetPreviewSizing
} from './previewSizing';
import {
    DEFAULT_ODT_PAGE_SIZE,
    DEFAULT_PPTX_PAGE_SIZE,
    DEFAULT_DOCX_PAGE_SIZE,
    extractDocxPageSizes,
    extractOdtPageSizes,
    extractPptxPageSize,
    pageSizeAt,
    type PreviewPageSize
} from './previewPageMetadata';

export type PandocPreviewRendererKind =
    | 'html'
    | 'text'
    | 'pdf'
    | 'docx'
    | 'epub'
    | 'pptx'
    | 'paged-html'
    | 'odt-addon'
    | 'odt-pandoc-fallback'
    | 'unsupported';

export interface PandocPreviewRenderer {
    kind: PandocPreviewRendererKind;
    label: string;
    addonInstallPath?: string;
    addonVersion?: string;
    pageSize?: PreviewPageSize;
}

export interface PandocPreviewRenderRequest {
    container: HTMLElement;
    filePath: string;
    renderer: PandocPreviewRenderer;
    readText: (path: string) => Promise<string>;
    readBinary: (path: string) => Promise<Uint8Array>;
}

interface EpubFactory {
    (data: ArrayBuffer): EpubBook;
}

interface EpubBook {
    ready: Promise<unknown>;
    locations: {
        cfiFromLocation(location: number): string | undefined;
        generate(chars: number): Promise<unknown>;
        length(): number;
    };
    renderTo(element: HTMLElement, options: {
        height: string;
        spread: string;
        width: string;
    }): EpubRendition;
}

interface EpubRendition {
    display(target?: string): Promise<unknown>;
}

const HTML_FORMATS = new Set([
    'html',
    'html4',
    'html5',
    'revealjs',
    's5',
    'slidy',
    'slideous',
    'dzslides'
]);

const TEXT_EXTENSIONS = new Set([
    '.txt',
    '.md',
    '.markdown',
    '.tex',
    '.typ',
    '.rst',
    '.rtf',
    '.opml',
    '.bib',
    '.mediawiki',
    '.textile',
    '.json',
    '.xml'
]);

export function selectPreviewRenderer(
    toFormat: string,
    extension: string,
    odtAddon?: OdtPreviewAddonSettings
): PandocPreviewRenderer {
    const normalizedFormat = stripFormatExtensions(toFormat);
    const normalizedExtension = normalizeExtension(extension);

    if (normalizedExtension === '.odt' || normalizedFormat === 'odt') {
        if (
            odtAddon?.enabled &&
            odtAddon.status === 'installed' &&
            odtAddon.installPath
        ) {
            return {
                kind: 'odt-addon',
                label: 'ODT add-on preview',
                addonInstallPath: odtAddon.installPath,
                addonVersion: odtAddon.version
            };
        }
        return { kind: 'odt-pandoc-fallback', label: 'ODT fallback preview' };
    }

    if (HTML_FORMATS.has(normalizedFormat) || normalizedExtension === '.html') {
        return { kind: 'html', label: 'HTML preview' };
    }
    if (TEXT_EXTENSIONS.has(normalizedExtension)) {
        return { kind: 'text', label: 'Text preview' };
    }
    if (normalizedExtension === '.pdf' || normalizedFormat === 'pdf') return { kind: 'pdf', label: 'PDF preview' };
    if (normalizedExtension === '.docx' || normalizedFormat === 'docx') return { kind: 'docx', label: 'DOCX preview' };
    if (normalizedExtension === '.epub' || normalizedFormat.startsWith('epub')) return { kind: 'epub', label: 'EPUB preview' };
    if (normalizedExtension === '.pptx' || normalizedFormat === 'pptx') return { kind: 'pptx', label: 'PPTX preview' };

    return { kind: 'unsupported', label: 'Preview unavailable' };
}

export async function renderPreviewFile(request: PandocPreviewRenderRequest): Promise<void> {
    const { container, renderer } = request;
    resetPreviewSizing(container);
    container.empty();
    container.addClass('pem-pandoc-preview-rendered');

    if (renderer.kind === 'html') {
        await renderHtmlPreview(request);
        return;
    }
    if (renderer.kind === 'text') {
        await renderTextPreview(request);
        return;
    }
    if (renderer.kind === 'pdf') {
        await renderPdfPreview(request);
        return;
    }
    if (renderer.kind === 'docx') {
        await renderDocxPreview(request);
        return;
    }
    if (renderer.kind === 'epub') {
        await renderEpubPreview(request);
        return;
    }
    if (renderer.kind === 'pptx') {
        await renderPptxPreview(request);
        return;
    }
    if (renderer.kind === 'paged-html') {
        await renderPagedHtmlPreview(request);
        return;
    }
    if (renderer.kind === 'odt-addon') {
        await renderOdtAddonPreview(request);
        return;
    }

    renderUnsupportedPreview(container, renderer.label);
}

async function renderHtmlPreview(request: PandocPreviewRenderRequest): Promise<void> {
    const viewport = createFlowPreview(request.container, 'pem-pandoc-html-flow-preview');
    const iframe = viewport.createEl('iframe', {
        cls: 'pem-pandoc-preview-frame pem-pandoc-flow-preview-frame',
        attr: {
            sandbox: '',
            title: 'Pandoc export preview'
        }
    });
    iframe.srcdoc = await request.readText(request.filePath);
}

async function renderTextPreview(request: PandocPreviewRenderRequest): Promise<void> {
    const text = await request.readText(request.filePath);
    createFlowPreview(request.container, 'pem-pandoc-text-flow-preview')
        .createEl('pre', { cls: 'pem-pandoc-preview-text pem-pandoc-flow-preview-text' })
        .createEl('code')
        .setText(text);
}

async function renderPdfPreview(request: PandocPreviewRenderRequest): Promise<void> {
    await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = await request.readBinary(request.filePath);
    const loadingTask = pdfjs.getDocument({ data });
    const document = await loadingTask.promise;
    let pager: PreviewPager;
    const renderPage = async (pageIndex: number) => {
        pager.clearStage();
        const page = await document.getPage(pageIndex + 1);
        const viewport = page.getViewport({ scale: 1.35 });
        const outputScale = window.devicePixelRatio || 1;
        const canvas = pager.stage.createEl('canvas', { cls: 'pem-pandoc-pdf-page' });
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
        pager.refreshFit();
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas rendering is unavailable.');
        await page.render({
            canvasContext: context,
            viewport,
            transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined
        }).promise;
    };
    pager = new PreviewPager(request.container, {
        initialPageCount: document.numPages,
        onPageChange: pageIndex => {
            void renderPage(pageIndex);
        }
    });
    pager.setPageCount(document.numPages);

    await renderPage(0);
}

async function renderDocxPreview(request: PandocPreviewRenderRequest): Promise<void> {
    const { renderAsync } = await import('docx-preview');
    const data = await request.readBinary(request.filePath);
    const pageSizes = extractDocxPageSizes(data);
    let pager: PreviewPager;
    const showPage = (pageIndex: number) => {
        showOnlyPage(pager.stage, '.pem-pandoc-docx-page-shell', pageIndex);
        pager.refreshFit();
    };
    pager = new PreviewPager(request.container, { onPageChange: showPage });
    const wrapper = pager.stage.createDiv({ cls: 'pem-pandoc-docx-preview' });
    await renderAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), wrapper, undefined, {
        className: 'pem-pandoc-docx',
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        breakPages: true,
        renderHeaders: true,
        renderFooters: true
    });
    installDocxPreviewFit(request.container, pageSizes);
    const pageCount = pager.stage.querySelectorAll('.pem-pandoc-docx-page-shell').length;
    pager.setPageCount(pageCount);
    showPage(pager.currentPageIndex);
}

async function renderEpubPreview(request: PandocPreviewRenderRequest): Promise<void> {
    const epub = (await import('epubjs')).default as EpubFactory;
    const data = await request.readBinary(request.filePath);
    const book = epub(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
    let locationCount = 1;
    let rendition: EpubRendition | undefined;
    const pager = new PreviewPager(request.container, {
        pageLabel: 'Location',
        onPageChange: pageIndex => {
            if (!rendition) return;
            const cfi = book.locations.cfiFromLocation(Math.min(pageIndex, locationCount - 1));
            if (cfi) void rendition.display(cfi);
        }
    });
    const viewport = createScrollablePage(pager, DEFAULT_DOCX_PAGE_SIZE, 'pem-pandoc-epub-viewport');
    rendition = book.renderTo(viewport, {
        width: '100%',
        height: '100%',
        spread: 'none'
    });
    await rendition.display();
    await book.ready;
    await book.locations.generate(1000);
    locationCount = Math.max(1, book.locations.length());
    pager.setPageCount(locationCount);
}

async function renderPptxPreview(request: PandocPreviewRenderRequest): Promise<void> {
    const { PPTXViewer } = await import('pptxviewjs');
    const data = await request.readBinary(request.filePath);
    const pageSize = extractPptxPageSize(data) ?? DEFAULT_PPTX_PAGE_SIZE;
    const viewer = new PPTXViewer({
        slideSizeMode: 'fit',
        autoRenderFirstSlide: false
    });
    await viewer.loadFile(data);

    const slideCount = Math.max(1, viewer.getSlideCount());
    let pager: PreviewPager;
    const renderSlide = async (slideIndex: number) => {
        pager.clearStage();
        const shell = pager.stage.createDiv({ cls: 'pem-pandoc-pptx-page-shell' });
        applyPageSizeStyle(shell, pageSize);
        const canvas = shell.createEl('canvas', { cls: 'pem-pandoc-pptx-canvas' });
        applyPageSizeStyle(canvas, pageSize);
        canvas.style.width = `${pageSize.widthPx}px`;
        canvas.style.height = `${pageSize.heightPx}px`;
        pager.refreshFit();
        await viewer.render(canvas, { quality: 'high', slideIndex });
    };
    pager = new PreviewPager(request.container, {
        pageLabel: 'Slide',
        initialPageCount: slideCount,
        onPageChange: slideIndex => {
            void renderSlide(slideIndex);
        }
    });
    pager.setPageCount(slideCount);

    await renderSlide(0);
}

async function renderPagedHtmlPreview(request: PandocPreviewRenderRequest): Promise<void> {
    const html = await request.readText(request.filePath);
    const pageSize = request.renderer.pageSize ?? DEFAULT_ODT_PAGE_SIZE;
    const pager = new PreviewPager(request.container);
    const page = createScrollablePage(pager, pageSize, 'pem-pandoc-paged-html-page-preview');
    const iframe = page.createEl('iframe', {
        cls: 'pem-pandoc-preview-frame pem-pandoc-paged-html-preview',
        attr: {
            sandbox: '',
            title: 'Pandoc paged export preview'
        }
    });
    iframe.srcdoc = pagedHtmlSource(html, pageSize);
}

async function renderOdtAddonPreview(request: PandocPreviewRenderRequest): Promise<void> {
    const installPath = request.renderer.addonInstallPath;
    if (!installPath) {
        throw new Error('ODT preview add-on path is missing.');
    }

    const script = await readWebOdfScript(installPath, request.renderer.addonVersion, request.readText);
    const data = await request.readBinary(request.filePath);
    const pageSize = pageSizeAt(extractOdtPageSizes(data), 0, DEFAULT_ODT_PAGE_SIZE);
    let pager: PreviewPager;
    let frame: HTMLIFrameElement;
    const showPage = (pageIndex: number) => {
        if (!frame) return;
        frame.contentWindow?.postMessage({
            token: frame.dataset.pemOdtToken,
            type: 'set-page',
            pageIndex
        }, '*');
    };
    pager = new PreviewPager(request.container, { onPageChange: showPage });
    frame = pager.stage.createEl('iframe', {
        cls: 'pem-pandoc-scrollable-page pem-pandoc-odt-preview',
        attr: {
            sandbox: 'allow-scripts allow-same-origin',
            title: 'Odt preview'
        }
    });
    applyPageSizeStyle(frame, pageSize);
    frame.style.width = `${pageSize.widthPx}px`;
    frame.style.height = `${pageSize.heightPx}px`;
    pager.refreshFit();

    const message = await renderOdtInWebOdfFrame(frame, script, data, pageSize);
    frame.dataset.pemOdtToken = message.token;
    pager.setPageCount(message.pageCount);
    showPage(pager.currentPageIndex);
}

function applyPageSizeStyle(element: HTMLElement, pageSize: PreviewPageSize): void {
    element.style.setProperty('--pem-pandoc-page-width', `${pageSize.widthPx}px`);
    element.style.setProperty('--pem-pandoc-page-height', `${pageSize.heightPx}px`);
    element.style.aspectRatio = `${pageSize.widthPx} / ${pageSize.heightPx}`;
}

function createScrollablePage(
    pager: PreviewPager,
    pageSize: PreviewPageSize,
    cls: string
): HTMLElement {
    const page = pager.stage.createDiv({ cls: `pem-pandoc-scrollable-page ${cls}` });
    applyPageSizeStyle(page, pageSize);
    page.style.width = `${pageSize.widthPx}px`;
    page.style.height = `${pageSize.heightPx}px`;
    pager.refreshFit();
    return page;
}

function createFlowPreview(container: HTMLElement, cls: string): HTMLElement {
    clearPagerToolbar(container);
    return container.createDiv({ cls: `pem-pandoc-flow-preview ${cls}` });
}

function clearPagerToolbar(container: HTMLElement): void {
    const pane = container.closest('.pem-pandoc-preview-pane');
    pane?.querySelector<HTMLElement>('.pem-pandoc-preview-toolbar-left')?.replaceChildren();
    pane?.querySelector<HTMLElement>('.pem-pandoc-preview-toolbar-center')?.replaceChildren();
}

function showOnlyPage(root: HTMLElement, selector: string, pageIndex: number): void {
    Array.from(root.querySelectorAll<HTMLElement>(selector))
        .forEach((page, index) => {
            page.classList.toggle('is-hidden', index !== pageIndex);
        });
}

function pagedHtmlSource(html: string, pageSize: PreviewPageSize): string {
    const parsed = parseHtmlDocument(html);
    const pageWidth = `${pageSize.widthPx.toFixed(2)}px`;
    const pageHeight = `${pageSize.heightPx.toFixed(2)}px`;

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
${parsed.head}
<style>
html {
    background: #f3f3f3;
}
body {
    box-sizing: border-box;
    color: #111;
    margin: 0;
    min-height: 100vh;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 16px;
}
.pem-pandoc-html-page {
    background: #fff;
    box-shadow: 0 1px 8px rgba(0, 0, 0, 0.18);
    box-sizing: border-box;
    margin: 0 auto 16px;
    min-height: ${pageHeight};
    overflow: hidden;
    padding: 48px;
    width: min(100%, ${pageWidth});
}
</style>
</head>
<body>
<main class="pem-pandoc-html-page">
${parsed.body}
</main>
</body>
</html>`;
}

function parseHtmlDocument(html: string): { head: string; body: string } {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    return {
        head: parsed.head?.innerHTML ?? '',
        body: parsed.body?.innerHTML ?? html
    };
}

function renderUnsupportedPreview(container: HTMLElement, label: string): void {
    container.createEl('p', {
        cls: 'pem-pandoc-preview-message',
        text: `${label}. Export still works; use an external app to inspect this format.`
    });
}

function stripFormatExtensions(format: string): string {
    return format.trim().toLowerCase().split(/[+-]/)[0];
}

function normalizeExtension(extension: string): string {
    const trimmed = extension.trim().toLowerCase();
    if (!trimmed) return '';
    return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
}

function pathToFileUrl(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/');
    const prefix = normalized.startsWith('/') ? 'file://' : 'file:///';
    return `${prefix}${encodeURI(normalized)}`;
}

function renderOdtInWebOdfFrame(
    frame: HTMLIFrameElement,
    script: { source: string; path: string },
    data: Uint8Array,
    pageSize: PreviewPageSize
): Promise<WebOdfFrameReadyMessage> {
    return new Promise((resolve, reject) => {
        let settled = false;
        const token = `pandoc-odt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const fail = (error: Error) => {
            if (settled) return;
            settled = true;
            window.removeEventListener('message', onMessage);
            window.clearTimeout(timeout);
            reject(error);
        };
        const done = (message: WebOdfFrameReadyMessage) => {
            if (settled) return;
            settled = true;
            window.removeEventListener('message', onMessage);
            window.clearTimeout(timeout);
            frame.dataset.pemOdtReady = 'true';
            frame.dataset.pemOdtText = message.text;
            frame.dataset.pemOdtImageCount = String(message.imageCount);
            frame.dataset.pemOdtPageCount = String(message.pageCount);
            resolve(message);
        };
        const timeout = window.setTimeout(() => {
            fail(new Error('WebODF loaded the add-on but did not render the ODT preview.'));
        }, 30000);
        const onMessage = (event: MessageEvent<WebOdfFrameMessage>) => {
            if (!event.data || event.data.token !== token) return;
            if (event.data.type === 'ready') done(event.data);
            if (event.data.type === 'error') fail(new Error(event.data.message));
        };

        window.addEventListener('message', onMessage);
        frame.addEventListener('load', () => {
            pollWebOdfFrameState(frame, token, done, fail);
        }, { once: true });
        frame.addEventListener('error', () => {
            fail(new Error('WebODF iframe failed to load.'));
        }, { once: true });
        frame.srcdoc = webOdfFrameSource(token, script, bytesToBase64(data), pageSize);
    });
}

function pollWebOdfFrameState(
    frame: HTMLIFrameElement,
    token: string,
    done: (message: WebOdfFrameReadyMessage) => void,
    fail: (error: Error) => void,
    attemptsRemaining = 120
): void {
    let message: WebOdfFrameMessage | undefined;
    try {
        const frameWindow = frame.contentWindow as (Window & { __pemOdtPreviewState?: WebOdfFrameMessage }) | null;
        if (!frameWindow) {
            fail(new Error('WebODF iframe window is unavailable.'));
            return;
        }
        message = frameWindow.__pemOdtPreviewState;
    } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
        return;
    }

    if (message?.token === token && message.type === 'ready') {
        done(message);
        return;
    }
    if (message?.token === token && message.type === 'error') {
        fail(new Error(message.message));
        return;
    }
    if (attemptsRemaining <= 0) {
        fail(new Error('WebODF loaded the add-on but did not render the ODT preview.'));
        return;
   }

    window.setTimeout(() => {
        pollWebOdfFrameState(frame, token, done, fail, attemptsRemaining - 1);
    }, 500);
}

function bytesToBase64(content: Uint8Array): string {
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < content.length; index += chunkSize) {
        binary += String.fromCharCode(...content.subarray(index, index + chunkSize));
    }

    return btoa(binary);
}

interface WebOdfFrameBaseMessage {
    token: string;
}

interface WebOdfFrameReadyMessage extends WebOdfFrameBaseMessage {
    type: 'ready';
    imageCount: number;
    pageCount: number;
    text: string;
}

interface WebOdfFrameErrorMessage extends WebOdfFrameBaseMessage {
    type: 'error';
    message: string;
}

interface WebOdfFrameSetPageMessage extends WebOdfFrameBaseMessage {
    type: 'set-page';
    pageIndex: number;
}

type WebOdfFrameMessage = WebOdfFrameReadyMessage | WebOdfFrameErrorMessage | WebOdfFrameSetPageMessage;

function webOdfFrameSource(
    token: string,
    script: { source: string; path: string },
    odtBase64: string,
    pageSize: PreviewPageSize
): string {
    const documentUrl = `pandoc-preview-odt://${token}`;
    const sourceUrl = pathToFileUrl(script.path);
    const margins = pageSize.marginsPx ?? { top: 0, right: 0, bottom: 0, left: 0 };
    const contentLeftPx = margins.left;
    const contentTopPx = margins.top + (pageSize.headerHeightPx ?? 0);
    const contentRightPx = margins.right;
    const contentBottomPx = margins.bottom + (pageSize.footerHeightPx ?? 0);
    const contentWidthPx = Math.max(1, pageSize.widthPx - contentLeftPx - contentRightPx);
    const contentHeightPx = Math.max(1, pageSize.heightPx - contentTopPx - contentBottomPx);
    const pageWidth = `${pageSize.widthPx.toFixed(2)}px`;
    const pageHeight = `${pageSize.heightPx.toFixed(2)}px`;
    const contentLeft = `${contentLeftPx.toFixed(2)}px`;
    const contentTop = `${contentTopPx.toFixed(2)}px`;
    const contentWidth = `${contentWidthPx.toFixed(2)}px`;
    const contentHeight = `${contentHeightPx.toFixed(2)}px`;

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
html, body {
    background: #fff;
    color: #000;
    height: 100%;
    margin: 0;
    overflow: hidden;
    width: 100%;
}
body {
    box-sizing: border-box;
    font-family: sans-serif;
    padding: 0;
}
#odf-viewport {
    box-sizing: border-box;
    height: ${pageHeight};
    overflow: hidden;
    width: ${pageWidth};
}
#odf-pages {
    display: block;
    height: ${pageHeight};
    margin: 0;
    width: ${pageWidth};
}
.odf-page-shell {
    background: transparent !important;
    box-shadow: none;
    box-sizing: border-box;
    height: ${pageHeight};
    margin: 0;
    overflow: hidden;
    position: relative;
    width: ${pageWidth};
}
.odf-page-content-viewport {
    background: transparent !important;
    box-sizing: border-box;
    height: ${contentHeight};
    left: ${contentLeft};
    overflow: hidden;
    position: absolute;
    top: ${contentTop};
    width: ${contentWidth};
}
#odf-canvas,
.odf-page-content {
    background: #fff !important;
    box-sizing: border-box;
    min-height: ${pageHeight};
    transform-origin: top left;
    width: ${pageWidth};
}
.odf-page-content {
    left: 0;
    margin: 0;
    position: absolute;
    top: 0;
}
</style>
</head>
<body>
<div id="odf-viewport">
<div id="odf-canvas" aria-label="ODT preview"></div>
</div>
<script>
(() => {
    const token = ${scriptLiteral(token)};
    const documentUrl = ${scriptLiteral(documentUrl)};
    const odtBase64 = ${scriptLiteral(odtBase64)};
    const webOdfSource = ${scriptLiteral(`${script.source}\n//# sourceURL=${sourceUrl}`)};
    const drawNamespace = 'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0';
    const maxTextLineBoxHeight = 120;
    const nonBodyTextAncestors = new Set([
        'automatic-styles',
        'font-face',
        'font-face-decls',
        'graphic-properties',
        'master-styles',
        'meta',
        'page-layout',
        'page-layout-properties',
        'paragraph-properties',
        'style',
        'styles',
        'tab-stops',
        'text-properties'
    ]);
    let currentPageIndex = 0;

    const report = message => {
        const state = { ...message, token };
        window.__pemOdtPreviewState = state;
        window.parent.postMessage(state, '*');
    };
    const fail = error => {
        report({
            type: 'error',
            message: error instanceof Error ? error.message : String(error)
        });
    };
    const bytesFromBase64 = value => {
        const binary = atob(value);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return bytes;
    };
    const installDocument = data => {
        const originalReadFile = runtime.readFile.bind(runtime);
        const originalRead = runtime.read?.bind(runtime);
        runtime.readFile = (path, encoding, callback) => {
            if (path === documentUrl && encoding === 'binary') {
                callback(null, data);
                return;
            }
            originalReadFile(path, encoding, callback);
        };
        if (originalRead) {
            runtime.read = (path, offset, length, callback) => {
                if (path === documentUrl) {
                    callback(null, data.subarray(offset, offset + length));
                    return;
                }
                originalRead(path, offset, length, callback);
            };
        }
    };
    const visibleText = element => (
        element.innerText || element.textContent || ''
    ).replace(/^Loading.*\\.\\.\\.$/, '').trim();
    const fitOdtPreview = element => {
        const pages = element.id === 'odf-pages' ? element : document.getElementById('odf-pages') || element;
        const viewport = pages.parentElement;
        if (!viewport) return;

        pages.style.marginLeft = '';
        pages.style.marginRight = '';
        pages.style.transform = '';
        viewport.style.height = '${pageHeight}';
        if (pages.id === 'odf-pages') applyOdtPageVisibility(pages);
    };
    const applyOdtPageVisibility = pages => {
        const pageElements = Array.from(pages.querySelectorAll('.odf-page-shell'));
        const pageCount = Math.max(1, pageElements.length);
        currentPageIndex = Math.max(0, Math.min(pageCount - 1, currentPageIndex));
        for (const [index, page] of pageElements.entries()) {
            page.hidden = index !== currentPageIndex;
            page.style.display = index === currentPageIndex ? '' : 'none';
        }
        pages.dataset.pemOdtPageCount = String(pageCount);
        return pageCount;
    };
    const scheduleOdtFit = element => {
        window.requestAnimationFrame(() => fitOdtPreview(element));
    };
    const paginateOdtPreview = element => {
        const existingPages = document.getElementById('odf-pages');
        if (existingPages) return existingPages;

        const pageWidth = ${pageSize.widthPx.toFixed(6)};
        const pageHeight = ${pageSize.heightPx.toFixed(6)};
        const contentLeft = ${contentLeftPx.toFixed(6)};
        const contentTop = ${contentTopPx.toFixed(6)};
        const contentWidth = ${contentWidthPx.toFixed(6)};
        const contentHeight = ${contentHeightPx.toFixed(6)};
        const renderedHeight = Math.max(pageHeight, element.scrollHeight, element.offsetHeight, 1);
        const source = element.cloneNode(true);
        const baseBoxes = collectUnbreakableBoxes(element);
        const measuredBoxes = [];
        const flowStart = naturalFlowStart(contentTop, baseBoxes);
        const flowEnd = Math.max(flowStart + contentHeight, renderedHeight);
        let slices = calculateNaturalPageSlices({
            flowStart,
            flowEnd,
            pageHeight: contentHeight,
            unbreakableBoxes: baseBoxes
        });
        let pages = buildOdtPages(source, slices, {
            pageWidth,
            pageHeight,
            contentLeft,
            contentTop,
            contentWidth,
            renderedHeight
        });

        element.replaceWith(pages);
        for (let attempt = 0; attempt < 12; attempt += 1) {
            const clippedLines = clippedTextLines(pages, slices);
            if (clippedLines.length === 0) {
                applyOdtPageVisibility(pages);
                return pages;
            }
            measuredBoxes.push(...clippedLines);
            const refinedFlowStart = naturalFlowStart(flowStart, measuredBoxes);
            slices = calculateNaturalPageSlices({
                flowStart: refinedFlowStart,
                flowEnd,
                pageHeight: contentHeight,
                unbreakableBoxes: [...baseBoxes, ...measuredBoxes]
            });
            const nextPages = buildOdtPages(source, slices, {
                pageWidth,
                pageHeight,
                contentLeft,
                contentTop,
                contentWidth,
                renderedHeight
            });
            pages.replaceWith(nextPages);
            pages = nextPages;
        }

        applyOdtPageVisibility(pages);
        return pages;
    };
    const naturalFlowStart = (fallbackStart, boxes) => {
        return boxes.reduce((start, box) => {
            if (box.top < start - 0.5 && box.bottom > start + 0.5) {
                return Math.max(0, box.top);
            }
            return start;
        }, fallbackStart);
    };
    const buildOdtPages = (source, slices, options) => {
        const pages = document.createElement('div');
        pages.id = 'odf-pages';

        for (let pageIndex = 0; pageIndex < slices.length; pageIndex += 1) {
            const slice = slices[pageIndex];
            const shell = document.createElement('div');
            shell.className = 'odf-page-shell';
            shell.style.aspectRatio = \`\${options.pageWidth} / \${options.pageHeight}\`;
            const viewport = document.createElement('div');
            viewport.className = 'odf-page-content-viewport';
            viewport.style.left = \`\${options.contentLeft}px\`;
            viewport.style.top = \`\${options.contentTop}px\`;
            viewport.style.width = \`\${options.contentWidth}px\`;
            viewport.style.height = \`\${slice.height}px\`;

            const page = source.cloneNode(true);
            if (pageIndex === 0) {
                page.id = 'odf-canvas';
            } else {
                page.removeAttribute('id');
            }
            page.classList.add('odf-page-content');
            page.style.minHeight = \`\${options.renderedHeight}px\`;
            page.style.transform = \`translate(-\${options.contentLeft}px, -\${slice.start}px)\`;
            applyOdtPaperBackground(page);
            viewport.appendChild(page);
            shell.appendChild(viewport);
            pages.appendChild(shell);
        }

        return pages;
    };
    const clippedTextLines = (pages, slices) => {
        const clippedLines = [];
        const seen = new Set();
        const pageElements = Array.from(pages.querySelectorAll('.odf-page-shell'));
        for (const [pageIndex, page] of pageElements.entries()) {
            const viewport = page.querySelector('.odf-page-content-viewport');
            const content = page.querySelector('.odf-page-content');
            const slice = slices[pageIndex];
            if (!viewport || !content || !slice) continue;

            const viewportRect = viewport.getBoundingClientRect();
            const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
            let node = walker.nextNode();
            while (node) {
                if (isRenderableTextNode(node)) {
                    const range = document.createRange();
                    range.selectNodeContents(node);
                    for (const rect of Array.from(range.getClientRects())) {
                        if (!isClippedLineRect(rect, viewportRect)) continue;
                        const line = {
                            top: slice.start + rect.top - viewportRect.top,
                            bottom: slice.start + rect.bottom - viewportRect.top
                        };
                        const key = \`\${Math.round(line.top * 10)}:\${Math.round(line.bottom * 10)}\`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            clippedLines.push(line);
                        }
                    }
                    range.detach();
                }
                node = walker.nextNode();
            }
        }

        return clippedLines;
    };
    const isClippedLineRect = (rect, viewportRect) => {
        if (rect.width <= 1 || rect.height <= 3 || rect.height > maxTextLineBoxHeight) return false;
        if (rect.bottom <= viewportRect.top || rect.top >= viewportRect.bottom) return false;
        return rect.top < viewportRect.top - 0.5 || rect.bottom > viewportRect.bottom + 0.5;
    };
    const calculateNaturalPageSlices = options => {
        const flowStart = Math.max(0, options.flowStart);
        const flowEnd = Math.max(flowStart, options.flowEnd);
        const pageHeight = Math.max(1, options.pageHeight);
        const boxes = normalizePaginationBoxes(options.unbreakableBoxes || [], flowStart, flowEnd);
        const slices = [];
        let current = flowStart;

        while (current < flowEnd - 0.5 && slices.length < 1000) {
            const target = Math.min(current + pageHeight, flowEnd);
            const boundary = target >= flowEnd - 0.5 ?
                target :
                naturalPageBoundary(current, target, pageHeight, boxes);
            const next = boundary > current + 0.5 ? boundary : target;
            slices.push({
                start: current,
                height: Math.max(1, Math.min(pageHeight, next - current))
            });
            current = next;
        }

        return slices.length > 0 ? slices : [{ start: flowStart, height: pageHeight }];
    };
    const collectUnbreakableBoxes = root => {
        const rootRect = root.getBoundingClientRect();
        return [
            ...collectTextLineBoxes(root, rootRect),
            ...collectAtomicElementBoxes(root, rootRect)
        ];
    };
    const collectTextLineBoxes = (root, rootRect) => {
        const boxes = [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();

        while (node) {
            if (isRenderableTextNode(node)) {
                const range = document.createRange();
                range.selectNodeContents(node);
                for (const rect of Array.from(range.getClientRects())) {
                    if (rect.height > maxTextLineBoxHeight) continue;
                    addRectBox(boxes, rect, rootRect);
                }
                range.detach();
            }
            node = walker.nextNode();
        }

        return boxes;
    };
    const isRenderableTextNode = node => {
        if (!node.textContent || !node.textContent.trim()) return false;

        let element = node.parentElement;
        let hasOdtBody = false;
        while (element) {
            const name = odtLocalName(element);
            if (nonBodyTextAncestors.has(name)) return false;
            const nodeName = (element.nodeName || '').toLowerCase();
            const namespace = element.namespaceURI || '';
            if (
                (name === 'body' || name === 'text') &&
                (nodeName.startsWith('office:') || namespace.includes('opendocument'))
            ) {
                hasOdtBody = true;
            }
            element = element.parentElement;
        }

        return hasOdtBody;
    };
    const odtLocalName = element => {
        const localName = (element.localName || '').toLowerCase();
        return localName.includes(':') ? localName.split(':').pop() : localName;
    };
    const collectAtomicElementBoxes = (root, rootRect) => {
        return Array.from(root.querySelectorAll('*'))
            .filter(isAtomicPreviewElement)
            .flatMap(element => Array.from(element.getClientRects()))
            .reduce((boxes, rect) => {
                addRectBox(boxes, rect, rootRect);
                return boxes;
            }, []);
    };
    const isAtomicPreviewElement = element => {
        const localName = (element.localName || '').toLowerCase().split(':').pop() || '';
        return [
            'canvas',
            'embed',
            'frame',
            'iframe',
            'image',
            'img',
            'object',
            'pre',
            'svg',
            'table',
            'video'
        ].includes(localName);
    };
    const addRectBox = (boxes, rect, rootRect) => {
        if (rect.height <= 0.5 || rect.width <= 0.5) return;
        boxes.push({
            top: rect.top - rootRect.top,
            bottom: rect.bottom - rootRect.top
        });
    };
    const normalizePaginationBoxes = (boxes, flowStart, flowEnd) => {
        return boxes
            .map(box => ({
                top: Math.max(flowStart, box.top),
                bottom: Math.min(flowEnd, box.bottom)
            }))
            .filter(box => box.bottom > box.top + 0.5)
            .sort((first, second) => first.top - second.top || first.bottom - second.bottom);
    };
    const naturalPageBoundary = (start, target, pageHeight, boxes) => {
        let boundary = target;

        for (let attempts = 0; attempts < boxes.length; attempts += 1) {
            const crossing = boxes.find(box =>
                box.bottom - box.top <= pageHeight - 0.5 &&
                box.top > start + 0.5 &&
                box.top < boundary - 0.5 &&
                box.bottom > boundary + 0.5
            );
            if (!crossing) return boundary;
            boundary = crossing.top;
        }

        return boundary;
    };
    const applyOdtPaperBackground = page => {
        ensureOdtPaperCss();
        setImportantBackground(page, '#fff');
        for (const element of Array.from(page.querySelectorAll('*'))) {
            if (!isOdtStructuralPaperElement(element)) continue;
            setImportantBackground(element, 'transparent');
        }
    };
    const ensureOdtPaperCss = () => {
        if (document.getElementById('pem-webodf-paper-css')) return;

        const style = document.createElement('style');
        style.id = 'pem-webodf-paper-css';
        style.textContent = [
            '@namespace office url(urn:oasis:names:tc:opendocument:xmlns:office:1.0);',
            '.odf-page-content, #odf-canvas { background: #fff !important; background-color: #fff !important; }',
            '.odf-page-content office|body,',
            '.odf-page-content office|document-content,',
            '.odf-page-content office|text { background: transparent !important; background-color: transparent !important; }'
        ].join('\\n');
        document.head.appendChild(style);
    };
    const setImportantBackground = (element, value) => {
        const style = element.getAttribute('style') || '';
        element.setAttribute(
            'style',
            \`\${style}; background: \${value} !important; background-color: \${value} !important;\`
        );
        element.style?.setProperty?.('background', value, 'important');
        element.style?.setProperty?.('background-color', value, 'important');
    };
    const isOdtStructuralPaperElement = element => {
        const localName = (element.localName || '').toLowerCase();
        const nodeName = (element.nodeName || '').toLowerCase();
        const name = localName.includes(':') ? localName.split(':').pop() : localName;
        if (!name || !['document-content', 'body', 'text'].includes(name)) return false;

        const namespace = element.namespaceURI || '';
        return namespace.includes('opendocument') || nodeName.startsWith('office:');
    };
    const imageBackgroundRuleCount = () => {
        let count = 0;
        for (const sheet of Array.from(document.styleSheets)) {
            let rules;
            try {
                rules = Array.from(sheet.cssRules || []);
            } catch {
                rules = [];
            }
            count += rules.filter(rule => (
                rule.cssText.includes('draw|image') &&
                rule.cssText.includes('background-image') &&
                rule.cssText.includes('data:')
            )).length;
        }
        return count;
    };
    const imageCssSheet = () => {
        let style = document.getElementById('pem-webodf-image-css');
        if (!style) {
            style = document.createElement('style');
            style.id = 'pem-webodf-image-css';
            style.textContent = [
                '@namespace draw url(urn:oasis:names:tc:opendocument:xmlns:drawing:1.0);',
                '@namespace webodfhelper url(urn:webodf:names:helper);'
            ].join('\\n');
            document.head.appendChild(style);
        }
        return style.sheet;
    };
    const cssString = value => value.replace(/["\\\\\\n\\r\\f]/g, '\\\\$&');
    const cssUrl = value => value.replace(/["\\\\\\n\\r\\f]/g, encodeURIComponent);
    const ensureImageCss = canvas => {
        const container = canvas.odfContainer?.();
        if (!container?.getPart) return;
        const sheet = imageCssSheet();
        const images = document.getElementsByTagNameNS(drawNamespace, 'image');

        for (const [index, image] of Array.from(images).entries()) {
            const href = image.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
            if (!href || image.getAttribute('data-pem-image-css-requested') === 'true') continue;
            const styleId = image.getAttributeNS('urn:webodf:names:helper', 'styleid') ||
                image.getAttribute('styleid') ||
                \`pem-image-\${index}\`;
            image.setAttributeNS('urn:webodf:names:helper', 'styleid', styleId);
            image.setAttribute('data-pem-image-css-requested', 'true');
            const part = container.getPart(href);
            part.onchange = loadedPart => {
                if (!loadedPart.url || !sheet) return;
                const selector = \`draw|image[webodfhelper|styleid="\${cssString(styleId)}"], \` +
                    \`draw|image[styleid="\${cssString(styleId)}"]\`;
                sheet.insertRule(
                    \`\${selector} { background-image: url("\${cssUrl(loadedPart.url)}"); }\`,
                    sheet.cssRules.length
                );
            };
            part.load();
        }
    };
    const reportWhenPaintable = (element, canvas) => {
        let requestedImageCss = false;
        const finish = attemptsRemaining => {
            const text = visibleText(element);
            const images = document.getElementsByTagNameNS(drawNamespace, 'image');
            const imageRules = imageBackgroundRuleCount();
            const rect = element.getBoundingClientRect();
            fitOdtPreview(element);
            if (text && rect.width > 0 && rect.height > 0 && (images.length === 0 || imageRules > 0)) {
                const pages = paginateOdtPreview(element);
                const pageCount = applyOdtPageVisibility(pages);
                fitOdtPreview(pages);
                report({ type: 'ready', text, imageCount: images.length, pageCount });
                return;
            }
            if (images.length > 0 && imageRules === 0 && !requestedImageCss) {
                requestedImageCss = true;
                ensureImageCss(canvas);
            }
            if (attemptsRemaining <= 0) {
                fail(new Error('WebODF rendered an empty ODT preview.'));
                return;
            }
            window.setTimeout(() => finish(attemptsRemaining - 1), 250);
        };
        window.setTimeout(() => finish(120), 0);
    };

    try {
        window.addEventListener('error', event => {
            fail(event.error || event.message);
        });
        window.addEventListener('unhandledrejection', event => {
            fail(event.reason || 'Unhandled WebODF promise rejection.');
        });
        window.addEventListener('message', event => {
            const message = event.data || {};
            if (message.token !== token || message.type !== 'set-page') return;
            currentPageIndex = Number.isFinite(message.pageIndex) ? message.pageIndex : currentPageIndex;
            const pages = document.getElementById('odf-pages');
            if (pages) fitOdtPreview(pages);
        });
        (0, eval)(webOdfSource);
        if (!window.odf?.OdfCanvas || !window.runtime?.readFile) {
            throw new Error('WebODF add-on did not expose OdfCanvas.');
        }
        const data = bytesFromBase64(odtBase64);
        installDocument(data);
        const element = document.getElementById('odf-canvas');
        const canvas = new window.odf.OdfCanvas(element);
        window.addEventListener('resize', () => scheduleOdtFit(element));
        canvas.addListener('statereadychange', container => {
            if (container.state === window.odf.OdfContainer.DONE) {
                reportWhenPaintable(element, canvas);
            }
            if (container.state === window.odf.OdfContainer.INVALID) {
                fail(new Error('WebODF could not load the generated ODT preview.'));
            }
        });
        canvas.load(documentUrl);
        window.setTimeout(() => reportWhenPaintable(element, canvas), 0);
    } catch (error) {
        fail(error);
    }
})();
</script>
</body>
</html>`;
}

function scriptLiteral(value: string): string {
    return JSON.stringify(value).replace(/<\/script/gi, '<\\/script');
}

function webOdfScriptCandidates(installPath: string, version?: string): string[] {
    const candidates = version ?
        [`${installPath}/webodf.js-${version}/webodf.js`] :
        [];
    return [...candidates, `${installPath}/webodf.js`];
}

async function readWebOdfScript(
    installPath: string,
    version: string | undefined,
    readText: (path: string) => Promise<string>
): Promise<{ source: string; path: string }> {
    const errors: string[] = [];
    for (const scriptPath of webOdfScriptCandidates(installPath, version)) {
        try {
            return {
                source: await readText(scriptPath),
                path: scriptPath
            };
        } catch (error) {
            errors.push(error instanceof Error ? error.message : String(error));
        }
    }
    throw new Error(`Failed to load WebODF add-on. ${errors.join(' ')}`);
}
