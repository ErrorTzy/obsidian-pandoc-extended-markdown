import { Decoration } from '@codemirror/view';
import { InlineProcessor, InlineMatch, ProcessingContext, ContentRegion } from '../types';
import { ListPatterns } from '../../../shared/patterns';
import { SuperscriptWidget } from '../../widgets';
import { getRegionCursorPosition } from '../../../shared/utils/cursorUtils';

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
        // Uses negative character classes for compatibility with older browsers
        const pattern = ListPatterns.SUPERSCRIPT_INLINE;
        
        // Get cursor position relative to region
        const regionCursorPos = getRegionCursorPosition(context, region);
        
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const supStart = match.index;
            const supEnd = match.index + match[0].length;
            const cursorInSup = regionCursorPos >= supStart && regionCursorPos <= supEnd;
            
            // Only create match if cursor is not within it
            if (!cursorInSup) {
                matches.push({
                    from: supStart,
                    to: supEnd,
                    type: 'superscript',
                    data: {
                        content: match[1],
                        rawText: match[0],
                        absoluteFrom: region.from + supStart
                    }
                });
            }
        }
        
        return matches;
    }
    
    createDecoration(match: InlineMatch, context: ProcessingContext): Decoration {
        const { content, absoluteFrom } = match.data;
        
        return Decoration.replace({
            widget: new SuperscriptWidget(content, context.view, absoluteFrom),
            inclusive: false
        });
    }
}