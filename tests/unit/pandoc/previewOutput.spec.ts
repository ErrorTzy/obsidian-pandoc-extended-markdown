import { describe, expect, it } from '@jest/globals';

import { overridePandocOutputArgs } from '../../../src/pandoc';

describe('overridePandocOutputArgs', () => {
    it.each([
        [['input.md', '-o', 'real.pdf'], ['input.md', '-o', '/tmp/preview.pdf']],
        [['input.md', '--output', 'real.pdf'], ['input.md', '-o', '/tmp/preview.pdf']],
        [['input.md', '--output=real.pdf'], ['input.md', '-o', '/tmp/preview.pdf']],
        [['input.md', '-oreal.pdf'], ['input.md', '-o', '/tmp/preview.pdf']],
        [
            ['input.md', '-o', 'first.pdf', '--toc', '--output=last.pdf'],
            ['input.md', '--toc', '-o', '/tmp/preview.pdf']
        ]
    ])('overrides %j', (args, expected) => {
        expect(overridePandocOutputArgs(args, '/tmp/preview.pdf')).toEqual(expected);
    });

    it('adds an output argument when none exists', () => {
        expect(overridePandocOutputArgs(['input.md', '-t', 'html'], '/tmp/preview.html'))
            .toEqual(['input.md', '-t', 'html', '-o', '/tmp/preview.html']);
    });
});
