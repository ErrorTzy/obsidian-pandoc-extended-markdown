import { ListBlockValidator } from '../../../src/live-preview/validators/listBlockValidator';
import { PandocExtendedMarkdownSettings } from '../../../src/core/settings';

describe('Strict Pandoc Mode Validation', () => {
    const settings: PandocExtendedMarkdownSettings = {
        strictPandocMode: true,
        fancyLists: true,
        moreExtendedSyntax: true
    } as PandocExtendedMarkdownSettings;

    describe('Invalid list blocks without blank lines', () => {
        it('should mark ALL list items as invalid when no blank line before', () => {
            const lines = [
                'text',
                'A.  First item',
                'B.  Second item', 
                'C.  Third item'
            ];
            
            const invalidLines = ListBlockValidator.validateListBlocks(lines, settings);
            
            // All three list items should be marked as invalid (0-based indices)
            expect(invalidLines.has(1)).toBe(true); // Array index 1: "A.  First item"
            expect(invalidLines.has(2)).toBe(true); // Array index 2: "B.  Second item"
            expect(invalidLines.has(3)).toBe(true); // Array index 3: "C.  Third item"
            expect(invalidLines.size).toBe(3);
        });

        it('should mark ALL list items as invalid when no blank line after', () => {
            const lines = [
                '',
                'A.  First item',
                'B.  Second item',
                'C.  Third item',
                'text'
            ];
            
            const invalidLines = ListBlockValidator.validateListBlocks(lines, settings);
            
            // All three list items should be marked as invalid
            expect(invalidLines.has(1)).toBe(true); // Line index 1: "A.  First item"
            expect(invalidLines.has(2)).toBe(true); // Line index 2: "B.  Second item"
            expect(invalidLines.has(3)).toBe(true); // Line index 3: "C.  Third item"
            expect(invalidLines.size).toBe(3);
        });

        it('should mark ALL list items as invalid when no blank lines before AND after', () => {
            const lines = [
                'text before',
                'A.  First item',
                'B.  Second item',
                'C.  Third item',
                'text after'
            ];
            
            const invalidLines = ListBlockValidator.validateListBlocks(lines, settings);
            
            // All three list items should be marked as invalid
            expect(invalidLines.has(1)).toBe(true); // Line index 1: "A.  First item"
            expect(invalidLines.has(2)).toBe(true); // Line index 2: "B.  Second item"
            expect(invalidLines.has(3)).toBe(true); // Line index 3: "C.  Third item"
            expect(invalidLines.size).toBe(3);
        });

        it('should handle hash lists correctly', () => {
            const lines = [
                'text',
                '#.  First item',
                '#.  Second item',
                '#.  Third item',
                'text'
            ];
            
            const invalidLines = ListBlockValidator.validateListBlocks(lines, settings);
            
            // All three list items should be marked as invalid
            expect(invalidLines.has(1)).toBe(true);
            expect(invalidLines.has(2)).toBe(true);
            expect(invalidLines.has(3)).toBe(true);
            expect(invalidLines.size).toBe(3);
        });

        it('should handle example lists correctly', () => {
            const lines = [
                'text',
                '(@ex1)  First item',
                '(@ex2)  Second item',
                '(@ex3)  Third item',
                'text'
            ];
            
            const invalidLines = ListBlockValidator.validateListBlocks(lines, settings);
            
            // All three list items should be marked as invalid
            expect(invalidLines.has(1)).toBe(true);
            expect(invalidLines.has(2)).toBe(true);
            expect(invalidLines.has(3)).toBe(true);
            expect(invalidLines.size).toBe(3);
        });
    });

    describe('Valid list blocks with proper blank lines', () => {
        it('should not mark any items as invalid when properly formatted', () => {
            const lines = [
                '',
                'A.  First item',
                'B.  Second item',
                'C.  Third item',
                ''
            ];
            
            const invalidLines = ListBlockValidator.validateListBlocks(lines, settings);
            
            expect(invalidLines.size).toBe(0);
        });

        it('should allow list at beginning of document', () => {
            const lines = [
                'A.  First item',
                'B.  Second item',
                'C.  Third item',
                ''
            ];
            
            const invalidLines = ListBlockValidator.validateListBlocks(lines, settings);
            
            expect(invalidLines.size).toBe(0);
        });

        it('should allow list at end of document', () => {
            const lines = [
                '',
                'A.  First item',
                'B.  Second item',
                'C.  Third item'
            ];
            
            const invalidLines = ListBlockValidator.validateListBlocks(lines, settings);
            
            expect(invalidLines.size).toBe(0);
        });
    });

    describe('Definition lists special case', () => {
        it('should only require blank line after, not before', () => {
            const lines = [
                'Term',
                ':   Definition',
                ''
            ];
            
            const invalidLines = ListBlockValidator.validateListBlocks(lines, settings);
            
            expect(invalidLines.size).toBe(0);
        });

        it('should mark as invalid without blank line after', () => {
            const lines = [
                'Term',
                ':   Definition',
                'text'
            ];
            
            const invalidLines = ListBlockValidator.validateListBlocks(lines, settings);
            
            expect(invalidLines.has(1)).toBe(true); // Definition line should be invalid
        });
    });

    describe('When strict mode is disabled', () => {
        it('should not mark any lines as invalid', () => {
            const nonStrictSettings: PandocExtendedMarkdownSettings = {
                ...settings,
                strictPandocMode: false
            };
            
            const lines = [
                'text',
                'A.  First item',
                'B.  Second item',
                'C.  Third item',
                'text'
            ];
            
            const invalidLines = ListBlockValidator.validateListBlocks(lines, nonStrictSettings);
            
            expect(invalidLines.size).toBe(0);
        });
    });
});