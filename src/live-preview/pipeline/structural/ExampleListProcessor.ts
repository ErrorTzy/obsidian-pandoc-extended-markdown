import { Decoration } from '@codemirror/view';
import { Line } from '@codemirror/state';
import { StructuralResult, ProcessingContext } from '../types';
import { ListPatterns } from '../../../shared/patterns';
import { CSS_CLASSES } from '../../../core/constants';
import { ExampleListMarkerWidget, DuplicateExampleLabelWidget } from '../../widgets';
import { BaseStructuralProcessor } from './BaseStructuralProcessor';

/**
 * Processes example lists (@label) - only handles structural elements
 */
export class ExampleListProcessor extends BaseStructuralProcessor {
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
        if (this.isInvalidInStrictMode(line, context)) {
            return { decorations: [] };
        }

        const markerInfo = this.extractMarkerInfo(exampleMatch, line);
        const decorations: Array<{from: number, to: number, decoration: Decoration}> = [];

        // Add line decoration using base class method
        decorations.push(this.createLineDecoration(line));

        // Add marker widget if cursor is not within it
        const cursorInMarker = this.isCursorInMarker(markerInfo.markerStart, markerInfo.markerEnd, context);
        if (!cursorInMarker) {
            this.addMarkerWidget(decorations, markerInfo, line, lineText, context);
        }

        // Add content decoration using base class method
        decorations.push(this.createContentMarkDecoration(markerInfo.contentStart, line.to));

        // Create content region and update context
        const contentRegion = this.createContentRegion(
            markerInfo.contentStart,
            line.to,
            'example-list',
            { label: markerInfo.label, isDuplicate: context.duplicateExampleLineNumbers?.has(line.number) || false }
        );

        this.setListContext(
            context,
            markerInfo.indent.length + markerInfo.fullMarker.length + markerInfo.space.length,
            1,
            'example-list'
        );

        return {
            decorations,
            contentRegion,
            skipFurtherProcessing: true
        };
    }
    
    /**
     * Extracts marker information from the regex match.
     */
    private extractMarkerInfo(match: RegExpMatchArray, line: Line) {
        const indent = match[1] || '';
        const fullMarker = match[2]; // Full (@label) part
        const label = match[3] || '';  // Just the label
        const space = match[4] || '';
        
        const markerStart = line.from + indent.length;
        const markerEnd = line.from + indent.length + fullMarker.length + space.length;
        const contentStart = markerEnd;
        
        return { indent, fullMarker, label, space, markerStart, markerEnd, contentStart };
    }
    
    
    /**
     * Adds the appropriate marker widget.
     */
    private addMarkerWidget(
        decorations: Array<{from: number, to: number, decoration: Decoration}>,
        markerInfo: ReturnType<typeof this.extractMarkerInfo>,
        line: Line,
        lineText: string,
        context: ProcessingContext
    ): void {
        const isDuplicate = context.duplicateExampleLineNumbers?.has(line.number);
        
        if (isDuplicate && markerInfo.label) {
            // Use duplicate widget for duplicate labels
            const firstLine = context.duplicateExampleLabels?.get(markerInfo.label) || 0;
            const firstContent = context.duplicateExampleContent?.get(markerInfo.label) || '';
            decorations.push({
                from: markerInfo.markerStart,
                to: markerInfo.markerEnd,
                decoration: Decoration.replace({
                    widget: new DuplicateExampleLabelWidget(
                        markerInfo.label, 
                        firstLine, 
                        firstContent, 
                        context.view, 
                        markerInfo.markerStart
                    ),
                    inclusive: false
                })
            });
        } else {
            // Use normal widget for unique labels
            const exampleNumber = context.exampleLineNumbers?.get(line.number) || 
                                 (markerInfo.label ? context.exampleLabels?.get(markerInfo.label) : 0) || 0;
            
            decorations.push({
                from: markerInfo.markerStart,
                to: markerInfo.markerEnd,
                decoration: Decoration.replace({
                    widget: new ExampleListMarkerWidget(
                        exampleNumber, 
                        markerInfo.label, 
                        context.view, 
                        markerInfo.markerStart
                    ),
                    inclusive: false
                })
            });
        }
    }
}