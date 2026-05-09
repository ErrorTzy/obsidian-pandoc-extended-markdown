import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const filterPath = resolve(__dirname, 'FencedDivExtendedSyntax.lua');

interface PandocBlock {
    t: string;
    c?: unknown;
}

interface PandocInline {
    t: string;
    c?: unknown;
}

function runPandoc(
    markdown: string,
    args: string[] = ['-t', 'json']
): { status: number | null; stdout: string; stderr: string } {
    const result = spawnSync(
        'pandoc',
        ['-f', 'markdown', ...args, `--lua-filter=${filterPath}`],
        {
            input: markdown,
            encoding: 'utf8'
        }
    );

    return {
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr
    };
}

function renderBlocks(markdown: string): PandocBlock[] {
    const result = runPandoc(markdown);
    expect(result.status).toBe(0);
    return JSON.parse(result.stdout).blocks;
}

function inlineText(inlines: PandocInline[]): string {
    return inlines.map(inline => {
        if (inline.t === 'Str') return String(inline.c);
        if (inline.t === 'Space') return ' ';
        if (inline.t === 'SoftBreak' || inline.t === 'LineBreak') return '\n';
        return '';
    }).join('');
}

function divContent(block: PandocBlock): PandocBlock[] {
    return (block.c as [unknown, PandocBlock[]])[1];
}

function divAttr(block: PandocBlock): unknown {
    return (block.c as [unknown, PandocBlock[]])[0];
}

function renderFormat(markdown: string, format: string, extraArgs: string[] = []): string {
    const result = runPandoc(markdown, ['-t', format, ...extraArgs]);
    expect(result.status).toBe(0);
    return result.stdout;
}

