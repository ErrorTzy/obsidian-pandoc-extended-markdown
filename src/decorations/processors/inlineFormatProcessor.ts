import { Decoration } from '@codemirror/view';
import { ListPatterns } from '../../patterns';
import { ExampleReferenceWidget, SuperscriptWidget, SubscriptWidget } from '../widgets';

export interface InlineFormatContext {
    line: any;
    lineText: string;
    cursorPos: number;
    exampleLabels?: Map<string, number>;
    exampleContent?: Map<string, string>;
}

export function processExampleReferences(
    context: InlineFormatContext
): Array<{from: number, to: number, decoration: Decoration}> {
    const { line, lineText, cursorPos, exampleLabels, exampleContent } = context;
    const decorations: Array<{from: number, to: number, decoration: Decoration}> = [];
    
    if (!exampleLabels) return decorations;
    
    const refRegex = /\(@([a-zA-Z0-9_-]+)\)/g;
    let match;
    while ((match = refRegex.exec(lineText)) !== null) {
        const label = match[1];
        if (exampleLabels.has(label)) {
            const refStart = line.from + match.index;
            const refEnd = line.from + match.index + match[0].length;
            
            // Check if cursor is within this reference
            const cursorInRef = cursorPos >= refStart && cursorPos <= refEnd;
            
            // Only replace if cursor is not within the reference
            if (!cursorInRef) {
                const number = exampleLabels.get(label)!;
                const tooltipText = exampleContent?.get(label);
                decorations.push({
                    from: refStart,
                    to: refEnd,
                    decoration: Decoration.replace({
                        widget: new ExampleReferenceWidget(number, tooltipText),
                        inclusive: false
                    })
                });
            }
        }
    }
    
    return decorations;
}

export function processSuperscripts(
    context: InlineFormatContext
): Array<{from: number, to: number, decoration: Decoration}> {
    const { line, lineText, cursorPos } = context;
    const decorations: Array<{from: number, to: number, decoration: Decoration}> = [];
    
    const superscripts = ListPatterns.findSuperscripts(lineText);
    for (const supMatch of superscripts) {
        const supStart = line.from + supMatch.index!;
        const supEnd = line.from + supMatch.index! + supMatch[0].length;
        
        // Check if cursor is within this superscript
        const cursorInSup = cursorPos >= supStart && cursorPos <= supEnd;
        
        // Only replace if cursor is not within the superscript
        if (!cursorInSup) {
            // Extract content and unescape spaces
            const content = supMatch[0].slice(1, -1).replace(/\\[ ]/g, ' ');
            decorations.push({
                from: supStart,
                to: supEnd,
                decoration: Decoration.replace({
                    widget: new SuperscriptWidget(content)
                })
            });
        }
    }
    
    return decorations;
}

export function processSubscripts(
    context: InlineFormatContext
): Array<{from: number, to: number, decoration: Decoration}> {
    const { line, lineText, cursorPos } = context;
    const decorations: Array<{from: number, to: number, decoration: Decoration}> = [];
    
    const subscripts = ListPatterns.findSubscripts(lineText);
    for (const subMatch of subscripts) {
        const subStart = line.from + subMatch.index!;
        const subEnd = line.from + subMatch.index! + subMatch[0].length;
        
        // Check if cursor is within this subscript
        const cursorInSub = cursorPos >= subStart && cursorPos <= subEnd;
        
        // Only replace if cursor is not within the subscript
        if (!cursorInSub) {
            // Extract content and unescape spaces
            const content = subMatch[0].slice(1, -1).replace(/\\[ ]/g, ' ');
            decorations.push({
                from: subStart,
                to: subEnd,
                decoration: Decoration.replace({
                    widget: new SubscriptWidget(content)
                })
            });
        }
    }
    
    return decorations;
}