import {
    PreviewPager
} from './previewControls';
import {
    DEFAULT_DOCX_PAGE_SIZE,
    type PreviewPageSize
} from './previewPageMetadata';
import {
    applyPageSizeStyle
} from './shared/pageStyle';
import type {
    ObsidianPandocPreviewRendererModule
} from './types';

interface EpubFactory {
    (data: ArrayBuffer): EpubBook;
}

interface EpubBook {
    ready: Promise<unknown>;
    locations: {
        cfiFromLocation(location: number): string | undefined;
        generate(chars: number): Promise<unknown>;
        length(): number;
    };
    renderTo(element: HTMLElement, options: {
        height: string;
        spread: string;
        width: string;
    }): EpubRendition;
}

interface EpubRendition {
    display(target?: string): Promise<unknown>;
}

export function createEpubPreviewRenderer(): ObsidianPandocPreviewRendererModule {
    return {
        id: 'epub',
        label: 'EPUB preview',
        render: async request => {
            const epub = (await import('epubjs')).default as EpubFactory;
            const data = await request.readBinary(request.artifact.filePath);
            const book = epub(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
            let locationCount = 1;
            let rendition: EpubRendition | undefined;
            const pager = new PreviewPager(request.container, {
                pageLabel: 'Location',
                onPageChange: pageIndex => {
                    if (!rendition) return;
                    const cfi = book.locations.cfiFromLocation(Math.min(pageIndex, locationCount - 1));
                    if (cfi) void rendition.display(cfi);
                }
            });
            const viewport = createScrollablePage(pager, DEFAULT_DOCX_PAGE_SIZE, 'pem-pandoc-epub-viewport');
            rendition = book.renderTo(viewport, {
                width: '100%',
                height: '100%',
                spread: 'none'
            });
            await rendition.display();
            await book.ready;
            await book.locations.generate(1000);
            locationCount = Math.max(1, book.locations.length());
            pager.setPageCount(locationCount);
        }
    };
}

function createScrollablePage(
    pager: PreviewPager,
    pageSize: PreviewPageSize,
    cls: string
): HTMLElement {
    const page = pager.stage.createDiv({ cls: `pem-pandoc-scrollable-page ${cls}` });
    applyPageSizeStyle(page, pageSize);
    page.style.width = `${pageSize.widthPx}px`;
    page.style.height = `${pageSize.heightPx}px`;
    pager.refreshFit();
    return page;
}
