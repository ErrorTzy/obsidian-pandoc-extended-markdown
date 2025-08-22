import { Decoration } from '@codemirror/view';
import { EditorView } from '@codemirror/view';
import { CSS_CLASSES } from '../../constants';
import { DefinitionBulletWidget } from '../widgets';
import { PandocExtendedMarkdownSettings } from '../../settings';

export interface DefinitionContext {
    line: any;
    lineNum: number;
    lineText: string;
    cursorPos: number;
    view: EditorView;
    invalidListBlocks: Set<number>;
    settings: PandocExtendedMarkdownSettings;
    lines: string[];
}

export function processDefinitionItem(
    context: DefinitionContext
): Array<{from: number, to: number, decoration: Decoration}> | null {
    const { line, lineNum, lineText, cursorPos, view, invalidListBlocks, settings } = context;
    const decorations: Array<{from: number, to: number, decoration: Decoration}> = [];
    
    const defItemMatch = ListPatterns.isDefinitionMarker(lineText);
    if (!defItemMatch) return null;
    
    // Check if this list item is in an invalid block
    if (settings.strictPandocMode && invalidListBlocks.has(lineNum - 1)) {
        return null;
    }
    
    const indent = defItemMatch[1];
    const marker = defItemMatch[2];
    const space = defItemMatch[3];
    
    const markerStart = line.from + indent.length;
    const markerEnd = line.from + indent.length + marker.length + space.length;
    
    // Check if cursor is within the marker area
    const cursorInMarker = cursorPos >= markerStart && cursorPos < markerEnd;
    
    // Only replace the marker if cursor is not within it
    if (!cursorInMarker) {
        decorations.push({
            from: markerStart,
            to: markerEnd,
            decoration: Decoration.replace({
                widget: new DefinitionBulletWidget(view, markerStart)
            })
        });
    }
    
    return decorations;
}

export function processDefinitionTerm(
    context: DefinitionContext
): Array<{from: number, to: number, decoration: Decoration}> | null {
    const { line, lineText, view } = context;
    const decorations: Array<{from: number, to: number, decoration: Decoration}> = [];
    
    // Check if this line is a definition term
    if (!lineText.trim() || ListPatterns.isDefinitionMarker(lineText) || ListPatterns.isIndentedContent(lineText)) {
        return null;
    }
    
    // Check next line(s) for definition marker
    let isDefinitionTerm = false;
    
    // First check immediate next line
    if (line.number < view.state.doc.lines) {
        const nextLine = view.state.doc.line(line.number + 1);
        const nextText = nextLine.text;
        
        // Direct definition (no empty line)
        if (ListPatterns.isDefinitionMarker(nextText)) {
            isDefinitionTerm = true;
        }
        // Empty line followed by definition
        else if (nextText.trim() === '' && line.number + 1 < view.state.doc.lines) {
            const lineAfterEmpty = view.state.doc.line(line.number + 2);
            if (ListPatterns.isDefinitionMarker(lineAfterEmpty.text)) {
                isDefinitionTerm = true;
            }
        }
    }
    
    if (isDefinitionTerm) {
        decorations.push({
            from: line.from,
            to: line.to,
            decoration: Decoration.mark({
                class: 'cm-strong cm-pandoc-definition-term'
            })
        });
        return decorations;
    }
    
    return null;
}

export function processDefinitionParagraph(
    context: DefinitionContext
): Array<{from: number, to: number, decoration: Decoration}> | null {
    const { line, lineNum, lineText, view } = context;
    const decorations: Array<{from: number, to: number, decoration: Decoration}> = [];
    
    const indentMatch = ListPatterns.isIndentedContent(lineText) ? lineText.match(/^(    |\t)(.*)$/) : null;
    if (!indentMatch) return null;
    
    // Check if we're after a definition marker
    let inDefinitionContext = false;
    for (let checkLine = lineNum - 1; checkLine >= 1; checkLine--) {
        const prevLine = view.state.doc.line(checkLine);
        const prevText = prevLine.text;
        
        // If we find a definition marker, we're in definition context
        if (ListPatterns.isDefinitionMarker(prevText)) {
            inDefinitionContext = true;
            break;
        }
        // If we find a non-empty, non-indented line that's not a definition
        if (prevText.trim() && !ListPatterns.isIndentedContent(prevText) && !ListPatterns.isDefinitionMarker(prevText)) {
            // Could still be in context if this is a term followed by definition
            break;
        }
    }
    
    if (!inDefinitionContext) return null;
    
    const content = indentMatch[2];
    
    // Only apply decorations if there's actual content after the indent
    // This prevents cursor issues on empty indented lines
    if (content && content.trim()) {
        // Apply line decoration to override code block styling
        decorations.push({
            from: line.from,
            to: line.from,
            decoration: Decoration.line({
                class: 'cm-pandoc-definition-paragraph',
                attributes: {
                    'data-definition-content': 'true'
                }
            })
        });
        
        // Mark the entire line content to prevent code styling
        decorations.push({
            from: line.from,
            to: line.to,
            decoration: Decoration.mark({
                class: CSS_CLASSES.DEFINITION_CONTENT_TEXT
            })
        });
    }
    
    return decorations;
}