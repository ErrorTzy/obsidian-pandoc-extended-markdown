import {
    createSimplePreviewFormatModule
} from './helpers';

export function createPptxPreviewFormatModule() {
    return createSimplePreviewFormatModule({
        id: 'pptx',
        kind: 'pptx',
        label: 'PPTX preview',
        matches: request => request.normalizedExtension === '.pptx' ||
            request.normalizedFormat === 'pptx'
    });
}
