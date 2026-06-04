import type { OdtPreviewAddonSettings } from '../export/types';

export type PandocPreviewRendererKind =
    | 'html'
    | 'text'
    | 'pdf'
    | 'docx'
    | 'epub'
    | 'pptx'
    | 'paged-html'
    | 'odt-addon'
    | 'odt-pandoc-fallback'
    | 'unsupported';

export interface PandocPreviewRendererPlan {
    kind: PandocPreviewRendererKind;
    label: string;
    addonInstallPath?: string;
    addonVersion?: string;
}

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

export function selectPreviewRendererPlan(
    toFormat: string,
    extension: string,
    odtAddon?: OdtPreviewAddonSettings
): PandocPreviewRendererPlan {
    const normalizedFormat = stripFormatExtensions(toFormat);
    const normalizedExtension = normalizePreviewArtifactExtension(extension);

    if (normalizedExtension === '.odt' || normalizedFormat === 'odt') {
        return selectOdtPreviewRenderer(odtAddon);
    }

    if (HTML_FORMATS.has(normalizedFormat) || normalizedExtension === '.html') {
        return { kind: 'html', label: 'HTML preview' };
    }
    if (TEXT_EXTENSIONS.has(normalizedExtension)) {
        return { kind: 'text', label: 'Text preview' };
    }
    if (normalizedExtension === '.pdf' || normalizedFormat === 'pdf') return { kind: 'pdf', label: 'PDF preview' };
    if (normalizedExtension === '.docx' || normalizedFormat === 'docx') return { kind: 'docx', label: 'DOCX preview' };
    if (normalizedExtension === '.epub' || normalizedFormat.startsWith('epub')) return { kind: 'epub', label: 'EPUB preview' };
    if (normalizedExtension === '.pptx' || normalizedFormat === 'pptx') return { kind: 'pptx', label: 'PPTX preview' };

    return { kind: 'unsupported', label: 'Preview unavailable' };
}

function selectOdtPreviewRenderer(
    odtAddon: OdtPreviewAddonSettings | undefined
): PandocPreviewRendererPlan {
    if (
        odtAddon?.enabled &&
        odtAddon.status === 'installed' &&
        odtAddon.installPath
    ) {
        return {
            kind: 'odt-addon',
            label: 'ODT add-on preview',
            addonInstallPath: odtAddon.installPath,
            addonVersion: odtAddon.version
        };
    }

    return { kind: 'odt-pandoc-fallback', label: 'ODT fallback preview' };
}

function stripFormatExtensions(format: string): string {
    return format.toLowerCase().split(/[+-]/)[0];
}

function normalizePreviewArtifactExtension(extension: string): string {
    return extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
}
