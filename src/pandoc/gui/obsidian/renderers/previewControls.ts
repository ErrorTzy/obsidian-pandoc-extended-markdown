import { setTooltip } from 'obsidian';

import { calculateViewportFitScale } from './previewSizing';

export interface PreviewPagerOptions {
    fitMode?: PreviewFitMode;
    pageLabel?: string;
    initialPageCount?: number;
    onPageChange?: (pageIndex: number) => void;
}

export type PreviewFitMode = 'viewport' | 'width';

interface PreviewContentSize {
    width: number;
    height: number;
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
    private readonly zoomInput: HTMLInputElement;
    private readonly fitMode: PreviewFitMode;
    private readonly pageLabel: string;
    private readonly onPageChange?: (pageIndex: number) => void;
    private resizeObserver?: ResizeObserver;
    private stageObserver?: MutationObserver;
    private fitScale = 1;
    private pageIndex = 0;
    private pageCount: number;
    private zoom = 1;

    constructor(container: HTMLElement, options: PreviewPagerOptions = {}) {
        this.fitMode = options.fitMode ?? 'viewport';
        this.pageLabel = options.pageLabel ?? 'Page';
        this.pageCount = Math.max(1, options.initialPageCount ?? 1);
        this.onPageChange = options.onPageChange;
        this.host = container.createDiv({ cls: 'pem-pandoc-paged-preview' });

        const toolbar = this.createToolbar(container);
        const zoomControls = toolbar.left.createDiv({ cls: 'pem-pandoc-paged-preview-zoom' });
        this.createButton(zoomControls, '-', 'Zoom out', () => this.setZoom(this.zoom - 0.1));
        this.zoomInput = zoomControls.createEl('input', {
            cls: 'pem-pandoc-paged-preview-zoom-value',
            attr: {
                'aria-label': 'Zoom percentage',
                inputmode: 'decimal',
                type: 'text',
                value: '100%'
            }
        });
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
        this.installSideNavigationZoneHover(previousZone, 'left');
        this.installSideNavigationZoneHover(nextZone, 'right');

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
        this.zoomInput.onclick = () => this.zoomInput.select();
        this.zoomInput.onfocus = () => this.zoomInput.select();
        this.zoomInput.onchange = () => this.commitZoomInput();
        this.zoomInput.onkeydown = event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.zoomInput.blur();
                this.commitZoomInput();
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                this.updateZoomInput();
                this.zoomInput.blur();
            }
        };

        this.installFitObservers();
        this.refreshFit();
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
        this.refreshFit();
    }

    refreshFit(): void {
        const availableSize = this.availableViewportSize();
        const contentSize = this.visibleContentSize();
        this.fitScale = calculateViewportFitScale({
            availableWidth: availableSize.width,
            availableHeight: this.fitMode === 'width' ? contentSize.height : availableSize.height,
            contentWidth: contentSize.width,
            contentHeight: contentSize.height
        });
        this.update();
    }

    private setZoom(zoom: number): void {
        this.zoom = Math.max(0.1, Math.min(4, Math.round(zoom * 100) / 100));
        this.update();
    }

    private update(): void {
        const scaledZoom = this.fitScale * this.zoom;
        this.host.style.setProperty('--pem-pandoc-preview-fit-scale', this.fitScale.toFixed(4));
        this.host.style.setProperty('--pem-pandoc-preview-zoom', scaledZoom.toFixed(4));
        if (document.activeElement !== this.zoomInput) {
            this.updateZoomInput();
        }
        this.pageInput.max = String(this.pageCount);
        this.pageInput.value = String(this.pageIndex + 1);
        this.pageTotalEl.textContent = `of ${this.pageCount}`;
        this.previousButton.disabled = this.pageIndex <= 0;
        this.nextButton.disabled = this.pageIndex >= this.pageCount - 1;
        this.previousButton.setAttribute('aria-disabled', String(this.previousButton.disabled));
        this.nextButton.setAttribute('aria-disabled', String(this.nextButton.disabled));
    }

    private commitZoomInput(): void {
        const parsed = parseZoomInput(this.zoomInput.value);
        if (parsed) {
            this.setZoom(parsed);
            return;
        }

        this.updateZoomInput();
    }

    private updateZoomInput(): void {
        this.zoomInput.value = `${Math.round(this.zoom * 100)}%`;
    }

    private installFitObservers(): void {
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => this.refreshFit());
            this.resizeObserver.observe(this.viewport);
        }
        if (typeof MutationObserver !== 'undefined') {
            this.stageObserver = new MutationObserver(() => this.refreshFit());
            this.stageObserver.observe(this.stage, {
                attributes: true,
                attributeFilter: ['class', 'style'],
                childList: true,
                subtree: true
            });
        }
    }

    private availableViewportSize(): PreviewContentSize {
        const style = window.getComputedStyle(this.viewport);
        const width = viewportDimension(this.viewport, 'width') -
            cssPixels(style.paddingLeft) -
            cssPixels(style.paddingRight);
        const height = viewportDimension(this.viewport, 'height') -
            cssPixels(style.paddingTop) -
            cssPixels(style.paddingBottom);
        return {
            width: Math.max(0, width),
            height: Math.max(0, height)
        };
    }

    private visibleContentSize(): PreviewContentSize {
        const elements = this.visiblePreviewElements();
        return elements.reduce<PreviewContentSize>((size, element) => {
            size.width = Math.max(size.width, naturalElementDimension(element, 'width', this.fitScale * this.zoom));
            size.height = Math.max(size.height, naturalElementDimension(element, 'height', this.fitScale * this.zoom));
            return size;
        }, { width: 0, height: 0 });
    }

    private visiblePreviewElements(): HTMLElement[] {
        const directChildren = Array.from(this.stage.children) as HTMLElement[];
        const fixedPageShells = Array.from(this.stage.querySelectorAll<HTMLElement>(
            '.pem-pandoc-docx-page-shell, .pem-pandoc-pptx-page-shell'
        ));
        return [...directChildren, ...fixedPageShells]
            .filter(element => !element.closest('.is-hidden'));
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
        this.setSideNavigationHover(
            position <= 0.2 ? 'left' :
                position >= 0.8 ? 'right' :
                    undefined
        );
    }

    private setSideNavigationHover(side: 'left' | 'right' | undefined): void {
        this.host.classList.toggle('is-hovering-left', side === 'left');
        this.host.classList.toggle('is-hovering-right', side === 'right');
        this.previousButton.style.opacity = side === 'left' && !this.previousButton.disabled ? '0.42' : '';
        this.nextButton.style.opacity = side === 'right' && !this.nextButton.disabled ? '0.42' : '';
    }

    private installSideNavigationZoneHover(
        zone: HTMLElement,
        side: 'left' | 'right'
    ): void {
        const activate = () => this.setSideNavigationHover(side);
        zone.onmouseenter = activate;
        zone.onpointerenter = activate;
        zone.onmousemove = activate;
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

function parseZoomInput(value: string): number | undefined {
    const normalized = value.trim().replace(/%$/, '');
    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
    return parsed / 100;
}

function naturalElementDimension(
    element: HTMLElement,
    property: 'width' | 'height',
    currentScale: number
): number {
    const rect = element.getBoundingClientRect();
    const rectValue = rect[property] > 0 && currentScale > 0 ? rect[property] / currentScale : 0;
    return Math.max(
        dimensionFromElement(element, property),
        rectValue,
        cssPixels(element.style[property]),
        cssPixels(element.style.getPropertyValue(`--pem-pandoc-page-${property}`))
    );
}

function dimensionFromElement(element: HTMLElement, property: 'width' | 'height'): number {
    const clientProperty = property === 'width' ? 'clientWidth' : 'clientHeight';
    const offsetProperty = property === 'width' ? 'offsetWidth' : 'offsetHeight';
    const scrollProperty = property === 'width' ? 'scrollWidth' : 'scrollHeight';
    const rect = element.getBoundingClientRect();
    return Math.max(
        element[clientProperty],
        element[offsetProperty],
        element[scrollProperty],
        rect[property]
    );
}

function viewportDimension(element: HTMLElement, property: 'width' | 'height'): number {
    const clientProperty = property === 'width' ? 'clientWidth' : 'clientHeight';
    const clientValue = element[clientProperty];
    if (clientValue > 0) return clientValue;

    const rect = element.getBoundingClientRect();
    return rect[property];
}

function cssPixels(value: string): number {
    const pixels = Number.parseFloat(value);
    return Number.isFinite(pixels) ? pixels : 0;
}
