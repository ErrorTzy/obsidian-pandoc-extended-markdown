import type { OdtPreviewAddonSettings } from './types';
import {
    installFixedPagePreviewFit,
    installDocxPreviewFit,
    resetPreviewSizing
} from './previewSizing';
import {
    DEFAULT_ODT_PAGE_SIZE,
    DEFAULT_PPTX_PAGE_SIZE,
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
    const iframe = request.container.createEl('iframe', {
        cls: 'pem-pandoc-preview-frame',
        attr: {
            sandbox: '',
            title: 'Pandoc export preview'
        }
    });
    iframe.srcdoc = await request.readText(request.filePath);
}

async function renderTextPreview(request: PandocPreviewRenderRequest): Promise<void> {
    const text = await request.readText(request.filePath);
    request.container.createEl('pre', { cls: 'pem-pandoc-preview-text' })
        .createEl('code')
        .setText(text);
}

async function renderPdfPreview(request: PandocPreviewRenderRequest): Promise<void> {
    await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = await request.readBinary(request.filePath);
    const loadingTask = pdfjs.getDocument({ data });
    const document = await loadingTask.promise;
    const pages = request.container.createDiv({ cls: 'pem-pandoc-pdf-pages' });

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.35 });
        const outputScale = window.devicePixelRatio || 1;
        const canvas = pages.createEl('canvas', { cls: 'pem-pandoc-pdf-page' });
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas rendering is unavailable.');
        await page.render({
            canvasContext: context,
            viewport,
            transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined
        }).promise;
    }
}

async function renderDocxPreview(request: PandocPreviewRenderRequest): Promise<void> {
    const { renderAsync } = await import('docx-preview');
    const data = await request.readBinary(request.filePath);
    const pageSizes = extractDocxPageSizes(data);
    const wrapper = request.container.createDiv({ cls: 'pem-pandoc-docx-preview' });
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
}

