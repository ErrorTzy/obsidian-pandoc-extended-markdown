import { Decoration } from '@codemirror/view';
import { Line } from '@codemirror/state';
import { StructuralProcessor, StructuralResult, ProcessingContext } from '../types';
import { ListPatterns } from '../../../shared/patterns';
import { CSS_CLASSES } from '../../../core/constants';
import { HashListMarkerWidget } from '../../widgets';

/**
 * Processes hash lists (#.) - only handles structural elements
 */
export class HashListProcessor implements StructuralProcessor {
    name = 'hash-list';
    priority = 10;
    
    canProcess(line: Line, context: ProcessingContext): boolean {
        const lineText = line.text;
        return ListPatterns.isHashList(lineText) !== null;
    }
    
    process(line: Line, context: ProcessingContext): StructuralResult {
        const lineText = line.text;
        const hashMatch = ListPatterns.isHashList(lineText);
        
        if (!hashMatch) {
            return { decorations: [] };
        }
        
        // Check if this list item is in an invalid block
        if (context.settings.strictPandocMode && context.invalidLines.has(line.number)) {
            return { decorations: [] };
        }
        
        const indent = hashMatch[1];
        const marker = hashMatch[2];
        const space = hashMatch[3];
        
        const markerStart = line.from + indent.length;
        const markerEnd = line.from + indent.length + marker.length + space.length;
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
        
        // Only replace the marker if cursor is not within it
        if (!cursorInMarker) {
            decorations.push({
                from: markerStart,
                to: markerEnd,
                decoration: Decoration.replace({
                    widget: new HashListMarkerWidget(context.hashCounter.value, context.view, markerStart),
                    inclusive: false
                })
            });
        }
        
        // Increment counter for next hash list
        context.hashCounter.value++;
        
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
            parentStructure: 'hash-list' as const
        };
        
        // Set list context for continuation line detection
        context.listContext = {
            isInList: true,
            contentStartColumn: indent.length + marker.length + space.length,
            listLevel: 1,
            parentStructure: 'hash-list'
        };
        
        return {
            decorations,
            contentRegion,
            skipFurtherProcessing: true
        };
    }
}