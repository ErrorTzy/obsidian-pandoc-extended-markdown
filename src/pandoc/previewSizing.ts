import {
    DEFAULT_DOCX_PAGE_SIZE,
    pageSizeAt,
    type PreviewPageSize
} from './previewPageMetadata';

const previewSizingObservers = new WeakMap<HTMLElement, ResizeObserver>();

interface DocxPreviewPage {
    page: HTMLElement;
    shell: HTMLElement;
    pageSize: PreviewPageSize;
}

interface FixedPreviewPage {
    shell: HTMLElement;
    pageSize: PreviewPageSize;
}

interface PageContentRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

export function resetPreviewSizing(container: HTMLElement): void {
    previewSizingObservers.get(container)?.disconnect();
    previewSizingObservers.delete(container);
}

export function installDocxPreviewFit(
    container: HTMLElement,
    pageSizes: PreviewPageSize[] = []
): void {
    resetPreviewSizing(container);

    const preview = container.querySelector<HTMLElement>('.pem-pandoc-docx-preview');
    const wrapper = preview?.querySelector<HTMLElement>('.pem-pandoc-docx-wrapper');
    if (!preview || !wrapper) return;

    const pages = wrapDocxPreviewPages(wrapper, pageSizes);
    if (pages.length === 0) return;

    const fit = () => {
        fitDocxPreviewPages(preview, pages);
    };
    fit();

    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(fit);
    observer.observe(preview);
    for (const { page } of pages) observer.observe(page);
    previewSizingObservers.set(container, observer);
}

export function installFixedPagePreviewFit(
    container: HTMLElement,
    options: {
        previewSelector: string;
        shellSelector: string;
        scaleProperty: string;
        pageSizes: PreviewPageSize[];
    }
): void {
    resetPreviewSizing(container);

    const preview = container.querySelector<HTMLElement>(options.previewSelector);
    if (!preview) return;

    const pages = Array.from(preview.querySelectorAll<HTMLElement>(options.shellSelector))
        .map((shell, index) => ({
            shell,
            pageSize: pageSizeAt(options.pageSizes, index, DEFAULT_DOCX_PAGE_SIZE)
        }));
    if (pages.length === 0) return;

    const fit = () => {
        fitFixedPreviewPages(preview, pages, options.scaleProperty);
    };
    fit();

    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(fit);
    observer.observe(preview);
    previewSizingObservers.set(container, observer);
}

function wrapDocxPreviewPages(
    wrapper: HTMLElement,
    pageSizes: PreviewPageSize[]
): DocxPreviewPage[] {
    return Array.from(wrapper.querySelectorAll<HTMLElement>('section.pem-pandoc-docx'))
        .flatMap((page, index) => {
            return paginateDocxPreviewPage(wrapper, page, pageSizeAt(pageSizes, index, DEFAULT_DOCX_PAGE_SIZE));
        });
}

function paginateDocxPreviewPage(
    wrapper: HTMLElement,
    page: HTMLElement,
    pageSize: PreviewPageSize
): DocxPreviewPage[] {
    applyDocxPageSize(page, pageSize, true);
    const contentRect = docxContentRect(pageSize);
    const renderedHeight = renderedDocxHeight(page, pageSize);
    const flowHeight = Math.max(contentRect.height, renderedHeight - contentRect.top);
    const pageCount = Math.max(1, Math.ceil(flowHeight / contentRect.height));
    const pages: DocxPreviewPage[] = [];
    const anchor = page.nextSibling;

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
        const fragmentPage = pageIndex === 0 ? page : page.cloneNode(true) as HTMLElement;
        const shell = createDocxPageShell(pageSize);
        const fragment = document.createElement('div');
        fragment.className = 'pem-pandoc-docx-page-fragment';
        const viewport = createDocxPageViewport(contentRect);

        applyDocxPageSize(fragment, pageSize, false);
        prepareDocxFragmentPage(fragmentPage, renderedHeight, pageSize, contentRect, pageIndex);
        wrapper.insertBefore(shell, anchor);
        viewport.appendChild(fragmentPage);
        fragment.appendChild(viewport);
        shell.appendChild(fragment);
        pages.push({
            page: fragmentPage,
            pageSize,
            shell
        });
    }

    return pages;
}

function createDocxPageShell(pageSize: PreviewPageSize): HTMLElement {
    const shell = document.createElement('div');
    shell.className = 'pem-pandoc-docx-page-shell';
    shell.style.aspectRatio = `${pageSize.widthPx} / ${pageSize.heightPx}`;
    return shell;
}

