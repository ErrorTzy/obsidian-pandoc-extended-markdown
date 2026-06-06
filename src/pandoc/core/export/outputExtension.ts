const FORMAT_EXTENSIONS: Record<string, string> = {
    ansi: '.ansi',
    asciidoc: '.adoc',
    asciidoc_legacy: '.adoc',
    asciidoctor: '.adoc',
    bbcode: '.bbcode',
    bbcode_fluxbb: '.bbcode',
    bbcode_hubzilla: '.bbcode',
    bbcode_phpbb: '.bbcode',
    bbcode_steam: '.bbcode',
    bbcode_xenforo: '.bbcode',
    beamer: '.tex',
    biblatex: '.bib',
    bibtex: '.bib',
    chunkedhtml: '.html',
    commonmark: '.md',
    commonmark_x: '.md',
    commonmark_xrepl: '.md',
    context: '.tex',
    csljson: '.json',
    djot: '.dj',
    docbook: '.xml',
    docbook4: '.xml',
    docbook5: '.xml',
    docx: '.docx',
    dokuwiki: '.dokuwiki',
    dzslides: '.html',
    epub: '.epub',
    epub2: '.epub',
    epub3: '.epub',
    fb2: '.fb2',
    gfm: '.md',
    haddock: '.haddock',
    html: '.html',
    html4: '.html',
    html5: '.html',
    icml: '.icml',
    ipynb: '.ipynb',
    jats: '.xml',
    jats_archiving: '.xml',
    jats_articleauthoring: '.xml',
    jats_publishing: '.xml',
    jira: '.jira',
    json: '.json',
    latex: '.tex',
    man: '.man',
    markdown: '.md',
    markdown_github: '.md',
    markdown_mmd: '.md',
    markdown_phpextra: '.md',
    markdown_strict: '.md',
    markua: '.markua',
    mediawiki: '.mediawiki',
    ms: '.ms',
    muse: '.muse',
    native: '.native',
    odt: '.odt',
    opendocument: '.fodt',
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
    vimdoc: '.vim',
    xml: '.xml',
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
