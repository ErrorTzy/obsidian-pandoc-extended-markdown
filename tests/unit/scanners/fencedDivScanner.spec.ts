import { Text } from '@codemirror/state';
import { scanFencedDivs } from '../../../src/live-preview/scanners/fencedDivScanner';
import { PandocExtendedMarkdownSettings } from '../../../src/core/settings';

describe('scanFencedDivs', () => {
    const settings = {
        enableFencedDivs: true
    } as PandocExtendedMarkdownSettings;

    const scan = (doc: string) => scanFencedDivs(Text.of(doc.split('\n')), settings);

    it('collects labels from adjacent and nested Pandoc fenced divs', () => {
        const labels = scan([
            '::: {.outer #outer}',
            '::: {.inner #inner}',
            'Nested content.',
            ':::',
            '::: {.sibling #sibling}',
            'Sibling content.',
            ':::',
            ':::'
        ].join('\n'));

        expect([...labels.keys()]).toEqual(['outer', 'inner', 'sibling']);
        expect(labels.get('outer')?.content).toContain('Nested content.');
        expect(labels.get('inner')?.displayName).toBe('Inner');
        expect(labels.get('sibling')?.displayName).toBe('Sibling');
    });

    it('does not collect labels from openings that Pandoc treats as paragraph text', () => {
        const labels = scan([
            'Paragraph before.',
            '::: {.note #invalid}',
            'Still paragraph text.',
            ':::',
            '',
            '::: {.note #valid}',
            'Actual div.',
            ':::'
        ].join('\n'));

        expect(labels.has('invalid')).toBe(false);
        expect(labels.has('valid')).toBe(true);
    });

    it('does not collect labels from indented openings', () => {
        const labels = scan([
            ' ::: {.note #invalid}',
            'content',
            ':::'
        ].join('\n'));

        expect(labels.size).toBe(0);
    });
});
