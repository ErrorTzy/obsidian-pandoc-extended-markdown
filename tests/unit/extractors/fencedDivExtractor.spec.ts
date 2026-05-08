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
            title: '',
            label: 'thm',
            content: 'Panel content.',
            classes: ['Theorem'],
            typeLabel: 'Theorem',
            number: 1,
            referenceText: 'Theorem 1'
        });
    });

    it('extracts title metadata without rendering it as content', () => {
        const items = extractFencedDivs([
            '::: {.logic-block #prem:a title="Premise"}',
            'Panel content.',
            ':::'
        ].join('\n'), settings);

        expect(items[0]).toMatchObject({
            title: 'Premise',
            label: 'prem:a',
            content: 'Panel content.',
            classes: ['logic-block'],
            typeLabel: 'Premise',
            typeKey: 'premise',
            number: 1,
            referenceText: 'Premise 1'
        });
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
