import {
    createSimplePreviewFormatModule
} from './helpers';

export function createEpubPreviewFormatModule() {
    return createSimplePreviewFormatModule({
        id: 'epub',
        kind: 'epub',
        label: 'EPUB preview',
        matches: request => request.normalizedExtension === '.epub' ||
            request.normalizedFormat.startsWith('epub')
    });
}
