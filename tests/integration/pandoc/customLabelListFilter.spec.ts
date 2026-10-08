import { execFileSync } from 'child_process';
import { copyFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { strFromU8, unzipSync } from 'fflate';

import { PlaceholderContext } from '../../../src/shared/utils/placeholderProcessor';
import { ListPatterns } from '../../../src/shared/patterns';
import { buildPandocProfileArgs } from '../../../src/pandoc/core/args/profileArgs';
import { ExportVariables } from '../../../src/pandoc/core/export/types';

const filter = resolve(__dirname, '../../../lua_filter/CustomLabelList.lua');
const sourceReader = resolve(__dirname, '../../../lua_filter/CustomLabelReader.lua');

function hasPandoc(): boolean {
    try {
        execFileSync('pandoc', ['--version'], { timeout: 3000 });
        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
        throw error;
    }
}

function render(source: string, reader = `${sourceReader}-smart`, extraArgs: string[] = []): string {
    return execFileSync('pandoc', [
        '-f', reader, '--preserve-tabs', '-t', 'html', '--lua-filter', filter, ...extraArgs
    ], { input: source, encoding: 'utf8', timeout: 5000 });
}

// Exercise the real Lua filter, not the Jest .lua import mock. Pandoc remains
// optional for development and is never introduced into plugin startup.
const pandocDescribe = hasPandoc() ? describe : describe.skip;

pandocDescribe('CustomLabelList Pandoc filter', () => {
    it.each([true, false])('loads copied shared support outside the script directory (reader: %j)', useReader => {
        const directory = mkdtempSync(join(tmpdir(), 'custom label bundle '));
        try {
            for (const name of ['CustomLabelReader.lua', 'CustomLabelList.lua', 'CustomLabelSupport.lua']) {
                copyFileSync(resolve(__dirname, '../../../lua_filter', name), join(directory, name));
            }
            const source = useReader
                ? '\\{::P(#ignored)} literal\n{::P(#a\tb)} first\n{::P(#a b)} second\n\nSee {::P(#a\tb)}, {::P(#a b)}.'
                : '{::P(#a)} **body**\n\nSee {::P(#a)}.';
            const output = execFileSync('pandoc', [
                '-f', useReader ? `${join(directory, 'CustomLabelReader.lua')}-smart` : 'markdown-smart',
                '--preserve-tabs', '-t', 'html', '--lua-filter', join(directory, 'CustomLabelList.lua')
            ], { input: source, encoding: 'utf8', cwd: tmpdir(), timeout: 5000 });
            expect(output).toContain(useReader ? '<p>See (P1), (P2).</p>' : '<p>See (P1).</p>');
            expect(output).not.toContain('data-pem-custom-label');
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    });

    it('retains ordinary filter-only CLI support', () => {
        expect(render('{::P(#a)} **body**\n\nSee {::P(#a)}.', 'markdown-smart'))
            .toContain('<p>See (P1).</p>');
    });

    it.each(['  ', '\t', ' \t '])('keeps placeholder names distinct for %j', whitespace => {
        const labels = [`P(#a${whitespace}b)`, 'P(#a b)'];
        const context = new PlaceholderContext();
        const expected = labels.map(label => `(${context.processLabel(label)})`);
        const output = render(labels.map(label => `{::${label}} body`).join('\n')
            + `\n\nSee {::${labels[0]}} and {::${labels[1]}}.`);
        const dom = new DOMParser().parseFromString(output, 'text/html');
        expect([...dom.querySelectorAll('dt')].map(term => term.textContent)).toEqual(expected);
        expect(dom.querySelector('p')?.textContent).toBe(`See ${expected.join(' and ')}.`);
    });

    it('matches manual labels using exact source whitespace', () => {
        const context = new PlaceholderContext();
        context.processLabel('Alpha  Beta');
        expect(context.getProcessedLabel('Alpha Beta')).toBeNull();
        expect(render('{::Alpha  Beta} body\n\nSee {::Alpha Beta} and {::Alpha  Beta}.'))
            .toContain('<p>See {::Alpha Beta} and (Alpha  Beta).</p>');
    });

    it('does not allocate a number for an escaped definition', () => {
        const literal = '\\{::P(#a)} literal text';
        expect(ListPatterns.isCustomLabelList(literal)).toBeNull();
        const output = render(`${literal}\n{::P(#b)} actual item\n\nSee {::P(#a)}, {::P(#b)}.`);
        expect(output).toContain('<p>{::P(#a)} literal text</p>');
        expect(output).toContain('<dt>(P1)</dt>');
        expect(output).not.toContain('(P2)');
        expect(output).toContain('<p>See {::P(#a)}, (P1).</p>');
    });

    it.each([' ', '  ', '\t', '   '])('registers a marker-only line followed by %j', whitespace => {
        expect(ListPatterns.isCustomLabelList(`{::P}${whitespace}`)).not.toBeNull();
        const output = render(`{::P}${whitespace}\nBody\n\nSee {::P}.`);
        const dom = new DOMParser().parseFromString(output, 'text/html');
        expect(dom.querySelector('dt')?.textContent).toBe('(P)');
        expect(dom.querySelector('dd')?.textContent?.trim()).toBe('Body');
        expect(dom.querySelector('p')?.textContent).toBe('See (P).');
        expect(dom.querySelectorAll('br')).toHaveLength(whitespace === ' ' ? 0 : 1);
    });

    it.each(['{::P} ', '{::P}  \n\nSee {::P}.'])('registers an empty item: %j', source => {
        const dom = new DOMParser().parseFromString(render(source), 'text/html');
        expect(dom.querySelector('dt')?.textContent).toBe('(P)');
        expect(dom.querySelector('dd')?.textContent?.trim()).toBe('');
    });

    it('keeps escaped references literal and removes internal boundaries', () => {
        const output = render('{::P(#a)} body\n\nSee \\{::P(#a)} and {::P(#a)}.');
        expect(output).toContain('<p>See {::P(#a)} and (P1).</p>');
        expect(output).not.toMatch(/PEMCUSTOMLABEL|data-pem-custom-label|<span/);
    });

    it.each([1, 2, 3, 4])('preserves Markdown backslash parity with %i backslashes', count => {
        const slashes = '\\'.repeat(count);
        const output = render(`{::P} body\n\nSee ${slashes}{::P}.`);
        expect(output).toContain(`<p>See ${'\\'.repeat(Math.floor(count / 2))}`
            + `${count % 2 ? '{::P}' : '(P)'}.</p>`);
    });

    it.each([
        '```\n{::P(#a\tb)}\tcode\n\\{::P} literal\n```',
        '`{::P(#a\tb)}` and `{::P} `',
        '    {::P(#a\tb)}\tcode',
        '$\\{::P(#a  b)}$ and $$ {::P}  $$',
        '<pre>\\{::P(#a  b)} raw</pre>',
        '[link](<https://example.com/{::Alpha  Beta}>)',
        '![alt](<foo{::Alpha  Beta}.png>)',
        '[link](<https://example.com/\\{::P}>)',
        '::: {.box title="{::Alpha  Beta} body"}\nordinary\n:::',
        '---\nlabel: "{::Alpha  Beta} text"\n---\n\nordinary'
    ])('restores opaque content without leaking tokens: %j', source => {
        const options = { input: source, encoding: 'utf8' as const, timeout: 5000 };
        const actual = execFileSync('pandoc', [
            '-f', `${sourceReader}-smart`, '--preserve-tabs', '-t', 'json', '--lua-filter', filter
        ], options);
        const expected = execFileSync('pandoc', ['-f', 'markdown-smart', '-t', 'json'], options);
        expect(JSON.parse(actual)).toEqual(JSON.parse(expected));
        expect(actual).not.toMatch(/[\u200b\u200c\u2060\u2063]|data-pem-custom-label/);
    });

    it('avoids token collisions with source text', () => {
        const output = render('\u2060 \u2060\u2060\n\n'
            + '{::P(#a  b)} body\n{::P(#a b)} other');
        expect(output).toContain('<p>\u2060 \u2060\u2060</p>');
        expect(output).toContain('<dt>(P2)</dt>');
        expect(output).not.toContain('\u2060\u2060\u2060');
    });

    it('preserves fixed-width table boundaries and original column widths', () => {
        const output = render('+-----------------------+\n| {::P(#a  b)} body     |\n'
            + '+=======================+\n| {::P(#a b)} body      |\n+-----------------------+');
        const dom = new DOMParser().parseFromString(output, 'text/html');
        expect(dom.querySelector('thead th dt')?.textContent).toBe('(P1)');
        expect(dom.querySelector('tbody td dt')?.textContent).toBe('(P2)');
        expect(dom.querySelector('col')?.getAttribute('style')).toBe('width: 33%');
        expect(output).not.toMatch(/[\u200b\u200c\u2060\u2063]|data-pem-custom-label/);
    });

    it.each(['{::Alpha  *Beta*} body', '{::Alpha*\t*Beta} body', '{::*a\t*b} body'])
    ('retains Markdown inline boundaries inside labels: %j', source => {
        const options = { input: source, encoding: 'utf8' as const, timeout: 5000 };
        const actual = execFileSync('pandoc', [
            '-f', `${sourceReader}-smart`, '--preserve-tabs', '-t', 'html', '--lua-filter', filter
        ], options);
        if (source === '{::Alpha*\t*Beta} body') {
            expect(actual).toContain('<dt>(Alpha*\t*Beta)</dt>');
        } else {
            expect(actual).toBe(execFileSync('pandoc', ['-f', 'markdown-smart', '-t', 'html'], options));
        }
    });

    it('preserves tab indentation and tab-stop options outside labels', () => {
        const source = '\t{::P(#code)} code\n\n{::P(#a\tb)}\tbody\n\tcontinuation';
        const output = render(source, `${sourceReader}-smart`, ['--tab-stop=8']);
        expect(output).toContain('<code>{::P(#code)} code</code>');
        expect(output).toContain('<dt>(P1)</dt>');
        expect(output).toContain('continuation');
    });

    it.each(['html', 'docx', 'odt', 'rtf'])('preserves source-sensitive numbering in %s', format => {
        const data = execFileSync('pandoc', [
            '-f', `${sourceReader}-smart`, '--preserve-tabs', '-t', format, '--lua-filter', filter
        ], {
            input: '\\{::P(#escaped)} LITERAL\n{::P(#a\tb)} FIRST\n{::P(#a b)}  \nBODY\n\n'
                + 'See {::P(#a\tb)}, {::P(#a b)}.', timeout: 5000
        });
        const output = format === 'docx' || format === 'odt'
            ? strFromU8(unzipSync(new Uint8Array(data))[
                format === 'docx' ? 'word/document.xml' : 'content.xml'
            ]) : data.toString('utf8');
        for (const token of ['LITERAL', 'FIRST', 'BODY', '(P1)', '(P2)']) expect(output).toContain(token);
        expect(output).not.toMatch(/PEMCUSTOMLABEL|data-pem-custom-label|\(P3\)/);
    });

    it('automatically exports custom labels and fenced divs without configured filters', () => {
        const variables = {
            currentPath: '-', fromFormat: 'markdown-smart+wikilinks_title_after_pipe',
            outputPath: '-', outputExtension: '.html',
            luaFilterDir: resolve(__dirname, '../../../lua_filter')
        } as ExportVariables;
        const args = buildPandocProfileArgs({
            profile: {
                id: 'saved', name: 'Saved', type: 'pandoc', to: 'html', extension: '.html'
            }, variables
        });
        const output = execFileSync('pandoc', args, {
            input: '::: {.theorem #thm title="Theorem &"}\n'
                + '\\{::P(#ignored)} literal\n{::P(#a\tb)} first\n{::P(#a b)} second\n:::\n\n'
                + 'See @thm, {::P(#a\tb)}, {::P(#a b)}, [[Note|Alias]].',
            encoding: 'utf8', timeout: 5000
        });
        expect(output).toContain('Theorem 1');
        expect(output).toContain('<dt>(P1)</dt>');
        expect(output).toContain('<dt>(P2)</dt>');
        expect(output).toContain('See Theorem 1, (P1), (P2),');
        expect(output).toContain('>Alias</a>');
        expect(output).not.toMatch(/PEMCUSTOMLABEL|data-pem-custom-label/);
    });

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
        const data = execFileSync('pandoc', ['-f', `${sourceReader}-smart`, '-t', format, '--lua-filter', filter], {
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
        const args = ['-f', `${sourceReader}-smart`, '-t', 'json'];
        const options = { input: source, encoding: 'utf8' as const, timeout: 5000 };
        expect(JSON.parse(execFileSync('pandoc', [...args, '--lua-filter', filter], options)))
            .toEqual(JSON.parse(execFileSync('pandoc', args, options)));
    });

    it('keeps label and body separate in Word output, including invalid markers', () => {
        const data = execFileSync('pandoc', ['-f', `${sourceReader}-smart`, '-t', 'docx', '--lua-filter', filter], {
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
        const output = execFileSync('pandoc', ['-f', `${sourceReader}-smart`, '-t', 'latex', '--lua-filter', filter], {
            input: '{::P(#a)} **body**\nContinuation\n\nSee {::P(#a)}.', encoding: 'utf8', timeout: 5000
        });
        expect(output).toContain('\\item[(P1)]');
        expect(output).toContain('\\textbf{body}');
        expect(output).toContain('Continuation');
        expect(output).toContain('See (P1).');
    });
});
