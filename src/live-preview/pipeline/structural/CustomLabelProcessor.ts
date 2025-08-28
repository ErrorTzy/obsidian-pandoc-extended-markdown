import { Line } from '@codemirror/state';
import { Decoration } from '@codemirror/view';

import { StructuralProcessor, StructuralResult, ProcessingContext, ContentRegion } from '../types';
import { DecorationInfo } from '../../../shared/types/decorationTypes';

import { CSS_CLASSES, DECORATION_STYLES } from '../../../core/constants';

import { ListPatterns } from '../../../shared/patterns';

import {
    CustomLabelMarkerWidget,
    CustomLabelPartialWidget,
    CustomLabelPlaceholderWidget,
    CustomLabelProcessedWidget,
    CustomLabelInlineNumberWidget,
    DuplicateCustomLabelWidget
} from '../../widgets/customLabelWidget';

/**
 * Represents parsed custom label components
 */
interface ParsedCustomLabel {
    indent: string;
    fullMarker: string;
    rawLabel: string;
    space: string;
    processedLabel: string;
    markerStart: number;
    markerEnd: number;
    isDuplicate: boolean;
}

/**
 * Represents placeholder information within a custom label
 */
interface PlaceholderRange {
    start: number;
    end: number;
    name: string;
}

/**
 * Cursor position information relative to the custom label
 */
interface CursorPosition {
    pos: number;
    isInMarker: boolean;
    isAtListMarker: boolean;
    cursorPlaceholder: PlaceholderRange | null;
}

/**
 * Display level for custom label rendering
 */
type DisplayLevel = 'full' | 'semi-expanded' | 'collapsed';

/**
 * Processor for custom label list markers {::LABEL}
 * Handles the structural part of custom label lists, leaving inline content for phase 2
 * 
 * REFACTORED: This processor was refactored from a single 246-line process() method into
 * multiple focused functions following the Extract Method pattern:
 * - parseCustomLabel(): Parse syntax from line (32 lines)
 * - parsePlaceholders(): Extract placeholder positions (17 lines) 
 * - handleCursorPosition(): Analyze cursor position (36 lines)
 * - determineDisplayLevel(): Determine display mode (18 lines)
 * - createCollapsedDecorations(): Handle collapsed display (17 lines)
 * - createSemiExpandedDecorations(): Handle semi-expanded display (47 lines)
 * - createFullDisplayDecorations(): Handle full display with placeholders (77 lines)
 * - processPlaceholders(): Process individual placeholders (53 lines)
 * - buildStructuralResult(): Build final result object (15 lines)
 * - process(): Main orchestrator method (28 lines)
 * 
 * The complex three-level display logic (collapsed/semi-expanded/full) is preserved
 * while being much more maintainable and testable.
 */
export class CustomLabelProcessor implements StructuralProcessor {
    name = 'custom-label-list';
    priority = 15; // Process after basic lists
    
    canProcess(line: Line, context: ProcessingContext): boolean {
        // Only process if More Extended Syntax is enabled
        if (!context.settings.moreExtendedSyntax) {
            return false;
        }
        
        const lineText = context.document.sliceString(line.from, line.to);
        return ListPatterns.isCustomLabelList(lineText) !== null;
    }
    
    /**
     * Parse the custom label syntax from a line of text
     */
    private parseCustomLabel(line: Line, context: ProcessingContext): ParsedCustomLabel | null {
        const lineText = context.document.sliceString(line.from, line.to);
        const lineNum = context.document.lineAt(line.from).number;
        
        const customLabelMatch = ListPatterns.isCustomLabelList(lineText);
        if (!customLabelMatch) {
            return null;
        }
        
        // Check strict mode requirements
        if (context.settings.strictPandocMode && context.invalidLines.has(lineNum - 1)) {
            return null;
        }
        
        const indent = customLabelMatch[1];
        const fullMarker = customLabelMatch[2];
        const rawLabel = customLabelMatch[3];
        const space = customLabelMatch[4];
        
        // Get processed label (with placeholders replaced)
        const processedLabel = context.rawToProcessed?.get(rawLabel) || rawLabel;
        
        const markerStart = line.from + indent.length;
        const markerEnd = line.from + indent.length + fullMarker.length + space.length;
        
        // Check if this is a duplicate label
        const isDuplicate = context.duplicateCustomLabels?.has(processedLabel) || false;
        
        return {
            indent,
            fullMarker,
            rawLabel,
            space,
            processedLabel,
            markerStart,
            markerEnd,
            isDuplicate
        };
    }
    
