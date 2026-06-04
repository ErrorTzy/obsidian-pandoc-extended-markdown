import { describe, expect, it } from '@jest/globals';

import { PreviewPager } from '../../../src/pandoc/gui/obsidian/renderers/previewControls';

describe('PreviewPager', () => {
    it('counts the viewport-fitted size as 100%', () => {
        const container = withObsidianDomHelpers(document.createElement('div'));
        const pager = new PreviewPager(container);
        const page = pager.stage.createDiv();
        page.style.width = '800px';
        page.style.height = '1000px';
        defineDimension(pager.viewport, 'clientWidth', 1000);
        defineDimension(pager.viewport, 'clientHeight', 420);

        pager.refreshFit();

        expect(pager.host.style.getPropertyValue('--pem-pandoc-preview-fit-scale')).toBe('0.4200');
        expect(pager.host.style.getPropertyValue('--pem-pandoc-preview-zoom')).toBe('0.4200');
        expect(pager.host.querySelector<HTMLInputElement>('[aria-label="Zoom percentage"]')?.value).toBe('100%');
    });

    it('applies edited zoom percentages relative to the fitted size', () => {
        const container = withObsidianDomHelpers(document.createElement('div'));
        const pager = new PreviewPager(container);
        const page = pager.stage.createDiv();
        page.style.width = '800px';
        page.style.height = '1000px';
        defineDimension(pager.viewport, 'clientWidth', 400);
        defineDimension(pager.viewport, 'clientHeight', 500);
        pager.refreshFit();
        const zoomInput = pager.host.querySelector<HTMLInputElement>('[aria-label="Zoom percentage"]');

        expect(zoomInput).not.toBeNull();
        zoomInput!.value = '114%';
        zoomInput!.dispatchEvent(new Event('change'));

        expect(zoomInput?.value).toBe('114%');
        expect(pager.host.style.getPropertyValue('--pem-pandoc-preview-fit-scale')).toBe('0.5000');
        expect(pager.host.style.getPropertyValue('--pem-pandoc-preview-zoom')).toBe('0.5700');
    });

    it('does not treat existing scroll overflow as available viewport space', () => {
        const container = withObsidianDomHelpers(document.createElement('div'));
        const pager = new PreviewPager(container);
        const page = pager.stage.createDiv();
        page.style.width = '800px';
        page.style.height = '1000px';
        defineDimension(pager.viewport, 'clientWidth', 1000);
        defineDimension(pager.viewport, 'clientHeight', 500);
        defineDimension(pager.viewport, 'offsetWidth', 1200);
        defineDimension(pager.viewport, 'offsetHeight', 1200);
        defineDimension(pager.viewport, 'scrollWidth', 1200);
        defineDimension(pager.viewport, 'scrollHeight', 1200);

        pager.refreshFit();

        expect(pager.host.style.getPropertyValue('--pem-pandoc-preview-fit-scale')).toBe('0.5000');
        expect(pager.host.style.getPropertyValue('--pem-pandoc-preview-zoom')).toBe('0.5000');
    });

    it('fits scrollable previews by width without shrinking long content to height', () => {
        const container = withObsidianDomHelpers(document.createElement('div'));
        const pager = new PreviewPager(container, { fitMode: 'width' });
        const page = pager.stage.createDiv();
        page.style.width = '800px';
        page.style.height = '3000px';
        defineDimension(pager.viewport, 'clientWidth', 400);
        defineDimension(pager.viewport, 'clientHeight', 500);

        pager.refreshFit();

        expect(pager.host.style.getPropertyValue('--pem-pandoc-preview-fit-scale')).toBe('0.5000');
        expect(pager.host.style.getPropertyValue('--pem-pandoc-preview-zoom')).toBe('0.5000');
    });

    it('fits DOCX page shells without measuring clipped source fragments', () => {
        const container = withObsidianDomHelpers(document.createElement('div'));
        const pager = new PreviewPager(container);
        const preview = pager.stage.createDiv({ cls: 'pem-pandoc-docx-preview' });
        const shell = preview.createDiv({ cls: 'pem-pandoc-docx-page-shell' });
        const viewport = shell.createDiv({ cls: 'pem-pandoc-docx-page-viewport' });
        const sourcePage = viewport.createEl('section', { cls: 'pem-pandoc-docx' });
        shell.style.width = '800px';
        shell.style.height = '1000px';
        sourcePage.style.width = '800px';
        sourcePage.style.height = '3000px';
        defineDimension(pager.viewport, 'clientWidth', 400);
        defineDimension(pager.viewport, 'clientHeight', 500);

        pager.refreshFit();

        expect(pager.host.style.getPropertyValue('--pem-pandoc-preview-fit-scale')).toBe('0.5000');
    });

    it('keeps side navigation outside the scroll viewport', () => {
        const container = withObsidianDomHelpers(document.createElement('div'));
        const pager = new PreviewPager(container);

        const overlay = pager.host.querySelector('.pem-pandoc-paged-preview-side-nav-overlay');
        const zones = pager.host.querySelectorAll('.pem-pandoc-paged-preview-side-nav-zone');
        const previous = pager.host.querySelector('[aria-label="Previous page"]');
        const next = pager.host.querySelector('[aria-label="Next page"]');

        expect(overlay).not.toBeNull();
        expect(zones).toHaveLength(2);
        expect(pager.viewport.contains(previous)).toBe(false);
        expect(pager.viewport.contains(next)).toBe(false);
        expect(overlay?.contains(previous)).toBe(true);
        expect(overlay?.contains(next)).toBe(true);
        expect(zones[0].contains(previous)).toBe(true);
        expect(zones[1].contains(next)).toBe(true);
    });

    it('uses SVG chevrons for side navigation buttons', () => {
        const container = withObsidianDomHelpers(document.createElement('div'));
        const pager = new PreviewPager(container);
        const previous = pager.host.querySelector<HTMLButtonElement>('[aria-label="Previous page"]');
        const next = pager.host.querySelector<HTMLButtonElement>('[aria-label="Next page"]');

        expect(previous?.textContent).toBe('');
        expect(next?.textContent).toBe('');
        expect(previous?.querySelector('svg path')?.getAttribute('d')).toBe('M15 18l-6-6 6-6');
        expect(next?.querySelector('svg path')?.getAttribute('d')).toBe('M9 18l6-6-6-6');
    });

    it('disables previous on the first page and next on the last page', () => {
        const container = withObsidianDomHelpers(document.createElement('div'));
        const pager = new PreviewPager(container, { initialPageCount: 3 });
        const previous = pager.host.querySelector<HTMLButtonElement>('[aria-label="Previous page"]');
        const next = pager.host.querySelector<HTMLButtonElement>('[aria-label="Next page"]');

        expect(previous?.disabled).toBe(true);
        expect(next?.disabled).toBe(false);

        pager.setPage(2);

        expect(previous?.disabled).toBe(false);
        expect(next?.disabled).toBe(true);
    });
});

function withObsidianDomHelpers(element: HTMLElement): HTMLElement {
    const helper = element as HTMLElement & {
        createDiv(options?: { cls?: string }): HTMLElement;
        createEl(
            tag: string,
            options?: { cls?: string; text?: string; attr?: Record<string, string> }
        ): HTMLElement;
    };
    helper.createDiv = options => {
        const div = withObsidianDomHelpers(document.createElement('div'));
        if (options?.cls) div.className = options.cls;
        element.appendChild(div);
        return div;
    };
    helper.createEl = (tag, options) => {
        const child = withObsidianDomHelpers(document.createElement(tag));
        if (options?.cls) child.className = options.cls;
        if (options?.text) child.textContent = options.text;
        Object.entries(options?.attr ?? {}).forEach(([name, value]) => child.setAttribute(name, value));
        element.appendChild(child);
        return child;
    };

    return helper;
}

function defineDimension(element: HTMLElement, name: string, value: number): void {
    Object.defineProperty(element, name, {
        configurable: true,
        value
    });
}
