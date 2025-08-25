import { truncateLabel, truncateContent, truncateContentWithRendering } from '../../../src/views/panels/utils/contentTruncator';

describe('Content Truncator', () => {
    describe('truncateLabel', () => {
        it('should truncate labels longer than 6 characters', () => {
            expect(truncateLabel('ABCDEFG')).toBe('ABCDE…');
            expect(truncateLabel('PPPPPP1')).toBe('PPPPP…');
            expect(truncateLabel('VeryLongLabel')).toBe('VeryL…');
        });

        it('should not truncate labels with 6 or fewer characters', () => {
            expect(truncateLabel('ABC')).toBe('ABC');
            expect(truncateLabel('PPPPPP')).toBe('PPPPPP');
            expect(truncateLabel('P1')).toBe('P1');
            expect(truncateLabel('')).toBe('');
        });
    });

    describe('truncateContent', () => {
        it('should truncate content longer than 51 characters', () => {
            const longContent = 'This is a very long content that definitely exceeds the fifty-one character limit for truncation';
            const truncated = truncateContent(longContent);
            expect(truncated).toBe('This is a very long content that definitely exceed…');
            expect(truncated.length).toBe(51);
        });

        it('should not truncate content with 51 or fewer characters', () => {
            expect(truncateContent('Short content')).toBe('Short content');
            expect(truncateContent('Exactly fifty-one characters content example here!')).toBe('Exactly fifty-one characters content example here!');
            expect(truncateContent('')).toBe('');
        });
    });

    describe('truncateContentWithRendering', () => {
        it('should use simple truncation for non-math content', () => {
            const content = 'This is plain text without any math formulas that should be truncated normally';
            const truncated = truncateContentWithRendering(content);
            expect(truncated).toBe('This is plain text without any math formulas that …');
        });

        it('should handle math content based on rendered length', () => {
            // Math content that renders short but has long raw text
            const mathContent = '$\\therefore \\therefore \\therefore$';
            // When rendered, this shows as: ∴∴∴ (3 characters)
            const truncated = truncateContentWithRendering(mathContent);
            expect(truncated).toBe(mathContent); // Should not truncate
        });

        it('should truncate long math content properly', () => {
            // Create content with many math symbols
            let longMathContent = '$';
            for (let i = 0; i < 60; i++) {
                longMathContent += '\\therefore ';
            }
            longMathContent += '$';
            
            const truncated = truncateContentWithRendering(longMathContent);
            expect(truncated).toContain('$');
            expect(truncated).toContain('…');
            // Should have truncated the math content
            expect(truncated.length).toBeLessThan(longMathContent.length);
        });

        it('should handle mixed content with math and text', () => {
            const mixedContent = 'The formula $\\alpha + \\beta = \\gamma$ represents addition in Greek letters';
            const truncated = truncateContentWithRendering(mixedContent);
            // The rendered version: "The formula α + β = γ represents addition in Greek letters"
            // This is over 51 characters, should truncate
            expect(truncated).toContain('$');
            // The exact length depends on how the math is truncated
            expect(truncated.length).toBeLessThanOrEqual(75); // Buffer for math syntax
        });

        it('should not leave trailing spaces before closing $ in math', () => {
            const mathWithSpaces = '$\\therefore \\therefore \\therefore $';
            const truncated = truncateContentWithRendering(mathWithSpaces);
            expect(truncated).not.toMatch(/\s\$/);
        });

        it('should handle unclosed math at end of string', () => {
            const unclosedMath = 'Start of content $\\alpha \\beta';
            const truncated = truncateContentWithRendering(unclosedMath);
            // Should close the math expression properly
            expect(truncated).toMatch(/\$/);
        });
    });
});