import { extractDefinitionLists, DefinitionListItem } from '../../../src/shared/extractors/definitionListExtractor';

describe('definitionListExtractor', () => {
    describe('extractDefinitionLists', () => {
        it('should extract simple single definition', () => {
            const content = `Term 1
: Definition 1`;
            
            const result = extractDefinitionLists(content);
            
            expect(result).toHaveLength(1);
            expect(result[0].term).toBe('Term 1');
            expect(result[0].definitions).toEqual(['Definition 1']);
        });
        
        it('should extract term with multiple definitions', () => {
            const content = `Term 2
: Def 2a
: Def 2b`;
            
            const result = extractDefinitionLists(content);
            
            expect(result).toHaveLength(1);
            expect(result[0].term).toBe('Term 2');
            expect(result[0].definitions).toHaveLength(2);
            expect(result[0].definitions).toEqual(['Def 2a', 'Def 2b']);
        });
        
        it('should handle continuation lines', () => {
            const content = `Term 3
: Def 3a

    This is a continuation`;
            
            const result = extractDefinitionLists(content);
            
            expect(result).toHaveLength(1);
            expect(result[0].term).toBe('Term 3');
            expect(result[0].definitions).toEqual(['Def 3a This is a continuation']);
        });
        
        it('should handle tilde markers', () => {
            const content = `Term 4
~ Def 4a
~ Def 4b`;
            
            const result = extractDefinitionLists(content);
            
            expect(result).toHaveLength(1);
            expect(result[0].term).toBe('Term 4');
            expect(result[0].definitions).toHaveLength(2);
            expect(result[0].definitions).toEqual(['Def 4a', 'Def 4b']);
        });
        
        it('should handle terms with markdown formatting', () => {
            const content = `**Bold Term**
: Definition for bold term

*Italic Term*
: Definition for italic term

_Underscore Term_
: Definition for underscore term`;
            
            const result = extractDefinitionLists(content);
            
            expect(result).toHaveLength(3);
            expect(result[0].term).toBe('**Bold Term**');
            expect(result[0].definitions).toEqual(['Definition for bold term']);
            expect(result[1].term).toBe('*Italic Term*');
            expect(result[1].definitions).toEqual(['Definition for italic term']);
            expect(result[2].term).toBe('_Underscore Term_');
            expect(result[2].definitions).toEqual(['Definition for underscore term']);
        });
        
        it('should not confuse unordered lists with formatted terms', () => {
            const content = `* This is a list item
- Another list item
+ Yet another list item

**This is a term**
: This is a definition`;
            
            const result = extractDefinitionLists(content);
            
            // Should only find the actual definition list, not the unordered list items
            expect(result).toHaveLength(1);
            expect(result[0].term).toBe('**This is a term**');
            expect(result[0].definitions).toEqual(['This is a definition']);
        });
        
        it('should handle complex multi-term list', () => {
            const content = `Term 1
: Def 1

Term 2
: Def 2a

    Def 2a, another paragraph

: Def 2b

Term 3

~ Def 3a
~ Def 3b`;
            
            const result = extractDefinitionLists(content);
            
            expect(result).toHaveLength(3);
            
            // Check Term 1
            expect(result[0].term).toBe('Term 1');
            expect(result[0].definitions).toEqual(['Def 1']);
            
            // Check Term 2
            expect(result[1].term).toBe('Term 2');
            expect(result[1].definitions).toHaveLength(2);
            expect(result[1].definitions[0]).toContain('Def 2a');
            expect(result[1].definitions[0]).toContain('another paragraph');
            expect(result[1].definitions[1]).toBe('Def 2b');
            
            // Check Term 3
            expect(result[2].term).toBe('Term 3');
            expect(result[2].definitions).toEqual(['Def 3a', 'Def 3b']);
        });
    });
});