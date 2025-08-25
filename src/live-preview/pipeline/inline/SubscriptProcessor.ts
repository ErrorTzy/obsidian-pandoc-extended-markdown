import { Decoration } from '@codemirror/view';
import { InlineProcessor, InlineMatch, ProcessingContext, ContentRegion } from '../types';
import { ListPatterns } from '../../../shared/patterns';
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
        const pattern = ListPatterns.SUBSCRIPT_INLINE;
        
        // Get cursor position relative to region
        const cursorPos = context.view?.state?.selection?.main?.head;
        const regionCursorPos = cursorPos !== undefined ? cursorPos - region.from : -1;
        
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const subStart = match.index;
            const subEnd = match.index + match[0].length;
            const cursorInSub = regionCursorPos >= subStart && regionCursorPos <= subEnd;
            
            // Only create match if cursor is not within it
            if (!cursorInSub) {
                matches.push({
                    from: subStart,
                    to: subEnd,
                    type: 'subscript',
                    data: {
                        content: match[1],
                        rawText: match[0],
                        absoluteFrom: region.from + subStart
                    }
                });
            }
        }
        
        return matches;
    }
    
    createDecoration(match: InlineMatch, context: ProcessingContext): Decoration {
        const { content, absoluteFrom } = match.data;
        
        return Decoration.replace({
            widget: new SubscriptWidget(content, context.view, absoluteFrom),
            inclusive: false
        });
    }
}