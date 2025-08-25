import { Decoration } from '@codemirror/view';
import { Line } from '@codemirror/state';
import { StructuralProcessor, StructuralResult, ProcessingContext } from '../types';
import { ListPatterns } from '../../../shared/patterns';
import { CSS_CLASSES } from '../../../core/constants';

/**
 * Processes standard unordered lists (*, +, -) to ensure they render correctly
 * when nested within fancy lists or other structures
 * 
 * NOTE: Currently disabled to preserve Obsidian's default rendering behavior.
 * Kept for potential future use if custom handling is needed.
 */
export class StandardListProcessor implements StructuralProcessor {
    name = 'standard-list';
    priority = 25; // Process after fancy lists but before definition lists
    
    canProcess(line: Line, context: ProcessingContext): boolean {
        // Disabled: Always return false to let Obsidian handle standard lists
        // Original code: return ListPatterns.UNORDERED_LIST.test(line.text);
        return false;
    }
    
    process(line: Line, context: ProcessingContext): StructuralResult {
        const lineText = line.text;
        const match = lineText.match(ListPatterns.UNORDERED_LIST);
        
        if (!match) {
            return { decorations: [] };
        }
        
        // Check if this list item is in an invalid block
        if (context.settings.strictPandocMode && context.invalidLines.has(line.number)) {
            return { decorations: [] };
        }
        
        const indent = match[1];
        const markerMatch = lineText.match(/^(\s*)([-*+])(\s+)/);
        if (!markerMatch) {
            return { decorations: [] };
        }
        
        const marker = markerMatch[2];
        const space = markerMatch[3];
        
        const markerStart = line.from + indent.length;
        const markerEnd = line.from + indent.length + marker.length + space.length;
        const contentStart = markerEnd;
        
        const decorations: Array<{from: number, to: number, decoration: Decoration}> = [];
        
        // Calculate indentation level based on spaces (4 spaces = 1 level, tabs = 1 level)
        const indentLevel = Math.floor(indent.replace(/\t/g, '    ').length / 4) + 1;
        const listClass = indentLevel === 1 ? CSS_CLASSES.LIST_LINE_1 : 
                         indentLevel === 2 ? CSS_CLASSES.LIST_LINE_2 :
                         indentLevel === 3 ? CSS_CLASSES.LIST_LINE_3 :
                         CSS_CLASSES.LIST_LINE_4;
        
        // Add line decoration for proper styling and indentation
        decorations.push({
            from: line.from,
            to: line.from,
            decoration: Decoration.line({
                class: `${CSS_CLASSES.LIST_LINE} ${listClass} HyperMD-list-line HyperMD-list-line-${indentLevel}`
            })
        });
        
        // Mark the list marker
        decorations.push({
            from: markerStart,
            to: markerEnd - space.length,
            decoration: Decoration.mark({
                class: 'cm-formatting-list cm-formatting-list-ul'
            })
        });
        
        // Mark the content area
        if (contentStart < line.to) {
            decorations.push({
                from: contentStart,
                to: line.to,
                decoration: Decoration.mark({
                    class: `cm-list-${indentLevel}`
                })
            });
        }
        
        // Mark content region for inline processing
        const contentRegion = {
            from: contentStart,
            to: line.to,
            type: 'list-content' as const,
            parentStructure: 'standard-list' as const
        };
        
        return {
            decorations,
            contentRegion,
            skipFurtherProcessing: true
        };
    }
}