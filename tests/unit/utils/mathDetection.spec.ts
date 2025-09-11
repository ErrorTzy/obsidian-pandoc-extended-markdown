import { detectCodeRegions } from '../../../src/live-preview/pipeline/utils/codeDetection';
import { Text } from '../../../__mocks__/codemirror';

describe('Math region detection', () => {
    describe('Inline math expressions', () => {
        it('should detect and protect inline math with superscripts', () => {
            const text = 'Given $R^{+}_{xy}$ and $R^{+}_{yz}$, we have $R^{+}_{xz}$';
            const doc = Text.of([text]);
            const regions = detectCodeRegions(doc);
            
            // Should detect three math regions
            expect(regions).toHaveLength(3);
            
            // First math expression: $R^{+}_{xy}$
            expect(regions[0]).toEqual({
                from: 6,
                to: 18,
                type: 'math'
            });
            
            // Second math expression: $R^{+}_{yz}$
            expect(regions[1]).toEqual({
                from: 23,
                to: 35,
                type: 'math'
            });
            
            // Third math expression: $R^{+}_{xz}$
            expect(regions[2]).toEqual({
                from: 45,
                to: 57,
                type: 'math'
            });
        });

        it('should protect math expressions from superscript processing', () => {
            const text = 'Math: $x^2 + y^2 = z^2$ and normal superscript: ^test^';
            const doc = Text.of([text]);
            const regions = detectCodeRegions(doc);
            
            // Should detect one math region and leave normal superscript unprotected
            expect(regions.some(r => r.from === 6 && r.to === 23 && r.type === 'math')).toBe(true);
            
            // The ^test^ should NOT be in a protected region
            const testSupStart = text.indexOf('^test^');
            const isProtected = regions.some(r => 
                testSupStart >= r.from && testSupStart < r.to
            );
            expect(isProtected).toBe(false);
        });
    });

    describe('Display math expressions', () => {
        it('should detect display math blocks', () => {
            const text = `Regular text
$$
x^2 + y^2 = z^2
$$
More text`;
            const doc = Text.of(text.split('\n'));
            const regions = detectCodeRegions(doc);
            
            // Should detect the display math block
            const displayMathRegion = regions.find(r => r.type === 'math');
            expect(displayMathRegion).toBeDefined();
            expect(text.substring(displayMathRegion!.from, displayMathRegion!.to))
                .toContain('x^2 + y^2 = z^2');
        });
    });

    describe('Complex math in blockquotes', () => {
        it('should handle the reported bug case', () => {
            const text = '> Given $R^{+}_{xy}$ and $R^{+}_{yz}$, if x=y or y=z, obviously we have $R^{+}_{xz}$';
            const doc = Text.of([text]);
            const regions = detectCodeRegions(doc);
            
            // Should detect all three math expressions even in blockquote
            const mathRegions = regions.filter(r => r.type === 'math');
            expect(mathRegions).toHaveLength(3);
            
            // Verify each math expression is properly detected
            mathRegions.forEach(region => {
                const content = text.substring(region.from, region.to);
                expect(content).toMatch(/^\$.*\$$/);
                expect(content).toContain('^');
            });
        });
    });

    describe('Edge cases', () => {
        it('should handle escaped dollar signs', () => {
            const text = 'Cost: \\$50 and math: $x^2$';
            const doc = Text.of([text]);
            const regions = detectCodeRegions(doc);
            
            // Should only detect the actual math, not escaped dollar
            const mathRegions = regions.filter(r => r.type === 'math');
            expect(mathRegions).toHaveLength(1);
            expect(text.substring(mathRegions[0].from, mathRegions[0].to)).toBe('$x^2$');
        });

        it('should handle unclosed math expressions', () => {
            const text = 'Start $x^2 but no closing';
            const doc = Text.of([text]);
            const regions = detectCodeRegions(doc);
            
            // Should not detect unclosed math
            const mathRegions = regions.filter(r => r.type === 'math');
            expect(mathRegions).toHaveLength(0);
        });

        it('should not interfere with code blocks', () => {
            const text = `\`\`\`
$not math$
\`\`\`
$actual^{math}$`;
            const doc = Text.of(text.split('\n'));
            const regions = detectCodeRegions(doc);
            
            // Should have one code block and one math region
            expect(regions.filter(r => r.type === 'codeblock')).toHaveLength(1);
            expect(regions.filter(r => r.type === 'math')).toHaveLength(1);
        });
    });
});