    /**
     * Parse placeholder ranges within the custom label
     */
    private parsePlaceholders(parsedLabel: ParsedCustomLabel): PlaceholderRange[] {
        const placeholderMatches = Array.from(parsedLabel.rawLabel.matchAll(ListPatterns.PLACEHOLDER_PATTERN));
        const placeholderRanges: PlaceholderRange[] = [];
        
        for (const match of placeholderMatches) {
            if (match.index !== undefined) {
                const placeholderStart = parsedLabel.markerStart + DECORATION_STYLES.CUSTOM_LABEL_PREFIX_LENGTH + match.index;
                const placeholderEnd = placeholderStart + match[0].length;
                placeholderRanges.push({
                    start: placeholderStart,
                    end: placeholderEnd,
                    name: match[1]
                });
            }
        }
        
        return placeholderRanges;
    }
    
    /**
     * Analyze cursor position relative to the custom label
     */
    private handleCursorPosition(
        parsedLabel: ParsedCustomLabel,
        placeholderRanges: PlaceholderRange[],
        context: ProcessingContext
    ): CursorPosition {
        const selection = context.view.state.selection;
        const cursorPos = selection?.main?.from;
        
        if (cursorPos === undefined) {
            return {
                pos: -1,
                isInMarker: false,
                isAtListMarker: false,
                cursorPlaceholder: null
            };
        }
        
        const isInMarker = cursorPos >= parsedLabel.markerStart && cursorPos <= parsedLabel.markerEnd;
        const isAtListMarker = cursorPos >= parsedLabel.markerStart && cursorPos < parsedLabel.markerEnd;
        
        // Find which placeholder the cursor is in (if any)
        let cursorPlaceholder: PlaceholderRange | null = null;
        if (isInMarker) {
            for (const range of placeholderRanges) {
                if (cursorPos >= range.start && cursorPos <= range.end) {
                    cursorPlaceholder = range;
                    break;
                }
            }
        }
        
        return {
            pos: cursorPos,
            isInMarker,
            isAtListMarker,
            cursorPlaceholder
        };
    }
    
    /**
     * Determine the display level based on cursor position and placeholder presence
     */
    private determineDisplayLevel(
        line: Line,
        parsedLabel: ParsedCustomLabel,
        placeholderRanges: PlaceholderRange[],
        cursorInfo: CursorPosition
    ): DisplayLevel {
        if (cursorInfo.isAtListMarker) {
            return 'full';
        }
        
        if (placeholderRanges.length > 0 && !cursorInfo.isInMarker) {
            // Check if cursor is anywhere in the line
            const isCursorInLine = cursorInfo.pos !== -1 && 
                                 cursorInfo.pos >= line.from && 
                                 cursorInfo.pos <= line.to;
            return isCursorInLine ? 'semi-expanded' : 'collapsed';
        }
        
        return 'collapsed';
    }
    
    /**
     * Create decorations for collapsed display mode (fully processed marker widget)
     */
    private createCollapsedDecorations(
        parsedLabel: ParsedCustomLabel,
        context: ProcessingContext
    ): DecorationInfo[] {
        const decorations: DecorationInfo[] = [];
        
        decorations.push({
            from: parsedLabel.markerStart,
            to: parsedLabel.markerEnd,
            decoration: Decoration.replace({
                widget: new CustomLabelMarkerWidget(
                    parsedLabel.processedLabel,
                    context.view,
                    parsedLabel.markerStart
                ),
                inclusive: false
            })
        });
        
        return decorations;
    }
    
