import { Decoration } from '@codemirror/view';
import { Line } from '@codemirror/state';
import { StructuralProcessor, StructuralResult, ProcessingContext } from '../types';
import { ListPatterns } from '../../../shared/patterns';
import { CSS_CLASSES } from '../../../core/constants';
import { ExampleListMarkerWidget, DuplicateExampleLabelWidget } from '../../widgets';

/**
 * Processes example lists (@label) - only handles structural elements
 */
export class ExampleListProcessor implements StructuralProcessor {
    name = 'example-list';
    priority = 30;
    
    canProcess(line: Line, context: ProcessingContext): boolean {
        const lineText = line.text;
        return ListPatterns.isExampleList(lineText) !== null;
    }
    
    process(line: Line, context: ProcessingContext): StructuralResult {
        const lineText = line.text;
        const exampleMatch = ListPatterns.isExampleList(lineText);
        
        if (!exampleMatch) {
            return { decorations: [] };
        }
        
        // Check if this list item is in an invalid block
        if (context.settings.strictPandocMode && context.invalidLines.has(line.number)) {
            return { decorations: [] };
        }
        
        const indent = exampleMatch[1] || '';
        const fullMarker = exampleMatch[2]; // Full (@label) part
        const label = exampleMatch[3] || '';  // Just the label
        const space = exampleMatch[4] || '';
        
        const markerStart = line.from + indent.length;
        const markerEnd = line.from + indent.length + fullMarker.length + space.length;
        const contentStart = markerEnd;
        
        // Check if cursor is within the marker area
        const cursorPos = context.view.state.selection?.main?.head;
        const cursorInMarker = cursorPos !== undefined && cursorPos >= markerStart && cursorPos < markerEnd;
        
        const decorations: Array<{from: number, to: number, decoration: Decoration}> = [];
        
        // Add line decoration with CSS class for proper styling
        decorations.push({
            from: line.from,
            to: line.from,
            decoration: Decoration.line({
                class: `${CSS_CLASSES.LIST_LINE} ${CSS_CLASSES.LIST_LINE_1} ${CSS_CLASSES.PANDOC_LIST_LINE}`
            })
        });
        
        // Check if THIS line is marked as a duplicate (not the first occurrence)
        const isDuplicate = context.duplicateExampleLineNumbers?.has(line.number);
        
        // Only replace the marker if cursor is not within it
        if (!cursorInMarker) {
            if (isDuplicate && label) {
                // Use duplicate widget for duplicate labels
                const firstLine = context.duplicateExampleLabels?.get(label) || 0;
                const firstContent = context.duplicateExampleContent?.get(label) || '';
                decorations.push({
                    from: markerStart,
                    to: markerEnd,
                    decoration: Decoration.replace({
                        widget: new DuplicateExampleLabelWidget(
                            label, 
                            firstLine, 
                            firstContent, 
                            context.view, 
                            markerStart
                        ),
                        inclusive: false
                    })
                });
            } else {
                // Use normal widget for unique labels
                // For unlabeled lists, use line number mapping; for labeled lists, use label mapping
                const exampleNumber = context.exampleLineNumbers?.get(line.number) || 
                                     (label ? context.exampleLabels?.get(label) : 0) || 0;
                const exampleContent = lineText.substring(indent.length + fullMarker.length + space.length);
                
                decorations.push({
                    from: markerStart,
                    to: markerEnd,
                    decoration: Decoration.replace({
                        widget: new ExampleListMarkerWidget(
                            exampleNumber, 
                            label, 
                            context.view, 
                            markerStart
                        ),
                        inclusive: false
                    })
                });
            }
        }
        
        // Wrap the content area
        decorations.push({
            from: contentStart,
            to: line.to,
            decoration: Decoration.mark({
                class: CSS_CLASSES.CM_LIST_1
            })
        });
        
        // Mark content region for inline processing
        const contentRegion = {
            from: contentStart,
            to: line.to,
            type: 'list-content' as const,
            parentStructure: 'example-list' as const,
            metadata: { label, isDuplicate: isDuplicate || false }
        };
        
        return {
            decorations,
            contentRegion,
            skipFurtherProcessing: true
        };
    }
}