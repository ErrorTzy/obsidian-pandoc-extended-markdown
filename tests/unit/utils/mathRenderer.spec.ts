import { renderMathToText, tokenizeMath, truncateMathContent, truncateMathAtLimit } from '../../../src/shared/utils/mathRenderer';

describe('Math Renderer', () => {
    describe('renderMathToText', () => {
        it('should convert common LaTeX symbols to Unicode', () => {
            expect(renderMathToText('\\therefore')).toBe('∴');
            expect(renderMathToText('\\alpha')).toBe('α');
            expect(renderMathToText('\\beta')).toBe('β');
            expect(renderMathToText('\\pi')).toBe('π');
            expect(renderMathToText('\\infty')).toBe('∞');
            expect(renderMathToText('\\exists')).toBe('∃');
            expect(renderMathToText('\\forall')).toBe('∀');
        });

        it('should handle multiple symbols in sequence', () => {
            expect(renderMathToText('\\alpha + \\beta = \\gamma')).toBe('α + β = γ');
            expect(renderMathToText('\\therefore \\exists x')).toBe('∴ ∃ x');
            expect(renderMathToText('\\forall x \\in A')).toBe('∀ x ∈ A');
        });

        it('should handle arrows and logical operators', () => {
            expect(renderMathToText('\\rightarrow')).toBe('→');
            expect(renderMathToText('\\Rightarrow')).toBe('⇒');
            expect(renderMathToText('\\land \\lor \\neg')).toBe('∧ ∨ ¬');
        });

        it('should remove remaining backslashes', () => {
            expect(renderMathToText('\\unknown \\command')).toBe('unknown command');
            expect(renderMathToText('text\\with\\backslash')).toBe('textwithbackslash');
        });

        it('should normalize spaces', () => {
            expect(renderMathToText('\\alpha    \\beta')).toBe('α β');
            expect(renderMathToText('  \\pi  ')).toBe('π');
        });
    });

    describe('tokenizeMath', () => {
        it('should tokenize LaTeX commands', () => {
            const tokens = tokenizeMath('\\alpha + \\beta');
            expect(tokens).toEqual(['\\alpha ', '+ ', '\\beta']);
        });

        it('should preserve command spaces', () => {
            const tokens = tokenizeMath('\\therefore \\exists');
            expect(tokens).toEqual(['\\therefore ', '\\exists']);
        });

        it('should handle text between commands', () => {
            const tokens = tokenizeMath('x = \\alpha + 2');
            expect(tokens).toEqual(['x = ', '\\alpha ', '+ 2']);
        });

        it('should handle commands without spaces', () => {
            const tokens = tokenizeMath('\\alpha\\beta');
            expect(tokens).toEqual(['\\alpha', '\\beta']);
        });

        it('should handle empty input', () => {
            expect(tokenizeMath('')).toEqual([]);
        });
    });

    describe('truncateMathContent', () => {
        it('should truncate math content based on rendered length', () => {
            // Create a long string of LaTeX commands
            let longMath = '';
            for (let i = 0; i < 20; i++) {
                longMath += '\\therefore ';
            }
            
            // Truncate to max 10 rendered characters
            const truncated = truncateMathContent(longMath, 10);
            expect(truncated).toContain('$');
            expect(truncated).toContain('\\therefore');
            
            // Extract content between dollar signs
            const content = truncated.slice(1, -1);
            const rendered = renderMathToText(content);
            expect(rendered.length).toBeLessThanOrEqual(10);
        });

        it('should preserve complete LaTeX commands', () => {
            const math = '\\alpha \\beta \\gamma \\delta';
            const truncated = truncateMathContent(math, 3);
            
            // Should include complete commands
            expect(truncated).toMatch(/^\$[^$]*\$$/);
            // The truncated version should have valid LaTeX
            expect(truncated).toContain('$');
        });

        it('should remove trailing spaces before closing $', () => {
            const math = '\\therefore \\therefore ';
            const truncated = truncateMathContent(math, 10);
            
            expect(truncated).not.toMatch(/\s\$/);
            expect(truncated).toMatch(/\$$/);
        });

        it('should handle empty input', () => {
            const truncated = truncateMathContent('', 10);
            expect(truncated).toBe('$');
        });
    });

    describe('truncateMathAtLimit', () => {
        it('should add ellipsis when truncating', () => {
            const result = truncateMathAtLimit('\\alpha \\beta \\gamma', 'Content: ', 5);
            expect(result).toContain('…');
            expect(result).toContain('$');
        });

        it('should handle when remaining space is 1', () => {
            const result = truncateMathAtLimit('\\alpha', 'Content: ', 1);
            expect(result).toBe('Content: …');
        });

        it('should handle when current result ends with $', () => {
            const result = truncateMathAtLimit('\\alpha', 'Content: $', 0);
            expect(result).toBe('Content: …');
        });

        it('should truncate math content within remaining space', () => {
            const result = truncateMathAtLimit('\\alpha \\beta \\gamma', '', 10);
            expect(result).toContain('$');
            expect(result).toContain('…');
            
            // Should have truncated the math to fit
            const mathPart = result.slice(0, result.indexOf('…'));
            if (mathPart.includes('$')) {
                const mathContent = mathPart.slice(mathPart.indexOf('$') + 1);
                const rendered = renderMathToText(mathContent);
                expect(rendered.length).toBeLessThanOrEqual(9); // 10 - 1 for ellipsis
            }
        });
    });
});