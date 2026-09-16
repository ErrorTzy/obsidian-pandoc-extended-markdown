import { checkPandocFormatting } from '../../../src/editor-extensions/pandocValidator';

describe('Pandoc formatting command list-spacing parity', () => {
    it('reports paragraph-interrupting lists only when the extension is disabled', () => {
        const content = [
            'Paragraph text',
            '- extension-controlled item'
        ].join('\n');

        expect(checkPandocFormatting(content, false, false)).toContainEqual({
            line: 2,
            message: 'List cannot interrupt a paragraph'
        });
        expect(checkPandocFormatting(content, false, true)).not.toContainEqual({
            line: 2,
            message: 'List cannot interrupt a paragraph'
        });
    });

    it('uses Pandoc block boundaries instead of the preceding-line heuristic', () => {
        const content = [
            '\\begin{quote}',
            'raw TeX content',
            '\\end{quote}',
            '- extension-controlled item'
        ].join('\n');

        expect(checkPandocFormatting(content, false, false)).toContainEqual({
            line: 4,
            message: 'List cannot interrupt a paragraph'
        });
        expect(checkPandocFormatting(content, false, true)).not.toContainEqual({
            line: 4,
            message: 'List cannot interrupt a paragraph'
        });
    });
});
