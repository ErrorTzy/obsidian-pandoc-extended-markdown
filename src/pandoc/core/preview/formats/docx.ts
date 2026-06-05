import {
    createSimplePreviewFormatModule
} from './helpers';

export function createDocxPreviewFormatModule() {
    return createSimplePreviewFormatModule({
        id: 'docx',
        kind: 'docx',
        label: 'DOCX preview',
        matches: request => request.normalizedExtension === '.docx' ||
            request.normalizedFormat === 'docx'
    });
}
