import { Decoration } from '@codemirror/view';
import { EditorView } from '@codemirror/view';
import { PandocExtendedMarkdownSettings } from '../../settings';
import { CSS_CLASSES } from '../../constants';
import { ListPatterns } from '../../patterns';
import { 
    HashListMarkerWidget, 
    FancyListMarkerWidget, 
    ExampleListMarkerWidget, 
    DuplicateExampleLabelWidget 
} from '../widgets';
import { processExampleReferences, processSuperscripts, processSubscripts, InlineFormatContext } from './inlineFormatProcessor';
import { processCustomLabelReferences } from './customLabelProcessor';
import { PlaceholderContext } from '../../utils/placeholderProcessor';

export interface ProcessorContext {
    line: any;
    lineNum: number;
    lineText: string;
    cursorPos: number;
    view: EditorView;
    invalidListBlocks: Set<number>;
    settings: PandocExtendedMarkdownSettings;
    exampleLabels?: Map<string, number>;
    exampleLineNumbers?: Map<number, number>;
    duplicateLabels?: Map<string, number>;
    duplicateLabelContent?: Map<string, string>;
    exampleContent?: Map<string, string>;
    customLabels?: Map<string, string>;
    rawToProcessed?: Map<string, string>;
    placeholderContext?: PlaceholderContext;
}

export function processHashList(
    context: ProcessorContext,
    hashCounter: { value: number }
): Array<{from: number, to: number, decoration: Decoration}> | null {
    const { line, lineNum, lineText, cursorPos, view, invalidListBlocks, settings } = context;
    const decorations: Array<{from: number, to: number, decoration: Decoration}> = [];
    const hashMatch = ListPatterns.isHashList(lineText);
    
    if (!hashMatch) return null;
    
    // Check if this list item is in an invalid block
    if (settings.strictPandocMode && invalidListBlocks.has(lineNum - 1)) {
        return null;
    }
    
    const indent = hashMatch[1];
    const marker = hashMatch[2];
    const space = hashMatch[3];
    
    const markerStart = line.from + indent.length;
    const markerEnd = line.from + indent.length + marker.length + space.length;
    
    // Check if cursor is within the marker area
    const cursorInMarker = cursorPos >= markerStart && cursorPos < markerEnd;
    
    // Add line decoration with CSS class for proper styling
    decorations.push({
        from: line.from,
        to: line.from,
        decoration: Decoration.line({
            class: 'HyperMD-list-line HyperMD-list-line-1 pandoc-list-line'
        })
    });
    
    // Only replace the marker if cursor is not within it
    if (!cursorInMarker) {
        decorations.push({
            from: markerStart,
            to: markerEnd,
            decoration: Decoration.replace({
                widget: new HashListMarkerWidget(hashCounter.value, view, markerStart)
            })
        });
    }
    
    // Wrap the rest of the line
    const contentStart = line.from + indent.length + marker.length + space.length;
    decorations.push({
        from: contentStart,
        to: line.to,
        decoration: Decoration.mark({
            class: 'cm-list-1'
        })
    });
    
    // Process inline formats in the content part
    const contentText = lineText.substring(indent.length + marker.length + space.length);
    if (contentText) {
        // Process example references
        const inlineContext: InlineFormatContext = {
            line: { from: contentStart, to: line.to },
            lineText: contentText,
            cursorPos: cursorPos > contentStart ? cursorPos - contentStart : -1,
            exampleLabels: context.exampleLabels,
            exampleContent: context.exampleContent
        };
        
        const exampleRefs = processExampleReferences(inlineContext);
        decorations.push(...exampleRefs.map(d => ({
            from: d.from,
            to: d.to,
            decoration: d.decoration
        })));
        
        const superscripts = processSuperscripts(inlineContext);
        decorations.push(...superscripts.map(d => ({
            from: d.from,
            to: d.to,
            decoration: d.decoration
        })));
        
        const subscripts = processSubscripts(inlineContext);
        decorations.push(...subscripts.map(d => ({
            from: d.from,
            to: d.to,
            decoration: d.decoration
        })));
        
        // Process custom label references if enabled
        if (settings.moreExtendedSyntax && context.customLabels) {
            const customLabelRefs = processCustomLabelReferences(
                contentText,
                contentStart,
                context.customLabels,
                view,
                cursorPos,
                settings,
                true,
                context.rawToProcessed,
                context.placeholderContext
            );
            decorations.push(...customLabelRefs);
        }
    }
    
    hashCounter.value++;
    return decorations;
}

