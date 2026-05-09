import { FancyListType, FancyListMarker } from '../../../shared/types/listTypes';

import { ListPatterns } from '../../../shared/patterns';

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
