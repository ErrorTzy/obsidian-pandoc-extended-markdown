import { Decoration } from '@codemirror/view';
import { Line } from '@codemirror/state';
import { StructuralProcessor, StructuralResult, ProcessingContext } from '../types';
import { IndentMetrics } from '../../../shared/types/listTypes';
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
        
        // Add line decoration
        this.addLineDecoration(decorations, line, context.listContext.contentStartColumn);
        
        // Add indent decorations if present
        if (indent.textLength > 0) {
            this.addIndentDecorations(decorations, line, indent.textLength);
        }
        
        // Add content decoration
        this.addContentDecoration(decorations, line, indent.textLength);
        
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
        indentCharLength: number
    ): void {
        decorations.push({
            from: line.from,
            to: line.from + indentCharLength,
            decoration: Decoration.mark({
                class: 'cm-hmd-list-indent cm-hmd-list-indent-1',
                tagName: 'span'
            })
        });
        
        // Add the indent spacing span
        decorations.push({
            from: line.from,
            to: line.from + indentCharLength,
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
        indentCharLength: number
    ): void {
        decorations.push({
            from: line.from + indentCharLength,
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
}