export function processFancyList(
    context: ProcessorContext
): Array<{from: number, to: number, decoration: Decoration}> | null {
    const { line, lineNum, lineText, cursorPos, view, invalidListBlocks, settings } = context;
    const decorations: Array<{from: number, to: number, decoration: Decoration}> = [];
    const fancyMatch = ListPatterns.isFancyList(lineText);
    
    if (!fancyMatch) return null;
    
    // Check if this list item is in an invalid block
    if (settings.strictPandocMode && invalidListBlocks.has(lineNum - 1)) {
        return null;
    }
    
    const indent = fancyMatch[1];
    const marker = fancyMatch[2];
    const space = fancyMatch[5];
    
    const markerStart = line.from + indent.length;
    const markerEnd = line.from + indent.length + marker.length + space.length;
    
    // Check if cursor is within the marker area
    const cursorInMarker = cursorPos >= markerStart && cursorPos < markerEnd;
    
    // Determine list type and appropriate class
    let listClass = CSS_CLASSES.FANCY_LIST_UPPER_ALPHA;
    const letterMatch = ListPatterns.extractLetterMarker(marker);
    const romanMatch = ListPatterns.extractRomanMarker(marker);
    
    if (letterMatch) {
        const letter = letterMatch[1];
        if (letter[0] === letter[0].toLowerCase()) {
            listClass = CSS_CLASSES.FANCY_LIST_LOWER_ALPHA;
        }
    } else if (romanMatch) {
        const roman = romanMatch[1];
        if (roman[0] === roman[0].toLowerCase()) {
            listClass = CSS_CLASSES.FANCY_LIST_LOWER_ROMAN;
        } else {
            listClass = CSS_CLASSES.FANCY_LIST_UPPER_ROMAN;
        }
    }
    
    // Add line decoration with CSS class for proper styling
    decorations.push({
        from: line.from,
        to: line.from,
        decoration: Decoration.line({
            class: 'HyperMD-list-line HyperMD-list-line-1 pandoc-list-line'
        })
    });
    
    // Only replace the marker if cursor is not within it
    if (!cursorInMarker) {
        decorations.push({
            from: markerStart,
            to: markerEnd,
            decoration: Decoration.replace({
                widget: new FancyListMarkerWidget(marker, listClass, view, markerStart)
            })
        });
    }
    
    // Wrap the rest of the line
    const contentStart = line.from + indent.length + marker.length + space.length;
    decorations.push({
        from: contentStart,
        to: line.to,
        decoration: Decoration.mark({
            class: 'cm-list-1'
        })
    });
    
    // Process inline formats in the content part
    const contentText = lineText.substring(indent.length + marker.length + space.length);
    if (contentText) {
        // Process example references
        const inlineContext: InlineFormatContext = {
            line: { from: contentStart, to: line.to },
            lineText: contentText,
            cursorPos: cursorPos > contentStart ? cursorPos - contentStart : -1,
            exampleLabels: context.exampleLabels,
            exampleContent: context.exampleContent
        };
        
        const exampleRefs = processExampleReferences(inlineContext);
        decorations.push(...exampleRefs.map(d => ({
            from: d.from,
            to: d.to,
            decoration: d.decoration
        })));
        
        const superscripts = processSuperscripts(inlineContext);
        decorations.push(...superscripts.map(d => ({
            from: d.from,
            to: d.to,
            decoration: d.decoration
        })));
        
        const subscripts = processSubscripts(inlineContext);
        decorations.push(...subscripts.map(d => ({
            from: d.from,
            to: d.to,
            decoration: d.decoration
        })));
        
        // Process custom label references if enabled
        if (settings.moreExtendedSyntax && context.customLabels) {
            const customLabelRefs = processCustomLabelReferences(
                contentText,
                contentStart,
                context.customLabels,
                view,
                cursorPos,
                settings,
                true,
                context.rawToProcessed,
                context.placeholderContext
            );
            decorations.push(...customLabelRefs);
        }
    }
    
    return decorations;
}

