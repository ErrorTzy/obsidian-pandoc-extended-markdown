import { Decoration } from '@codemirror/view';
import { Line } from '@codemirror/state';
import { StructuralProcessor, StructuralResult, ProcessingContext } from '../types';
import { CSS_CLASSES, INDENTATION } from '../../../core/constants';

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
        
        // Check if this line is properly indented to be a continuation
        // It should have at least 3 spaces (or 4 spaces which Obsidian treats as a tab)
        const indentLength = this.getIndentLength(lineText);
        return indentLength >= 3; // Accept 3 or more spaces as continuation
    }
    
    process(line: Line, context: ProcessingContext): StructuralResult {
        if (!context.listContext) {
            return { decorations: [] };
        }
        
        const lineText = line.text;
        const decorations: Array<{from: number, to: number, decoration: Decoration}> = [];
        const indentLength = this.getIndentLength(lineText);
        
        // Add line decoration
        this.addLineDecoration(decorations, line, context.listContext.contentStartColumn);
        
        // Add indent decorations if present
        if (indentLength > 0) {
            this.addIndentDecorations(decorations, line, indentLength);
        }
        
        // Add content decoration
        this.addContentDecoration(decorations, line, indentLength);
        
        // Mark content region for inline processing
        const contentRegion = {
            from: line.from + indentLength,
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
        contentStartColumn: number
    ): void {
        const textIndent = '0px'; // Override Obsidian's negative indent
        const paddingStart = (contentStartColumn * 6) + 'px';
        
        decorations.push({
            from: line.from,
            to: line.from,
            decoration: Decoration.line({
                class: `${CSS_CLASSES.LIST_LINE} ${CSS_CLASSES.LIST_LINE_1} ${CSS_CLASSES.LIST_LINE_NOBULLET}`,
                attributes: {
                    style: `text-indent: ${textIndent} !important; padding-inline-start: ${paddingStart};`
                }
            })
        });
    }
    
    /**
     * Adds indent decorations for leading whitespace.
     */
    private addIndentDecorations(
        decorations: Array<{from: number, to: number, decoration: Decoration}>,
        line: Line,
        indentLength: number
    ): void {
        decorations.push({
            from: line.from,
            to: line.from + indentLength,
            decoration: Decoration.mark({
                class: 'cm-hmd-list-indent cm-hmd-list-indent-1',
                tagName: 'span'
            })
        });
        
        // Add the indent spacing span
        decorations.push({
            from: line.from,
            to: line.from + indentLength,
            decoration: Decoration.mark({
                class: 'cm-indent-spacing',
                tagName: 'span',
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
        indentLength: number
    ): void {
        decorations.push({
            from: line.from + indentLength,
            to: line.to,
            decoration: Decoration.mark({
                class: CSS_CLASSES.CM_LIST_1
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
            const nextIndentLength = this.getIndentLength(nextLine.text);
            
            // Clear list context if next line is blank or has less than 3 spaces
            if (nextLineText === '' || nextIndentLength < 3) {
                context.listContext = undefined;
            }
            // Keep the list context active if the next line is also a continuation
        } else {
            // End of document
            context.listContext = undefined;
        }
    }
    
    private getIndentLength(text: string): number {
        let length = 0;
        for (const char of text) {
            if (char === ' ') {
                length++;
            } else if (char === '\t') {
                length += INDENTATION.TAB_SIZE;
            } else {
                break;
            }
        }
        return length;
    }
}