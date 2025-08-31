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
        
        const markerInfo = this.extractMarkerInfo(exampleMatch, line);
        const decorations: Array<{from: number, to: number, decoration: Decoration}> = [];
        
        // Add line decoration
        this.addLineDecoration(decorations, line);
        
        // Add marker widget if cursor is not within it
        const cursorInMarker = this.isCursorInMarker(markerInfo, context);
        if (!cursorInMarker) {
            this.addMarkerWidget(decorations, markerInfo, line, lineText, context);
        }
        
        // Add content decoration
        this.addContentDecoration(decorations, markerInfo.contentStart, line.to);
        
        // Create content region and update context
        const contentRegion = this.createContentRegion(markerInfo, line, context);
        this.updateListContext(markerInfo, context);
        
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
     * Checks if cursor is within the marker area.
     */
    private isCursorInMarker(
        markerInfo: ReturnType<typeof this.extractMarkerInfo>,
        context: ProcessingContext
    ): boolean {
        const cursorPos = context.view.state.selection?.main?.head;
        return cursorPos !== undefined && 
               cursorPos >= markerInfo.markerStart && 
               cursorPos < markerInfo.markerEnd;
    }
    
    /**
     * Adds line decoration for styling.
     */
    private addLineDecoration(
        decorations: Array<{from: number, to: number, decoration: Decoration}>,
        line: Line
    ): void {
        decorations.push({
            from: line.from,
            to: line.from,
            decoration: Decoration.line({
                class: `${CSS_CLASSES.LIST_LINE} ${CSS_CLASSES.LIST_LINE_1} ${CSS_CLASSES.PANDOC_LIST_LINE}`
            })
        });
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
    
    /**
     * Adds content area decoration.
     */
    private addContentDecoration(
        decorations: Array<{from: number, to: number, decoration: Decoration}>,
        contentStart: number,
        contentEnd: number
    ): void {
        decorations.push({
            from: contentStart,
            to: contentEnd,
            decoration: Decoration.mark({
                class: CSS_CLASSES.CM_LIST_1
            })
        });
    }
    
    /**
     * Creates content region for inline processing.
     */
    private createContentRegion(
        markerInfo: ReturnType<typeof this.extractMarkerInfo>,
        line: Line,
        context: ProcessingContext
    ) {
        const isDuplicate = context.duplicateExampleLineNumbers?.has(line.number);
        return {
            from: markerInfo.contentStart,
            to: line.to,
            type: 'list-content' as const,
            parentStructure: 'example-list' as const,
            metadata: { label: markerInfo.label, isDuplicate: isDuplicate || false }
        };
    }
    
    /**
     * Updates list context for continuation line detection.
     */
    private updateListContext(
        markerInfo: ReturnType<typeof this.extractMarkerInfo>,
        context: ProcessingContext
    ): void {
        context.listContext = {
            isInList: true,
            contentStartColumn: markerInfo.indent.length + markerInfo.fullMarker.length + markerInfo.space.length,
            listLevel: 1,
            parentStructure: 'example-list'
        };
    }
}