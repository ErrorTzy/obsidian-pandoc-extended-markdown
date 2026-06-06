import type { OptionSpec, PandocOptionCatalog } from './types';
import { FALLBACK_EXTENSION_DESCRIPTIONS } from './fallbackExtensionDescriptions';
import FALLBACK_PANDOC_OPTIONS_METADATA from '../metadata/pandoc-options.json';
import { postProcessOptionMetadata } from './metadataPostProcessor';
import { metadataToOptionSpecs } from './optionsMetadata';
import type { PandocOptionsMetadata } from './types';

const INPUT_FORMATS = [
    'commonmark',
    'commonmark_x',
    'docx',
    'epub',
    'gfm',
    'html',
    'ipynb',
    'latex',
    'markdown',
    'markdown_mmd',
    'markdown_phpextra',
    'markdown_strict',
    'mediawiki',
    'native',
    'odt',
    'org',
    'rst',
    'textile',
    'typst'
];

const OUTPUT_FORMATS = [
    'ansi',
    'asciidoc',
    'asciidoc_legacy',
    'asciidoctor',
    'beamer',
    'biblatex',
    'bibtex',
    'bbcode',
    'bbcode_fluxbb',
    'bbcode_hubzilla',
    'bbcode_phpbb',
    'bbcode_steam',
    'bbcode_xenforo',
    'commonmark',
    'commonmark_x',
    'context',
    'csljson',
    'chunkedhtml',
    'djot',
    'docbook',
    'docbook4',
    'docbook5',
    'docx',
    'dokuwiki',
    'dzslides',
    'epub',
    'epub2',
    'epub3',
    'fb2',
    'gfm',
    'haddock',
    'html',
    'html4',
    'html5',
    'icml',
    'ipynb',
    'jats',
    'jats_archiving',
    'jats_articleauthoring',
    'jats_publishing',
    'jira',
    'json',
    'latex',
    'man',
    'markdown',
    'markdown_github',
    'markdown_mmd',
    'markdown_phpextra',
    'markdown_strict',
    'markua',
    'mediawiki',
    'ms',
    'muse',
    'native',
    'odt',
    'opendocument',
    'opml',
    'org',
    'pdf',
    'plain',
    'pptx',
    'revealjs',
    'rst',
    'rtf',
    's5',
    'slideous',
    'slidy',
    'tei',
    'texinfo',
    'textile',
    'typst',
    'vimdoc',
    'xml',
    'xwiki',
    'zimwiki'
];

const MARKDOWN_EXTENSIONS: string[] = [];

const HIGHLIGHT_STYLES = ['default', 'breezedark', 'espresso', 'haddock', 'kate', 'monochrome', 'pygments', 'tango', 'zenburn'];

export const FALLBACK_OPTIONS: OptionSpec[] = postProcessOptionMetadata(
    metadataToOptionSpecs(FALLBACK_PANDOC_OPTIONS_METADATA as PandocOptionsMetadata)
).map(enrichFallbackOptionValues);

export const FALLBACK_PANDOC_CATALOG: PandocOptionCatalog = {
    source: 'fallback',
    options: FALLBACK_OPTIONS,
    inputFormats: INPUT_FORMATS,
    outputFormats: OUTPUT_FORMATS,
    markdownExtensions: MARKDOWN_EXTENSIONS,
    extensionDescriptions: FALLBACK_EXTENSION_DESCRIPTIONS,
    formatExtensions: {},
    highlightStyles: HIGHLIGHT_STYLES
};

function enrichFallbackOptionValues(option: OptionSpec): OptionSpec {
    if (option.key === '--highlight-style') {
        return enrichStyleValues(option, HIGHLIGHT_STYLES);
    }
    if (option.key === '--syntax-highlighting') {
        return enrichStyleValues(option, HIGHLIGHT_STYLES);
    }
    return option;
}

function enrichStyleValues(option: OptionSpec, values: string[]): OptionSpec {
    return {
        ...option,
        valueAlternatives: option.valueAlternatives?.map(alternative => alternative.id === 'STYLE'
            ? { ...alternative, values: mergeValues(alternative.values, values) }
            : alternative)
    };
}

function mergeValues(...groups: Array<string[] | undefined>): string[] {
    return Array.from(new Set(groups.flatMap(group => group ?? [])));
}
