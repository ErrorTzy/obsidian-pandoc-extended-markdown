import {
    createSimplePreviewFormatModule
} from './helpers';

const TEXT_EXTENSIONS = new Set([
    '.txt',
    '.md',
    '.markdown',
    '.tex',
    '.typ',
    '.rst',
    '.rtf',
    '.opml',
    '.bib',
    '.mediawiki',
    '.textile',
    '.json',
    '.xml'
]);

export function createTextPreviewFormatModule() {
    return createSimplePreviewFormatModule({
        id: 'text',
        kind: 'text',
        label: 'Text preview',
        matches: request => TEXT_EXTENSIONS.has(request.normalizedExtension)
    });
}
