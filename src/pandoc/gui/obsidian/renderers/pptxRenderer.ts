import {
    PreviewPager
} from './previewControls';
import {
    DEFAULT_PPTX_PAGE_SIZE,
    extractPptxPageSize
} from './previewPageMetadata';
import {
    applyPageSizeStyle
} from './shared/pageStyle';
import type {
    ObsidianPandocPreviewRendererModule
} from './types';

export function createPptxPreviewRenderer(): ObsidianPandocPreviewRendererModule {
    return {
        id: 'pptx',
        label: 'PPTX preview',
        render: async request => {
            const { PPTXViewer } = await import('pptxviewjs');
            const data = await request.readBinary(request.artifact.filePath);
            const pageSize = extractPptxPageSize(data) ?? DEFAULT_PPTX_PAGE_SIZE;
            const viewer = new PPTXViewer({
                slideSizeMode: 'fit',
                autoRenderFirstSlide: false
            });
            await viewer.loadFile(data);

            const slideCount = Math.max(1, viewer.getSlideCount());
            let pager: PreviewPager;
            const renderSlide = async (slideIndex: number) => {
                pager.clearStage();
                const shell = pager.stage.createDiv({ cls: 'pem-pandoc-pptx-page-shell' });
                applyPageSizeStyle(shell, pageSize);
                const canvas = shell.createEl('canvas', { cls: 'pem-pandoc-pptx-canvas' });
                applyPageSizeStyle(canvas, pageSize);
                canvas.style.width = `${pageSize.widthPx}px`;
                canvas.style.height = `${pageSize.heightPx}px`;
                pager.refreshFit();
                await viewer.render(canvas, { quality: 'high', slideIndex });
            };
            pager = new PreviewPager(request.container, {
                pageLabel: 'Slide',
                initialPageCount: slideCount,
                onPageChange: slideIndex => {
                    void renderSlide(slideIndex);
                }
            });
            pager.setPageCount(slideCount);

            await renderSlide(0);
        }
    };
}
