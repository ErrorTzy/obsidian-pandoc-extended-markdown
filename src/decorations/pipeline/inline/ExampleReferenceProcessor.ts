import { Decoration } from '@codemirror/view';
import { InlineProcessor, InlineMatch, ProcessingContext, ContentRegion } from '../types';
import { ExampleReferenceWidget } from '../../widgets';

/**
 * Processes example references ((@label)) in content
 */
export class ExampleReferenceProcessor implements InlineProcessor {
    name = 'example-reference';
    priority = 10;
    supportedRegions = new Set(['list-content', 'definition-content', 'paragraph', 'normal']);
    
    findMatches(text: string, region: ContentRegion, context: ProcessingContext): InlineMatch[] {
        const matches: InlineMatch[] = [];
        const pattern = /\(@([a-zA-Z][a-zA-Z0-9_-]*)\)/g;
        
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const label = match[1];
            
            // Only create match if label exists
            if (context.exampleLabels.has(label)) {
                matches.push({
                    from: match.index,
                    to: match.index + match[0].length,
                    type: 'example-ref',
                    data: { 
                        label,
                        rawText: match[0]
                    }
                });
            }
        }
        
        return matches;
    }
    
    createDecoration(match: InlineMatch, context: ProcessingContext): Decoration {
        const { label } = match.data;
        const number = context.exampleLabels.get(label) || 0;
        const content = context.exampleContent.get(label) || '';
        
        return Decoration.replace({
            widget: new ExampleReferenceWidget(number, content),
            inclusive: false
        });
    }
}