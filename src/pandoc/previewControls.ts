import { setTooltip } from 'obsidian';

export interface PreviewPagerOptions {
    pageLabel?: string;
    initialPageCount?: number;
    onPageChange?: (pageIndex: number) => void;
}

export class PreviewPager {
    readonly host: HTMLElement;
    readonly viewportShell: HTMLElement;
    readonly viewport: HTMLElement;
    readonly stage: HTMLElement;

    private readonly pageInput: HTMLInputElement;
    private readonly pageTotalEl: HTMLElement;
    private readonly previousButton: HTMLButtonElement;
    private readonly nextButton: HTMLButtonElement;
    private readonly zoomValueEl: HTMLElement;
    private readonly pageLabel: string;
    private readonly onPageChange?: (pageIndex: number) => void;
    private pageIndex = 0;
    private pageCount: number;
    private zoom = 1;

    constructor(container: HTMLElement, options: PreviewPagerOptions = {}) {
        this.pageLabel = options.pageLabel ?? 'Page';
        this.pageCount = Math.max(1, options.initialPageCount ?? 1);
        this.onPageChange = options.onPageChange;
        this.host = container.createDiv({ cls: 'pem-pandoc-paged-preview' });

        const toolbar = this.createToolbar(container);
        const zoomControls = toolbar.left.createDiv({ cls: 'pem-pandoc-paged-preview-zoom' });
        this.createButton(zoomControls, '-', 'Zoom out', () => this.setZoom(this.zoom - 0.1));
        this.zoomValueEl = zoomControls.createEl('span', { cls: 'pem-pandoc-paged-preview-zoom-value' });
        this.createButton(zoomControls, '+', 'Zoom in', () => this.setZoom(this.zoom + 0.1));

        const pageControls = toolbar.center.createDiv({ cls: 'pem-pandoc-paged-preview-page-controls' });
        pageControls.createEl('span', {
            cls: 'pem-pandoc-paged-preview-page-label',
            text: this.pageLabel
        });
        this.pageInput = pageControls.createEl('input', {
            attr: {
                'aria-label': `${this.pageLabel} number`,
                min: '1',
                type: 'number',
                value: '1'
            }
        });
        this.pageTotalEl = pageControls.createEl('span', { cls: 'pem-pandoc-paged-preview-page-total' });

        this.viewportShell = this.host.createDiv({ cls: 'pem-pandoc-paged-preview-viewport-shell' });
        this.viewport = this.viewportShell.createDiv({ cls: 'pem-pandoc-paged-preview-viewport' });
        this.stage = this.viewport.createDiv({ cls: 'pem-pandoc-paged-preview-stage' });
        const sideNavOverlay = this.viewportShell.createDiv({
            cls: 'pem-pandoc-paged-preview-side-nav-overlay'
        });
        const previousZone = sideNavOverlay.createDiv({
            cls: 'pem-pandoc-paged-preview-side-nav-zone is-left'
        });
        const nextZone = sideNavOverlay.createDiv({
            cls: 'pem-pandoc-paged-preview-side-nav-zone is-right'
        });

        this.previousButton = this.createSideNavButton(previousZone, 'left', `Previous ${this.pageLabel.toLowerCase()}`, () => {
            this.setPage(this.pageIndex - 1);
        });
        this.nextButton = this.createSideNavButton(nextZone, 'right', `Next ${this.pageLabel.toLowerCase()}`, () => {
            this.setPage(this.pageIndex + 1);
        });
        this.viewportShell.onmousemove = event => this.updateSideNavigation(event);
        this.viewportShell.onmouseleave = () => {
            this.host.classList.remove('is-hovering-left', 'is-hovering-right');
        };

        this.pageInput.onchange = () => {
            const requestedPage = Number.parseInt(this.pageInput.value, 10);
            this.setPage(Number.isFinite(requestedPage) ? requestedPage - 1 : this.pageIndex);
        };
        this.pageInput.onkeydown = event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.pageInput.blur();
                this.pageInput.dispatchEvent(new Event('change'));
            }
        };

        this.update();
    }

    get currentPageIndex(): number {
        return this.pageIndex;
    }

    get totalPages(): number {
        return this.pageCount;
    }

    setPageCount(pageCount: number): void {
        const normalizedPageCount = Number.isFinite(pageCount) ? Math.floor(pageCount) : 1;
        this.pageCount = Math.max(1, normalizedPageCount);
        this.setPage(this.pageIndex, false);
    }

    setPage(pageIndex: number, emit = true): void {
        const nextPage = Math.max(0, Math.min(this.pageCount - 1, Math.floor(pageIndex)));
        const changed = nextPage !== this.pageIndex;
        this.pageIndex = nextPage;
        this.update();
        if (emit && (changed || this.pageCount === 1)) {
            this.onPageChange?.(this.pageIndex);
        }
    }

    clearStage(): void {
        this.stage.empty();
    }

    private setZoom(zoom: number): void {
        this.zoom = Math.max(0.4, Math.min(2.5, Math.round(zoom * 10) / 10));
        this.update();
    }

    private update(): void {
        this.host.style.setProperty('--pem-pandoc-preview-zoom', this.zoom.toFixed(2));
        this.zoomValueEl.textContent = `${Math.round(this.zoom * 100)}%`;
        this.pageInput.max = String(this.pageCount);
        this.pageInput.value = String(this.pageIndex + 1);
        this.pageTotalEl.textContent = `of ${this.pageCount}`;
        this.previousButton.disabled = this.pageIndex <= 0;
        this.nextButton.disabled = this.pageIndex >= this.pageCount - 1;
        this.previousButton.setAttribute('aria-disabled', String(this.previousButton.disabled));
        this.nextButton.setAttribute('aria-disabled', String(this.nextButton.disabled));
    }

    private createToolbar(container: HTMLElement): { left: HTMLElement; center: HTMLElement } {
        const pane = container.closest('.pem-pandoc-preview-pane');
        const left = pane?.querySelector<HTMLElement>('.pem-pandoc-preview-toolbar-left');
        const center = pane?.querySelector<HTMLElement>('.pem-pandoc-preview-toolbar-center');
        if (left && center) {
            left.replaceChildren();
            center.replaceChildren();
            this.host.classList.add('has-external-toolbar');
            return { left, center };
        }

        const fallback = this.host.createDiv({ cls: 'pem-pandoc-paged-preview-topbar' });
        return {
            left: fallback.createDiv({ cls: 'pem-pandoc-preview-toolbar-left' }),
            center: fallback.createDiv({ cls: 'pem-pandoc-preview-toolbar-center' })
        };
    }

    private updateSideNavigation(event: MouseEvent): void {
        const rect = this.viewportShell.getBoundingClientRect();
        const position = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0.5;
        this.host.classList.toggle('is-hovering-left', position <= 0.2);
        this.host.classList.toggle('is-hovering-right', position >= 0.8);
    }

    private createSideNavButton(
        container: HTMLElement,
        direction: 'left' | 'right',
        label: string,
        onClick: () => void
    ): HTMLButtonElement {
        const button = container.createEl('button', {
            cls: `pem-pandoc-paged-preview-side-nav is-${direction}`,
            attr: { 'aria-label': label }
        });
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.setAttribute('aria-hidden', 'true');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', direction === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6');
        svg.appendChild(path);
        button.appendChild(svg);
        setTooltip(button, label);
        button.onclick = onClick;
        return button;
    }

    private createButton(
        container: HTMLElement,
        text: string,
        label: string,
        onClick: () => void
    ): HTMLButtonElement {
        const button = container.createEl('button', { text, attr: { 'aria-label': label } });
        setTooltip(button, label);
        button.onclick = onClick;
        return button;
    }
}
