import { spawnSync } from 'child_process';
import { resolve } from 'path';

const readableFilterPath = resolve(__dirname, '../../../lua_filter/ReadableFencedDiv.lua');
const crossRefFilterPath = resolve(__dirname, '../../../lua_filter/FencedDivCrossRef.lua');

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
    filters: string[] = [crossRefFilterPath]
): { status: number | null; stdout: string; stderr: string } {
    const result = spawnSync(
        'pandoc',
        ['-f', 'markdown', '-t', 'json', ...filters.map(filter => `--lua-filter=${filter}`)],
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

function renderBlocks(markdown: string, filters?: string[]): PandocBlock[] {
    const result = runPandoc(markdown, filters);
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

describe('FencedDivCrossRef.lua', () => {
    it('replaces native fenced div citations with independently numbered reference text', () => {
        const blocks = renderBlocks([
            '::: {.proposition #prop:a}',
            'A proposition.',
            ':::',
            '',
            '::: {.remark #rem:a}',
            'A remark.',
            ':::',
            '',
            '::: {.proposition #prop:b}',
            'Another proposition.',
            ':::',
            '',
            'See @prop:a, @rem:a, and @prop:b.'
        ].join('\n'));
        const lastPara = blocks[blocks.length - 1];

        expect(lastPara.t).toBe('Para');
        expect(inlineText(lastPara.c as PandocInline[])).toBe(
            'See Proposition 1, Remark 1, and Proposition 2.'
        );
    });

    it('uses title attributes before class and Div fallbacks', () => {
        const blocks = renderBlocks([
            '::: {.logic-block #prem:a title="Premise"}',
            'A premise.',
            ':::',
            '',
            '::: {#misc:a}',
            'Misc content.',
            ':::',
            '',
            'See @prem:a and @misc:a.'
        ].join('\n'));
        const lastPara = blocks[blocks.length - 1];

        expect(inlineText(lastPara.c as PandocInline[])).toBe('See Premise 1 and Div 1.');
    });

    it('works after ReadableFencedDiv.lua normalizes readable shorthand', () => {
        const blocks = renderBlocks([
            '::: Premise #prem:a',
            '',
            'Readable premise.',
            '',
            ':::',
            '',
            'See @prem:a.'
        ].join('\n'), [readableFilterPath, crossRefFilterPath]);
        const lastPara = blocks[blocks.length - 1];

        expect(inlineText(lastPara.c as PandocInline[])).toBe('See Premise 1.');
    });

    it('preserves unknown citations for citeproc or other filters', () => {
        const blocks = renderBlocks([
            '::: {.proposition #prop:a}',
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
});
