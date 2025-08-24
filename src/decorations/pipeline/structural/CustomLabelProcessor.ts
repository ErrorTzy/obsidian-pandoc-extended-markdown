import { Line } from '@codemirror/state';
import { Decoration } from '@codemirror/view';
import { StructuralProcessor, StructuralResult, ProcessingContext, ContentRegion } from '../types';
import { ListPatterns } from '../../../patterns';
import { CSS_CLASSES, DECORATION_STYLES } from '../../../constants';
import {
    CustomLabelMarkerWidget,
    CustomLabelPartialWidget,
    CustomLabelPlaceholderWidget,
    CustomLabelProcessedWidget,
    CustomLabelInlineNumberWidget,
    DuplicateCustomLabelWidget
} from '../../widgets/customLabelWidget';

/**
 * Processor for custom label list markers {::LABEL}
 * Handles the structural part of custom label lists, leaving inline content for phase 2
 */
export class CustomLabelProcessor implements StructuralProcessor {
    name = 'custom-label-list';
    priority = 15; // Process after basic lists
    
    canProcess(line: Line, context: ProcessingContext): boolean {
        // Only process if More Extended Syntax is enabled
        if (!context.settings.moreExtendedSyntax) {
            return false;
        }
        
        const lineText = context.document.sliceString(line.from, line.to);
        return ListPatterns.isCustomLabelList(lineText) !== null;
    }
    
