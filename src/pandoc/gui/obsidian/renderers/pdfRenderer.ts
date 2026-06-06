import {
    PreviewPager
} from './previewControls';
import type {
    ObsidianPandocPreviewRendererModule
} from './types';

export function createPdfPreviewRenderer(): ObsidianPandocPreviewRendererModule {
    return {
        id: 'pdf',
        label: 'PDF preview',
        render: async request => {
            await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
            const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
            const data = await request.readBinary(request.artifact.filePath);
            const loadingTask = pdfjs.getDocument({ data });
            const document = await loadingTask.promise;
            let pager: PreviewPager;
            const renderPage = async (pageIndex: number) => {
                pager.clearStage();
                const page = await document.getPage(pageIndex + 1);
                const viewport = page.getViewport({ scale: 1.35 });
                const outputScale = window.devicePixelRatio || 1;
                const canvas = pager.stage.createEl('canvas', { cls: 'pem-pandoc-pdf-page' });
                canvas.width = Math.floor(viewport.width * outputScale);
                canvas.height = Math.floor(viewport.height * outputScale);
                canvas.style.width = `${viewport.width}px`;
                canvas.style.height = `${viewport.height}px`;
                canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
                pager.refreshFit();
                const context = canvas.getContext('2d');
                if (!context) throw new Error('Canvas rendering is unavailable.');
                void page.render({
                    canvasContext: context,
                    viewport,
                    transform: outputScale !== 1 ?
                        [outputScale, 0, 0, outputScale, 0, 0] :
                        undefined
                }).promise.catch(error => {
                    // PDF.js can leave the render promise unsettled in embedded Electron contexts.
                    console.error('PDF preview page render failed', error);
                });
            };
            pager = new PreviewPager(request.container, {
                initialPageCount: document.numPages,
                onPageChange: pageIndex => {
                    void renderPage(pageIndex);
                }
            });
            pager.setPageCount(document.numPages);

            await renderPage(0);
        }
    };
}
