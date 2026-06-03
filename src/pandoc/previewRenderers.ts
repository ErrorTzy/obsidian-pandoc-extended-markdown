import type { OdtPreviewAddonSettings } from './types';
import {
    installDocxPreviewFit,
    resetPreviewSizing
} from './previewSizing';

export type PandocPreviewRendererKind =
    | 'html'
    | 'text'
    | 'pdf'
    | 'docx'
    | 'epub'
    | 'pptx'
    | 'odt-addon'
    | 'odt-pandoc-fallback'
    | 'unsupported';

export interface PandocPreviewRenderer {
    kind: PandocPreviewRendererKind;
    label: string;
    addonInstallPath?: string;
    addonVersion?: string;
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
    const wrapper = request.container.createDiv({ cls: 'pem-pandoc-docx-preview' });
    await renderAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), wrapper, undefined, {
        className: 'pem-pandoc-docx',
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        renderHeaders: true,
        renderFooters: true
    });
    installDocxPreviewFit(request.container);
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
    const frame = request.container.createDiv({ cls: 'pem-pandoc-pptx-preview' });
    const controls = frame.createDiv({ cls: 'pem-pandoc-preview-controls' });
    const previous = controls.createEl('button', { text: 'Previous' });
    const counter = controls.createEl('span', { cls: 'pem-pandoc-preview-counter' });
    const next = controls.createEl('button', { text: 'Next' });
    const canvas = frame.createEl('canvas', { cls: 'pem-pandoc-pptx-canvas' });
    const viewer = new PPTXViewer({ canvas, slideSizeMode: 'fit' });
    await viewer.loadFile(data);

    const updateCounter = () => {
        counter.setText(`${viewer.getCurrentSlideIndex() + 1} / ${Math.max(1, viewer.getSlideCount())}`);
    };
    previous.onclick = async () => {
        await viewer.previousSlide(canvas);
        updateCounter();
    };
    next.onclick = async () => {
        await viewer.nextSlide(canvas);
        updateCounter();
    };
    await viewer.render(canvas, { quality: 'high' });
    updateCounter();
}

async function renderOdtAddonPreview(request: PandocPreviewRenderRequest): Promise<void> {
    const installPath = request.renderer.addonInstallPath;
    if (!installPath) {
        throw new Error('ODT preview add-on path is missing.');
    }

    const script = await readWebOdfScript(installPath, request.renderer.addonVersion, request.readText);
    const data = await request.readBinary(request.filePath);
    const frame = request.container.createEl('iframe', {
        cls: 'pem-pandoc-odt-preview',
        attr: {
            sandbox: 'allow-scripts allow-same-origin',
            title: 'Odt preview'
        }
    });

    await renderOdtInWebOdfFrame(frame, script, data);
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
    data: Uint8Array
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
        frame.srcdoc = webOdfFrameSource(token, script, bytesToBase64(data));
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
    odtBase64: string
): string {
    const documentUrl = `pandoc-preview-odt://${token}`;
    const sourceUrl = pathToFileUrl(script.path);

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
html, body {
    background: #fff;
    color: #000;
    margin: 0;
    min-height: 100%;
}
body {
    box-sizing: border-box;
    font-family: sans-serif;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 12px;
}
#odf-viewport {
    min-height: calc(100vh - 24px);
    overflow: hidden;
}
#odf-canvas {
    margin: 0 auto;
    min-height: calc(100vh - 24px);
    transform-origin: top left;
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
        const viewport = element.parentElement;
        if (!viewport) return;

        element.style.marginLeft = '';
        element.style.marginRight = '';
        element.style.transform = '';
        viewport.style.height = '';
        const availableWidth = Math.max(1, viewport.clientWidth);
        const naturalWidth = Math.max(element.scrollWidth, element.offsetWidth, 1);
        const naturalHeight = Math.max(element.scrollHeight, element.offsetHeight, 1);
        const scale = Math.min(1, availableWidth / naturalWidth);
        const scaledWidth = naturalWidth * scale;
        const horizontalInset = Math.max(0, (availableWidth - scaledWidth) / 2);
        element.style.marginLeft = \`\${Math.floor(horizontalInset)}px\`;
        element.style.marginRight = \`\${Math.floor(horizontalInset)}px\`;
        element.style.transform = \`scale(\${scale})\`;
        viewport.style.height = \`\${Math.ceil(naturalHeight * scale)}px\`;
    };
    const scheduleOdtFit = element => {
        window.requestAnimationFrame(() => fitOdtPreview(element));
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
