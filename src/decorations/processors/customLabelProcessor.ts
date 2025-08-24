// External libraries
import { Decoration, EditorView } from '@codemirror/view';

// Types
import { PandocExtendedMarkdownSettings } from '../../settings';

// Constants
import { CSS_CLASSES, DECORATION_STYLES } from '../../constants';

// Patterns
import { ListPatterns } from '../../patterns';

// Utils
import { PlaceholderContext } from '../../utils/placeholderProcessor';

// Import inline processors for example references
import { processExampleReferences, processSuperscripts, processSubscripts, InlineFormatContext } from './inlineFormatProcessor';

// Internal modules
import { 
    CustomLabelMarkerWidget, 
    CustomLabelReferenceWidget,
    CustomLabelPartialWidget,
    CustomLabelPlaceholderWidget,
    CustomLabelProcessedWidget,
    CustomLabelInlineNumberWidget,
    DuplicateCustomLabelWidget
} from '../widgets/customLabelWidget';

export interface CustomLabelProcessorContext {
    line: any;
    lineNum: number;
    lineText: string;
    cursorPos: number;
    view: EditorView;
    invalidListBlocks: Set<number>;
    settings: PandocExtendedMarkdownSettings;
    customLabels?: Map<string, string>; // processed label -> content
    rawToProcessed?: Map<string, string>; // raw label -> processed label
    duplicateLabels?: Set<string>; // labels that appear more than once
    duplicateLineInfo?: Map<string, { firstLine: number; firstContent: string }>; // duplicate label -> first occurrence info
    placeholderContext?: PlaceholderContext; // context for processing placeholders
    exampleLabels?: Map<string, number>; // for example references
    exampleContent?: Map<string, string>; // for example reference tooltips
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
        customLabels, rawToProcessed, duplicateLabels, duplicateLineInfo, placeholderContext
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
    const rawLabel = customLabelMatch[3];
    const space = customLabelMatch[4];
    
    // Get processed label (with placeholders replaced)
    const processedLabel = rawToProcessed?.get(rawLabel) || rawLabel;
    
    const markerStart = line.from + indent.length;
    const markerEnd = line.from + indent.length + fullMarker.length + space.length;
    
