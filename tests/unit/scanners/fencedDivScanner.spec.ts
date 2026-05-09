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
            '::: {.outer #outer title="Outer &"}',
            '::: {.inner #inner title="Inner &"}',
            'Nested content.',
            ':::',
            '::: {.sibling #sibling title="Sibling &"}',
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
            '::: Theorem #thm title="Theorem &"',
            'Readable content.',
            ':::',
            '',
            'See @thm.'
        ].join('\n'));

        expect(labels.get('thm')?.referenceText).toBe('Theorem 1');
        expect(labels.get('thm')?.content).toBe('Readable content.');
    });

    it('renders arbitrary fenced div classes without implicit numbering', () => {
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

        expect(labels.get('prop:a')?.referenceText).toBe('Proposition');
        expect(labels.get('rem:a')?.referenceText).toBe('Remark');
        expect(labels.get('prop:b')?.referenceText).toBe('Proposition');
    });

    it('uses title as the reference type label before falling back to class or unnumbered Div', () => {
        const labels = scan([
            '::: {.logic-block #prem:a title="Premise &"}',
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
            title: 'Premise &',
            titleTemplate: 'Premise &',
            typeLabel: 'Premise',
            typeKey: 'premise',
            number: 1,
            numberParts: [1],
            numberingEnabled: true,
            referenceText: 'Premise 1',
            blockTitleText: 'Premise 1',
            classes: ['logic-block']
        });
        expect(labels.get('pre:a')?.referenceText).toBe('Presupposition');
        expect(labels.get('misc:a')?.referenceText).toBe('Div');
    });

    it('supports front placeholders, multi-part counters, and no-num literals', () => {
        const labels = scan([
            '::: {.case #c1 title="Case &"}',
            ':::',
            '',
            '::: {.case #c1a title="Case &.&"}',
            ':::',
            '',
            '::: {.case #c1b title="Case &.&"}',
            ':::',
            '',
            '::: {.case #c2 title="Case &"}',
            ':::',
            '',
            '::: {.case #c2a title="Case &.&.&"}',
            ':::',
            '',
            '::: {.note #front title="& Note"}',
            ':::',
            '',
            '::: {.warning #literal .no-num title="AT&T Warning"}',
            ':::'
        ].join('\n'));

        expect(labels.get('c1')?.referenceText).toBe('Case 1');
        expect(labels.get('c1a')?.referenceText).toBe('Case 1.1');
        expect(labels.get('c1b')?.referenceText).toBe('Case 1.2');
        expect(labels.get('c2')?.referenceText).toBe('Case 2');
        expect(labels.get('c2a')?.referenceText).toBe('Case 2.1.1');
        expect(labels.get('front')?.referenceText).toBe('1 Note');
        expect(labels.get('literal')?.referenceText).toBe('AT&T Warning');
    });

    it('numbers readable shorthand placeholder classes through synthesized titles', () => {
        const labels = scan([
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
            ':::'
        ].join('\n'));

        expect(labels.get('c1')).toMatchObject({
            classes: ['Case', '&'],
            title: 'Case &',
            referenceText: 'Case 1',
            blockTitleText: 'Case 1'
        });
        expect(labels.get('c1a')?.referenceText).toBe('Case 1.1');
        expect(labels.get('n1')?.referenceText).toBe('1 Note');
        expect(labels.get('c1b')).toMatchObject({
            classes: ['Case_&.&'],
            title: 'Case &.&',
            referenceText: 'Case 1.2'
        });
        expect(labels.get('literal')?.referenceText).toBe('Case &');
    });

    it('matches Pandoc export escaping for literal ampersands in native titles', () => {
        const labels = scan([
            '::: {.case #single title="AT\\&T-&.&"}',
            'Single backslash is consumed by Markdown.',
            ':::',
            '',
            '::: {.case #double title="AT\\\\&T-&.&"}',
            'Doubled backslash preserves the numbering escape.',
            ':::'
        ].join('\n'));

        expect(labels.get('single')?.referenceText).toBe('AT1T-&.&');
        expect(labels.get('double')?.referenceText).toBe('AT&T-1.1');
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
