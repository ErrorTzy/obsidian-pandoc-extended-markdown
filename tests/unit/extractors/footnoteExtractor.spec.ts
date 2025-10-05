import { extractFootnotes } from '../../../src/shared/extractors/footnoteExtractor';

describe('footnoteExtractor', () => {
    it('extracts basic footnote definitions with references', () => {
        const content = `Text with footnote[^1].\n\n[^1]: Footnote text.`;

        const footnotes = extractFootnotes(content);

        expect(footnotes).toHaveLength(1);
        const footnote = footnotes[0];

        expect(footnote.label).toBe('1');
        expect(footnote.content).toBe('Footnote text.');
        expect(footnote.definitionLine).toBe(2);
        expect(footnote.definitionPosition).toEqual({ line: 2, ch: 0 });
        expect(footnote.referenceLine).toBe(0);
        expect(footnote.referencePosition).toEqual({ line: 0, ch: 18 });
        expect(footnote.referenceLength).toBe(4);
    });

    it('combines multi-line footnote definitions into paragraphs', () => {
        const content = `Paragraph with footnote[^note].\n\n[^note]: First line\n    second line\n\n    Third paragraph continuation.`;

        const [footnote] = extractFootnotes(content);

        expect(footnote.label).toBe('note');
        expect(footnote.content).toBe('First line second line\n\nThird paragraph continuation.');
        expect(footnote.referenceLine).toBe(0);
        expect(footnote.referenceLength).toBe(7);
    });

    it('handles footnotes without a matching reference', () => {
        const content = `Some text without references.\n\n[^missing]: Only a definition.`;

        const [footnote] = extractFootnotes(content);

        expect(footnote.label).toBe('missing');
        expect(footnote.referenceLine).toBeNull();
        expect(footnote.referencePosition).toBeNull();
        expect(footnote.referenceLength).toBeNull();
        expect(footnote.content).toBe('Only a definition.');
    });
});
