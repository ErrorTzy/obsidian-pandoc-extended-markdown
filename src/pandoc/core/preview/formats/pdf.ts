import {
    createSimplePreviewFormatModule
} from './helpers';

export function createPdfPreviewFormatModule() {
    return createSimplePreviewFormatModule({
        id: 'pdf',
        kind: 'pdf',
        label: 'PDF preview',
        matches: request => request.normalizedExtension === '.pdf' ||
            request.normalizedFormat === 'pdf'
    });
}
