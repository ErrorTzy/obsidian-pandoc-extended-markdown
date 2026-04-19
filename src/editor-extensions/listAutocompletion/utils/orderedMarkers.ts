import { INDENTATION } from '../../../core/constants';
import {
    PandocExtendedMarkdownSettings,
    isSyntaxFeatureEnabled
} from '../../../shared/types/settingsTypes';
import {
    OrderedListMarkerStyle,
    normalizeOrderedListMarkerOrder
} from '../../../shared/types/orderedListTypes';

const ORDERED_MARKER_PATTERN = /^(?:\d+|[A-Za-z]+)[.)]$/;
const DECIMAL_STYLES = new Set<OrderedListMarkerStyle>([
    'decimal-period',
    'decimal-one-paren'
]);

function isOrderedMarker(marker: string): boolean {
    return ORDERED_MARKER_PATTERN.test(marker);
}

function getIndentDepth(indent: string): number {
    const visualLength = Array.from(indent).reduce((length, character) => {
        return length + (character === INDENTATION.TAB ? INDENTATION.TAB_SIZE : 1);
    }, 0);

    return Math.floor(visualLength / INDENTATION.TAB_SIZE);
}

function isStyleAvailable(
    style: OrderedListMarkerStyle,
    settings: Partial<PandocExtendedMarkdownSettings>
): boolean {
    if (DECIMAL_STYLES.has(style)) {
        return true;
    }

    return isSyntaxFeatureEnabled(settings, 'enableFancyLists');
}

function getAvailableOrder(
    settings: Partial<PandocExtendedMarkdownSettings>
): OrderedListMarkerStyle[] {
    return normalizeOrderedListMarkerOrder(settings.orderedListMarkerOrder)
        .filter(style => isStyleAvailable(style, settings));
}

export function getOrderedMarkerForIndent(
    marker: string,
    indent: string,
    settings: Partial<PandocExtendedMarkdownSettings>
): string {
    if (!isOrderedMarker(marker)) {
        return marker;
    }

    if (!isSyntaxFeatureEnabled(settings, 'enableOrderedListMarkerCycling')) {
        return marker;
    }

    const order = getAvailableOrder(settings);
    if (order.length === 0) {
        return marker;
    }

    return createMarker(order[getIndentDepth(indent) % order.length]);
}

function createMarker(style: OrderedListMarkerStyle): string {
    switch (style) {
        case 'decimal-period':
            return '1.';
        case 'decimal-one-paren':
            return '1)';
        case 'lower-alpha-period':
            return 'a.';
        case 'lower-alpha-one-paren':
            return 'a)';
        case 'lower-roman-period':
            return 'i.';
        case 'lower-roman-one-paren':
            return 'i)';
        case 'upper-alpha-period':
            return 'A.';
        case 'upper-alpha-one-paren':
            return 'A)';
        case 'upper-roman-period':
            return 'I.';
        case 'upper-roman-one-paren':
            return 'I)';
    }
}
