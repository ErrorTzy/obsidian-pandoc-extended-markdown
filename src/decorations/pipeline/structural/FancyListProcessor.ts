import { Decoration } from '@codemirror/view';
import { Line } from '@codemirror/state';
import { StructuralProcessor, StructuralResult, ProcessingContext } from '../types';
import { ListPatterns } from '../../../patterns';
import { FancyListMarkerWidget } from '../../widgets';

/**
 * Processes fancy lists (A., i., etc.) - only handles structural elements
 */
export class FancyListProcessor implements StructuralProcessor {
    name = 'fancy-list';
    priority = 20;
    
    canProcess(line: Line, context: ProcessingContext): boolean {
        const lineText = line.text;
        return ListPatterns.isFancyList(lineText) !== null;
    }
    
    process(line: Line, context: ProcessingContext): StructuralResult {
        const lineText = line.text;
        const fancyMatch = ListPatterns.isFancyList(lineText);
        
        if (!fancyMatch) {
            return { decorations: [] };
        }
        
        // Check if this list item is in an invalid block
        if (context.settings.strictPandocMode && context.invalidLines.has(line.number)) {
            return { decorations: [] };
        }
        
        const indent = fancyMatch[1];
        const markerWithDelimiter = fancyMatch[2];  // e.g., "A."
        const marker = fancyMatch[3];                // e.g., "A"
        const delimiter = fancyMatch[4];             // e.g., "."
        const space = fancyMatch[5];
        
        const markerStart = line.from + indent.length;
        const markerEnd = line.from + indent.length + marker.length + delimiter.length + space.length;
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
                class: 'HyperMD-list-line HyperMD-list-line-1 pandoc-list-line'
            })
        });
        
        // Only replace the marker if cursor is not within it
        if (!cursorInMarker) {
            decorations.push({
                from: markerStart,
                to: markerEnd,
                decoration: Decoration.replace({
                    widget: new FancyListMarkerWidget(marker, delimiter, context.view, markerStart)
                })
            });
        }
        
        // Wrap the content area
        decorations.push({
            from: contentStart,
            to: line.to,
            decoration: Decoration.mark({
                class: 'cm-list-1'
            })
        });
        
        // Mark content region for inline processing
        const contentRegion = {
            from: contentStart,
            to: line.to,
            type: 'list-content' as const,
            parentStructure: 'fancy-list' as const
        };
        
        return {
            decorations,
            contentRegion,
            skipFurtherProcessing: true
        };
    }
}