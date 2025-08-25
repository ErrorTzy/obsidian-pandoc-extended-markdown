import { Decoration } from '@codemirror/view';
import { InlineProcessor, InlineMatch, ProcessingContext, ContentRegion } from '../types';
import { ListPatterns } from '../../../shared/patterns';
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
        const pattern = ListPatterns.EXAMPLE_REFERENCE;
        
        // Get cursor position relative to region
        const cursorPos = context.view?.state?.selection?.main?.head;
        const regionCursorPos = cursorPos !== undefined ? cursorPos - region.from : -1;
        
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const label = match[1];
            
            // Check if cursor is within this reference
            const refStart = match.index;
            const refEnd = match.index + match[0].length;
            const cursorInRef = regionCursorPos >= refStart && regionCursorPos <= refEnd;
            
            // Only create match if label exists and cursor is not within it
            if (context.exampleLabels.has(label) && !cursorInRef) {
                matches.push({
                    from: refStart,
                    to: refEnd,
                    type: 'example-ref',
                    data: { 
                        label,
                        rawText: match[0],
                        region
                    }
                });
            }
        }
        
        return matches;
    }
    
    createDecoration(match: InlineMatch, context: ProcessingContext): Decoration {
        const { label, region } = match.data;
        const number = context.exampleLabels.get(label) || 0;
        const content = context.exampleContent.get(label) || '';
        const absolutePosition = match.from + (region?.from || 0);
        
        // Create a context object to pass to the widget for processing references in popovers
        const referenceContext = {
            exampleLabels: context.exampleLabels,
            exampleContent: context.exampleContent,
            customLabels: context.customLabels,
            rawToProcessed: context.rawToProcessed
        };
        
        return Decoration.replace({
            widget: new ExampleReferenceWidget(
                number, 
                content, 
                context.view, 
                absolutePosition,
                context.app,
                context.component,
                referenceContext
            ),
            inclusive: false
        });
    }
}