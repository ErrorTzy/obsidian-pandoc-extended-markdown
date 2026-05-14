import { Decoration } from '@codemirror/view';
import { InlineProcessor, InlineMatch, ProcessingContext, ContentRegion } from '../types';
import { isSyntaxFeatureEnabled } from '../../../shared/types/settingsTypes';
import { ListPatterns } from '../../../shared/patterns';
import { SubscriptWidget } from '../../widgets';
import { getRegionCursorPosition } from '../../../shared/utils/cursorUtils';

/**
 * Processes subscript syntax (~text~) in content
 */
export class SubscriptProcessor implements InlineProcessor {
    name = 'subscript';
    priority = 30;
    supportedRegions = new Set(['list-content', 'definition-content', 'paragraph', 'normal']);
    
    findMatches(text: string, region: ContentRegion, context: ProcessingContext): InlineMatch[] {
        const matches: InlineMatch[] = [];

        if (!isSyntaxFeatureEnabled(context.settings, 'enableSubscript')) {
            return matches;
        }
        
        // Pattern for subscript: ~text~ but not ^text^
        const pattern = ListPatterns.SUBSCRIPT_INLINE;
        
        // Get cursor position relative to region
        const regionCursorPos = getRegionCursorPosition(context, region);
        
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const subStart = match.index;
            const subEnd = match.index + match[0].length;
            const cursorInSub = regionCursorPos >= subStart && regionCursorPos <= subEnd;
            const isPartOfDoubleTilde = this.isTouchingTilde(text, region, context, subStart, subEnd);
            
            // Only create match if cursor is not within it and it is not part of ~~strikethrough~~.
            if (!cursorInSub && !isPartOfDoubleTilde) {
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

    private isTouchingTilde(
        text: string,
        region: ContentRegion,
        context: ProcessingContext,
        subStart: number,
        subEnd: number
    ): boolean {
        const sourceDoc = context.view?.state?.doc ?? context.document;
        if (!sourceDoc?.sliceString || sourceDoc.sliceString(region.from, region.to) !== text) {
            return this.isTouchingTildeInText(text, subStart, subEnd);
        }

        const absoluteFrom = region.from + subStart;
        const absoluteTo = region.from + subEnd;
        const charBefore = absoluteFrom > 0 ? sourceDoc.sliceString(absoluteFrom - 1, absoluteFrom) : '';
        const charAfter = absoluteTo < sourceDoc.length ? sourceDoc.sliceString(absoluteTo, absoluteTo + 1) : '';

        return charBefore === '~' || charAfter === '~';
    }

    private isTouchingTildeInText(text: string, subStart: number, subEnd: number): boolean {
        const charBefore = subStart > 0 ? text.charAt(subStart - 1) : '';
        const charAfter = subEnd < text.length ? text.charAt(subEnd) : '';

        return charBefore === '~' || charAfter === '~';
    }
    
    createDecoration(match: InlineMatch, context: ProcessingContext): Decoration {
        const { content, absoluteFrom } = match.data;
        
        return Decoration.replace({
            widget: new SubscriptWidget(content, context.view, absoluteFrom),
            inclusive: false
        });
    }
}
