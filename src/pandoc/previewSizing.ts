const previewSizingObservers = new WeakMap<HTMLElement, ResizeObserver>();

interface DocxPreviewPage {
    page: HTMLElement;
    shell: HTMLElement;
}

export function resetPreviewSizing(container: HTMLElement): void {
    previewSizingObservers.get(container)?.disconnect();
    previewSizingObservers.delete(container);
}

export function installDocxPreviewFit(container: HTMLElement): void {
    resetPreviewSizing(container);

    const preview = container.querySelector<HTMLElement>('.pem-pandoc-docx-preview');
    const wrapper = preview?.querySelector<HTMLElement>('.pem-pandoc-docx-wrapper');
    if (!preview || !wrapper) return;

    const pages = wrapDocxPreviewPages(wrapper);
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

function wrapDocxPreviewPages(wrapper: HTMLElement): DocxPreviewPage[] {
    return Array.from(wrapper.querySelectorAll<HTMLElement>('section.pem-pandoc-docx'))
        .map(page => ({
            page,
            shell: ensureDocxPageShell(wrapper, page)
        }));
}

function ensureDocxPageShell(wrapper: HTMLElement, page: HTMLElement): HTMLElement {
    const parent = page.parentElement;
    if (parent?.classList.contains('pem-pandoc-docx-page-shell')) return parent;

    const shell = document.createElement('div');
    shell.className = 'pem-pandoc-docx-page-shell';
    wrapper.insertBefore(shell, page);
    shell.appendChild(page);
    return shell;
}

function fitDocxPreviewPages(preview: HTMLElement, pages: DocxPreviewPage[]): void {
    const availableWidth = Math.max(1, preview.clientWidth - horizontalPadding(preview));
    const widestPage = Math.max(...pages.map(({ page }) => naturalWidth(page)), 1);
    const scale = Math.min(1, availableWidth / widestPage);

    preview.style.setProperty('--pem-pandoc-docx-page-scale', scale.toFixed(4));
    for (const { page, shell } of pages) {
        shell.style.width = `${Math.ceil(naturalWidth(page) * scale)}px`;
        shell.style.height = `${Math.ceil(naturalHeight(page) * scale)}px`;
    }
}

function naturalWidth(element: HTMLElement): number {
    return Math.max(element.offsetWidth, element.scrollWidth);
}

function naturalHeight(element: HTMLElement): number {
    return Math.max(element.offsetHeight, element.scrollHeight);
}

function horizontalPadding(element: HTMLElement): number {
    const style = window.getComputedStyle(element);
    return cssPixels(style.paddingLeft) + cssPixels(style.paddingRight);
}

function cssPixels(value: string): number {
    const pixels = Number.parseFloat(value);
    return Number.isFinite(pixels) ? pixels : 0;
}