    /**
     * Create decorations for semi-expanded display mode (brackets and processed label)
     */
    private createSemiExpandedDecorations(
        parsedLabel: ParsedCustomLabel,
        context: ProcessingContext
    ): DecorationInfo[] {
        const decorations: DecorationInfo[] = [];
        
        // Opening bracket {::
        decorations.push({
            from: parsedLabel.markerStart,
            to: parsedLabel.markerStart + DECORATION_STYLES.CUSTOM_LABEL_PREFIX_LENGTH,
            decoration: Decoration.replace({
                widget: new CustomLabelPartialWidget('{::', context.view, parsedLabel.markerStart),
                inclusive: false
            })
        });
        
        // Processed label
        const labelStart = parsedLabel.markerStart + DECORATION_STYLES.CUSTOM_LABEL_PREFIX_LENGTH;
        const labelEnd = parsedLabel.markerEnd - parsedLabel.space.length - 1; // Exclude closing bracket and space
        
        decorations.push({
            from: labelStart,
            to: labelEnd,
            decoration: Decoration.replace({
                widget: new CustomLabelProcessedWidget(
                    parsedLabel.processedLabel,
                    context.view,
                    labelStart
                ),
                inclusive: false
            })
        });
        
        // Closing bracket
        decorations.push({
            from: labelEnd,
            to: labelEnd + 1,
            decoration: Decoration.replace({
                widget: new CustomLabelPartialWidget('}', context.view, labelEnd),
                inclusive: false
            })
        });
        
        return decorations;
    }
    
    /**
     * Process placeholders within full display mode
     */
    private processPlaceholders(
        line: Line,
        parsedLabel: ParsedCustomLabel,
        placeholderRanges: PlaceholderRange[],
        cursorInfo: CursorPosition,
        context: ProcessingContext
    ): DecorationInfo[] {
        const decorations: DecorationInfo[] = [];
        const lineText = context.document.sliceString(line.from, line.to);
        
        const labelStart = parsedLabel.markerStart + DECORATION_STYLES.CUSTOM_LABEL_PREFIX_LENGTH;
        const labelEnd = parsedLabel.markerEnd - parsedLabel.space.length - 1;
        
        let lastEnd = labelStart;
        
        for (const range of placeholderRanges) {
            // Add text before placeholder (if any)
            if (range.start > lastEnd) {
                decorations.push({
                    from: lastEnd,
                    to: range.start,
                    decoration: Decoration.mark({ class: CSS_CLASSES.CUSTOM_LABEL_TEXT })
                });
            }
            
            // Add placeholder widget or mark
            if (cursorInfo.cursorPlaceholder && cursorInfo.cursorPlaceholder === range) {
                // Cursor is in this placeholder - don't replace it
                decorations.push({
                    from: range.start,
                    to: range.end,
                    decoration: Decoration.mark({ class: CSS_CLASSES.CUSTOM_LABEL_PLACEHOLDER })
                });
            } else {
                // Replace placeholder with number widget
                const placeholderKey = `${parsedLabel.rawLabel.substring(
                    0,
                    parsedLabel.rawLabel.indexOf('(')
                )}(#${range.name})`;
                const processedKey = context.rawToProcessed?.get(placeholderKey);
                const number = processedKey
                    ? parseInt(processedKey.match(ListPatterns.TRAILING_DIGITS)?.[0] || '0')
                    : context.placeholderContext?.getPlaceholderNumber(range.name) || 0;
                
                decorations.push({
                    from: range.start,
                    to: range.end,
                    decoration: Decoration.replace({
                        widget: new CustomLabelInlineNumberWidget(String(number), context.view),
                        inclusive: false
                    })
                });
            }
            
            lastEnd = range.end;
        }
        
        // Add text after last placeholder (if any)
        if (lastEnd < labelEnd) {
            decorations.push({
                from: lastEnd,
                to: labelEnd,
                decoration: Decoration.mark({ class: CSS_CLASSES.CUSTOM_LABEL_TEXT })
            });
        }
        
        return decorations;
    }
    
