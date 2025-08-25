import { EditorPosition } from 'obsidian';
import { ListPatterns } from '../patterns';
import { PlaceholderContext } from '../utils/placeholderProcessor';
import { withErrorBoundary } from '../utils/errorHandler';

export interface CustomLabel {
    label: string;          // Rendered label (e.g., "(P1)")
    rawLabel: string;       // Raw label text (e.g., "{::P(#a)}")
    content: string;        // List content (raw markdown)
    renderedContent?: string; // Rendered content (with processed references)
    lineNumber: number;     // 0-indexed line number
    position: EditorPosition; // Position in editor
}

export function extractCustomLabels(content: string, moreExtendedSyntax: boolean): CustomLabel[] {
    return withErrorBoundary(() => {
        const lines = content.split('\n');
        const labels: CustomLabel[] = [];
        
        // Check if plugin settings allow custom labels
        if (!moreExtendedSyntax) {
            return labels;
        }
        
        // Process labels with placeholder context
        const { processedLabels, rawToProcessed } = processLabels(lines);
        
        // Extract label information
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = ListPatterns.isCustomLabelList(line);
            
            if (match) {
                const fullMarker = match[2];
                const rawLabel = match[3];
                const restOfLine = line.substring(match[0].length);
                
                // Get processed label
                const processedLabel = rawToProcessed.get(rawLabel) || rawLabel;
                
                // Build the rendered label - just show the processed label without wrapper syntax
                const renderedLabel = processedLabel;
                
                // Process content to replace references with rendered forms
                let renderedContent = restOfLine.trim();
                // Replace custom label references in content
                renderedContent = renderedContent.replace(ListPatterns.CUSTOM_LABEL_REFERENCE, (match, ref) => {
                    const processedRef = rawToProcessed.get(ref) || ref;
                    return processedRef;
                });
                
                labels.push({
                    label: renderedLabel,
                    rawLabel: fullMarker,
                    content: restOfLine.trim(),
                    renderedContent: renderedContent,
                    lineNumber: i,
                    position: { line: i, ch: 0 }
                });
            }
        }
        
        return labels;
    }, [], 'CustomLabelExtractor.extractCustomLabels');
}

export function processLabels(lines: string[]): { 
    processedLabels: Map<string, string>, 
    rawToProcessed: Map<string, string> 
} {
    const placeholderContext = new PlaceholderContext();
    const processedLabels = new Map<string, string>();
    const rawToProcessed = new Map<string, string>();
    
    // Process all labels using PlaceholderContext
    for (const line of lines) {
        const match = ListPatterns.isCustomLabelList(line);
        if (match) {
            const rawLabel = match[3];
            // Get the rest of the line after the match - this accounts for cases with or without space
            const fullMatch = match[0];
            const restOfLine = line.substring(fullMatch.length);
            
            // Use PlaceholderContext to process the label
            const processedLabel = placeholderContext.processLabel(rawLabel);
            
            processedLabels.set(processedLabel, restOfLine.trim());
            rawToProcessed.set(rawLabel, processedLabel);
        }
    }
    
    return { processedLabels, rawToProcessed };
}