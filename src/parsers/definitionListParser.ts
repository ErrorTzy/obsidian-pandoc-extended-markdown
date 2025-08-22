import { MarkdownPostProcessorContext } from 'obsidian';
import { getSectionInfo } from '../types/obsidian-extended';
import { CSS_CLASSES } from '../constants';
import { ListPatterns } from '../patterns';
import { findSuperSubInText } from './superSubParser';

export interface DefinitionListMarker {
    type: 'term' | 'definition';
    indent: string;
    marker: string;
    content: string;
}

export function parseDefinitionListMarker(line: string): DefinitionListMarker | null {
    const termMatch = line.match(ListPatterns.DEFINITION_TERM_PATTERN);
    if (termMatch && !line.includes('*') && !line.includes('-') && !line.match(ListPatterns.NUMBERED_LIST)) {
        const nextLineIndex = line.indexOf('\n');
        if (nextLineIndex === -1 || nextLineIndex === line.length - 1) {
            return {
                type: 'term',
                indent: '',
                marker: '',
                content: termMatch[1].trim()
            };
        }
    }
    
    // Allow spaces before the marker (e.g., "  ~ Definition" or "~ Definition")
    const defMatch = ListPatterns.isDefinitionMarker(line);
    if (defMatch) {
        // Extract content after the marker and spaces
        const content = line.substring(defMatch[0].length);
        return {
            type: 'definition',
            indent: defMatch[1],
            marker: defMatch[2],
            content: content
        };
    }
    
    return null;
}

export function processDefinitionLists(element: HTMLElement, context: MarkdownPostProcessorContext) {
    const section = element.closest('.markdown-preview-section') as HTMLElement;
    if (!section) return;
    
    const sectionInfo = getSectionInfo(section);
    if (!sectionInfo) return;
    
    const lines = sectionInfo.text.split('\n');
    const definitionLists: DefinitionList[] = [];
    
    let currentList: DefinitionList | null = null;
    let currentTerm: DefinitionTerm | null = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const marker = parseDefinitionListMarker(line);
        
        if (marker) {
            if (marker.type === 'term') {
                if (currentTerm && currentTerm.definitions.length > 0) {
                    if (!currentList) {
                        currentList = { terms: [] };
                        definitionLists.push(currentList);
                    }
                    currentList.terms.push(currentTerm);
                }
                currentTerm = {
                    text: marker.content,
                    lineNumber: i,
                    definitions: []
                };
            } else if (marker.type === 'definition' && currentTerm) {
                currentTerm.definitions.push({
                    text: marker.content,
                    lineNumber: i,
                    marker: marker.marker
                });
            }
        } else if (currentTerm && currentTerm.definitions.length > 0) {
            if (!currentList) {
                currentList = { terms: [] };
                definitionLists.push(currentList);
            }
            currentList.terms.push(currentTerm);
            currentTerm = null;
            currentList = null;
        }
    }
    
    if (currentTerm && currentTerm.definitions.length > 0) {
        if (!currentList) {
            currentList = { terms: [] };
            definitionLists.push(currentList);
        }
        currentList.terms.push(currentTerm);
    }
    
    renderDefinitionLists(element, definitionLists);
}

interface DefinitionList {
    terms: DefinitionTerm[];
}

interface DefinitionTerm {
    text: string;
    lineNumber: number;
    definitions: DefinitionItem[];
}

interface DefinitionItem {
    text: string;
    lineNumber: number;
    marker: string;
}

function renderDefinitionLists(element: HTMLElement, definitionLists: DefinitionList[]) {
    definitionLists.forEach(list => {
        const dl = document.createElement('dl');
        dl.className = CSS_CLASSES.DEFINITION_LIST;
        
        list.terms.forEach(term => {
            const dt = document.createElement('dt');
            dt.className = CSS_CLASSES.DEFINITION_TERM;
            applyInlineMarkdown(dt, term.text);
            dl.appendChild(dt);
            
            const dd = document.createElement('dd');
            const ul = document.createElement('ul');
            ul.className = CSS_CLASSES.DEFINITION_ITEMS;
            
            term.definitions.forEach(def => {
                const li = document.createElement('li');
                applyInlineMarkdown(li, def.text);
                ul.appendChild(li);
            });
            
            dd.appendChild(ul);
            dl.appendChild(dd);
        });
        
        const paragraphs = element.querySelectorAll('p');
        paragraphs.forEach(p => {
            const text = p.textContent || '';
            list.terms.forEach(term => {
                if (text.includes(term.text)) {
                    const parent = p.parentNode;
                    if (parent) {
                        parent.replaceChild(dl, p);
                    }
                }
            });
        });
    });
}

function applyInlineMarkdown(element: HTMLElement, text: string): void {
    // First, check for superscripts and subscripts
    const superSubMatches = findSuperSubInText(text);
    
    if (superSubMatches.length > 0) {
        let lastIndex = 0;
        
        superSubMatches.forEach(match => {
            // Add text before the match
            if (match.index > lastIndex) {
                const beforeText = text.substring(lastIndex, match.index);
                processMarkdownText(element, beforeText);
            }
            
            // Add the super/subscript element
            const elem = match.type === 'superscript' 
                ? document.createElement('sup')
                : document.createElement('sub');
            
            elem.className = match.type === 'superscript' 
                ? CSS_CLASSES.SUPERSCRIPT
                : CSS_CLASSES.SUBSCRIPT;
            
            elem.textContent = match.content;
            element.appendChild(elem);
            
            lastIndex = match.index + match.length;
        });
        
        // Add remaining text
        if (lastIndex < text.length) {
            const remainingText = text.substring(lastIndex);
            processMarkdownText(element, remainingText);
        }
    } else {
        processMarkdownText(element, text);
    }
}

function processMarkdownText(element: HTMLElement, text: string): void {
    // Parse the text safely without innerHTML
    const parts = ListPatterns.splitByInlineFormatting(text);
    
    parts.forEach(part => {
        if (!part) return;
        
        // Check for bold (** or __)
        if (part.startsWith('**') && part.endsWith('**')) {
            const strong = document.createElement('strong');
            strong.textContent = part.slice(2, -2);
            element.appendChild(strong);
        } else if (part.startsWith('__') && part.endsWith('__')) {
            const strong = document.createElement('strong');
            strong.textContent = part.slice(2, -2);
            element.appendChild(strong);
        }
        // Check for italic (* or _)
        else if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
            const em = document.createElement('em');
            em.textContent = part.slice(1, -1);
            element.appendChild(em);
        } else if (part.startsWith('_') && part.endsWith('_') && !part.startsWith('__')) {
            const em = document.createElement('em');
            em.textContent = part.slice(1, -1);
            element.appendChild(em);
        }
        // Check for code (`)
        else if (part.startsWith('`') && part.endsWith('`')) {
            const code = document.createElement('code');
            code.textContent = part.slice(1, -1);
            element.appendChild(code);
        }
        // Regular text
        else if (ListPatterns.startsWithFormatting(part)) {
            // Skip delimiters captured by split
            return;
        } else {
            element.appendChild(document.createTextNode(part));
        }
    });
}