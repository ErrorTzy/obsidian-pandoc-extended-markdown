import { MarkdownPostProcessorContext } from 'obsidian';

export interface DefinitionListMarker {
    type: 'term' | 'definition';
    indent: string;
    marker: string;
    content: string;
}

export function parseDefinitionListMarker(line: string): DefinitionListMarker | null {
    const termMatch = line.match(/^([^\n:~]+)$/);
    if (termMatch && !line.includes('*') && !line.includes('-') && !line.match(/^\s*\d+[.)]/)) {
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
    
    const defMatch = line.match(/^(\s*)([~:])\s+(.+)/);
    if (defMatch) {
        return {
            type: 'definition',
            indent: defMatch[1],
            marker: defMatch[2],
            content: defMatch[3]
        };
    }
    
    return null;
}

export function processDefinitionLists(element: HTMLElement, context: MarkdownPostProcessorContext) {
    const section = element.closest('.markdown-preview-section');
    if (!section) return;
    
    const sectionInfo = (section as any).getSection?.();
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
        dl.className = 'pandoc-definition-list';
        
        list.terms.forEach(term => {
            const dt = document.createElement('dt');
            dt.className = 'pandoc-definition-term';
            dt.innerHTML = parseInlineMarkdown(term.text);
            dl.appendChild(dt);
            
            const dd = document.createElement('dd');
            const ul = document.createElement('ul');
            ul.className = 'pandoc-definition-items';
            
            term.definitions.forEach(def => {
                const li = document.createElement('li');
                li.innerHTML = parseInlineMarkdown(def.text);
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

function parseInlineMarkdown(text: string): string {
    return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>');
}