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
        expect(labels.get('inner')?.referenceText).toBe('Inner 1');
        expect(labels.get('sibling')?.referenceText).toBe('Sibling 1');
    });

    it('collects labels from readable shorthand in non-strict mode', () => {
        const labels = scan([
            '::: Theorem #thm data=1',
            'Readable content.',
            ':::',
            '',
            'See @thm.'
        ].join('\n'));

        expect(labels.get('thm')?.referenceText).toBe('Theorem 1');
        expect(labels.get('thm')?.content).toBe('Readable content.');
    });

    it('numbers arbitrary fenced div classes independently', () => {
        const labels = scan([
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
            ':::'
        ].join('\n'));

        expect(labels.get('prop:a')?.referenceText).toBe('Proposition 1');
        expect(labels.get('rem:a')?.referenceText).toBe('Remark 1');
        expect(labels.get('prop:b')?.referenceText).toBe('Proposition 2');
    });

    it('uses title as the reference type label before falling back to class or Div', () => {
        const labels = scan([
            '::: {.logic-block #prem:a title="Premise"}',
            'Premise content.',
            ':::',
            '',
            '::: {.presupposition #pre:a}',
            'Presupposition content.',
            ':::',
            '',
            '::: {#misc:a}',
            'Misc content.',
            ':::'
        ].join('\n'));

        expect(labels.get('prem:a')).toMatchObject({
            title: 'Premise',
            typeLabel: 'Premise',
            typeKey: 'premise',
            number: 1,
            referenceText: 'Premise 1',
            blockTitleText: 'Premise 1',
            classes: ['logic-block']
        });
        expect(labels.get('pre:a')?.referenceText).toBe('Presupposition 1');
        expect(labels.get('misc:a')?.referenceText).toBe('Div 1');
    });

    it('does not collect labels from readable shorthand in strict mode', () => {
        const labels = scanFencedDivs(
            Text.of([
                '::: Theorem #thm data=1',
                'Readable content.',
                ':::'
            ]),
            {
                ...settings,
                strictPandocMode: true
            }
        );

        expect(labels.has('thm')).toBe(false);
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
