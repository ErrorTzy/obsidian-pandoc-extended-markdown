import {
    PreviewPager
} from './previewControls';
import {
    extractDocxPageSizes
} from './previewPageMetadata';
import {
    installDocxPreviewFit
} from './previewSizing';
import type {
    ObsidianPandocPreviewRendererModule
} from './types';

export function createDocxPreviewRenderer(): ObsidianPandocPreviewRendererModule {
    return {
        id: 'docx',
        label: 'DOCX preview',
        render: async request => {
            const { renderAsync } = await import('docx-preview');
            const data = await request.readBinary(request.artifact.filePath);
            const pageSizes = extractDocxPageSizes(data);
            let pager: PreviewPager;
            const showPage = (pageIndex: number) => {
                showOnlyPage(pager.stage, '.pem-pandoc-docx-page-shell', pageIndex);
                pager.refreshFit();
            };
            pager = new PreviewPager(request.container, { onPageChange: showPage });
            const wrapper = pager.stage.createDiv({ cls: 'pem-pandoc-docx-preview' });
            await renderAsync(
                data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
                wrapper,
                undefined,
                {
                    className: 'pem-pandoc-docx',
                    inWrapper: true,
                    ignoreWidth: false,
                    ignoreHeight: false,
                    breakPages: true,
                    renderHeaders: true,
                    renderFooters: true
                }
            );
            installDocxPreviewFit(request.container, pageSizes);
            const pageCount = pager.stage.querySelectorAll('.pem-pandoc-docx-page-shell').length;
            pager.setPageCount(pageCount);
            showPage(pager.currentPageIndex);
        }
    };
}

function showOnlyPage(root: HTMLElement, selector: string, pageIndex: number): void {
    Array.from(root.querySelectorAll<HTMLElement>(selector))
        .forEach((page, index) => {
            page.classList.toggle('is-hidden', index !== pageIndex);
        });
}