function createDocxPageViewport(contentRect: PageContentRect): HTMLElement {
    const viewport = document.createElement('div');
    viewport.className = 'pem-pandoc-docx-page-viewport';
    viewport.style.left = `${contentRect.left}px`;
    viewport.style.top = `${contentRect.top}px`;
    viewport.style.width = `${contentRect.width}px`;
    viewport.style.height = `${contentRect.height}px`;
    return viewport;
}

function prepareDocxFragmentPage(
    page: HTMLElement,
    renderedHeight: number,
    pageSize: PreviewPageSize,
    contentRect: PageContentRect,
    pageIndex: number
): void {
    applyDocxPageSize(page, pageSize, true);
    page.style.minHeight = `${renderedHeight}px`;
    page.style.transform = `translate(-${Math.floor(contentRect.left)}px, -${
        Math.floor(contentRect.top + pageIndex * contentRect.height)
    }px)`;
}

function renderedDocxHeight(page: HTMLElement, pageSize: PreviewPageSize): number {
    return Math.max(pageSize.heightPx, page.scrollHeight, page.offsetHeight);
}

function fitDocxPreviewPages(preview: HTMLElement, pages: DocxPreviewPage[]): void {
    const availableWidth = Math.max(1, preview.clientWidth - horizontalPadding(preview));
    const widestPage = Math.max(...pages.map(({ pageSize }) => naturalWidth(pageSize)), 1);
    const scale = Math.min(1, availableWidth / widestPage);

    preview.style.setProperty('--pem-pandoc-docx-page-scale', scale.toFixed(4));
    for (const { pageSize, shell } of pages) {
        shell.style.width = `${Math.ceil(naturalWidth(pageSize) * scale)}px`;
        shell.style.height = `${Math.ceil(naturalHeight(pageSize) * scale)}px`;
    }
}

function fitFixedPreviewPages(
    preview: HTMLElement,
    pages: FixedPreviewPage[],
    scaleProperty: string
): void {
    const availableWidth = Math.max(1, preview.clientWidth - horizontalPadding(preview));
    const widestPage = Math.max(...pages.map(({ pageSize }) => naturalWidth(pageSize)), 1);
    const scale = Math.min(1, availableWidth / widestPage);

    preview.style.setProperty(scaleProperty, scale.toFixed(4));
    for (const { pageSize, shell } of pages) {
        shell.style.width = `${Math.ceil(naturalWidth(pageSize) * scale)}px`;
        shell.style.height = `${Math.ceil(naturalHeight(pageSize) * scale)}px`;
    }
}

function applyDocxPageSize(
    page: HTMLElement,
    pageSize: PreviewPageSize,
    includeMargins: boolean
): void {
    page.style.width = `${pageSize.widthPx}px`;
    page.style.minHeight = `${pageSize.heightPx}px`;
    page.style.aspectRatio = `${pageSize.widthPx} / ${pageSize.heightPx}`;
    if (!includeMargins) return;

    const margins = pageSize.marginsPx ?? DEFAULT_DOCX_PAGE_SIZE.marginsPx;
    if (!margins) return;

    page.style.paddingTop = `${margins.top}px`;
    page.style.paddingRight = `${margins.right}px`;
    page.style.paddingBottom = `${margins.bottom}px`;
    page.style.paddingLeft = `${margins.left}px`;
}

function docxContentRect(pageSize: PreviewPageSize): PageContentRect {
    const margins = pageSize.marginsPx ?? DEFAULT_DOCX_PAGE_SIZE.marginsPx ?? {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
    };
    const left = clampInset(margins.left, pageSize.widthPx);
    const right = clampInset(margins.right, pageSize.widthPx - left);
    const top = clampInset(margins.top, pageSize.heightPx);
    const bottom = clampInset(margins.bottom, pageSize.heightPx - top);
    return {
        left,
        top,
        width: Math.max(1, pageSize.widthPx - left - right),
        height: Math.max(1, pageSize.heightPx - top - bottom)
    };
}

function clampInset(value: number, available: number): number {
    return Math.max(0, Math.min(value, Math.max(0, available - 1)));
}

function naturalWidth(pageSize: PreviewPageSize): number {
    return Math.max(1, pageSize.widthPx);
}

function naturalHeight(pageSize: PreviewPageSize): number {
    return Math.max(1, pageSize.heightPx);
}

function horizontalPadding(element: HTMLElement): number {
    const style = window.getComputedStyle(element);
    return cssPixels(style.paddingLeft) + cssPixels(style.paddingRight);
}

function cssPixels(value: string): number {
    const pixels = Number.parseFloat(value);
    return Number.isFinite(pixels) ? pixels : 0;
}
