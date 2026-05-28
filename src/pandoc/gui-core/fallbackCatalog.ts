import type { OptionSpec, PandocOptionCatalog } from './types';

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

export const FALLBACK_OPTIONS: OptionSpec[] = [
    spec('-f', ['-r', '--from', '--read'], 'from', 'Input format.', 'format', 'FORMAT', 'from'),
    spec('-t', ['-w', '--to', '--write'], 'to', 'Output format.', 'format', 'FORMAT', 'to'),
    spec('-o', ['--output'], 'output', 'Write output to a file.', 'file', 'FILE', 'output'),
    spec('--data-dir', [], 'data-dir', 'Pandoc user data directory.', 'directory', 'DIRECTORY'),
    spec('-d', ['--defaults'], 'defaults', 'Defaults file.', 'file', 'FILE'),
    spec('-s', ['--standalone'], 'standalone', 'Produce a standalone document.', 'none', undefined, 'standalone'),
    spec('-M', ['--metadata'], 'metadata', 'Set a metadata field.', 'keyValue', 'KEY=VALUE', 'metadata', true),
    spec('-V', ['--variable'], 'variable', 'Set a template variable.', 'keyValue', 'KEY=VALUE', 'variable', true),
    spec('--variable-json', [], 'variable-json', 'Set a template variable from JSON.', 'keyValue', 'KEY=JSON', 'variable', true),
    spec('-F', ['--filter'], 'filter', 'Run an executable filter.', 'path', 'PROGRAM', undefined, true),
    spec('-L', ['--lua-filter'], 'lua-filter', 'Run a Lua filter.', 'file', 'SCRIPT', 'luaFilter', true),
    spec('--resource-path', [], 'resource-path', 'Search path for images and other resources.', 'pathList', 'SEARCHPATH', 'resourcePath', true),
    spec('--eol', [], 'eol', 'Line endings in generated text output.', 'enum', 'crlf|lf|native', undefined, false, ['crlf', 'lf', 'native']),
    spec('--wrap', [], 'wrap', 'Text wrapping in generated source output.', 'enum', 'auto|none|preserve', undefined, false, ['auto', 'none', 'preserve']),
    spec('--columns', [], 'columns', 'Column width for text wrapping.', 'integer', 'NUMBER'),
    spec('--toc', ['--table-of-contents'], 'toc', 'Include a table of contents.', 'none'),
    spec('--toc-depth', [], 'toc-depth', 'Number of section levels in the table of contents.', 'integer', 'NUMBER'),
    spec('-N', ['--number-sections'], 'number-sections', 'Number section headings.', 'none'),
    spec('--number-offset', [], 'number-offset', 'Offset for section heading numbers.', 'string', 'NUMBERS'),
    spec('--template', [], 'template', 'Template file or URL.', 'file', 'FILE'),
    spec('--reference-doc', [], 'reference-doc', 'Reference document for docx/odt output.', 'file', 'FILE'),
    spec('--css', ['-c'], 'css', 'CSS file or URL for HTML output.', 'path', 'URL', undefined, true),
    spec('--include-in-header', ['-H'], 'include-in-header', 'File included in document header.', 'file', 'FILE', undefined, true),
    spec('--include-before-body', ['-B'], 'include-before-body', 'File included before document body.', 'file', 'FILE', undefined, true),
    spec('--include-after-body', ['-A'], 'include-after-body', 'File included after document body.', 'file', 'FILE', undefined, true),
    spec('--reference-location', [], 'reference-location', 'Reference placement in generated output.', 'enum', 'block|section|document', undefined, false, ['block', 'section', 'document']),
    spec('--figure-caption-position', [], 'figure-caption-position', 'Figure caption placement.', 'enum', 'above|below', undefined, false, ['above', 'below']),
    spec('--table-caption-position', [], 'table-caption-position', 'Table caption placement.', 'enum', 'above|below', undefined, false, ['above', 'below']),
    spec('--markdown-headings', [], 'markdown-headings', 'Markdown heading style.', 'enum', 'setext|atx', undefined, false, ['setext', 'atx']),
    spec('--top-level-division', [], 'top-level-division', 'Top-level heading division type.', 'enum', 'default|section|chapter|part', undefined, false, ['default', 'section', 'chapter', 'part']),
    spec('--email-obfuscation', [], 'email-obfuscation', 'HTML email obfuscation method.', 'enum', 'none|javascript|references', undefined, false, ['none', 'javascript', 'references']),
    spec('--highlight-style', [], 'highlight-style', 'Syntax highlighting style or file.', 'enum', 'STYLE', undefined, false, HIGHLIGHT_STYLES),
    spec('--syntax-highlighting', [], 'syntax-highlighting', 'Syntax highlighting mode.', 'enum', 'STYLE', undefined, false, ['default', 'none', 'idiomatic', ...HIGHLIGHT_STYLES]),
    spec('--pdf-engine', [], 'pdf-engine', 'Program used to create PDF output.', 'string', 'PROGRAM'),
    spec('--pdf-engine-opt', [], 'pdf-engine-opt', 'Option passed to the PDF engine.', 'string', 'STRING', undefined, true),
    spec('--citeproc', ['-C'], 'citeproc', 'Process citations.', 'none'),
    spec('--bibliography', [], 'bibliography', 'Bibliography file.', 'file', 'FILE', undefined, true),
    spec('--csl', [], 'csl', 'Citation style file.', 'file', 'FILE'),
    spec('--mathjax', [], 'mathjax', 'Render TeX math using MathJax.', 'string', 'URL'),
    spec('--katex', [], 'katex', 'Render TeX math using KaTeX.', 'string', 'URL'),
    spec('--embed-resources', [], 'embed-resources', 'Embed linked resources in supported output.', 'none'),
    spec('--extract-media', [], 'extract-media', 'Extract embedded media to a path.', 'path', 'PATH')
];

export const FALLBACK_PANDOC_CATALOG: PandocOptionCatalog = {
    source: 'fallback',
    options: FALLBACK_OPTIONS,
    inputFormats: INPUT_FORMATS,
    outputFormats: OUTPUT_FORMATS,
    markdownExtensions: MARKDOWN_EXTENSIONS,
    formatExtensions: {},
    highlightStyles: HIGHLIGHT_STYLES
};

function spec(
    key: string,
    aliases: string[],
    name: string,
    description: string,
    valueKind: OptionSpec['valueKind'],
    valuePlaceholder?: string,
    mapsTo?: OptionSpec['mapsTo'],
    repeatable = false,
    values?: string[]
): OptionSpec {
    return { key, aliases, name, description, valueKind, valuePlaceholder, mapsTo, repeatable, values };
}
