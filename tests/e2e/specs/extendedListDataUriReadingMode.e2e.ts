import { browser, expect } from '@wdio/globals';

import {
    createOrReplaceFile,
    deleteFileIfExists,
    ensureReadingMode,
    openFileInActiveLeaf
} from '../helpers/pandocSyntaxParity';

const path = 'extended-list-data-uri-reading-mode.md';
const source = [
    'a) ![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAEElEQVR4nGNgGAWjYBTAAAADEAABPywr7AAAAABJRU5ErkJggg==)',
    'b) Second item',
    'c) Third item'
].join('\n');

describe('parenthesized list with a data URI image in Reading mode', () => {
    before(async () => {
        await browser.reloadObsidian({ vault: './tests/e2e/vaults/test-vault' });
        await createOrReplaceFile(path, source);
        await openFileInActiveLeaf(path);
        await ensureReadingMode();
    });

    after(async () => {
        await deleteFileIfExists(path);
    });

    it('keeps the image, alpha markers, and separate list item boxes', async () => {
        await browser.waitUntil(async () => browser.execute(() => {
            const image = document.querySelector('.markdown-preview-view ol.pem-list-paren > li img') as HTMLImageElement | null;
            return Boolean(image?.complete && image.naturalWidth === 16);
        }), { timeout: 10000 });

        const result = await browser.execute(() => {
            const items = Array.from(document.querySelectorAll<HTMLElement>(
                '.markdown-preview-view ol.pem-list-paren > li'
            ));
            const image = items[0]?.querySelector('img') as HTMLImageElement | null;
            return {
                count: items.length,
                imageWidth: image?.naturalWidth,
                imageHeight: image?.naturalHeight,
                texts: items.map(item => item.textContent?.trim()),
                markerStyles: items.map(item => getComputedStyle(item, '::marker').content),
                type: items[0]?.parentElement?.getAttribute('type'),
                boxesSeparate: items.every((item, index) => index === 0 ||
                    item.getBoundingClientRect().top + 0.01 >=
                        items[index - 1].getBoundingClientRect().bottom)
            };
        });

        expect(result.count).toBe(3);
        expect(result.imageWidth).toBe(16);
        expect(result.imageHeight).toBe(16);
        expect(result.texts).toEqual(['', 'Second item', 'Third item']);
        expect(result.type).toBe('a');
        expect(result.markerStyles.every(style => style.includes('lower-alpha'))).toBe(true);
        expect(result.boxesSeparate).toBe(true);
    });
});
