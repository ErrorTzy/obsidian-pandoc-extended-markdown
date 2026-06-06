import { ExportProfile, PandocExportSettings } from '../export/types';

const BUNDLED_FILTERS = [
    '${luaFilterDir}/FencedDivExtendedSyntax.lua',
    '${luaFilterDir}/CustomLabelList.lua'
];

const COMMON_RESOURCE_PATHS = [
    '${currentDir}',
    '${attachmentFolderPath}',
    '${vaultDir}',
    '${embedDirs}'
];

function profile(
    id: string,
    name: string,
    to: string,
    extension: string,
    extraArgs: string[] = [],
    standalone = true
): ExportProfile {
    return {
        id,
        name,
        type: 'pandoc',
        to,
        extension,
        standalone,
        resourcePaths: COMMON_RESOURCE_PATHS,
        luaFilters: BUNDLED_FILTERS,
        extraArgs
    };
}

export const DEFAULT_EXPORT_PROFILES: ExportProfile[] = [
    profile('markdown', 'Markdown', 'commonmark_x-attributes', '.md'),
    profile('markdown-hugo', 'Markdown Hugo', 'commonmark_x-attributes', '.md'),
    profile('html', 'HTML', 'html', '.html', [
        '--embed-resources',
        '--metadata',
        'title=${currentFileName}',
        '--mathjax=https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg-full.js'
    ]),
    profile('textbundle', 'TextBundle', 'commonmark_x-attributes', '.md', [
        '-V',
        'media_dir=${outputDir}/${outputFileName}.textbundle/assets',
        '-o',
        '${outputDir}/${outputFileName}.textbundle/text.md'
    ]),
    profile('typst', 'Typst', 'typst', '.typ'),
    profile('pdf', 'PDF', 'pdf', '.pdf', ['--pdf-engine=pdflatex'], false),
    profile('docx', 'DOCX', 'docx', '.docx', [], false),
    profile('odt', 'ODT', 'odt', '.odt', [], false),
    profile('rtf', 'RTF', 'rtf', '.rtf'),
    profile('epub', 'EPUB', 'epub', '.epub', [], false),
    profile('latex', 'LaTeX', 'latex', '.tex', ['--extract-media=${outputDir}']),
    profile('mediawiki', 'MediaWiki', 'mediawiki', '.mediawiki'),
    profile('rst', 'reStructuredText', 'rst', '.rst'),
    profile('textile', 'Textile', 'textile', '.textile'),
    profile('opml', 'OPML', 'opml', '.opml'),
    profile('bibliography', 'Bibliography', 'bibtex', '.bib', [], false),
    profile('pptx', 'PPTX', 'pptx', '.pptx', [], false)
];

export const DEFAULT_PANDOC_EXPORT_SETTINGS: PandocExportSettings = {
    enabled: false,
    pandocPath: '',
    defaultOutputFolderMode: 'current',
    customOutputFolder: '',
    env: {},
    profiles: DEFAULT_EXPORT_PROFILES,
    showOverwriteConfirmation: true,
    openOutputFile: true,
    revealOutputFile: false,
    suggestRuntimeEnvVariables: false,
    preview: {
        enabled: true,
        debounceMs: 700,
        odtAddon: {
            enabled: false,
            status: 'not-installed'
        }
    }
};

export function cloneDefaultProfiles(): ExportProfile[] {
    return DEFAULT_EXPORT_PROFILES.map(profile => ({ ...profile }));
}
