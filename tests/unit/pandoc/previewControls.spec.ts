import { describe, expect, it } from '@jest/globals';

import { PreviewPager } from '../../../src/pandoc/previewControls';

describe('PreviewPager', () => {
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