export function processExampleList(
    context: ProcessorContext
): Array<{from: number, to: number, decoration: Decoration}> | null {
    const { 
        line, lineNum, lineText, cursorPos, view, invalidListBlocks, settings,
        exampleLabels, exampleLineNumbers, duplicateLabels, duplicateLabelContent
    } = context;
    
    const decorations: Array<{from: number, to: number, decoration: Decoration}> = [];
    const exampleMatch = ListPatterns.isExampleList(lineText);
    
    if (!exampleMatch) return null;
    
    // Check if this list item is in an invalid block
    if (settings.strictPandocMode && invalidListBlocks.has(lineNum - 1)) {
        return null;
    }
    
    const indent = exampleMatch[1];
    const fullMarker = exampleMatch[2];
    const label = exampleMatch[3] || '';
    const space = exampleMatch[4];
    
    const markerStart = line.from + indent.length;
    const markerEnd = line.from + indent.length + fullMarker.length + space.length;
    
    // Check if cursor is within the marker area
    const cursorInMarker = cursorPos >= markerStart && cursorPos < markerEnd;
    
    // Determine the example number for this line
    const exampleNumber = exampleLineNumbers?.get(lineNum) || 1;
    
    // Add line decoration with CSS class for proper styling
    decorations.push({
        from: line.from,
        to: line.from,
        decoration: Decoration.line({
            class: 'HyperMD-list-line HyperMD-list-line-1 pandoc-list-line'
        })
    });
    
    // Check if this is a duplicate label
    const isDuplicate = label && duplicateLabels?.has(label) && duplicateLabels.get(label) !== lineNum;
    
    // Only replace the marker if cursor is not within it
    if (!cursorInMarker) {
        if (isDuplicate && duplicateLabels && duplicateLabelContent) {
            // Show duplicate marker
            const originalLine = duplicateLabels.get(label)!;
            const originalContent = duplicateLabelContent.get(label)!;
            decorations.push({
                from: markerStart,
                to: markerEnd,
                decoration: Decoration.replace({
                    widget: new DuplicateExampleLabelWidget(label, originalLine, originalContent, view, markerStart)
                })
            });
        } else {
            // Normal example marker
            decorations.push({
                from: markerStart,
                to: markerEnd,
                decoration: Decoration.replace({
                    widget: new ExampleListMarkerWidget(exampleNumber, label || undefined, view, markerStart)
                })
            });
        }
    }
    
    // Wrap the rest of the line
    const contentStart = line.from + indent.length + fullMarker.length + space.length;
    decorations.push({
        from: contentStart,
        to: line.to,
        decoration: Decoration.mark({
            class: CSS_CLASSES.EXAMPLE_ITEM
        })
    });
    
    // Process inline formats in the content part
    const contentText = lineText.substring(indent.length + fullMarker.length + space.length);
    if (contentText) {
        // Process example references
        const inlineContext: InlineFormatContext = {
            line: { from: contentStart, to: line.to },
            lineText: contentText,
            cursorPos: cursorPos > contentStart ? cursorPos - contentStart : -1,
            exampleLabels: context.exampleLabels,
            exampleContent: context.exampleContent
        };
        
        const exampleRefs = processExampleReferences(inlineContext);
        decorations.push(...exampleRefs.map(d => ({
            from: d.from,
            to: d.to,
            decoration: d.decoration
        })));
        
        const superscripts = processSuperscripts(inlineContext);
        decorations.push(...superscripts.map(d => ({
            from: d.from,
            to: d.to,
            decoration: d.decoration
        })));
        
        const subscripts = processSubscripts(inlineContext);
        decorations.push(...subscripts.map(d => ({
            from: d.from,
            to: d.to,
            decoration: d.decoration
        })));
        
        // Process custom label references if enabled
        if (settings.moreExtendedSyntax && context.customLabels) {
            const customLabelRefs = processCustomLabelReferences(
                contentText,
                contentStart,
                context.customLabels,
                view,
                cursorPos,
                settings,
                true,
                context.rawToProcessed,
                context.placeholderContext
            );
            decorations.push(...customLabelRefs);
        }
    }
    
    return decorations;
}