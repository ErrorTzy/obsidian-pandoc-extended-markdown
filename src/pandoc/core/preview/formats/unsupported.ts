import {
    createSimplePreviewFormatModule
} from './helpers';

export function createUnsupportedPreviewFormatModule() {
    return createSimplePreviewFormatModule({
        id: 'unsupported',
        kind: 'unsupported',
        label: 'Preview unavailable',
        matches: () => true
    });
}