    process(line: Line, context: ProcessingContext): StructuralResult {
        const lineText = context.document.sliceString(line.from, line.to);
        const lineNum = context.document.lineAt(line.from).number;
        const decorations: Array<{from: number, to: number, decoration: Decoration}> = [];
        
        const customLabelMatch = ListPatterns.isCustomLabelList(lineText);
        if (!customLabelMatch) {
            return { decorations };
        }
        
        // Check strict mode requirements
        if (context.settings.strictPandocMode && context.invalidLines.has(lineNum - 1)) {
            return { decorations };
        }
        
        const indent = customLabelMatch[1];
        const fullMarker = customLabelMatch[2];
        const rawLabel = customLabelMatch[3];
        const space = customLabelMatch[4];
        
        // Get processed label (with placeholders replaced)
        const processedLabel = context.rawToProcessed?.get(rawLabel) || rawLabel;
        
        const markerStart = line.from + indent.length;
        const markerEnd = line.from + indent.length + fullMarker.length + space.length;
        
        // Parse the marker to find placeholder positions
        const placeholderMatches = [...rawLabel.matchAll(/\(#([^)]+)\)/g)];
        const placeholderRanges: Array<{start: number, end: number, name: string}> = [];
        
        for (const match of placeholderMatches) {
            if (match.index !== undefined) {
                const placeholderStart = markerStart + DECORATION_STYLES.CUSTOM_LABEL_PREFIX_LENGTH + match.index;
                const placeholderEnd = placeholderStart + match[0].length;
                placeholderRanges.push({
                    start: placeholderStart,
                    end: placeholderEnd,
                    name: match[1]
                });
            }
        }
        
        // Check if cursor is within the marker
        const selection = context.view.state.selection;
        const cursorPos = selection?.main?.from;
        const isCursorInMarker = cursorPos !== undefined && cursorPos >= markerStart && cursorPos <= markerEnd;
        const isCursorAtListMarker = cursorPos !== undefined && cursorPos >= markerStart && cursorPos < markerEnd;
        
        // Check if this is a duplicate label
        const isDuplicate = context.duplicateCustomLabels?.has(processedLabel) || false;
        
        // Find which placeholder the cursor is in (if any)
        let cursorPlaceholder: {start: number, end: number, name: string} | null = null;
        if (isCursorInMarker && cursorPos !== undefined) {
            for (const range of placeholderRanges) {
                if (cursorPos >= range.start && cursorPos <= range.end) {
                    cursorPlaceholder = range;
                    break;
                }
            }
        }
        
        // Determine display level based on cursor position
        let displayLevel: 'full' | 'semi-expanded' | 'collapsed';
        if (isCursorAtListMarker) {
            displayLevel = 'full';
        } else if (placeholderRanges.length > 0 && !isCursorInMarker) {
            // Check if cursor is anywhere in the line
            const isCursorInLine = cursorPos !== undefined && cursorPos >= line.from && cursorPos <= line.to;
            displayLevel = isCursorInLine ? 'semi-expanded' : 'collapsed';
        } else {
            displayLevel = 'collapsed';
        }
        
        if (displayLevel === 'collapsed' && !isDuplicate) {
            // Show fully processed marker widget
            const content = context.customLabels?.get(processedLabel) || '';
            decorations.push({
                from: markerStart,
                to: markerEnd,
                decoration: Decoration.replace({
                    widget: new CustomLabelMarkerWidget(processedLabel, content, context.view),
                    inclusive: false
                })
            });
        } else if (displayLevel === 'semi-expanded') {
            // Show brackets and processed label
            
            // Opening bracket
            decorations.push({
                from: markerStart,
                to: markerStart + DECORATION_STYLES.CUSTOM_LABEL_PREFIX_LENGTH,
                decoration: Decoration.replace({
                    widget: new CustomLabelPartialWidget('{', CSS_CLASSES.CUSTOM_LABEL_BRACKET),
                    inclusive: false
                })
            });
            
            // Double colon
            const colonStart = markerStart + DECORATION_STYLES.CUSTOM_LABEL_PREFIX_LENGTH;
            decorations.push({
                from: colonStart,
                to: colonStart + 2,
                decoration: Decoration.replace({
                    widget: new CustomLabelPartialWidget('::', CSS_CLASSES.CUSTOM_LABEL_MARKER),
                    inclusive: false
                })
            });
            
            // Processed label
            const labelStart = colonStart + 2;
            const labelEnd = markerEnd - space.length - 1; // Exclude closing bracket and space
            const content = context.customLabels?.get(processedLabel) || '';
            
            decorations.push({
                from: labelStart,
                to: labelEnd,
                decoration: Decoration.replace({
                    widget: new CustomLabelProcessedWidget(processedLabel, content, context.view),
                    inclusive: false
                })
            });
            
            // Closing bracket
            decorations.push({
                from: labelEnd,
                to: labelEnd + 1,
                decoration: Decoration.replace({
                    widget: new CustomLabelPartialWidget('}', CSS_CLASSES.CUSTOM_LABEL_BRACKET),
                    inclusive: false
                })
            });
        } else if (displayLevel === 'full' || isDuplicate) {
            // Show full syntax with selective placeholder expansion
            
            // Opening bracket
            decorations.push({
                from: markerStart,
                to: markerStart + DECORATION_STYLES.CUSTOM_LABEL_PREFIX_LENGTH,
                decoration: Decoration.replace({
                    widget: new CustomLabelPartialWidget('{', CSS_CLASSES.CUSTOM_LABEL_BRACKET),
                    inclusive: false
                })
            });
            
            // Double colon
            const colonStart = markerStart + DECORATION_STYLES.CUSTOM_LABEL_PREFIX_LENGTH;
            decorations.push({
                from: colonStart,
                to: colonStart + 2,
                decoration: Decoration.replace({
                    widget: new CustomLabelPartialWidget('::', CSS_CLASSES.CUSTOM_LABEL_MARKER),
                    inclusive: false
                })
            });
            
            // Process label content with selective placeholder expansion
            const labelStart = colonStart + 2;
            const labelEnd = markerEnd - space.length - 1;
            
            if (isDuplicate) {
                // Show duplicate warning widget
                const firstOccurrence = context.duplicateCustomLineInfo?.get(processedLabel);
                decorations.push({
                    from: labelStart,
                    to: labelEnd,
                    decoration: Decoration.replace({
                        widget: new DuplicateCustomLabelWidget(
                            rawLabel,
                            firstOccurrence?.firstLine,
                            firstOccurrence?.firstContent
                        ),
                        inclusive: false
                    })
                });
            } else if (placeholderRanges.length > 0) {
                // Process each part of the label
                let lastEnd = labelStart;
                
                for (const range of placeholderRanges) {
                    // Add text before placeholder (if any)
                    if (range.start > lastEnd) {
                        const textBefore = lineText.substring(
                            lastEnd - line.from,
                            range.start - line.from
                        );
                        decorations.push({
                            from: lastEnd,
                            to: range.start,
                            decoration: Decoration.mark({ class: CSS_CLASSES.CUSTOM_LABEL_TEXT })
                        });
                    }
                    
                    // Add placeholder widget
                    if (cursorPlaceholder && cursorPlaceholder === range) {
                        // Cursor is in this placeholder - don't replace it
                        decorations.push({
                            from: range.start,
                            to: range.end,
                            decoration: Decoration.mark({ class: CSS_CLASSES.CUSTOM_LABEL_PLACEHOLDER })
                        });
                    } else {
                        // Replace placeholder with number widget
                        const placeholderKey = `${rawLabel.substring(0, rawLabel.indexOf('('))}(#${range.name})`;
                        const processedKey = context.rawToProcessed?.get(placeholderKey);
                        const number = processedKey ? 
                            parseInt(processedKey.match(/\d+$/)?.[0] || '0') :
                            context.placeholderContext?.getPlaceholderNumber(range.name) || 0;
                        
                        decorations.push({
                            from: range.start,
                            to: range.end,
                            decoration: Decoration.replace({
                                widget: new CustomLabelInlineNumberWidget(number),
                                inclusive: false
                            })
                        });
                    }
                    
                    lastEnd = range.end;
                }
                
                // Add text after last placeholder (if any)
                if (lastEnd < labelEnd) {
                    decorations.push({
                        from: lastEnd,
                        to: labelEnd,
                        decoration: Decoration.mark({ class: CSS_CLASSES.CUSTOM_LABEL_TEXT })
                    });
                }
            } else {
                // No placeholders, just mark the label text
                decorations.push({
                    from: labelStart,
                    to: labelEnd,
                    decoration: Decoration.mark({ class: CSS_CLASSES.CUSTOM_LABEL_TEXT })
                });
            }
            
            // Closing bracket
            decorations.push({
                from: labelEnd,
                to: labelEnd + 1,
                decoration: Decoration.replace({
                    widget: new CustomLabelPartialWidget('}', CSS_CLASSES.CUSTOM_LABEL_BRACKET),
                    inclusive: false
                })
            });
        }
        
        // Mark content region for inline processing
        const contentRegion: ContentRegion = {
            from: markerEnd,
            to: line.to,
            type: 'list-content',
            parentStructure: 'custom-label-list',
            metadata: {
                rawLabel,
                processedLabel,
                isDuplicate
            }
        };
        
        return {
            decorations,
            contentRegion,
            skipFurtherProcessing: true
        };
    }
}