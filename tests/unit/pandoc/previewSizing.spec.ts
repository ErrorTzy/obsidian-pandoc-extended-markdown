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

        installDocxPreviewFit(container);

        const shell = page.parentElement as HTMLElement;
        expect(shell.classList.contains('pem-pandoc-docx-page-shell')).toBe(true);
        expect(preview.style.getPropertyValue('--pem-pandoc-docx-page-scale')).toBe('0.4900');
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