async function renderEpubPreview(request: PandocPreviewRenderRequest): Promise<void> {
    const epub = (await import('epubjs')).default;
    const data = await request.readBinary(request.filePath);
    const frame = request.container.createDiv({ cls: 'pem-pandoc-epub-preview' });
    const controls = frame.createDiv({ cls: 'pem-pandoc-preview-controls' });
    const previous = controls.createEl('button', { text: 'Previous' });
    const next = controls.createEl('button', { text: 'Next' });
    const viewport = frame.createDiv({ cls: 'pem-pandoc-epub-viewport' });
    const book = epub(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
    const rendition = book.renderTo(viewport, {
        width: '100%',
        height: '100%',
        spread: 'none'
    });
    previous.onclick = () => { void rendition.prev(); };
    next.onclick = () => { void rendition.next(); };
    await rendition.display();
}

async function renderPptxPreview(request: PandocPreviewRenderRequest): Promise<void> {
    const { PPTXViewer } = await import('pptxviewjs');
    const data = await request.readBinary(request.filePath);
    const pageSize = extractPptxPageSize(data) ?? DEFAULT_PPTX_PAGE_SIZE;
    const frame = request.container.createDiv({ cls: 'pem-pandoc-pptx-preview' });
    const controls = frame.createDiv({ cls: 'pem-pandoc-preview-controls' });
    const counter = controls.createEl('span', { cls: 'pem-pandoc-preview-counter' });
    const pages = frame.createDiv({ cls: 'pem-pandoc-pptx-pages' });
    const viewer = new PPTXViewer({
        slideSizeMode: 'fit',
        autoRenderFirstSlide: false
    });
    await viewer.loadFile(data);

    const slideCount = Math.max(1, viewer.getSlideCount());
    counter.setText(`${slideCount} ${slideCount === 1 ? 'slide' : 'slides'}`);
    for (let slideIndex = 0; slideIndex < slideCount; slideIndex += 1) {
        const shell = pages.createDiv({ cls: 'pem-pandoc-pptx-page-shell' });
        applyPageSizeStyle(shell, pageSize);
        const canvas = shell.createEl('canvas', { cls: 'pem-pandoc-pptx-canvas' });
        applyPageSizeStyle(canvas, pageSize);
        canvas.style.width = `${pageSize.widthPx}px`;
        canvas.style.height = `${pageSize.heightPx}px`;
        await viewer.render(canvas, { quality: 'high', slideIndex });
    }
    installFixedPagePreviewFit(request.container, {
        previewSelector: '.pem-pandoc-pptx-pages',
        shellSelector: '.pem-pandoc-pptx-page-shell',
        scaleProperty: '--pem-pandoc-pptx-page-scale',
        pageSizes: Array.from({ length: slideCount }, () => pageSize)
    });
}

async function renderPagedHtmlPreview(request: PandocPreviewRenderRequest): Promise<void> {
    const html = await request.readText(request.filePath);
    const pageSize = request.renderer.pageSize ?? DEFAULT_ODT_PAGE_SIZE;
    const iframe = request.container.createEl('iframe', {
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
    const frame = request.container.createEl('iframe', {
        cls: 'pem-pandoc-odt-preview',
        attr: {
            sandbox: 'allow-scripts allow-same-origin',
            title: 'Odt preview'
        }
    });

    await renderOdtInWebOdfFrame(frame, script, data, pageSize);
}

function applyPageSizeStyle(element: HTMLElement, pageSize: PreviewPageSize): void {
    element.style.setProperty('--pem-pandoc-page-width', `${pageSize.widthPx}px`);
    element.style.setProperty('--pem-pandoc-page-height', `${pageSize.heightPx}px`);
    element.style.aspectRatio = `${pageSize.widthPx} / ${pageSize.heightPx}`;
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
): Promise<void> {
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
            resolve();
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
    text: string;
}

interface WebOdfFrameErrorMessage extends WebOdfFrameBaseMessage {
    type: 'error';
    message: string;
}

type WebOdfFrameMessage = WebOdfFrameReadyMessage | WebOdfFrameErrorMessage;

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
    color: #000;
    margin: 0;
    min-height: 100%;
}
html {
    background: #f3f3f3;
}
body {
    background: #f3f3f3;
    box-sizing: border-box;
    font-family: sans-serif;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 12px;
}
#odf-viewport {
    box-sizing: border-box;
    min-height: calc(100vh - 24px);
    overflow: hidden;
}
#odf-pages {
    display: grid;
    gap: 14px;
    justify-content: center;
    transform-origin: top left;
    width: ${pageWidth};
}
.odf-page-shell {
    background: #fff !important;
    box-shadow: 0 1px 8px rgba(0, 0, 0, 0.18);
    box-sizing: border-box;
    margin: 0 auto;
    overflow: hidden;
    position: relative;
    width: ${pageWidth};
    height: ${pageHeight};
}
.odf-page-content-viewport {
    background: #fff !important;
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
        viewport.style.height = '';
        const availableWidth = Math.max(1, viewport.clientWidth);
        const naturalWidth = ${pageSize.widthPx.toFixed(6)};
        const naturalHeight = Math.max(${pageSize.heightPx.toFixed(6)}, pages.scrollHeight, pages.offsetHeight, 1);
        const scale = Math.min(1, availableWidth / naturalWidth);
        const scaledWidth = naturalWidth * scale;
        const horizontalInset = Math.max(0, (availableWidth - scaledWidth) / 2);
        pages.style.marginLeft = \`\${Math.floor(horizontalInset)}px\`;
        pages.style.marginRight = \`\${Math.floor(horizontalInset)}px\`;
        pages.style.transform = \`scale(\${scale})\`;
        viewport.style.height = \`\${Math.ceil(naturalHeight * scale)}px\`;
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
        const flowHeight = Math.max(contentHeight, renderedHeight - contentTop);
        const pageCount = Math.max(1, Math.ceil(flowHeight / contentHeight));
        const pages = document.createElement('div');
        pages.id = 'odf-pages';

        for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
            const shell = document.createElement('div');
            shell.className = 'odf-page-shell';
            shell.style.aspectRatio = \`\${pageWidth} / \${pageHeight}\`;
            const viewport = document.createElement('div');
            viewport.className = 'odf-page-content-viewport';
            viewport.style.left = \`\${contentLeft}px\`;
            viewport.style.top = \`\${contentTop}px\`;
            viewport.style.width = \`\${contentWidth}px\`;
            viewport.style.height = \`\${contentHeight}px\`;

            const page = element.cloneNode(true);
            if (pageIndex === 0) {
                page.id = 'odf-canvas';
            } else {
                page.removeAttribute('id');
            }
            page.classList.add('odf-page-content');
            page.style.minHeight = \`\${renderedHeight}px\`;
            page.style.transform = \`translate(-\${Math.floor(contentLeft)}px, -\${
                Math.floor(contentTop + pageIndex * contentHeight)
            }px)\`;
            applyOdtPaperBackground(page);
            viewport.appendChild(page);
            shell.appendChild(viewport);
            pages.appendChild(shell);
        }

        element.replaceWith(pages);
        pages.dataset.pemOdtPageCount = String(pageCount);
        return pages;
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
                fitOdtPreview(paginateOdtPreview(element));
                report({ type: 'ready', text, imageCount: images.length });
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
