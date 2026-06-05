import {
    createSimplePreviewFormatModule
} from './helpers';

const HTML_FORMATS = new Set([
    'html',
    'html4',
    'html5',
    'revealjs',
    's5',
    'slidy',
    'slideous',
    'dzslides'
]);

export function createHtmlPreviewFormatModule() {
    return createSimplePreviewFormatModule({
        id: 'html',
        kind: 'html',
        label: 'HTML preview',
        matches: request => HTML_FORMATS.has(request.normalizedFormat) ||
            request.normalizedExtension === '.html'
    });
}
