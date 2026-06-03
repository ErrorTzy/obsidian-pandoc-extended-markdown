import { describe, expect, it } from '@jest/globals';

import { installDocxPreviewFit } from '../../../src/pandoc/previewSizing';

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
        expect(preview.style.getPropertyValue('--pem-pandoc-docx-page-scale')).toBe('0.4900');
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
        expect(shell.style.width).toBe('392px');
        expect(shell.style.height).toBe('490px');
    });
});

function defineDimension(element: HTMLElement, name: string, value: number): void {
    Object.defineProperty(element, name, {
        configurable: true,
        value
    });
}