describe('FencedDivExtendedSyntax.lua', () => {
    it('converts readable shorthand to a native Pandoc Div', () => {
        const blocks = renderBlocks([
            '::: Theorem #thm data=1',
            '',
            'content',
            '',
            ':::'
        ].join('\n'));

        expect(blocks[0].t).toBe('Div');
        expect((blocks[0].c as unknown[])[0]).toEqual([
            'thm',
            ['Theorem', 'pem-fenced-div'],
            [['data', '1'], ['title', 'Theorem']]
        ]);
    });

    it('preserves multi-block content inside readable shorthand Divs', () => {
        const blocks = renderBlocks([
            '::: Theorem #thm',
            '',
            'First paragraph.',
            '',
            '- one',
            '- two',
            '',
            'Second paragraph.',
            '',
            ':::'
        ].join('\n'));
        const content = divContent(blocks[0]);

        expect(content.slice(1).map(block => block.t)).toEqual(['Para', 'BulletList', 'Para']);
    });

    it('converts nested readable shorthand Divs', () => {
        const blocks = renderBlocks([
            '::: Outer #outer',
            '',
            'outer content',
            '',
            '::: Inner #inner',
            '',
            'inner content',
            '',
            ':::',
            '',
            ':::'
        ].join('\n'));
        const outerContent = divContent(blocks[0]);
        const inner = outerContent.find(block => {
            if (block.t !== 'Div') return false;
            const attr = divAttr(block) as [string, string[], Array<[string, string]>];
            return attr[0] === 'inner';
        });

        expect(divAttr(blocks[0])).toEqual([
            'outer',
            ['Outer', 'pem-fenced-div'],
            [['title', 'Outer']]
        ]);
        expect(inner?.t).toBe('Div');
        expect(inner ? divAttr(inner) : undefined).toEqual([
            'inner',
            ['Inner', 'pem-fenced-div'],
            [['title', 'Inner']]
        ]);
    });

    it('leaves unmatched readable shorthand openers and content intact with a warning', () => {
        const result = runPandoc([
            '::: Theorem #thm',
            '',
            'content'
        ].join('\n'));
        const blocks = JSON.parse(result.stdout).blocks as PandocBlock[];

        expect(result.status).toBe(0);
        expect(result.stderr).toContain('unmatched readable fenced div opener');
        expect(blocks.map(block => block.t)).toEqual(['Para', 'Para']);
    });

    it('replaces native fenced div citations with independently numbered reference text', () => {
        const blocks = renderBlocks([
            '::: {.proposition #prop:a title="Proposition &"}',
            'A proposition.',
            ':::',
            '',
            '::: {.remark #rem:a title="Remark &"}',
            'A remark.',
            ':::',
            '',
            '::: {.proposition #prop:b title="Proposition &"}',
            'Another proposition.',
            ':::',
            '',
            'See @prop:a, @rem:a, and @prop:b.'
        ].join('\n'));
        const firstDivContent = divContent(blocks[0]);
        const lastPara = blocks[blocks.length - 1];

        expect(JSON.stringify(firstDivContent[0])).toContain('pem-fenced-div-title');
        expect(JSON.stringify(firstDivContent[0])).toContain('Proposition 1');
        expect(inlineText(lastPara.c as PandocInline[])).toBe(
            'See Proposition 1, Remark 1, and Proposition 2.'
        );
    });

    it('uses title attributes before class and uses Div for id-only references', () => {
        const blocks = renderBlocks([
            '::: {.logic-block #prem:a title="Premise &"}',
            'A premise.',
            ':::',
            '',
            '::: {#misc:a}',
            'Misc content.',
            ':::',
            '',
            'See @prem:a and @misc:a.'
        ].join('\n'));
        const premiseContent = divContent(blocks[0]);
        const miscContent = divContent(blocks[1]);
        const lastPara = blocks[blocks.length - 1];

        expect(JSON.stringify(premiseContent[0])).toContain('Premise 1');
        expect(JSON.stringify(miscContent[0])).not.toContain('pem-fenced-div-title');
        expect(inlineText(lastPara.c as PandocInline[])).toBe('See Premise 1 and Div.');
    });

    it('supports hierarchical placeholders and no-num ampersand literals', () => {
        const blocks = renderBlocks([
            '::: {.case #c1 title="Case &"}',
            'First case.',
            ':::',
            '',
            '::: {.case #c1a title="Case &.&"}',
            'First subcase.',
            ':::',
            '',
            '::: {.case #c1b title="Case &.&"}',
            'Second subcase.',
            ':::',
            '',
            '::: {.case #c2 title="Case &"}',
            'Second case.',
            ':::',
            '',
            '::: {.case #c2a title="Case &.&"}',
            'Nested under second case.',
            ':::',
            '',
            '::: {.warning #warn .no-num title="AT&T Warning"}',
            'Literal ampersand.',
            ':::',
            '',
            'See @c1 @c1a @c1b @c2 @c2a @warn.'
        ].join('\n'));
        const lastPara = blocks[blocks.length - 1];

        expect(inlineText(lastPara.c as PandocInline[])).toBe(
            'See Case 1 Case 1.1 Case 1.2 Case 2 Case 2.1 AT&T Warning.'
        );
    });

    it('resolves readable shorthand references after internal normalization', () => {
        const blocks = renderBlocks([
            '::: Premise #prem:a',
            '',
            'Readable premise.',
            '',
            ':::',
            '',
            'See @prem:a.'
        ].join('\n'));
        const lastPara = blocks[blocks.length - 1];

        expect(inlineText(lastPara.c as PandocInline[])).toBe('See Premise.');
    });

    it('numbers readable shorthand placeholder classes through synthesized titles', () => {
        const blocks = renderBlocks([
            '::: Case & #c1',
            'Top-level case.',
            ':::',
            '',
            '::: Case &.& #c1a',
            'Nested case.',
            ':::',
            '',
            '::: & Note #n1',
            'Front-numbered note.',
            ':::',
            '',
            '::: Case_&.& #c1b',
            'Embedded placeholder class.',
            ':::',
            '',
            '::: Case & #literal no-num',
            'Numbering disabled.',
            ':::',
            '',
            'See @c1 @c1a @n1 @c1b @literal.'
        ].join('\n'));
        const lastPara = blocks[blocks.length - 1];

        expect(divAttr(blocks[0])).toEqual([
            'c1',
            ['Case', '&', 'pem-fenced-div'],
            [['title', 'Case &']]
        ]);
        expect(divAttr(blocks[1])).toEqual([
            'c1a',
            ['Case', '&.&', 'pem-fenced-div'],
            [['title', 'Case &.&']]
        ]);
        expect(inlineText(lastPara.c as PandocInline[])).toBe(
            'See Case 1 Case 1.1 1 Note Case 1.2 Case &.'
        );
    });

    it('honors escaped ampersands and only numbers the first placeholder group', () => {
        const blocks = renderBlocks([
            '::: {.case #escaped title="AT\\\\&T-&.&"}',
            'Escaped ampersand.',
            ':::',
            '',
            '::: {.case #first title="&-&"}',
            'First group only.',
            ':::',
            '',
            'See @escaped and @first.'
        ].join('\n'));
        const lastPara = blocks[blocks.length - 1];

        expect(inlineText(lastPara.c as PandocInline[])).toBe('See AT&T-1.1 and 1-&.');
    });

    it('matches Pandoc block boundaries for readable shorthand inside paragraph text', () => {
        const blocks = renderBlocks([
            'Paragraph before.',
            '::: Theorem #invalid',
            'Still paragraph text.',
            ':::',
            '',
            '::: Theorem #valid',
            'Actual div.',
            ':::',
            '',
            'See @invalid and @valid.'
        ].join('\n'));
        const lastPara = blocks[blocks.length - 1];

        expect(blocks.map(block => block.t)).toEqual(['Para', 'Div', 'Para']);
        expect(JSON.stringify(lastPara)).toContain('invalid');
        expect(inlineText(lastPara.c as PandocInline[])).toBe('See  and Theorem.');
    });

    it('uses explicit titles from readable braced title shorthand', () => {
        const blocks = renderBlocks([
            '::: {.logic #logic:a} explicit title after attributes &',
            'Readable logic.',
            ':::',
            '',
            '::: explicit title before attributes & {.logic #logic:b}',
            'More readable logic.',
            ':::',
            '',
            'See @logic:a and @logic:b.'
        ].join('\n'));
        const lastPara = blocks[blocks.length - 1];

        expect(inlineText(lastPara.c as PandocInline[])).toBe(
            'See explicit title after attributes 1 and explicit title before attributes 1.'
        );
    });

    it('renders Div titles only when a title attribute or class is present', () => {
        const blocks = renderBlocks([
            '::: title before attributes & {.theorem}',
            'No-id theorem.',
            ':::',
            '',
            '::: {.theorem} title after attributes &',
            'Another no-id theorem.',
            ':::',
            '',
            '::: classname',
            'Class-only content.',
            ':::',
            '',
            '::: title="titlename"',
            'Title-only content.',
            ':::',
            '',
            '::: {#bare}',
            'Id-only content.',
            ':::',
            '',
            'See @bare.'
        ].join('\n'));
        const rendered = JSON.stringify(blocks);
        const bareDivContent = divContent(blocks[4]);
        const lastPara = blocks[blocks.length - 1];

        expect(rendered).toContain('title before attributes 1');
        expect(rendered).toContain('title after attributes 1');
        expect(rendered).toContain('Classname');
        expect(rendered).toContain('titlename');
        expect(JSON.stringify(bareDivContent[0])).not.toContain('pem-fenced-div-title');
        expect(inlineText(lastPara.c as PandocInline[])).toBe('See Div.');
    });

    it('preserves unknown citations for citeproc or other filters', () => {
        const blocks = renderBlocks([
            '::: {.proposition #prop:a title="Proposition &"}',
            'A proposition.',
            ':::',
            '',
            'Known @prop:a and unknown @missing.'
        ].join('\n'));
        const lastPara = blocks[blocks.length - 1];

        expect(inlineText(lastPara.c as PandocInline[])).toContain('Known Proposition 1');
        expect(JSON.stringify(lastPara)).toContain('"Cite"');
        expect(JSON.stringify(lastPara)).toContain('missing');
    });

    it('adds restrained default styling for HTML export', () => {
        const html = renderFormat([
            '::: {.theorem #thm title="Theorem &"}',
            'A theorem.',
            ':::',
            '',
            'See @thm.'
        ].join('\n'), 'html', ['-s']);

        expect(html).toContain('class="theorem pem-fenced-div"');
        expect(html).toContain('class="pem-fenced-div-title"');
        expect(html).toContain('<strong>Theorem 1</strong>');
        expect(html).toContain('border-left: 2px solid #8a8f98;');
        expect(html).toContain('padding-left: 1em;');
        expect(html).toContain('font-weight: 700;');
        expect(html).toContain('See Theorem 1.');
        expect(html).not.toMatch(/\.pem-fenced-div[^{}]*\{[^}]*background/s);
    });

    it('wraps LaTeX fenced div export with a no-fill left-rule block', () => {
        const latex = renderFormat([
            '::: {.theorem #thm title="Theorem &"}',
            'A theorem.',
            ':::',
            '',
            'See @thm.'
        ].join('\n'), 'latex', ['-s']);

        expect(latex).toContain('\\usepackage[most]{tcolorbox}');
        expect(latex).toContain('\\newtcolorbox{PEMFencedDivBox}');
        expect(latex).toContain('blanker,');
        expect(latex).toContain('borderline west={1.5pt}{0pt}{black!45}');
        expect(latex).toContain('\\begin{PEMFencedDivBox}');
        expect(latex).toContain('\\textbf{Theorem 1}');
        expect(latex).toContain('\\end{PEMFencedDivBox}');
        expect(latex).toContain('See Theorem 1.');
        expect(latex).not.toMatch(/colback|background/i);
    });

    it('assigns DOCX custom styles to fenced divs and generated titles', () => {
        const directory = mkdtempSync(join(tmpdir(), 'pem-fenced-div-docx-'));
        const outputPath = join(directory, 'output.docx');

        try {
            const result = runPandoc([
                '::: {.theorem #thm title="Theorem &"}',
                'A theorem.',
                ':::',
                '',
                'See @thm.'
            ].join('\n'), ['-t', 'docx', '-o', outputPath]);
            expect(result.status).toBe(0);

            const unzipResult = spawnSync('unzip', ['-p', outputPath, 'word/document.xml'], {
                encoding: 'utf8'
            });
            expect(unzipResult.status).toBe(0);
            expect(unzipResult.stdout).toContain('w:val="PEMFencedDiv"');
            expect(unzipResult.stdout).toContain('w:val="PEMFencedDivTitle"');
            expect(unzipResult.stdout).toContain('<w:b');
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    });

    it('preserves semantic fenced div classes and bold titles for generic writers', () => {
        const markdown = renderFormat([
            '::: {.theorem #thm title="Theorem &"}',
            'A theorem.',
            ':::'
        ].join('\n'), 'markdown');

        expect(markdown).toContain('{#thm .theorem .pem-fenced-div title="Theorem &"}');
        expect(markdown).toContain('::: pem-fenced-div-title');
        expect(markdown).toContain('**Theorem 1**');
    });

    it('assigns ODT custom styles to fenced divs and generated titles', () => {
        const directory = mkdtempSync(join(tmpdir(), 'pem-fenced-div-odt-'));
        const outputPath = join(directory, 'output.odt');

        try {
            const result = runPandoc([
                '::: {.theorem #thm title="Theorem &"}',
                'A theorem.',
                ':::'
            ].join('\n'), ['-t', 'odt', '-o', outputPath]);
            expect(result.status).toBe(0);

            const unzipResult = spawnSync('unzip', ['-p', outputPath, 'content.xml'], {
                encoding: 'utf8'
            });
            expect(unzipResult.status).toBe(0);
            expect(unzipResult.stdout).toContain('text:style-name="PEM Fenced Div"');
            expect(unzipResult.stdout).toContain('text:style-name="PEM Fenced Div Title"');
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    });
});
