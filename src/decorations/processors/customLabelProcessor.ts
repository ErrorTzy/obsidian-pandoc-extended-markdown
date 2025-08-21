// External libraries
import { Decoration, EditorView } from '@codemirror/view';

// Types
import { PandocExtendedMarkdownSettings } from '../../settings';

// Constants
import { CSS_CLASSES } from '../../constants';

// Patterns
import { ListPatterns } from '../../patterns';

// Internal modules
import { CustomLabelMarkerWidget, CustomLabelReferenceWidget } from '../widgets/customLabelWidget';

export interface CustomLabelProcessorContext {
    line: any;
    lineNum: number;
    lineText: string;
    cursorPos: number;
    view: EditorView;
    invalidListBlocks: Set<number>;
    settings: PandocExtendedMarkdownSettings;
    customLabels?: Map<string, string>; // label -> content
}

/**
 * Process custom label list markers in the editor.
 * Converts {::LABEL} syntax at the start of lines into decorated list markers.
 * 
 * @param line - The line to process
 * @param lineText - The text content of the line
 * @param lineNo - The line number (1-indexed)
 * @param view - The CodeMirror editor view
 * @param settings - Plugin settings
 * @param context - Context for processing custom labels
 * @param decorations - Array to add decorations to
 */
export function processCustomLabelList(
    context: CustomLabelProcessorContext
): Array<{from: number, to: number, decoration: Decoration}> | null {
    const { 
        line, lineNum, lineText, cursorPos, view, invalidListBlocks, settings,
        customLabels
    } = context;
    
    // Only process if More Extended Syntax is enabled
    if (!settings.moreExtendedSyntax) {
        return null;
    }
    
    const decorations: Array<{from: number, to: number, decoration: Decoration}> = [];
    const customLabelMatch = ListPatterns.isCustomLabelList(lineText);
    
    if (!customLabelMatch) return null;
    
    // Check strict mode requirements
    if (settings.strictPandocMode && invalidListBlocks.has(lineNum - 1)) {
        return null;
    }
    
    const indent = customLabelMatch[1];
    const fullMarker = customLabelMatch[2];
    const label = customLabelMatch[3];
    const space = customLabelMatch[4];
    
    const markerStart = line.from + indent.length;
    const markerEnd = line.from + indent.length + fullMarker.length + space.length;
    
    // Check if cursor is within the marker area
    const cursorInMarker = cursorPos >= markerStart && cursorPos < markerEnd;
    
    // Add line decoration for proper styling
    decorations.push({
        from: line.from,
        to: line.from,
        decoration: Decoration.line({
            class: 'HyperMD-list-line HyperMD-list-line-1 pandoc-list-line-indent'
        })
    });
    
    // Only replace the marker if cursor is not within it
    if (!cursorInMarker) {
        decorations.push({
            from: markerStart,
            to: markerEnd,
            decoration: Decoration.replace({
                widget: new CustomLabelMarkerWidget(label, view, markerStart)
            })
        });
    }
    
    // Wrap the rest of the line
    decorations.push({
        from: line.from + indent.length + fullMarker.length + space.length,
        to: line.to,
        decoration: Decoration.mark({
            class: 'cm-list-1 pandoc-custom-label-item'
        })
    });
    
    // Store the label content for references
    if (customLabels) {
        const contentStart = indent.length + fullMarker.length + space.length;
        const content = lineText.substring(contentStart).trim();
        if (content) {
            customLabels.set(label, content);
        }
    }
    
    return decorations;
}

/**
 * Process custom label references in the editor.
 * Converts {::LABEL} references within text to decorated references.
 * 
 * @param line - The line to process
 * @param lineText - The text content of the line
 * @param view - The CodeMirror editor view
 * @param context - Context containing custom label definitions
 * @param decorations - Array to add decorations to
 */
export function processCustomLabelReferences(
    text: string,
    from: number,
    customLabels: Map<string, string>,
    view: EditorView,
    cursorPos: number,
    settings: PandocExtendedMarkdownSettings,
    isValidLine: boolean = true
): Array<{from: number, to: number, decoration: Decoration}> {
    const decorations: Array<{from: number, to: number, decoration: Decoration}> = [];
    
    // Only process if More Extended Syntax is enabled
    if (!settings.moreExtendedSyntax) {
        return decorations;
    }
    
    // Don't process references on lines that are invalid custom label list attempts
    if (!isValidLine && ListPatterns.isCustomLabelList(text)) {
        return decorations;
    }
    
    const matches = ListPatterns.findCustomLabelReferences(text);
    
    matches.forEach(match => {
        const label = match[1];
        const content = customLabels.get(label);
        const matchStart = from + (match.index || 0);
        const matchEnd = matchStart + match[0].length;
        
        // Check if cursor is within the reference
        const cursorInReference = cursorPos >= matchStart && cursorPos < matchEnd;
        
        if (!cursorInReference && customLabels.has(label)) {
            decorations.push({
                from: matchStart,
                to: matchEnd,
                decoration: Decoration.replace({
                    widget: new CustomLabelReferenceWidget(label, content, view, matchStart)
                })
            });
        }
    });
    
    return decorations;
}