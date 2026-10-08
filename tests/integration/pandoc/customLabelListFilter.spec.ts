import { execFileSync } from 'child_process';
import { resolve } from 'path';
import { strFromU8, unzipSync } from 'fflate';

import { PlaceholderContext } from '../../../src/shared/utils/placeholderProcessor';

const filter = resolve(__dirname, '../../../lua_filter/CustomLabelList.lua');

function hasPandoc(): boolean {
    try {
        execFileSync('pandoc', ['--version'], { timeout: 3000 });
        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
        throw error;
    }
}

function render(source: string, reader = 'markdown-smart', extraArgs: string[] = []): string {
    return execFileSync('pandoc', [
        '-f', reader, '-t', 'html', '--lua-filter', filter, ...extraArgs
    ], { input: source, encoding: 'utf8', timeout: 5000 });
}

// Exercise the real Lua filter, not the Jest .lua import mock. Pandoc remains
// optional for development and is never introduced into plugin startup.
const pandocDescribe = hasPandoc() ? describe : describe.skip;

pandocDescribe('CustomLabelList Pandoc filter', () => {
    it('numbers definitions and forward references while preserving body markup', () => {
        const output = render('See {::P(#a)} and {::Q(#b)}.\n\n'
            + '{::P(#a)} **bold** [link](https://example.com)\n{::Q(#b)} second');
        expect(output).toContain('<p>See (P1) and (Q2).</p>');
        expect(output).toContain('<dt>(P1)</dt>');
        expect(output).toContain('<dt>(Q2)</dt>');
        expect(output).toContain('<strong>bold</strong>');
        expect(output).toContain('<a href="https://example.com">link</a>');
    });

    it.each(['\n', '  \n'])('preserves surrounding lines and continuation breaks %j', separator => {
        const output = render(`BEFORE${separator}{::P} body${separator}AFTER${separator}{::Q} tail`);
        const dom = new DOMParser().parseFromString(output, 'text/html');
        expect(dom.body.firstElementChild?.textContent).toBe('BEFORE');
        expect([...dom.querySelectorAll('dt')].map(term => term.textContent)).toEqual(['(P)', '(Q)']);
        expect(dom.querySelector('dd')?.textContent).toMatch(/body\s*AFTER/);
        expect(dom.querySelectorAll('br')).toHaveLength(separator.startsWith(' ') ? 1 : 0);
    });

    it.each([
        ['div', '::: box\n{::P(#a)} body\n:::', 'div.box'],
        ['quote', '> {::P(#a)} body', 'blockquote'],
        ['bullet', '- {::P(#a)} body', 'ul > li'],
        ['ordered', '1. {::P(#a)} body', 'ol > li'],
        ['definition', 'Term\n: {::P(#a)} body', 'dd'],
        ['table', '| Cell |\n| --- |\n| {::P(#a)} body |', 'td'],
        ['note', 'Text[^n]\n\n[^n]: {::P(#a)} body', 'li#fn1'],
        ['nested containers', '::: box\n> - {::P(#a)} body\n:::', 'div.box > blockquote > ul > li']
    ])('registers definitions in a %s without flattening it', (_name, source, selector) => {
        const output = render(`${source}\n\nSee {::P(#a)}.`);
        const dom = new DOMParser().parseFromString(output, 'text/html');
        expect(dom.querySelector(`${selector} dt`)?.textContent).toBe('(P1)');
        expect(output).toContain('<p>See (P1).</p>');
        expect(output).not.toContain('{::P(#a)}');
    });

    it('allocates in document order across containers and notes', () => {
        const output = render('See {::P(#a)}, {::P(#b)}, {::P(#c)}, {::P(#d)}.\n\n'
            + '::: box\n{::P(#a)} first\n:::\n\n'
            + '> {::P(#b)} second\n\n'
            + 'Text[^n]\n{::P(#d)} fourth\n\n[^n]: {::P(#c)} third');
        expect(output).toContain('<p>See (P1), (P2), (P3), (P4).</p>');
    });

    const referenceCases = [
        ['P(#a),(#b)', 'P1,2'], ['(#a)+(#b)', '1+2'],
        ["P(#a)'", "P1'"], ['UNDEFINED+(#a)', null],
        ['P(#never)', null], ['(#never)', null], ['P(#a)+(#never)', null],
        ['UNDEFINED(#a)', null], ['P', null], ['P1', 'P1'],
        ['Theorem1', null], ["Theorem10'", "Theorem10'"],
        ["Lemma1'", "Lemma1'"], ['Lemma', null]
    ] as const;

    it.each(referenceCases)('resolves %s using the shared reference semantics', (reference, expected) => {
        const labels = ['P(#a)', 'P(#b)', "Theorem10'''", "Lemma1'''"];
        const context = new PlaceholderContext();
        labels.forEach(label => context.processLabel(label));
        expect(context.getProcessedLabel(reference)).toBe(expected);
        const output = render(labels.map(label => `{::${label}} body`).join('\n')
            + `\n\nSee {::${reference}}.`);
        expect(output).toContain(`<p>See ${expected === null ? `{::${reference}}` : `(${expected})`}.</p>`);
    });

    it.each(['\u00a0', '\u2003', '\u202f'])('matches plugin whitespace semantics for %j', whitespace => {
        const reference = `P(#a)${whitespace}+(#b)`;
        const context = new PlaceholderContext();
        context.processLabel('P(#a)');
        context.processLabel('Q(#b)');
        const output = render(`{::P(#a)}${whitespace}**body**\n{::Q(#b)} tail\n\nSee {::${reference}}.`);
        const dom = new DOMParser().parseFromString(output, 'text/html');
        expect([...dom.querySelectorAll('dt')].map(term => term.textContent)).toEqual(['(P1)', '(Q2)']);
        expect(dom.querySelector('strong')?.textContent).toBe('body');
        expect(dom.querySelector('p')?.textContent).toBe(`See (${context.getProcessedLabel(reference)}).`);
    });

    it('keeps unknown placeholders unresolved even when a manual label could alias them', () => {
        expect(render('{::P1} manual\n\nSee {::P(#never)} and {::(#never)}.'))
            .toContain('<p>See {::P(#never)} and {::(#never)}.</p>');
        expect(render('Unknown {::(#never)}.')).toContain('<p>Unknown {::(#never)}.</p>');
    });

    it.each([2, 6, 32])('parses names of %i words and adjacent references without token limits', count => {
        const name = Array.from({ length: count }, (_unused, index) => `word${index}`).join(' ');
        const output = render(`{::P(#${name})} **body**\n\n`
            + `See pre{::P(#${name})}mid{::P(#${name})}post.`);
        expect(output).toContain('<dt>(P1)</dt>');
        expect(output).toContain('<strong>body</strong>');
        expect(output).toContain('<p>See pre(P1)mid(P1)post.</p>');
    });

    it.each(['{::P}**bold** tail', '{::P}word tail', '{::P}'])('rejects a definition without marker whitespace: %s', source => {
        const output = render(source);
        expect(output).not.toContain('<dl>');
        expect(output).toContain('{::P}');
        if (source.includes('bold')) expect(output).toContain('<strong>bold</strong>');
        if (source.includes('word')) expect(output).toContain('word tail');
    });

    it('leaves markers in code, raw content, and across inline boundaries untouched', () => {
        const output = render('{::P(#a)} body\n{::P(#one two)} other\n\n'
            + '`{::P(#a)}` and **{::P(#a)}**\n\n'
            + '```\n{::P(#code)} code\n```\n\n'
            + 'See {::P(#code)}, {::P(#one\ntwo)}, and {::P(#a)**broken**}.');
        expect(output).toContain('<code>{::P(#a)}</code>');
        expect(output).toContain('<strong>(P1)</strong>');
        expect(output).toContain('{::P(#code)}');
        expect(output).toMatch(/\{::P\(#one\s+two\)\}/);
        expect(output).toContain('{::P(#a)<strong>broken</strong>}');
    });

    it('preserves content across generated mixtures of list and ordinary lines', () => {
        for (const separator of ['\n', '  \n']) {
            for (const prefix of ['', `**BEFORE**${separator}`]) {
                for (const continuation of ['', `${separator}*CONTINUATION*`]) {
                    const output = render(`${prefix}{::P(#a)} **BODY**${continuation}`
                        + `${separator}{::Q(#b)} [TAIL](https://example.com)\n\nAFTER`);
                    const dom = new DOMParser().parseFromString(output, 'text/html');
                    expect([...dom.querySelectorAll('dt')].map(term => term.textContent))
                        .toEqual(['(P1)', '(Q2)']);
                    expect(dom.querySelectorAll('strong')).toHaveLength(prefix ? 2 : 1);
                    expect(dom.querySelectorAll('em')).toHaveLength(continuation ? 1 : 0);
                    expect(dom.querySelector('dd a')?.textContent).toBe('TAIL');
                    expect(dom.body.lastElementChild?.textContent).toBe('AFTER');
                    const text = dom.body.textContent!;
                    for (const token of ['BODY', 'TAIL', 'AFTER', ...(prefix ? ['BEFORE'] : []),
                        ...(continuation ? ['CONTINUATION'] : [])]) {
                        expect(text.split(token)).toHaveLength(2);
                    }
                }
            }
        }
    });

    it('keeps lists in sibling containers separate from root-level lists', () => {
        const output = render('{::P(#a)} root\n\n::: box\n{::Q(#b)} inner\n:::\n\n{::R(#c)} root');
        const dom = new DOMParser().parseFromString(output, 'text/html');
        expect([...dom.body.children].map(block => block.tagName)).toEqual(['DL', 'DIV', 'DL']);
        expect(dom.querySelector('div.box > dl > dt')?.textContent).toBe('(Q2)');
    });

    it.each(['odt', 'rtf'])('keeps body markup and continuation content in %s', format => {
        const data = execFileSync('pandoc', ['-f', 'markdown-smart', '-t', format, '--lua-filter', filter], {
            input: '{::P(#a)} **BODY**\nCONTINUATION\n\nSee {::P(#a)}.', timeout: 5000
        });
        const output = format === 'odt'
            ? strFromU8(unzipSync(new Uint8Array(data))['content.xml']) : data.toString('utf8');
        for (const content of ['(P1)', 'BODY', 'CONTINUATION', 'See (P1).']) {
            expect(output).toContain(content);
        }
    });

    it('preserves unmatched inline nodes exactly', () => {
        const source = 'See pre{::P(#long unknown name)}post and [link](https://example.com).';
        const args = ['-f', 'markdown-smart', '-t', 'json'];
        const options = { input: source, encoding: 'utf8' as const, timeout: 5000 };
        expect(JSON.parse(execFileSync('pandoc', [...args, '--lua-filter', filter], options)))
            .toEqual(JSON.parse(execFileSync('pandoc', args, options)));
    });

    it('keeps label and body separate in Word output, including invalid markers', () => {
        const data = execFileSync('pandoc', ['-f', 'markdown-smart', '-t', 'docx', '--lua-filter', filter], {
            input: '{::P(#one two)} **BOLD_BODY** tail\nContinuation\n\n'
                + '{::INVALID}**KEEP_BOLD** tail\n\n{::OTHER}KEEP_WORD tail', timeout: 5000
        });
        const xml = strFromU8(unzipSync(new Uint8Array(data))['word/document.xml']);
        expect(xml).toContain('(P1)');
        expect(xml).toContain('BOLD_BODY');
        expect(xml).toContain('Continuation');
        expect(xml).toContain('KEEP_BOLD');
        expect(xml).toContain('KEEP_WORD');
        expect(xml).toContain('{::INVALID}');
        expect(xml).toContain('{::OTHER}');
    });

    it('uses native definition lists for LaTeX output', () => {
        const output = execFileSync('pandoc', ['-f', 'markdown-smart', '-t', 'latex', '--lua-filter', filter], {
            input: '{::P(#a)} **body**\nContinuation\n\nSee {::P(#a)}.', encoding: 'utf8', timeout: 5000
        });
        expect(output).toContain('\\item[(P1)]');
        expect(output).toContain('\\textbf{body}');
        expect(output).toContain('Continuation');
        expect(output).toContain('See (P1).');
    });
});
