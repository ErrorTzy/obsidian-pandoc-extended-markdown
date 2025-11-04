import { Decoration, WidgetType } from '@codemirror/view';
import { Line } from '@codemirror/state';
import { StructuralProcessor, StructuralResult, ProcessingContext, ContentRegion } from '../types';
import { CSS_CLASSES } from '../../../core/constants';

type ParentStructure = NonNullable<ContentRegion['parentStructure']>;

/**
 * Base class for structural processors, providing common functionality
 * for list processing including cursor detection, decoration creation,
 * and context management.
 */
export abstract class BaseStructuralProcessor implements StructuralProcessor {
    abstract name: string;
    abstract priority: number;

    /**
     * Checks if this processor can handle the given line
     */
    abstract canProcess(line: Line, context: ProcessingContext): boolean;

    /**
     * Process the line and return decorations
     * This is the template method that subclasses override for specific behavior
     */
    abstract process(line: Line, context: ProcessingContext): StructuralResult;

    /**
     * Check if cursor is within a marker range
     */
    protected isCursorInMarker(markerStart: number, markerEnd: number, context: ProcessingContext): boolean {
        const cursorPos = context.view.state.selection?.main?.head;
        return cursorPos !== undefined && cursorPos >= markerStart && cursorPos < markerEnd;
    }

    /**
     * Check if strict mode validation should block processing
     */
    protected isInvalidInStrictMode(line: Line, context: ProcessingContext): boolean {
        return context.settings.strictPandocMode && context.invalidLines.has(line.number);
    }

    /**
     * Create standard line decoration for lists
     */
    protected createLineDecoration(line: Line, additionalClasses?: string): {from: number, to: number, decoration: Decoration} {
        const classes = [
            CSS_CLASSES.LIST_LINE,
            CSS_CLASSES.LIST_LINE_1,
            CSS_CLASSES.PANDOC_LIST_LINE,
            additionalClasses
        ].filter(Boolean).join(' ');

        return {
            from: line.from,
            to: line.from,
            decoration: Decoration.line({ class: classes })
        };
    }

    /**
     * Create content area wrapping decoration
     */
    protected createContentMarkDecoration(contentStart: number, contentEnd: number, listLevel: number = 1): {from: number, to: number, decoration: Decoration} {
        const className = listLevel === 1 ? CSS_CLASSES.CM_LIST_1 :
                         listLevel === 2 ? CSS_CLASSES.CM_LIST_2 :
                         listLevel === 3 ? CSS_CLASSES.CM_LIST_3 :
                         CSS_CLASSES.CM_LIST_1;

        return {
            from: contentStart,
            to: contentEnd,
            decoration: Decoration.mark({ class: className })
        };
    }

    /**
     * Create marker replacement decoration
     */
    protected createMarkerReplacement(markerStart: number, markerEnd: number, widget: WidgetType): {from: number, to: number, decoration: Decoration} {
        return {
            from: markerStart,
            to: markerEnd,
            decoration: Decoration.replace({
                widget: widget,
                inclusive: false
            })
        };
    }

    /**
     * Create content region for inline processing
     */
    protected createContentRegion(
        contentStart: number,
        contentEnd: number,
        parentStructure: ParentStructure,
        metadata?: Record<string, unknown>
    ): ContentRegion {
        return {
            from: contentStart,
            to: contentEnd,
            type: 'list-content',
            parentStructure,
            metadata
        };
    }

    /**
     * Set list context for continuation line detection
     */
    protected setListContext(
        context: ProcessingContext,
        contentStartColumn: number,
        listLevel: number,
        parentStructure: ParentStructure
    ): void {
        context.listContext = {
            isInList: true,
            contentStartColumn,
            listLevel,
            parentStructure
        };
    }

    /**
     * Standard pattern for processing list lines
     * This provides the common structure that most list processors follow
     */
    protected processStandardList(
        line: Line,
        context: ProcessingContext,
        markerStart: number,
        markerEnd: number,
        contentStart: number,
        widget: WidgetType,
        parentStructure: ParentStructure,
        listLevel: number = 1
    ): StructuralResult {
        const decorations: Array<{from: number, to: number, decoration: Decoration}> = [];

        // Add line decoration
        decorations.push(this.createLineDecoration(line));

        // Check cursor position
        const cursorInMarker = this.isCursorInMarker(markerStart, markerEnd, context);

        // Only replace marker if cursor is not within it
        if (!cursorInMarker) {
            decorations.push(this.createMarkerReplacement(markerStart, markerEnd, widget));
        }

        // Wrap content area
        decorations.push(this.createContentMarkDecoration(contentStart, line.to, listLevel));

        // Create content region
        const contentRegion = this.createContentRegion(contentStart, line.to, parentStructure);

        // Set list context
        this.setListContext(context, contentStart - line.from, listLevel, parentStructure);

        return {
            decorations,
            contentRegion,
            skipFurtherProcessing: true
        };
    }
}
