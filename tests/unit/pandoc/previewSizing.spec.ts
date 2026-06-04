import { describe, expect, it } from '@jest/globals';

import {
    calculateViewportFitScale,
    calculateNaturalPageSlices,
    installDocxPreviewFit
} from '../../../src/pandoc/gui/obsidian/renderers/previewSizing';

describe('calculateViewportFitScale', () => {
    it('uses the smaller width or height scale to avoid viewport overflow', () => {
        expect(calculateViewportFitScale({
            availableWidth: 1000,
            availableHeight: 420,
            contentWidth: 800,
            contentHeight: 1000
        })).toBeCloseTo(0.42);
    });

    it('falls back to natural scale while dimensions are unavailable', () => {
        expect(calculateViewportFitScale({
            availableWidth: 0,
            availableHeight: 420,
            contentWidth: 800,
            contentHeight: 1000
        })).toBe(1);
    });
});

describe('calculateNaturalPageSlices', () => {
    it('moves a line that crosses the page boundary to the next page', () => {
        expect(calculateNaturalPageSlices({
            flowStart: 0,
            flowEnd: 180,
            pageHeight: 100,
            unbreakableBoxes: [{ top: 96, bottom: 116 }]
        })).toEqual([
            { start: 0, height: 96 },
            { start: 96, height: 84 }
        ]);
    });

    it('backs up through earlier boxes until the page break cuts no line', () => {
        expect(calculateNaturalPageSlices({
            flowStart: 0,
            flowEnd: 190,
            pageHeight: 100,
            unbreakableBoxes: [
                { top: 90, bottom: 98 },
                { top: 96, bottom: 116 }
            ]
        })).toEqual([
            { start: 0, height: 90 },
            { start: 90, height: 100 }
        ]);
    });

    it('keeps making progress when an element is taller than a page', () => {
        expect(calculateNaturalPageSlices({
            flowStart: 0,
            flowEnd: 140,
            pageHeight: 100,
            unbreakableBoxes: [{ top: 0, bottom: 120 }]
        })).toEqual([
            { start: 0, height: 100 },
            { start: 100, height: 40 }
        ]);
    });

    it('ignores oversized containers and still honors nested line boxes', () => {
        expect(calculateNaturalPageSlices({
            flowStart: 0,
            flowEnd: 180,
            pageHeight: 100,
            unbreakableBoxes: [
                { top: 0, bottom: 180 },
                { top: 96, bottom: 116 }
            ]
        })).toEqual([
            { start: 0, height: 96 },
            { start: 96, height: 84 }
        ]);
    });
});

describe('installDocxPreviewFit', () => {
    it('scales DOCX pages into the available preview width', () => {
        const container = document.createElement('div');
        const preview = document.createElement('div');
        preview.className = 'pem-pandoc-docx-preview';
        preview.style.padding = '14px';
        const wrapper = document.createElement('div');
        wrapper.className = 'pem-pandoc-docx-wrapper';
        const page = document.createElement('section');
        page.className = 'pem-pandoc-docx';
        container.appendChild(preview);
        preview.appendChild(wrapper);
        wrapper.appendChild(page);

        defineDimension(preview, 'clientWidth', 420);
        defineDimension(page, 'offsetWidth', 800);
        defineDimension(page, 'scrollWidth', 800);
        defineDimension(page, 'offsetHeight', 1000);
        defineDimension(page, 'scrollHeight', 1000);

        installDocxPreviewFit(container, [{
            widthPx: 800,
            heightPx: 1000,
            marginsPx: {
                top: 80,
                right: 70,
                bottom: 60,
                left: 50
            }
        }]);

        const viewport = page.parentElement as HTMLElement;
        const fragment = viewport.parentElement as HTMLElement;
        const shell = fragment.parentElement as HTMLElement;
        expect(viewport.classList.contains('pem-pandoc-docx-page-viewport')).toBe(true);
        expect(fragment.classList.contains('pem-pandoc-docx-page-fragment')).toBe(true);
        expect(shell.classList.contains('pem-pandoc-docx-page-shell')).toBe(true);
        expect(preview.style.getPropertyValue('--pem-pandoc-docx-page-scale')).toBe('1.0000');
        expect(page.style.width).toBe('800px');
        expect(page.style.minHeight).toBe('1000px');
        expect(page.style.aspectRatio).toBe('800 / 1000');
        expect(page.style.paddingTop).toBe('80px');
        expect(page.style.paddingRight).toBe('70px');
        expect(page.style.paddingBottom).toBe('60px');
        expect(page.style.paddingLeft).toBe('50px');
        expect(fragment.style.paddingLeft).toBe('');
        expect(viewport.style.left).toBe('50px');
        expect(viewport.style.top).toBe('80px');
        expect(viewport.style.width).toBe('680px');
        expect(viewport.style.height).toBe('860px');
        expect(shell.style.width).toBe('800px');
        expect(shell.style.height).toBe('1000px');
    });
});

function defineDimension(element: HTMLElement, name: string, value: number): void {
    Object.defineProperty(element, name, {
        configurable: true,
        value
    });
}
