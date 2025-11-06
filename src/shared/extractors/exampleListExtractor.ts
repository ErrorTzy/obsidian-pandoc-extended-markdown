import { ListPatterns } from '../patterns';
import { withErrorBoundary } from '../utils/errorHandler';

export interface ExampleListItem {
    renderedNumber: number;
    rawLabel: string;  // e.g., "@a", "@", "@b"
    content: string;
    lineNumber: number;
    position: { line: number; ch: number };
}

export function extractExampleLists(content: string): ExampleListItem[] {
    return withErrorBoundary(() => {
        const items: ExampleListItem[] = [];
        const lines = content.split('\n');
        let exampleCounter = 1;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(ListPatterns.EXAMPLE_LIST_WITH_CONTENT);
            if (match) {
                const rawLabel = `@${match[2]}`;
                const listContent = match[3].trim();
                
                items.push({
                    renderedNumber: exampleCounter,
                    rawLabel: rawLabel,
                    content: listContent,
                    lineNumber: i,
                    position: { line: i, ch: 0 }
                });
                
                exampleCounter++;
            } else {
                // Check for unlabeled example list
                const unlabeledMatch = line.match(ListPatterns.UNLABELED_EXAMPLE_LIST);
                if (unlabeledMatch) {
                    // Extract content after the (@) marker
                    const contentStart = line.indexOf('(@)') + 3;
                    const listContent = line.substring(contentStart).trim();
                    
                    items.push({
                        renderedNumber: exampleCounter,
                        rawLabel: '@',
                        content: listContent,
                        lineNumber: i,
                        position: { line: i, ch: 0 }
                    });
                    
                    exampleCounter++;
                }
            }
        }
        
        return items;
    }, 'Extract example lists', []);
}
