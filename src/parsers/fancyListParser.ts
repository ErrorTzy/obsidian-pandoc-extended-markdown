import { MarkdownPostProcessorContext } from 'obsidian';

export type FancyListType = 'upper-alpha' | 'lower-alpha' | 'upper-roman' | 'lower-roman' | 'decimal' | 'hash';

export interface FancyListMarker {
    indent: string;
    marker: string;
    type: FancyListType;
    delimiter: '.' | ')' | '';
    value?: string;
}

const ROMAN_UPPER = /^[IVXLCDM]+$/;
const ROMAN_LOWER = /^[ivxlcdm]+$/;
const ALPHA_UPPER = /^[A-Z]+$/;
const ALPHA_LOWER = /^[a-z]+$/;
const DECIMAL = /^[0-9]+$/;

export function parseFancyListMarker(line: string): FancyListMarker | null {
    const match = line.match(/^(\s*)(([a-zA-Z]+|[ivxlcdmIVXLCDM]+|[0-9]+|#)([.)]))\s+/);
    
    if (!match) {
        return null;
    }
    
    const indent = match[1];
    const marker = match[2];
    const value = match[3];
    const delimiter = match[4] as '.' | ')';
    
    let type: FancyListType;
    
    if (value === '#') {
        type = 'hash';
    } else if (DECIMAL.test(value)) {
        return null;
    } else if (ROMAN_UPPER.test(value)) {
        type = 'upper-roman';
    } else if (ROMAN_LOWER.test(value)) {
        type = 'lower-roman';
    } else if (ALPHA_UPPER.test(value)) {
        type = 'upper-alpha';
    } else if (ALPHA_LOWER.test(value)) {
        type = 'lower-alpha';
    } else {
        return null;
    }
    
    return {
        indent,
        marker,
        type,
        delimiter,
        value: value === '#' ? undefined : value
    };
}

function romanToDecimal(roman: string): number {
    const romanNumerals: { [key: string]: number } = {
        'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000,
        'i': 1, 'v': 5, 'x': 10, 'l': 50, 'c': 100, 'd': 500, 'm': 1000
    };
    
    let result = 0;
    for (let i = 0; i < roman.length; i++) {
        const current = romanNumerals[roman[i]];
        const next = romanNumerals[roman[i + 1]];
        
        if (next && current < next) {
            result -= current;
        } else {
            result += current;
        }
    }
    
    return result;
}

function alphaToDecimal(alpha: string): number {
    const base = alpha.toLowerCase();
    let result = 0;
    
    for (let i = 0; i < base.length; i++) {
        result = result * 26 + (base.charCodeAt(i) - 'a'.charCodeAt(0) + 1);
    }
    
    return result;
}

export function processFancyLists(element: HTMLElement, context: MarkdownPostProcessorContext) {
    const lists = element.querySelectorAll('ol, ul');
    
    lists.forEach((list) => {
        if (list instanceof HTMLOListElement) {
            processFancyOrderedList(list);
        }
    });
}

function processFancyOrderedList(list: HTMLOListElement) {
    const items = list.querySelectorAll('li');
    if (items.length === 0) return;
    
    const firstItem = items[0];
    const sourcePos = firstItem.getAttribute('data-line');
    
    if (!sourcePos) return;
    
    const section = list.closest('.markdown-preview-section');
    if (!section) return;
    
    const sectionInfo = (section as any).getSection?.();
    if (!sectionInfo) return;
    
    const lines = sectionInfo.text.split('\n');
    const lineNum = parseInt(sourcePos);
    
    if (lineNum >= lines.length) return;
    
    const firstLine = lines[lineNum];
    const marker = parseFancyListMarker(firstLine);
    
    if (!marker) return;
    
    list.classList.add(`pandoc-list-${marker.type}`);
    
    if (marker.delimiter === ')') {
        list.classList.add('pandoc-list-paren');
    }
    
    let startValue = 1;
    if (marker.value) {
        if (marker.type === 'upper-roman' || marker.type === 'lower-roman') {
            startValue = romanToDecimal(marker.value);
        } else if (marker.type === 'upper-alpha' || marker.type === 'lower-alpha') {
            startValue = alphaToDecimal(marker.value);
        }
    }
    
    if (startValue !== 1) {
        list.setAttribute('start', String(startValue));
    }
}