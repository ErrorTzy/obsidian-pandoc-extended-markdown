import { Text } from '@codemirror/state';
import { PandocExtendedMarkdownSettings } from '../../../src/core/settings';
import { findFencedDivRangeAtDepth } from '../../../src/live-preview/fencedDivDragRanges';

describe('fenced div drag range lookup', () => {
    const settings = {} as PandocExtendedMarkdownSettings;
    const doc = Text.of([
        '::: {.outer}',
        'Outer text',
        '',
        '::: {.inner}',
        'Inner text',
        ':::',
        'Back outside',
        ':::'
    ]);

    it('resolves an outer rail hit on a nested line to the outer block', () => {
        expect(findFencedDivRangeAtDepth(doc, 5, 1, settings)).toEqual({
            startLine: 1,
            endLine: 8
        });
    });

    it('resolves an inner rail hit on a nested line to the inner block', () => {
        expect(findFencedDivRangeAtDepth(doc, 5, 2, settings)).toEqual({
            startLine: 4,
            endLine: 6
        });
    });
});
