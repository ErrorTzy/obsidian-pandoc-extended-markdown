import { extractFencedDivs } from '../../../src/shared/extractors/fencedDivExtractor';
import { PandocExtendedMarkdownSettings } from '../../../src/core/settings';

describe('extractFencedDivs', () => {
    const settings = {
        strictPandocMode: false,
        enableFencedDivs: true
    } as PandocExtendedMarkdownSettings;

    it('extracts readable shorthand for panel rows in non-strict mode', () => {
        const items = extractFencedDivs([
            '::: Theorem #thm data=1',
            'Panel content.',
            ':::'
        ].join('\n'), settings);

        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({
            title: 'Theorem',
            label: 'thm',
            content: 'Panel content.',
            classes: ['Theorem'],
            typeLabel: 'Theorem',
            number: 0,
            numberParts: [],
            numberingEnabled: false,
            referenceText: 'Theorem',
            blockTitleText: 'Theorem'
        });
    });

    it('extracts title metadata without rendering it as content', () => {
        const items = extractFencedDivs([
            '::: {.logic-block #prem:a title="Premise &"}',
            'Panel content.',
            ':::'
        ].join('\n'), settings);

        expect(items[0]).toMatchObject({
            title: 'Premise &',
            label: 'prem:a',
            content: 'Panel content.',
            classes: ['logic-block'],
            typeLabel: 'Premise',
            typeKey: 'premise',
            number: 1,
            numberParts: [1],
            numberingEnabled: true,
            referenceText: 'Premise 1',
            blockTitleText: 'Premise 1'
        });
    });

    it('extracts base fenced divs without generated metadata when extras are disabled', () => {
        const items = extractFencedDivs([
            '::: {.logic-block #prem:a title="Premise &"}',
            'Panel content.',
            ':::'
        ].join('\n'), {
            ...settings,
            enableFencedDivExtras: false
        });

        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({
            title: '',
            label: 'prem:a',
            content: 'Panel content.',
            classes: ['logic-block'],
            typeLabel: 'Div',
            number: 0,
            numberParts: [],
            numberingEnabled: false,
            referenceText: 'Div',
            blockTitleText: ''
        });
    });

    it('provides rendered panel titles for numbered titles and class-only blocks', () => {
        const items = extractFencedDivs([
            '::: {.theorem #thm title="Theorem &"}',
            'Theorem content.',
            ':::',
            '',
            '::: {.lemma #lem}',
            'Lemma content.',
            ':::',
            '',
            '::: {#standalone}',
            'No title content.',
            ':::'
        ].join('\n'), settings);

        expect(items.map(item => item.title)).toEqual(['Theorem &', 'Lemma', '']);
        expect(items.map(item => item.blockTitleText)).toEqual(['Theorem 1', 'Lemma', '']);
    });

    it('renders native and shorthand placeholder titles consistently', () => {
        const items = extractFencedDivs([
            '::: {.case title="Case &"}',
            'Top-level case.',
            ':::',
            '',
            '::: {.case title="Case &.&"}',
            'Nested case.',
            ':::',
            '',
            '::: {.note title="& Note"}',
            'Front-numbered note.',
            ':::',
            '',
            '::: Case & {.case}',
            'Top-level case shortcut',
            ':::',
            '',
            '::: Case &.& {.case}',
            'Nested case shortcut',
            ':::',
            '',
            '::: & Note {.note}',
            'Front-numbered note shortcut',
            ':::',
            '',
            '::: Case_&',
            'Classname as title.',
            ':::',
            '',
            '::: Case_&.&',
            'Classname as nested title.',
            ':::',
            '',
            '::: {.case .no-num title="Case &"}',
            'Numbering disabled.',
            ':::',
            '',
            '::: {.case .no-num title="Case &.&"}',
            'Nested numbering disabled.',
            ':::',
            '',
            '::: {.note .no-num title="& Note"}',
            'Front numbering disabled.',
            ':::',
            '',
            '::: Case & {.case .no-num}',
            'Shortcut numbering disabled.',
            ':::',
            '',
            '::: Case &.& {.case .no-num}',
            'Nested shortcut numbering disabled.',
            ':::',
            '',
            '::: & Note {.note .no-num}',
            'Front shortcut numbering disabled.',
            ':::',
            '',
            '::: Case_& no-num',
            'Classname numbering disabled.',
            ':::',
            '',
            '::: Case_&.& no-num',
            'Nested classname numbering disabled.',
            ':::'
        ].join('\n'), settings);

        expect(items.map(item => item.blockTitleText)).toEqual([
            'Case 1',
            'Case 1.1',
            '1 Note',
            'Case 2',
            'Case 2.1',
            '2 Note',
            'Case 3',
            'Case 3.1',
            'Case &',
            'Case &.&',
            '& Note',
            'Case &',
            'Case &.&',
            '& Note',
            'Case &',
            'Case &.&'
        ]);
    });

    it('does not extract readable shorthand for panel rows in strict mode', () => {
        const items = extractFencedDivs([
            '::: Theorem #thm data=1',
            'Panel content.',
            ':::'
        ].join('\n'), {
            ...settings,
            strictPandocMode: true
        });

        expect(items).toHaveLength(0);
    });
});
