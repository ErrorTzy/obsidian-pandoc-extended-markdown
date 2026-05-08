import { spawnSync } from 'child_process';
import { resolve } from 'path';

const filterPath = resolve(__dirname, '../../../lua_filter/ReadableFencedDiv.lua');

interface PandocBlock {
    t: string;
    c?: unknown;
}

function runPandoc(markdown: string): { status: number | null; stdout: string; stderr: string } {
    const result = spawnSync(
        'pandoc',
        ['-f', 'markdown', '-t', 'json', `--lua-filter=${filterPath}`],
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

describe('ReadableFencedDiv.lua', () => {
    it('converts readable shorthand to a native Pandoc Div', () => {
        const blocks = renderBlocks([
            '::: Theorem #thm data=1',
            '',
            'content',
            '',
            ':::'
        ].join('\n'));

        expect(blocks[0].t).toBe('Div');
        expect((blocks[0].c as unknown[])[0]).toEqual(['thm', ['Theorem'], [['data', '1']]]);
    });

    it('preserves multi-block content inside the Div', () => {
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
        const divContent = ((blocks[0].c as unknown[])[1] as PandocBlock[]);

        expect(divContent.map(block => block.t)).toEqual(['Para', 'BulletList', 'Para']);
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
        const outerContent = ((blocks[0].c as unknown[])[1] as PandocBlock[]);
        const inner = outerContent.find(block => block.t === 'Div');

        expect((blocks[0].c as unknown[])[0]).toEqual(['outer', ['Outer'], []]);
        expect(inner?.t).toBe('Div');
        expect((inner?.c as unknown[])[0]).toEqual(['inner', ['Inner'], []]);
    });

    it('leaves unmatched openers and content intact with a warning', () => {
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
});
