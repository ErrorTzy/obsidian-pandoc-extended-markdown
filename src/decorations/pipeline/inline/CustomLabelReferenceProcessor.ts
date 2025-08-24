import { Decoration } from '@codemirror/view';
import { InlineProcessor, InlineMatch, ProcessingContext, ContentRegion } from '../types';
import { CustomLabelReferenceWidget, DuplicateCustomLabelWidget } from '../../widgets';
import { ListPatterns } from '../../../patterns';

/**
 * Processes custom label references ({::label}) in content
 */
export class CustomLabelReferenceProcessor implements InlineProcessor {
    name = 'custom-label-reference';
    priority = 40;
    supportedRegions = new Set(['list-content', 'definition-content', 'paragraph', 'normal']);
    
    findMatches(text: string, region: ContentRegion, context: ProcessingContext): InlineMatch[] {
        const matches: InlineMatch[] = [];
        
        // Only process if More Extended Syntax is enabled
        if (!context.settings.moreExtendedSyntax) {
            return matches;
        }
        
        const pattern = ListPatterns.findCustomLabelReferences(text);
        
        pattern.forEach(match => {
            const fullMatch = match[0];
            const rawLabel = match[1];
            
            matches.push({
                from: match.index!,
                to: match.index! + fullMatch.length,
                type: 'custom-label-ref',
                data: {
                    rawLabel,
                    fullMatch,
                    region
                }
            });
        });
        
        return matches;
    }
    
    createDecoration(match: InlineMatch, context: ProcessingContext): Decoration {
        const { rawLabel, region } = match.data;
        let processedLabel = context.rawToProcessed?.get(rawLabel);
        
        // If not in rawToProcessed map, check if it contains placeholders
        if (!processedLabel && rawLabel.includes('#')) {
            // Process the label using placeholder context
            processedLabel = this.processPlaceholders(rawLabel, context.placeholderContext);
        }
        
        // Fall back to raw label if no processing is available
        if (!processedLabel) {
            processedLabel = rawLabel;
        }
        
        // Check if this is a duplicate label
        const isDuplicate = context.duplicateCustomLabels?.has(processedLabel);
        
        if (isDuplicate) {
            // Get information about the first occurrence
            const duplicateInfo = context.duplicateCustomLineInfo?.get(processedLabel);
            return Decoration.replace({
                widget: new DuplicateCustomLabelWidget(
                    processedLabel,
                    duplicateInfo?.firstLine || 0,
                    duplicateInfo?.firstContent || '',
                    context.view
                ),
                inclusive: false
            });
        }
        
        const labelContent = context.customLabels?.get(processedLabel) || '';
        // Calculate absolute position from match.from and the region it was found in
        const absolutePosition = (region?.from || 0) + match.from;
        
        return Decoration.replace({
            widget: new CustomLabelReferenceWidget(processedLabel, labelContent, context.view, absolutePosition),
            inclusive: false
        });
    }
    
    private processPlaceholders(label: string, placeholderContext?: any): string {
        if (!placeholderContext) return label;
        
        // Simple placeholder processing - replace (#a), (#b), etc. with numbers
        return label.replace(/\(#([a-z])\)/g, (match, letter) => {
            const value = placeholderContext.getPlaceholderValue?.(letter);
            return value !== undefined ? `(${value})` : match;
        });
    }
}