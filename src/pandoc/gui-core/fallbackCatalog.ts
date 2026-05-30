import type { OptionSpec, PandocOptionCatalog } from './types';
import { FALLBACK_EXTENSION_DESCRIPTIONS } from './fallbackExtensionDescriptions';
import FALLBACK_PANDOC_OPTIONS_METADATA from '../metadata/pandoc-options.json';
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
    'asciidoc',
    'beamer',
    'commonmark',
    'commonmark_x',
    'context',
    'docx',
    'epub',
    'gfm',
    'html',
    'html5',
    'ipynb',
    'json',
    'latex',
    'markdown',
    'mediawiki',
    'odt',
    'opml',
    'pdf',
    'pptx',
    'rst',
    'rtf',
    'textile',
    'typst'
];

const MARKDOWN_EXTENSIONS: string[] = [];

const HIGHLIGHT_STYLES = ['default', 'breezedark', 'espresso', 'haddock', 'kate', 'monochrome', 'pygments', 'tango', 'zenburn'];

export const FALLBACK_OPTIONS: OptionSpec[] = metadataToOptionSpecs(
    FALLBACK_PANDOC_OPTIONS_METADATA as PandocOptionsMetadata
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
        return enrichPresetValues(option, HIGHLIGHT_STYLES);
    }
    if (option.key === '--syntax-highlighting') {
        return enrichPresetValues(option, mergeValues(option.values, HIGHLIGHT_STYLES));
    }
    return option;
}

function enrichPresetValues(option: OptionSpec, values: string[]): OptionSpec {
    return {
        ...option,
        values,
        valueAlternatives: option.valueAlternatives?.map(alternative => alternative.id === 'preset'
            ? { ...alternative, values: mergeValues(alternative.values, values) }
            : alternative)
    };
}

function mergeValues(...groups: Array<string[] | undefined>): string[] {
    return Array.from(new Set(groups.flatMap(group => group ?? [])));
}
