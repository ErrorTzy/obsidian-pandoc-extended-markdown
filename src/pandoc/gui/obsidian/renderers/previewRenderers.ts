import {
    selectPreviewRendererPlan
} from '../../../core';
import type {
    OdtPreviewAddonSettings,
    PandocPreviewRendererPlan
} from '../../../core';
import { PreviewPager } from './previewControls';
import {
    installDocxPreviewFit,
    resetPreviewSizing
} from './previewSizing';
import {
    DEFAULT_PPTX_PAGE_SIZE,
    DEFAULT_DOCX_PAGE_SIZE,
    extractDocxPageSizes,
    extractPptxPageSize,
    type PreviewPageSize
} from './previewPageMetadata';
import {
    renderOdtAddonPreview
} from './previewOdtRenderer';

const ODT_FALLBACK_PREVIEW_NOTICE = 'This preview is a fallback. Download odt support in plugin settings for the recommended renderer.';

export type {
    PandocPreviewRendererKind
} from '../../../core';

export interface PandocPreviewRenderer extends PandocPreviewRendererPlan {
    pageSize?: PreviewPageSize;
    sourcePath?: string;
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

export function selectPreviewRenderer(
    toFormat: string,
    extension: string,
    odtAddon?: OdtPreviewAddonSettings
): PandocPreviewRenderer {
    return selectPreviewRendererPlan(toFormat, extension, odtAddon);
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
    const viewport = createFlowPreview(
        request.container,
        'pem-pandoc-html-flow-preview',
        flowPreviewNoticeFor(request.renderer)
    );
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

function createFlowPreview(container: HTMLElement, cls: string, noticeText?: string): HTMLElement {
    clearPagerToolbar(container);
    const preview = container.createDiv({
        cls: `pem-pandoc-flow-preview ${cls}${noticeText ? ' has-notice' : ''}`
    });
    if (noticeText) {
        preview.createEl('div', {
            cls: 'pem-pandoc-flow-preview-notice',
            text: noticeText,
            attr: { 'aria-live': 'polite' }
        });
    }

    return preview.createDiv({ cls: 'pem-pandoc-flow-preview-viewport' });
}

function flowPreviewNoticeFor(renderer: PandocPreviewRenderer): string | undefined {
    if (
        renderer.kind === 'html' &&
        renderer.label === 'ODT fallback preview' &&
        renderer.sourcePath?.toLowerCase().endsWith('.odt')
    ) {
        return ODT_FALLBACK_PREVIEW_NOTICE;
    }

    return undefined;
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

function renderUnsupportedPreview(container: HTMLElement, label: string): void {
    container.createEl('p', {
        cls: 'pem-pandoc-preview-message',
        text: `${label}. Export still works; use an external app to inspect this format.`
    });
}
