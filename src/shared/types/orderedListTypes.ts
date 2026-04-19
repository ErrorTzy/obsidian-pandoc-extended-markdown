export type OrderedListMarkerStyle =
    | 'decimal-period'
    | 'decimal-one-paren'
    | 'lower-alpha-period'
    | 'lower-alpha-one-paren'
    | 'lower-roman-period'
    | 'lower-roman-one-paren'
    | 'upper-alpha-period'
    | 'upper-alpha-one-paren'
    | 'upper-roman-period'
    | 'upper-roman-one-paren';

export interface OrderedListMarkerStyleInfo {
    id: OrderedListMarkerStyle;
    displayName: string;
    marker: string;
    description: string;
}

export const ORDERED_LIST_MARKER_STYLES: OrderedListMarkerStyleInfo[] = [
    {
        id: 'decimal-period',
        displayName: 'Decimal period',
        marker: '1.',
        description: 'Arabic numerals such as 1., 2., 3.'
    },
    {
        id: 'lower-alpha-period',
        displayName: 'Lowercase letters period',
        marker: 'a.',
        description: 'Lowercase alphabetic markers such as a., b., c.'
    },
    {
        id: 'lower-roman-period',
        displayName: 'Lowercase roman numerals period',
        marker: 'i.',
        description: 'Lowercase roman numerals such as i., ii., iii.'
    },
    {
        id: 'upper-alpha-period',
        displayName: 'Uppercase letters period',
        marker: 'A.',
        description: 'Uppercase alphabetic markers such as A., B., C.'
    },
    {
        id: 'upper-roman-period',
        displayName: 'Uppercase roman numerals period',
        marker: 'I.',
        description: 'Uppercase roman numerals such as I., II., III.'
    },
    {
        id: 'decimal-one-paren',
        displayName: 'Decimal parenthesis',
        marker: '1)',
        description: 'Arabic numerals followed by a right parenthesis.'
    },
    {
        id: 'lower-alpha-one-paren',
        displayName: 'Lowercase letters parenthesis',
        marker: 'a)',
        description: 'Lowercase alphabetic markers followed by a right parenthesis.'
    },
    {
        id: 'lower-roman-one-paren',
        displayName: 'Lowercase roman numerals parenthesis',
        marker: 'i)',
        description: 'Lowercase roman numerals followed by a right parenthesis.'
    },
    {
        id: 'upper-alpha-one-paren',
        displayName: 'Uppercase letters parenthesis',
        marker: 'A)',
        description: 'Uppercase alphabetic markers followed by a right parenthesis.'
    },
    {
        id: 'upper-roman-one-paren',
        displayName: 'Uppercase roman numerals parenthesis',
        marker: 'I)',
        description: 'Uppercase roman numerals followed by a right parenthesis.'
    }
];

export const DEFAULT_ORDERED_LIST_MARKER_ORDER: OrderedListMarkerStyle[] =
    ORDERED_LIST_MARKER_STYLES.map(style => style.id);

const ORDERED_LIST_MARKER_STYLE_IDS = new Set<OrderedListMarkerStyle>(
    DEFAULT_ORDERED_LIST_MARKER_ORDER
);

export function normalizeOrderedListMarkerOrder(
    order?: readonly string[]
): OrderedListMarkerStyle[] {
    const sourceOrder = order ?? DEFAULT_ORDERED_LIST_MARKER_ORDER;
    const normalizedOrder = sourceOrder.filter(
        (style): style is OrderedListMarkerStyle =>
            ORDERED_LIST_MARKER_STYLE_IDS.has(style as OrderedListMarkerStyle)
    );

    return normalizedOrder.length > 0
        ? [...normalizedOrder]
        : [...DEFAULT_ORDERED_LIST_MARKER_ORDER];
}
