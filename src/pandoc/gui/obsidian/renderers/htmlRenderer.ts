import {
    createFlowPreview,
    previewNoticeFor
} from './shared/flowPreview';
import type {
    ObsidianPandocPreviewRendererModule
} from './types';

export function createHtmlPreviewRenderer(): ObsidianPandocPreviewRendererModule {
    return {
        id: 'html',
        label: 'HTML preview',
        render: async request => {
            const viewport = createFlowPreview(
                request.container,
                'pem-pandoc-html-flow-preview',
                previewNoticeFor(request.artifact.metadata)
            );
            const iframe = viewport.createEl('iframe', {
                cls: 'pem-pandoc-preview-frame pem-pandoc-flow-preview-frame',
                attr: {
                    sandbox: '',
                    title: 'Pandoc export preview'
                }
            });
            iframe.srcdoc = await request.readText(request.artifact.filePath);
        }
    };
}
