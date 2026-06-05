import {
    renderUnsupportedPreview
} from './shared/unsupportedPreview';
import type {
    ObsidianPandocPreviewRendererModule
} from './types';

export function createUnsupportedPreviewRenderer(): ObsidianPandocPreviewRendererModule {
    return {
        id: 'unsupported',
        label: 'Preview unavailable',
        render: async request => {
            renderUnsupportedPreview(request.container, request.artifact.label);
        }
    };
}
