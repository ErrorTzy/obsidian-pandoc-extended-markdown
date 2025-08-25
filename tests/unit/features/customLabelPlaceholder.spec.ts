import { PlaceholderContext } from '../../../src/shared/utils/placeholderProcessor';

describe('Custom Label Placeholder Numbering', () => {
    describe('PlaceholderContext', () => {
        it('should maintain correct numbering when inserting items between existing ones', () => {
            // Test the bug: When we insert a new item between existing ones,
            // the numbering should be reassigned correctly
            
            // Initial state: P1 and P2
            const context1 = new PlaceholderContext();
            const label1 = context1.processLabel('P(#a)');
            const label2 = context1.processLabel('P(#b)');
            
            expect(label1).toBe('P1');
            expect(label2).toBe('P2');
            
            // Simulate document edit: insert new item between P1 and P2
            // This should reset and renumber: P1, P2 (new), P3 (was P2)
            const context2 = new PlaceholderContext();
            const newLabel1 = context2.processLabel('P(#a)');
            const newLabel2 = context2.processLabel('P(#c)'); // new item
            const newLabel3 = context2.processLabel('P(#b)'); // was P2, should now be P3
            
            expect(newLabel1).toBe('P1');
            expect(newLabel2).toBe('P2');
            expect(newLabel3).toBe('P3');
            
            // References should use the new numbering
            expect(context2.getProcessedLabel('P(#a)')).toBe('P1');
            expect(context2.getProcessedLabel('P(#b)')).toBe('P3'); // This should be P3 now
            expect(context2.getProcessedLabel('P(#c)')).toBe('P2');
        });
        
        it('should reset numbering when context is reset', () => {
            const context = new PlaceholderContext();
            
            // First pass
            expect(context.processLabel('P(#a)')).toBe('P1');
            expect(context.processLabel('P(#b)')).toBe('P2');
            
            // Reset context
            context.reset();
            
            // After reset, numbering should start fresh
            expect(context.processLabel('P(#x)')).toBe('P1');
            expect(context.processLabel('P(#y)')).toBe('P2');
        });
        
        it('should demonstrate the bug when reusing context', () => {
            // This test demonstrates the actual bug
            const context = new PlaceholderContext();
            
            // First document: P(#a) and P(#b)
            expect(context.processLabel('P(#a)')).toBe('P1');
            expect(context.processLabel('P(#b)')).toBe('P2');
            
            // Now simulate inserting P(#c) between them WITHOUT resetting context
            // This is what happens in the plugin when document changes
            // The order is now: P(#a), P(#c), P(#b)
            
            // P(#a) is already processed, returns P1
            expect(context.getProcessedLabel('P(#a)')).toBe('P1');
            
            // P(#c) is new, gets the next number (P3) - THIS IS THE BUG
            expect(context.processLabel('P(#c)')).toBe('P3');
            
            // P(#b) was already processed as P2
            expect(context.getProcessedLabel('P(#b)')).toBe('P2');
            
            // So we get: P1, P3, P2 instead of P1, P2, P3
        });
    });
});