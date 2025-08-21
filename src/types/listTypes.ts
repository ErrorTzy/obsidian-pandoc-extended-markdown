/**
 * Type definitions for list-related interfaces and types
 */

export type FancyListType = 'upper-alpha' | 'lower-alpha' | 'upper-roman' | 'lower-roman' | 'decimal' | 'hash';

export interface FancyListMarker {
    indent: string;
    marker: string;
    type: FancyListType;
    delimiter: '.' | ')' | '';
    value?: string;
}