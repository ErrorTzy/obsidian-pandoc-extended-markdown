const FORMAT_EXTENSIONS: Record<string, string> = {
    asciidoc: '.adoc',
    asciidoctor: '.adoc',
    beamer: '.tex',
    biblatex: '.bib',
    bibtex: '.bib',
    commonmark: '.md',
    commonmark_x: '.md',
    commonmark_xrepl: '.md',
    context: '.tex',
    csljson: '.json',
    docbook: '.xml',
    docbook4: '.xml',
    docbook5: '.xml',
    docx: '.docx',
    dokuwiki: '.dokuwiki',
    dzslides: '.html',
    epub: '.epub',
    epub2: '.epub',
    epub3: '.epub',
    gfm: '.md',
    haddock: '.haddock',
    html: '.html',
    html4: '.html',
    html5: '.html',
    icml: '.icml',
    ipynb: '.ipynb',
    jira: '.jira',
    json: '.json',
    latex: '.tex',
    man: '.man',
    markdown: '.md',
    markdown_github: '.md',
    markdown_mmd: '.md',
    markdown_phpextra: '.md',
    markdown_strict: '.md',
    mediawiki: '.mediawiki',
    ms: '.ms',
    muse: '.muse',
    native: '.native',
    odt: '.odt',
    opml: '.opml',
    org: '.org',
    pdf: '.pdf',
    plain: '.txt',
    pptx: '.pptx',
    revealjs: '.html',
    rst: '.rst',
    rtf: '.rtf',
    s5: '.html',
    slideous: '.html',
    slidy: '.html',
    tei: '.xml',
    texinfo: '.texi',
    textile: '.textile',
    typst: '.typ',
    xwiki: '.xwiki',
    zimwiki: '.zimwiki'
};

export function inferOutputExtension(format: string | undefined, fallback = '.html'): string {
    const normalized = normalizeFormat(format);
    if (!normalized) return normalizeExtension(fallback);

    return FORMAT_EXTENSIONS[normalized] ?? normalizeExtension(fallback);
}

export function getPathExtension(path: string): string {
    const name = path.split(/[\\/]/).pop() ?? path;
    const index = name.lastIndexOf('.');

    return index > 0 ? name.slice(index) : '';
}

function normalizeFormat(format: string | undefined): string {
    const trimmed = format?.trim();
    if (!trimmed || trimmed.includes('${')) return '';

    return trimmed.split(/[+-]/)[0].toLowerCase();
}

function normalizeExtension(extension: string): string {
    const trimmed = extension.trim();
    if (!trimmed) return '';

    return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
}
