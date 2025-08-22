import { EditorView } from '@codemirror/view';
import { PandocExtendedMarkdownSettings } from '../../settings';
import { ListBlockValidator } from '../validators/listBlockValidator';

export interface ExampleScanResult {
    exampleLabels: Map<string, number>;
    exampleContent: Map<string, string>;
    exampleLineNumbers: Map<number, number>;
    duplicateLabels: Map<string, number>;
    duplicateLabelContent: Map<string, string>;
}

export function scanExampleLabels(
    view: EditorView, 
    settings: PandocExtendedMarkdownSettings
): ExampleScanResult {
    const result: ExampleScanResult = {
        exampleLabels: new Map(),
        exampleContent: new Map(),
        exampleLineNumbers: new Map(),
        duplicateLabels: new Map(),
        duplicateLabelContent: new Map()
    };
    
    let counter = 1;
    const docText = view.state.doc.toString();
    const lines = docText.split('\n');
    
    // In strict mode, validate list blocks first
    const invalidListBlocks = settings.strictPandocMode 
        ? ListBlockValidator.validateListBlocks(lines, settings) 
        : new Set<number>();
    
    for (let i = 0; i < lines.length; i++) {
        // Skip invalid lines in strict mode
        if (settings.strictPandocMode && invalidListBlocks.has(i)) {
            continue;
        }
        
        const line = lines[i];
        const match = line.match(ListPatterns.EXAMPLE_LIST_WITH_CONTENT);
        if (match) {
            const label = match[2];
            const content = match[3].trim();
            if (!result.exampleLabels.has(label)) {
                result.exampleLabels.set(label, counter);
                // Store the content after the marker
                if (content) {
                    result.exampleContent.set(label, content);
                }
                // Store the first occurrence line number (1-based) and full line content
                result.duplicateLabels.set(label, i + 1);
                result.duplicateLabelContent.set(label, line);
            }
            // Store line number to example number mapping
            result.exampleLineNumbers.set(i + 1, counter);
            counter++;
        } else {
            const unlabeledMatch = line.match(ListPatterns.UNLABELED_EXAMPLE_LIST);
            if (unlabeledMatch) {
                // Store line number to example number mapping for unlabeled examples
                result.exampleLineNumbers.set(i + 1, counter);
                counter++;
            }
        }
    }
    
    return result;
}