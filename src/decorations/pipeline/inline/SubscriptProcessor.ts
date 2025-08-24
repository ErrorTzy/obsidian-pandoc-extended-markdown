import { Decoration } from '@codemirror/view';
import { InlineProcessor, InlineMatch, ProcessingContext, ContentRegion } from '../types';
import { SubscriptWidget } from '../../widgets';

/**
 * Processes subscript syntax (~text~) in content
 */
export class SubscriptProcessor implements InlineProcessor {
    name = 'subscript';
    priority = 30;
    supportedRegions = new Set(['list-content', 'definition-content', 'paragraph', 'normal']);
    
    findMatches(text: string, region: ContentRegion, context: ProcessingContext): InlineMatch[] {
        const matches: InlineMatch[] = [];
        
        // Pattern for subscript: ~text~ but not ^text^
        const pattern = /~([^~^\s]+(?:\s+[^~^\s]+)*)~/g;
        
        let match;
        while ((match = pattern.exec(text)) !== null) {
            matches.push({
                from: match.index,
                to: match.index + match[0].length,
                type: 'subscript',
                data: {
                    content: match[1],
                    rawText: match[0]
                }
            });
        }
        
        return matches;
    }
    
    createDecoration(match: InlineMatch, context: ProcessingContext): Decoration {
        const { content } = match.data;
        
        return Decoration.replace({
            widget: new SubscriptWidget(content),
            inclusive: false
        });
    }
}