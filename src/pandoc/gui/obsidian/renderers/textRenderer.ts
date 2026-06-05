import {
    createFlowPreview
} from './shared/flowPreview';
import type {
    ObsidianPandocPreviewRendererModule
} from './types';

export function createTextPreviewRenderer(): ObsidianPandocPreviewRendererModule {
    return {
        id: 'text',
        label: 'Text preview',
        render: async request => {
            const text = await request.readText(request.artifact.filePath);
            createFlowPreview(request.container, 'pem-pandoc-text-flow-preview')
                .createEl('pre', { cls: 'pem-pandoc-preview-text pem-pandoc-flow-preview-text' })
                .createEl('code')
                .setText(text);
        }
    };
}
