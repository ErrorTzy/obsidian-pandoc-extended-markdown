import { MarkdownPostProcessorContext } from 'obsidian';
import { getSectionInfo } from '../../shared/types/obsidian-extended';
import { FancyListType, FancyListMarker } from '../../shared/types/listTypes';
import { CSS_CLASSES, getFancyListClass } from '../../core/constants';
import { ListPatterns } from '../../shared/patterns';

export function parseFancyListMarker(line: string): FancyListMarker | null {
    // Check for hash list first
    const hashMatch = ListPatterns.isHashList(line);
    if (hashMatch) {
        return {
            indent: hashMatch[1],
            marker: hashMatch[2],
            type: 'hash',
            delimiter: '.',
            value: undefined
        };
    }
    
    const match = ListPatterns.isFancyList(line);
    
    if (!match) {
        return null;
    }
    
    const indent = match[1];
    const marker = match[2];
    const value = match[3];
    const delimiter = match[4] as '.' | ')';
    
    let type: FancyListType;
    
    if (ListPatterns.DECIMAL.test(value)) {
        return null;
    } else if (ListPatterns.ROMAN_UPPER.test(value)) {
        type = 'upper-roman';
    } else if (ListPatterns.ROMAN_LOWER.test(value)) {
        type = 'lower-roman';
    } else if (ListPatterns.ALPHA_UPPER.test(value)) {
        type = 'upper-alpha';
    } else if (ListPatterns.ALPHA_LOWER.test(value)) {
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
    
    const section = list.closest('.markdown-preview-section') as HTMLElement;
    if (!section) return;
    
    const sectionInfo = getSectionInfo(section);
    if (!sectionInfo) return;
    
    const lines = sectionInfo.text.split('\n');
    const lineNum = parseInt(sourcePos);
    
    if (lineNum >= lines.length) return;
    
    const firstLine = lines[lineNum];
    const marker = parseFancyListMarker(firstLine);
    
    if (!marker) return;
    
    list.classList.add(getFancyListClass(marker.type));
    
    if (marker.delimiter === ')') {
        list.classList.add(CSS_CLASSES.FANCY_LIST_PAREN);
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