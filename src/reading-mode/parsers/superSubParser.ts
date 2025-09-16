// Constants
import { CSS_CLASSES } from '../../core/constants';

// Patterns
import { ListPatterns } from '../../shared/patterns';

// Utils
import { createTextNodeWalker } from '../utils/domUtils';

export interface SuperSubMatch {
    index: number;
    length: number;
    content: string;
    type: 'superscript' | 'subscript';
}

/**
 * Extract the actual text content from a superscript or subscript match,
 * handling escaped spaces.
 */
function extractContent(match: string, delimiter: string): string {
    // Remove the delimiters and unescape spaces
    const content = match.slice(1, -1);
    return ListPatterns.unescapeSpaces(content);
}

/**
 * Find all superscripts and subscripts in a text.
 */
export function findSuperSubInText(text: string): SuperSubMatch[] {
    const matches: SuperSubMatch[] = [];
    
    // Find superscripts
    const superscripts = ListPatterns.findSuperscripts(text);
    superscripts.forEach(match => {
        if (match.index !== undefined) {
            matches.push({
                index: match.index,
                length: match[0].length,
                content: extractContent(match[0], '^'),
                type: 'superscript'
            });
        }
    });
    
    // Find subscripts
    const subscripts = ListPatterns.findSubscripts(text);
    subscripts.forEach(match => {
        if (match.index !== undefined) {
            matches.push({
                index: match.index,
                length: match[0].length,
                content: extractContent(match[0], '~'),
                type: 'subscript'
            });
        }
    });
    
    // Sort by index to process in order
    matches.sort((a, b) => a.index - b.index);
    
    return matches;
}

/**
 * Process superscripts and subscripts in an HTML element for reading mode.
 */
export function processSuperSub(element: HTMLElement) {
    const walker = createTextNodeWalker(element, (node) => {
                // Skip if already processed
                const parent = node.parentElement;
                if (parent && (
                    parent.classList.contains(CSS_CLASSES.SUPERSCRIPT) ||
                    parent.classList.contains(CSS_CLASSES.SUBSCRIPT)
                )) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            });
    
    const nodesToReplace: { node: Text; matches: SuperSubMatch[] }[] = [];
    
    while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        const text = node.textContent || '';
        const matches = findSuperSubInText(text);
        
        if (matches.length > 0) {
            nodesToReplace.push({ node, matches });
        }
    }
    
    nodesToReplace.forEach(({ node, matches }) => {
        const parent = node.parentNode;
        if (!parent) return;
        
        let lastIndex = 0;
        const fragments: (string | HTMLElement)[] = [];
        
        matches.forEach(match => {
            // Add text before the match
            if (match.index > lastIndex) {
                fragments.push(node.textContent!.substring(lastIndex, match.index));
            }
            
            // Create the appropriate element
            const elem = match.type === 'superscript' 
                ? document.createElement('sup')
                : document.createElement('sub');
            
            elem.className = match.type === 'superscript' 
                ? CSS_CLASSES.SUPERSCRIPT
                : CSS_CLASSES.SUBSCRIPT;
            
            elem.textContent = match.content;
            fragments.push(elem);
            
            lastIndex = match.index + match.length;
        });
        
        // Add remaining text
        if (lastIndex < node.textContent!.length) {
            fragments.push(node.textContent!.substring(lastIndex));
        }
        
        // Replace the node with fragments
        fragments.forEach(fragment => {
            if (typeof fragment === 'string') {
                parent.insertBefore(document.createTextNode(fragment), node);
            } else {
                parent.insertBefore(fragment, node);
            }
        });
        
        parent.removeChild(node);
    });
}