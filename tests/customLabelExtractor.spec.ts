import { extractCustomLabels, processLabels, CustomLabel } from '../src/shared/extractors/customLabelExtractor';

describe('Custom Label Extractor', () => {
    describe('extractCustomLabels', () => {
        it('should extract custom labels from markdown content', () => {
            const content = `{::P(#a)} First proposition
{::P(#b)} Second proposition
{::Q} Third statement
Regular text without labels`;

            const labels = extractCustomLabels(content, true);
            
            expect(labels).toHaveLength(3);
            expect(labels[0]).toMatchObject({
                label: 'P1',
                rawLabel: '{::P(#a)}',
                content: 'First proposition',
                renderedContent: 'First proposition',
                lineNumber: 0
            });
            expect(labels[1]).toMatchObject({
                label: 'P2',
                rawLabel: '{::P(#b)}',
                content: 'Second proposition',
                renderedContent: 'Second proposition',
                lineNumber: 1
            });
            expect(labels[2]).toMatchObject({
                label: 'Q',
                rawLabel: '{::Q}',
                content: 'Third statement',
                renderedContent: 'Third statement',
                lineNumber: 2
            });
        });

        it('should process placeholders correctly', () => {
            const content = `{::P(#a)} First
{::P(#b)} Second
{::P(#c)} Third
{::Q(#a)} Another first`;

            const labels = extractCustomLabels(content, true);
            
            expect(labels[0].label).toBe('P1');
            expect(labels[1].label).toBe('P2');
            expect(labels[2].label).toBe('P3');
            expect(labels[3].label).toBe('Q1');
        });

        it('should handle references in content', () => {
            const content = `{::P(#a)} As shown in {::P(#b)}
{::P(#b)} This follows from {::P(#a)}`;

            const labels = extractCustomLabels(content, true);
            
            expect(labels[0].renderedContent).toBe('As shown in P2');
            expect(labels[1].renderedContent).toBe('This follows from P1');
        });

        it('should return empty array when moreExtendedSyntax is false', () => {
            const content = `{::P(#a)} First proposition
{::P(#b)} Second proposition`;

            const labels = extractCustomLabels(content, false);
            expect(labels).toHaveLength(0);
        });

        it('should handle complex labels with multiple placeholders', () => {
            const content = `{::P(#a),(#b)} Combined reference
{::Q(#a)-(#c)} Range reference`;

            const labels = extractCustomLabels(content, true);
            
            expect(labels[0].label).toBe('P1,2');
            expect(labels[1].label).toBe('Q1-3');
        });

        it('should handle empty content', () => {
            const labels = extractCustomLabels('', true);
            expect(labels).toHaveLength(0);
        });

        it('should ignore non-label lines', () => {
            const content = `Regular paragraph
{::P(#a)} Label line
Another regular paragraph
   {::Q} Indented label
Final paragraph`;

            const labels = extractCustomLabels(content, true);
            expect(labels).toHaveLength(2);
            expect(labels[0].lineNumber).toBe(1);
            expect(labels[1].lineNumber).toBe(3);
        });
    });

    describe('processLabels', () => {
        it('should create correct label mappings', () => {
            const lines = [
                '{::P(#a)} First',
                '{::P(#b)} Second',
                '{::Q(#a)} Third',
                'Regular text'
            ];

            const { processedLabels, rawToProcessed } = processLabels(lines);
            
            expect(processedLabels.size).toBe(3);
            expect(processedLabels.get('P1')).toBe('First');
            expect(processedLabels.get('P2')).toBe('Second');
            expect(processedLabels.get('Q1')).toBe('Third');
            
            expect(rawToProcessed.size).toBe(3);
            expect(rawToProcessed.get('P(#a)')).toBe('P1');
            expect(rawToProcessed.get('P(#b)')).toBe('P2');
            expect(rawToProcessed.get('Q(#a)')).toBe('Q1');
        });

        it('should handle labels without placeholders', () => {
            const lines = [
                '{::P} Simple label',
                '{::Q123} Numbered label'
            ];

            const { processedLabels, rawToProcessed } = processLabels(lines);
            
            expect(processedLabels.get('P')).toBe('Simple label');
            expect(processedLabels.get('Q123')).toBe('Numbered label');
            expect(rawToProcessed.get('P')).toBe('P');
            expect(rawToProcessed.get('Q123')).toBe('Q123');
        });

        it('should handle mixed placeholder and non-placeholder labels', () => {
            const lines = [
                '{::P(#a)} With placeholder',
                '{::P} Without placeholder',
                '{::P(#b)} Another placeholder'
            ];

            const { processedLabels, rawToProcessed } = processLabels(lines);
            
            expect(rawToProcessed.get('P(#a)')).toBe('P1');
            expect(rawToProcessed.get('P')).toBe('P');
            expect(rawToProcessed.get('P(#b)')).toBe('P2');
        });

        it('should handle empty lines array', () => {
            const { processedLabels, rawToProcessed } = processLabels([]);
            
            expect(processedLabels.size).toBe(0);
            expect(rawToProcessed.size).toBe(0);
        });

        it('should extract content after label correctly', () => {
            const lines = [
                '{::P(#a)}    Content with leading spaces',
                '{::Q} Content with space',
                '{::R(#a)} Content with single space'
            ];

            const { processedLabels } = processLabels(lines);
            
            expect(processedLabels.get('P1')).toBe('Content with leading spaces');
            expect(processedLabels.get('Q')).toBe('Content with space');
            expect(processedLabels.get('R1')).toBe('Content with single space');
        });
    });
});