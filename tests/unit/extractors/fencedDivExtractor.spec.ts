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
            classes: ['Theorem']
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
