import { Decoration } from '@codemirror/view';
import { Line } from '@codemirror/state';
import { StructuralProcessor, StructuralResult, ProcessingContext } from '../types';
import { IndentMetrics } from '../../../shared/types/listTypes';
import { CSS_CLASSES, INDENTATION, DECORATION_STYLES } from '../../../core/constants';
import { ListContinuationIndentWidget } from '../../widgets';

/**
 * Processes list continuation lines (lines within a list item that don't have their own marker)
 */
export class ListContinuationProcessor implements StructuralProcessor {
    name = 'list-continuation';
    priority = 100; // Run after all list processors
    
    canProcess(line: Line, context: ProcessingContext): boolean {
        // Only process if we're in a list context
        if (!context.listContext?.isInList) {
            return false;
        }
        
        const lineText = line.text;
        
        // Check if this line is properly indented to be a continuation using visual indentation width
        const indent = this.getIndentMetrics(lineText);
        return indent.visualLength >= INDENTATION.CONTINUATION_MIN_VISUAL;
    }
    
    process(line: Line, context: ProcessingContext): StructuralResult {
        if (!context.listContext) {
            return { decorations: [] };
        }
        
        const lineText = line.text;
        const decorations: Array<{from: number, to: number, decoration: Decoration}> = [];
        const indent = this.getIndentMetrics(lineText);
        const listLevel = this.getListLevel(context);
        const indentWidthPx = this.calculateIndentWidth(
            context.listContext.contentStartColumn,
            indent.visualLength
        );
        
        // Add line decoration
        this.addLineDecoration(decorations, line, indentWidthPx);
        
        // Add indent decorations if present
        if (indent.textLength > 0) {
            this.addIndentDecorations(
                decorations,
                line,
                indent.textLength,
                indentWidthPx,
                listLevel
            );
        }
        
        // Add content decoration
        this.addContentDecoration(decorations, line, indent.textLength, listLevel);
        
        // Mark content region for inline processing
        const contentRegion = {
            from: line.from + indent.textLength,
            to: line.to,
            type: 'list-content' as const,
            parentStructure: context.listContext.parentStructure
        };
        
        // Update list context based on next line
        this.updateListContext(line, context);
        
        return {
            decorations,
            contentRegion,
            skipFurtherProcessing: true
        };
    }
    
    /**
     * Adds line decoration with proper styling for continuation lines.
     */
    private addLineDecoration(
        decorations: Array<{from: number, to: number, decoration: Decoration}>,
        line: Line,
        indentWidthPx: number
    ): void {
        const baseConfig: { class: string; attributes?: Record<string, string> } = {
            class: `${CSS_CLASSES.LIST_LINE} ${CSS_CLASSES.LIST_LINE_1} ${CSS_CLASSES.LIST_LINE_NOBULLET}`
        };

        const textIndent = '0px'; // Override Obsidian's negative indent
        const paddingStart = this.calculatePadding(indentWidthPx);
        baseConfig.attributes = {
            style: `text-indent: ${textIndent} !important; padding-inline-start: ${paddingStart} !important;`
        };

        decorations.push({
            from: line.from,
            to: line.from,
            decoration: Decoration.line(baseConfig)
        });
    }
    
    /**
     * Adds indent decorations for leading whitespace.
     */
    private addIndentDecorations(
        decorations: Array<{from: number, to: number, decoration: Decoration}>,
        line: Line,
        indentCharLength: number,
        indentWidthPx: number,
        listLevel: number
    ): void {
        decorations.push({
            from: line.from,
            to: line.from + indentCharLength,
            decoration: Decoration.replace({
                widget: new ListContinuationIndentWidget(indentWidthPx, listLevel),
                inclusive: false
            })
        });
    }

    /**
     * Adds content area decoration.
     */
    private addContentDecoration(
        decorations: Array<{from: number, to: number, decoration: Decoration}>,
        line: Line,
        indentCharLength: number,
        listLevel: number
    ): void {
        decorations.push({
            from: line.from + indentCharLength,
            to: line.to,
            decoration: Decoration.mark({
                class: this.getContentClass(listLevel)
            })
        });
    }
    
    /**
     * Updates list context based on the next line.
     */
    private updateListContext(line: Line, context: ProcessingContext): void {
        const nextLineNum = line.number + 1;
        if (nextLineNum <= context.document.lines) {
            const nextLine = context.document.line(nextLineNum);
            const nextLineText = nextLine.text.trim();
            const nextIndent = this.getIndentMetrics(nextLine.text);
            
            // Clear list context if next line is blank or below the continuation indent threshold
            if (nextLineText === '' || nextIndent.visualLength < INDENTATION.CONTINUATION_MIN_VISUAL) {
                context.listContext = undefined;
            }
            // Keep the list context active if the next line is also a continuation
        } else {
            // End of document
            context.listContext = undefined;
        }
    }
    
    private getIndentMetrics(text: string): IndentMetrics {
        let visualLength = 0;
        let textLength = 0;

        for (const char of text) {
            if (char === ' ') {
                visualLength += INDENTATION.SINGLE_SPACE;
                textLength += 1;
            } else if (char === INDENTATION.TAB) {
                visualLength += INDENTATION.TAB_SIZE;
                textLength += 1;
            } else {
                break;
            }
        }

        return {
            visualLength,
            textLength
        };
    }

    private calculateIndentWidth(contentStartColumn: number, indentVisualLength: number): number {
        const columnWidth = DECORATION_STYLES.CONTINUATION_INDENT_UNIT_PX;
        const baseColumns = contentStartColumn > 0 ? contentStartColumn : indentVisualLength;
        return Math.max(baseColumns, INDENTATION.CONTINUATION_MIN_VISUAL) * columnWidth;
    }

    private calculatePadding(indentWidthPx: number): string {
        return `${indentWidthPx}px`;
    }

    private getListLevel(context: ProcessingContext): number {
        return context.listContext?.listLevel && context.listContext.listLevel > 0
            ? context.listContext.listLevel
            : 1;
    }

    private getContentClass(listLevel: number): string {
        switch (listLevel) {
            case 2:
                return CSS_CLASSES.CM_LIST_2;
            case 3:
                return CSS_CLASSES.CM_LIST_3;
            default:
                return CSS_CLASSES.CM_LIST_1;
        }
    }
}
