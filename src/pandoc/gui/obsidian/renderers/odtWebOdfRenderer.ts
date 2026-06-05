import {
    renderOdtAddonPreview
} from './previewOdtRenderer';
import type {
    ObsidianPandocPreviewRendererModule
} from './types';

export function createOdtWebOdfPreviewRenderer(
    id = 'odt-webodf'
): ObsidianPandocPreviewRendererModule {
    return {
        id,
        label: 'ODT add-on preview',
        render: renderOdtAddonPreview
    };
}