    /**
     * Create decorations for full display mode (complete syntax with selective placeholder expansion)
     */
    private createFullDisplayDecorations(
        line: Line,
        parsedLabel: ParsedCustomLabel,
        placeholderRanges: PlaceholderRange[],
        cursorInfo: CursorPosition,
        context: ProcessingContext
    ): DecorationInfo[] {
        const decorations: DecorationInfo[] = [];
        const labelStart = parsedLabel.markerStart + DECORATION_STYLES.CUSTOM_LABEL_PREFIX_LENGTH;
        const labelEnd = parsedLabel.markerEnd - parsedLabel.space.length - 1;
        
        // Opening bracket {::
        decorations.push({
            from: parsedLabel.markerStart,
            to: parsedLabel.markerStart + DECORATION_STYLES.CUSTOM_LABEL_PREFIX_LENGTH,
            decoration: Decoration.replace({
                widget: new CustomLabelPartialWidget('{::', context.view, parsedLabel.markerStart),
                inclusive: false
            })
        });
        
        // Process label content with selective placeholder expansion
        if (parsedLabel.isDuplicate) {
            // Show duplicate warning widget
            const firstOccurrence = context.duplicateCustomLineInfo?.get(parsedLabel.processedLabel);
            decorations.push({
                from: labelStart,
                to: labelEnd,
                decoration: Decoration.replace({
                    widget: new DuplicateCustomLabelWidget(
                        parsedLabel.rawLabel,
                        firstOccurrence?.firstLine ?? undefined,
                        firstOccurrence?.firstContent ?? undefined
                    ),
                    inclusive: false
                })
            });
        } else if (placeholderRanges.length > 0) {
            // Process placeholders
            const placeholderDecorations = this.processPlaceholders(
                line,
                parsedLabel,
                placeholderRanges,
                cursorInfo,
                context
            );
            decorations.push(...placeholderDecorations);
        } else {
            // No placeholders, just mark the label text
            decorations.push({
                from: labelStart,
                to: labelEnd,
                decoration: Decoration.mark({ class: CSS_CLASSES.CUSTOM_LABEL_TEXT })
            });
        }
        
        // Closing bracket
        decorations.push({
            from: labelEnd,
            to: labelEnd + 1,
            decoration: Decoration.replace({
                widget: new CustomLabelPartialWidget('}', context.view, labelEnd),
                inclusive: false
            })
        });
        
        return decorations;
    }
    
    /**
     * Build the content region for inline processing
     */
    private buildStructuralResult(
        parsedLabel: ParsedCustomLabel,
        line: Line,
        decorations: DecorationInfo[],
        context: ProcessingContext
    ): StructuralResult {
        const contentRegion: ContentRegion = {
            from: parsedLabel.markerEnd,
            to: line.to,
            type: 'list-content',
            parentStructure: 'custom-label-list',
            metadata: {
                rawLabel: parsedLabel.rawLabel,
                processedLabel: parsedLabel.processedLabel,
                isDuplicate: parsedLabel.isDuplicate
            }
        };
        
        // Set list context for continuation line detection
        context.listContext = {
            isInList: true,
            contentStartColumn: parsedLabel.markerEnd - line.from,
            listLevel: 1,
            parentStructure: 'custom-label-list'
        };
        
        return {
            decorations,
            contentRegion,
            skipFurtherProcessing: true
        };
    }
    
    process(line: Line, context: ProcessingContext): StructuralResult {
        // Parse the custom label from the line
        const parsedLabel = this.parseCustomLabel(line, context);
        if (!parsedLabel) {
            return { decorations: [] };
        }
        
        // Parse placeholder ranges within the label
        const placeholderRanges = this.parsePlaceholders(parsedLabel);
        
        // Analyze cursor position
        const cursorInfo = this.handleCursorPosition(parsedLabel, placeholderRanges, context);
        
        // Determine display level based on cursor position and placeholder presence
        const displayLevel = this.determineDisplayLevel(line, parsedLabel, placeholderRanges, cursorInfo);
        
        // Create appropriate decorations based on display level
        let decorations: DecorationInfo[];
        
        if (displayLevel === 'collapsed' && !parsedLabel.isDuplicate) {
            decorations = this.createCollapsedDecorations(parsedLabel, context);
        } else if (displayLevel === 'semi-expanded') {
            decorations = this.createSemiExpandedDecorations(parsedLabel, context);
        } else { // displayLevel === 'full' || isDuplicate
            decorations = this.createFullDisplayDecorations(
                line,
                parsedLabel,
                placeholderRanges,
                cursorInfo,
                context
            );
        }
        
        // Build and return the structural result
        return this.buildStructuralResult(parsedLabel, line, decorations, context);
    }
}