import { Decoration } from '@codemirror/view';
import { InlineProcessor, InlineMatch, ProcessingContext, ContentRegion } from '../types';
import { CustomLabelReferenceWidget, DuplicateCustomLabelWidget } from '../../widgets';
import { ListPatterns } from '../../../shared/patterns';

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
        
        // Get cursor position relative to region
        const cursorPos = context.view?.state?.selection?.main?.head;
        const regionCursorPos = cursorPos !== undefined ? cursorPos - region.from : -1;
        
        const pattern = ListPatterns.findCustomLabelReferences(text);
        
        pattern.forEach(match => {
            const fullMatch = match[0];
            const rawLabel = match[1];
            
            // Validate the reference before adding it to matches
            let isValid = false;
            
            // Check if label was explicitly defined in rawToProcessed
            if (context.rawToProcessed?.has(rawLabel)) {
                isValid = true;
            } 
            // Check if it's a direct match in customLabels (for labels without placeholders)
            else if (context.customLabels?.has(rawLabel)) {
                isValid = true;
            }
            // Check if it's marked as a duplicate (duplicates are references to valid labels)
            else if (context.duplicateCustomLabels?.has(rawLabel)) {
                isValid = true;
            }
            // Check if it can be validated through PlaceholderContext
            else if (context.placeholderContext) {
                const processedLabel = context.placeholderContext.getProcessedLabel(rawLabel);
                isValid = processedLabel !== null;
            }
            
            // Check if cursor is inside this reference
            const refStart = match.index!;
            const refEnd = match.index! + fullMatch.length;
            const cursorInReference = regionCursorPos >= refStart && regionCursorPos < refEnd;
            
            // Only add valid references to matches when cursor is NOT inside them
            // This allows the reference to expand when clicked (cursor moves inside)
            if (isValid && !cursorInReference) {
                matches.push({
                    from: refStart,
                    to: refEnd,
                    type: 'custom-label-ref',
                    data: {
                        rawLabel,
                        fullMatch,
                        absoluteFrom: region.from + refStart
                    }
                });
            }
        });
        
        return matches;
    }
    
    createDecoration(match: InlineMatch, context: ProcessingContext): Decoration {
        const { rawLabel, absoluteFrom } = match.data;
        
        // Since validation is now done in findMatches, we know this is a valid reference
        // Determine the processed label
        let processedLabel: string;
        
        // Check if label was explicitly defined in rawToProcessed
        if (context.rawToProcessed?.has(rawLabel)) {
            processedLabel = context.rawToProcessed.get(rawLabel)!;
        } 
        // Check if it's a direct match in customLabels (for labels without placeholders)
        else if (context.customLabels?.has(rawLabel)) {
            processedLabel = rawLabel;
        }
        // Check if it's marked as a duplicate
        else if (context.duplicateCustomLabels?.has(rawLabel)) {
            processedLabel = rawLabel;
        }
        // Use PlaceholderContext to process the label
        else if (context.placeholderContext) {
            const processed = context.placeholderContext.getProcessedLabel(rawLabel);
            processedLabel = processed !== null ? processed : rawLabel;
        }
        // Fall back to raw label
        else {
            processedLabel = rawLabel;
        }
        
        // Check if this is a duplicate label (duplicates are still valid, just marked differently)
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
        
        // Create a context object to pass to the widget for processing references in popovers
        const referenceContext = {
            exampleLabels: context.exampleLabels,
            exampleContent: context.exampleContent,
            customLabels: context.customLabels,
            rawToProcessed: context.rawToProcessed
        };
        
        return Decoration.replace({
            widget: new CustomLabelReferenceWidget(
                processedLabel, 
                labelContent, 
                context.view, 
                absoluteFrom,
                context.app,
                context.component,
                referenceContext
            ),
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