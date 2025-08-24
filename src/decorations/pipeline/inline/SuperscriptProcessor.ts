import { Decoration } from '@codemirror/view';
import { InlineProcessor, InlineMatch, ProcessingContext, ContentRegion } from '../types';
import { SuperscriptWidget } from '../../widgets';

/**
 * Processes superscript syntax (^text^) in content
 */
export class SuperscriptProcessor implements InlineProcessor {
    name = 'superscript';
    priority = 20;
    supportedRegions = new Set(['list-content', 'definition-content', 'paragraph', 'normal']);
    
    findMatches(text: string, region: ContentRegion, context: ProcessingContext): InlineMatch[] {
        const matches: InlineMatch[] = [];
        
        // Pattern for superscript: ^text^ but not ~text~
        // Negative lookbehind to avoid matching subscripts
        const pattern = /\^([^^~\s]+(?:\s+[^^~\s]+)*)\^/g;
        
        let match;
        while ((match = pattern.exec(text)) !== null) {
            // Additional check to ensure it's not a subscript
            if (match.index === 0 || text[match.index - 1] !== '~') {
                matches.push({
                    from: match.index,
                    to: match.index + match[0].length,
                    type: 'superscript',
                    data: {
                        content: match[1],
                        rawText: match[0]
                    }
                });
            }
        }
        
        return matches;
    }
    
    createDecoration(match: InlineMatch, context: ProcessingContext): Decoration {
        const { content } = match.data;
        
        return Decoration.replace({
            widget: new SuperscriptWidget(content),
            inclusive: false
        });
    }
}