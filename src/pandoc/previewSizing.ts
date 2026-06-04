import {
    DEFAULT_DOCX_PAGE_SIZE,
    pageSizeAt,
    type PreviewPageSize
} from './previewPageMetadata';

const previewSizingObservers = new WeakMap<HTMLElement, ResizeObserver>();
const MAX_TEXT_LINE_BOX_HEIGHT = 120;
const ATOMIC_PREVIEW_LOCAL_NAMES = new Set([
    'canvas', 'embed', 'frame', 'iframe', 'image', 'img', 'object', 'pre', 'svg', 'table', 'video'
]);

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

export interface PreviewFitScaleOptions {
    availableWidth: number;
    availableHeight: number;
    contentWidth: number;
    contentHeight: number;
}

export interface PreviewPaginationBox { top: number; bottom: number; }

export interface PreviewPageSlice { start: number; height: number; }

export function calculateViewportFitScale(options: PreviewFitScaleOptions): number {
    const availableWidth = finitePositive(options.availableWidth);
    const availableHeight = finitePositive(options.availableHeight);
    const contentWidth = finitePositive(options.contentWidth);
    const contentHeight = finitePositive(options.contentHeight);
    if (!availableWidth || !availableHeight || !contentWidth || !contentHeight) return 1;

    return Math.max(0.01, Math.min(availableWidth / contentWidth, availableHeight / contentHeight));
}

export function calculateNaturalPageSlices(
    options: {
        flowStart: number;
        flowEnd: number;
        pageHeight: number;
        unbreakableBoxes?: PreviewPaginationBox[];
    }
): PreviewPageSlice[] {
    const flowStart = Math.max(0, options.flowStart);
    const flowEnd = Math.max(flowStart, options.flowEnd);
    const pageHeight = Math.max(1, options.pageHeight);
    const boxes = normalizePaginationBoxes(options.unbreakableBoxes ?? [], flowStart, flowEnd);
    const slices: PreviewPageSlice[] = [];
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
    const flowEnd = docxFlowEnd(renderedHeight, pageSize, contentRect);
    const slices = calculateNaturalPageSlices({
        flowStart: contentRect.top,
        flowEnd,
        pageHeight: contentRect.height,
        unbreakableBoxes: collectUnbreakableBoxes(page)
    });
    const pages: DocxPreviewPage[] = [];
    const anchor = page.nextSibling;

    for (let pageIndex = 0; pageIndex < slices.length; pageIndex += 1) {
        const slice = slices[pageIndex];
        const fragmentPage = pageIndex === 0 ? page : page.cloneNode(true) as HTMLElement;
        const shell = createDocxPageShell(pageSize);
        const fragment = document.createElement('div');
        fragment.className = 'pem-pandoc-docx-page-fragment';
        const viewport = createDocxPageViewport(contentRect, slice.height);

        applyDocxPageSize(fragment, pageSize, false);
        prepareDocxFragmentPage(fragmentPage, renderedHeight, pageSize, contentRect, slice);
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

function createDocxPageViewport(contentRect: PageContentRect, height: number): HTMLElement {
    const viewport = document.createElement('div');
    viewport.className = 'pem-pandoc-docx-page-viewport';
    viewport.style.left = `${contentRect.left}px`;
    viewport.style.top = `${contentRect.top}px`;
    viewport.style.width = `${contentRect.width}px`;
    viewport.style.height = `${height}px`;
    return viewport;
}

function prepareDocxFragmentPage(
    page: HTMLElement,
    renderedHeight: number,
    pageSize: PreviewPageSize,
    contentRect: PageContentRect,
    slice: PreviewPageSlice
): void {
    applyDocxPageSize(page, pageSize, true);
    page.style.minHeight = `${renderedHeight}px`;
    page.style.transform = `translate(-${Math.floor(contentRect.left)}px, -${
        Math.floor(slice.start)
    }px)`;
}

function renderedDocxHeight(page: HTMLElement, pageSize: PreviewPageSize): number {
    return Math.max(pageSize.heightPx, page.scrollHeight, page.offsetHeight);
}

function fitDocxPreviewPages(preview: HTMLElement, pages: DocxPreviewPage[]): void {
    const scale = 1;
    preview.style.setProperty('--pem-pandoc-docx-page-scale', scale.toFixed(4));
    for (const { pageSize, shell } of pages) {
        shell.style.width = `${Math.ceil(naturalWidth(pageSize))}px`;
        shell.style.height = `${Math.ceil(naturalHeight(pageSize))}px`;
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

function docxFlowEnd(
    renderedHeight: number,
    pageSize: PreviewPageSize,
    contentRect: PageContentRect
): number {
    const bottomMargin = Math.max(0, pageSize.heightPx - contentRect.top - contentRect.height);
    return Math.max(contentRect.top + contentRect.height, renderedHeight - bottomMargin);
}

function collectUnbreakableBoxes(root: HTMLElement): PreviewPaginationBox[] {
    const rootRect = root.getBoundingClientRect();
    return [
        ...collectTextLineBoxes(root, rootRect),
        ...collectAtomicElementBoxes(root, rootRect)
    ];
}

function collectTextLineBoxes(root: HTMLElement, rootRect: DOMRect): PreviewPaginationBox[] {
    const boxes: PreviewPaginationBox[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();

    while (node) {
        if (node.textContent?.trim()) {
            const range = document.createRange();
            range.selectNodeContents(node);
            for (const rect of Array.from(range.getClientRects())) {
                if (rect.height > MAX_TEXT_LINE_BOX_HEIGHT) continue;
                addRectBox(boxes, rect, rootRect);
            }
            range.detach();
        }
        node = walker.nextNode();
    }

    return boxes;
}

function collectAtomicElementBoxes(root: HTMLElement, rootRect: DOMRect): PreviewPaginationBox[] {
    return Array.from(root.querySelectorAll<HTMLElement>('*'))
        .filter(isAtomicPreviewElement)
        .flatMap(element => Array.from(element.getClientRects()))
        .reduce<PreviewPaginationBox[]>((boxes, rect) => {
            addRectBox(boxes, rect, rootRect);
            return boxes;
        }, []);
}

function isAtomicPreviewElement(element: HTMLElement): boolean {
    const localName = element.localName.toLowerCase().split(':').pop() ?? '';
    return ATOMIC_PREVIEW_LOCAL_NAMES.has(localName);
}

function addRectBox(boxes: PreviewPaginationBox[], rect: DOMRect, rootRect: DOMRect): void {
    if (rect.height <= 0.5 || rect.width <= 0.5) return;
    boxes.push({
        top: rect.top - rootRect.top,
        bottom: rect.bottom - rootRect.top
    });
}

function normalizePaginationBoxes(
    boxes: PreviewPaginationBox[],
    flowStart: number,
    flowEnd: number
): PreviewPaginationBox[] {
    return boxes
        .map(box => ({
            top: Math.max(flowStart, box.top),
            bottom: Math.min(flowEnd, box.bottom)
        }))
        .filter(box => box.bottom > box.top + 0.5)
        .sort((first, second) => first.top - second.top || first.bottom - second.bottom);
}

function naturalPageBoundary(
    start: number,
    target: number,
    pageHeight: number,
    boxes: PreviewPaginationBox[]
): number {
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

function finitePositive(value: number): number {
    return Number.isFinite(value) && value > 0 ? value : 0;
}
