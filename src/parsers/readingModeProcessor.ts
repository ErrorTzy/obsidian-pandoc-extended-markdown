import { MarkdownPostProcessorContext } from 'obsidian';
import { parseFancyListMarker } from './fancyListParser';
import { parseExampleListMarker } from './exampleListParser';
import { parseDefinitionListMarker } from './definitionListParser';

export function processReadingMode(element: HTMLElement, context: MarkdownPostProcessorContext) {
    // Process all text nodes to find and replace our custom list markers
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null
    );

    const nodesToProcess: Text[] = [];
    while (walker.nextNode()) {
        nodesToProcess.push(walker.currentNode as Text);
    }

    // Build example reference map
    const exampleMap = new Map<string, number>();
    let exampleCounter = 1;
    
    nodesToProcess.forEach(node => {
        const text = node.textContent || '';
        const lines = text.split('\n');
        
        lines.forEach(line => {
            const exampleInfo = parseExampleListMarker(line);
            if (exampleInfo) {
                if (exampleInfo.label && !exampleMap.has(exampleInfo.label)) {
                    exampleMap.set(exampleInfo.label, exampleCounter);
                    exampleCounter++;
                } else if (!exampleInfo.label) {
                    exampleCounter++;
                }
            }
        });
    });

    // Process each text node
    nodesToProcess.forEach(node => {
        const parent = node.parentNode;
        if (!parent) return;
        
        const text = node.textContent || '';
        const lines = text.split('\n');
        
        const newElements: (HTMLElement | Text)[] = [];
        
        lines.forEach((line, lineIndex) => {
            if (lineIndex > 0) {
                newElements.push(document.createTextNode('\n'));
            }
            
            // Check for fancy list markers
            const fancyMarker = parseFancyListMarker(line);
            if (fancyMarker) {
                const span = document.createElement('span');
                span.className = `pandoc-list-${fancyMarker.type}`;
                span.textContent = fancyMarker.marker + ' ';
                newElements.push(span);
                
                const rest = line.substring(fancyMarker.indent.length + fancyMarker.marker.length + 1);
                if (rest) {
                    newElements.push(document.createTextNode(rest));
                }
                return;
            }
            
            // Check for example list markers
            const exampleMarker = parseExampleListMarker(line);
            if (exampleMarker) {
                let number = 1;
                if (exampleMarker.label && exampleMap.has(exampleMarker.label)) {
                    number = exampleMap.get(exampleMarker.label)!;
                }
                
                const span = document.createElement('span');
                span.className = 'pandoc-example-list';
                span.textContent = `(${number}) `;
                newElements.push(span);
                
                const rest = line.substring(exampleMarker.indent.length + exampleMarker.originalMarker.length + 1);
                if (rest) {
                    newElements.push(document.createTextNode(rest));
                }
                return;
            }
            
            // Check for definition list markers
            const defMarker = parseDefinitionListMarker(line);
            if (defMarker) {
                if (defMarker.type === 'term') {
                    const strong = document.createElement('strong');
                    const u = document.createElement('u');
                    u.textContent = defMarker.content;
                    strong.appendChild(u);
                    newElements.push(strong);
                } else {
                    const span = document.createElement('span');
                    span.textContent = '• ';
                    newElements.push(span);
                    newElements.push(document.createTextNode(defMarker.content));
                }
                return;
            }
            
            // Process example references
            const refRegex = /\(@([a-zA-Z0-9_-]+)\)/g;
            let lastIndex = 0;
            let match;
            
            while ((match = refRegex.exec(line)) !== null) {
                if (match.index > lastIndex) {
                    newElements.push(document.createTextNode(line.substring(lastIndex, match.index)));
                }
                
                const label = match[1];
                if (exampleMap.has(label)) {
                    const span = document.createElement('span');
                    span.className = 'pandoc-example-reference';
                    span.textContent = `(${exampleMap.get(label)})`;
                    newElements.push(span);
                } else {
                    newElements.push(document.createTextNode(match[0]));
                }
                
                lastIndex = match.index + match[0].length;
            }
            
            if (lastIndex < line.length) {
                newElements.push(document.createTextNode(line.substring(lastIndex)));
            } else if (lastIndex === 0) {
                newElements.push(document.createTextNode(line));
            }
        });
        
        // Replace the original text node with our new elements
        newElements.forEach(elem => {
            parent.insertBefore(elem, node);
        });
        parent.removeChild(node);
    });
}