    // Parse the marker to find placeholder positions
    const placeholderMatches = [...rawLabel.matchAll(/\(#([^)]+)\)/g)];
    const placeholderRanges: Array<{start: number, end: number, name: string}> = [];
    
    for (const match of placeholderMatches) {
        if (match.index !== undefined) {
            const placeholderStart = markerStart + DECORATION_STYLES.CUSTOM_LABEL_PREFIX_LENGTH + match.index; // Length of "{"
            const placeholderEnd = placeholderStart + match[0].length;
            placeholderRanges.push({
                start: placeholderStart,
                end: placeholderEnd,
                name: match[1]
            });
        }
    }
    
    // Check cursor position relative to marker and placeholders
    const cursorInMarker = cursorPos >= markerStart && cursorPos < markerEnd;
    let cursorPlaceholderIndex = -1;
    for (let i = 0; i < placeholderRanges.length; i++) {
        if (cursorPos >= placeholderRanges[i].start && cursorPos < placeholderRanges[i].end) {
            cursorPlaceholderIndex = i;
            break;
        }
    }
    const cursorInPlaceholder = cursorPlaceholderIndex !== -1;
    
    // Add line decoration for proper styling
    decorations.push({
        from: line.from,
        to: line.from,
        decoration: Decoration.line({
            class: `${CSS_CLASSES.LIST_LINE} ${CSS_CLASSES.LIST_LINE_1} ${CSS_CLASSES.PANDOC_LIST_LINE_INDENT}`
        })
    });
    
    // Check if this is a duplicate label
    const isDuplicate = duplicateLabels?.has(processedLabel);
    const duplicateInfo = duplicateLineInfo?.get(processedLabel);
    const isFirstOccurrence = duplicateInfo && duplicateInfo.firstLine === lineNum;
    
    
    // Apply decorations based on cursor position
    if (!cursorInMarker) {
        // Cursor is completely outside
        if (isDuplicate && !isFirstOccurrence && duplicateInfo) {
            // This is a duplicate (not the first occurrence) - show duplicate widget
            decorations.push({
                from: markerStart,
                to: markerEnd,
                decoration: Decoration.replace({
                    widget: new DuplicateCustomLabelWidget(
                        rawLabel,
                        duplicateInfo.firstLine,
                        duplicateInfo.firstContent,
                        view,
                        markerStart
                    ),
                    inclusive: false
                })
            });
        } else {
            // Normal label or first occurrence of duplicate - show normal widget
            decorations.push({
                from: markerStart,
                to: markerEnd,
                decoration: Decoration.replace({
                    widget: new CustomLabelMarkerWidget(processedLabel, view, markerStart),
                    inclusive: false
                })
            });
        }
    } else if (cursorInMarker && placeholderRanges.length > 0) {
        // Cursor is in marker - selectively process placeholders
        
        // Replace placeholders with numbers, except the one under cursor
        for (let i = 0; i < placeholderRanges.length; i++) {
            if (i !== cursorPlaceholderIndex) {
                // This placeholder is not under cursor - replace with number
                const range = placeholderRanges[i];
                const placeholderNumber = placeholderContext?.getPlaceholderNumber(range.name);
                if (placeholderNumber !== null && placeholderNumber !== undefined) {
                    decorations.push({
                        from: range.start,
                        to: range.end,
                        decoration: Decoration.replace({
                            widget: new CustomLabelInlineNumberWidget(placeholderNumber.toString(), view),
                            inclusive: false,
                            block: false
                        })
                    });
                }
            }
            // If cursor is on this placeholder, don't decorate it (show raw text)
        }
        
        // Mark the whole marker area for styling
        decorations.push({
            from: markerStart,
            to: markerEnd,
            decoration: Decoration.mark({
                class: `${CSS_CLASSES.CM_FORMATTING} ${CSS_CLASSES.CM_FORMATTING_LIST} ${CSS_CLASSES.CUSTOM_LABEL_PROCESSED}`
            })
        });
    }
    // If no placeholders exist, show raw text (no decorations)
    
    // Wrap the rest of the line
    const contentStart = line.from + indent.length + fullMarker.length + space.length;
    decorations.push({
        from: contentStart,
        to: line.to,
        decoration: Decoration.mark({
            class: `${CSS_CLASSES.CM_LIST_1} ${CSS_CLASSES.CUSTOM_LABEL_ITEM}`
        })
    });
    
    // Process references in the content part of the custom label list
    const contentText = lineText.substring(indent.length + fullMarker.length + space.length);
    if (contentText) {
        // Process custom label references
        const contentRefs = processCustomLabelReferences(
            contentText,
            contentStart,
            customLabels || new Map(),
            view,
            cursorPos,
            settings,
            true,
            rawToProcessed,
            placeholderContext
        );
        decorations.push(...contentRefs);
        
        // Process example references
        if (context.exampleLabels) {
            const inlineContext: InlineFormatContext = {
                line: { from: contentStart, to: line.to },
                lineText: contentText,
                cursorPos: cursorPos > contentStart ? cursorPos - contentStart : -1,
                exampleLabels: context.exampleLabels,
                exampleContent: context.exampleContent
            };
            
            const exampleRefs = processExampleReferences(inlineContext);
            decorations.push(...exampleRefs);
            
            const superscripts = processSuperscripts(inlineContext);
            decorations.push(...superscripts);
            
            const subscripts = processSubscripts(inlineContext);
            decorations.push(...subscripts);
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
    isValidLine: boolean = true,
    rawToProcessed?: Map<string, string>,
    placeholderContext?: PlaceholderContext
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
        const fullMatch = match[0];
        const rawLabel = match[1];
        let processedLabel = rawToProcessed?.get(rawLabel);
        
        // If not in rawToProcessed but contains placeholders, try to process it
        if (!processedLabel && rawLabel.includes('(#') && placeholderContext) {
            // This is a reference with placeholders that needs processing
            const result = placeholderContext.getProcessedLabel(rawLabel);
            if (result !== null) {
                processedLabel = result;
            }
        }
        
        // If still no processed label, use raw label
        if (!processedLabel) {
            processedLabel = rawLabel;
        }
        
        const matchStart = from + (match.index || 0);
        const matchEnd = matchStart + match[0].length;
        
        // Parse placeholder positions within the reference
        const placeholderMatches = [...rawLabel.matchAll(/\(#([^)]+)\)/g)];
        const placeholderRanges: Array<{start: number, end: number, name: string}> = [];
        
        for (const phMatch of placeholderMatches) {
            if (phMatch.index !== undefined) {
                const placeholderStart = matchStart + DECORATION_STYLES.CUSTOM_LABEL_PREFIX_LENGTH + phMatch.index; // Length of "{"
                const placeholderEnd = placeholderStart + phMatch[0].length;
                placeholderRanges.push({
                    start: placeholderStart,
                    end: placeholderEnd,
                    name: phMatch[1]
                });
            }
        }
        
        // Check cursor position
        const cursorInReference = cursorPos >= matchStart && cursorPos < matchEnd;
        let cursorPlaceholderIndex = -1;
        for (let i = 0; i < placeholderRanges.length; i++) {
            if (cursorPos >= placeholderRanges[i].start && cursorPos < placeholderRanges[i].end) {
                cursorPlaceholderIndex = i;
                break;
            }
        }
        const cursorInPlaceholder = cursorPlaceholderIndex !== -1;
        
        // Check if this is a valid reference
        let isValid = false;
        let content: string | undefined;
        
        if (customLabels.has(processedLabel)) {
            // Exact match found
            isValid = true;
            content = customLabels.get(processedLabel);
        } else if (placeholderContext) {
            // Check if it's a valid reference through placeholder context
            const validatedLabel = placeholderContext.getProcessedLabel(rawLabel);
            if (validatedLabel !== null) {
                isValid = true;
                processedLabel = validatedLabel;
                // Try to find content for partial matches
                const baseLabel = processedLabel.replace(/'+$/, '');
                for (const [label, labelContent] of customLabels) {
                    if (label.startsWith(baseLabel)) {
                        content = labelContent;
                        break;
                    }
                }
            }
        }
        
        // Only process if the reference is valid
        if (isValid) {
            if (!cursorInReference) {
                // Cursor is outside - show processed reference widget
                decorations.push({
                    from: matchStart,
                    to: matchEnd,
                    decoration: Decoration.replace({
                        widget: new CustomLabelReferenceWidget(processedLabel, content, view, matchStart),
                        inclusive: false
                    })
                });
            } else if (cursorInReference && placeholderRanges.length > 0) {
                // Cursor is in reference - selectively process placeholders
                
                // Replace placeholders with numbers, except the one under cursor
                for (let i = 0; i < placeholderRanges.length; i++) {
                    if (i !== cursorPlaceholderIndex) {
                        // This placeholder is not under cursor - replace with number
                        const range = placeholderRanges[i];
                        const placeholderNumber = placeholderContext?.getPlaceholderNumber(range.name);
                        if (placeholderNumber !== null && placeholderNumber !== undefined) {
                            decorations.push({
                                from: range.start,
                                to: range.end,
                                decoration: Decoration.replace({
                                    widget: new CustomLabelInlineNumberWidget(placeholderNumber.toString(), view),
                                    inclusive: false,
                                    block: false
                                })
                            });
                        }
                    }
                    // If cursor is on this placeholder, don't decorate it (show raw text)
                }
                
                // Mark the reference for styling
                decorations.push({
                    from: matchStart,
                    to: matchEnd,
                    decoration: Decoration.mark({
                        class: CSS_CLASSES.CUSTOM_LABEL_REFERENCE_PROCESSED
                    })
                });
            }
            // If no placeholders or cursor outside reference, apply appropriate decorations above
        }
        // If label is invalid, just leave it as plain text
    });
    
    return decorations;
}