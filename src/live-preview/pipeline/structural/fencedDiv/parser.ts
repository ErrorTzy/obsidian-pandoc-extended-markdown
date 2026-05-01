import { FencedDivAttributes } from '../../../../shared/types/fencedDivTypes';

const OPENING_FENCE = /^(\s*)(:{3,})(?:[ \t]+(.+?))[ \t]*$/;
const CLOSING_FENCE = /^\s*:{3,}\s*$/;
const BRACED_ATTRIBUTES = /^\{([^}]*)\}(?:[ \t]*:{3,})?$/;
const UNBRACED_CLASS = /^([^{}\s]+)(?:[ \t]+:{3,})?$/;
const ATTRIBUTE_KEY = /^[A-Za-z_:][A-Za-z0-9_:.-]*$/;

export function isFencedDivClosing(lineText: string): boolean {
    return CLOSING_FENCE.test(lineText);
}

export function parseFencedDivOpening(lineText: string): FencedDivAttributes | null {
    const openingMatch = lineText.match(OPENING_FENCE);
    if (!openingMatch) {
        return null;
    }

    const indent = openingMatch[1] || '';
    const fence = openingMatch[2] || '';
    const rawAttributes = openingMatch[3] || '';

    const bracedMatch = rawAttributes.match(BRACED_ATTRIBUTES);
    if (bracedMatch) {
        return parseBracedAttributes(indent, fence, rawAttributes, bracedMatch[1] || '');
    }

    const unbracedMatch = rawAttributes.match(UNBRACED_CLASS);
    if (!unbracedMatch || hasCommaOutsideQuotes(rawAttributes)) {
        return null;
    }

    return {
        indent,
        fence,
        rawAttributes,
        markerText: `${fence} ${rawAttributes}`,
        classes: [unbracedMatch[1]],
        keyValues: new Map()
    };
}

export function getFencedDivDisplayName(classes: string[]): string {
    const primaryClass = classes[0] || 'div';
    return primaryClass
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
}

export function getFencedDivCssClass(classes: string[]): string | undefined {
    const primaryClass = classes[0];
    if (!primaryClass) {
        return undefined;
    }

    return primaryClass
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || undefined;
}

function parseBracedAttributes(
    indent: string,
    fence: string,
    rawAttributes: string,
    content: string
): FencedDivAttributes | null {
    if (hasCommaOutsideQuotes(content)) {
        return null;
    }

    const tokens = splitAttributeTokens(content);
    if (!tokens) {
        return null;
    }

    const classes: string[] = [];
    const keyValues = new Map<string, string>();
    let id: string | undefined;

    for (const token of tokens) {
        if (token.startsWith('#') && token.length > 1) {
            id = token.slice(1);
        } else if (token.startsWith('.') && token.length > 1) {
            classes.push(token.slice(1));
        } else if (token.includes('=')) {
            const parsedKeyValue = parseKeyValueToken(token);
            if (!parsedKeyValue) {
                return null;
            }
            keyValues.set(parsedKeyValue.key, parsedKeyValue.value);
        } else if (token.length > 0) {
            return null;
        }
    }

    return {
        indent,
        fence,
        rawAttributes,
        markerText: `${fence} ${rawAttributes}`,
        id,
        classes,
        keyValues
    };
}

function splitAttributeTokens(content: string): string[] | null {
    const tokens: string[] = [];
    let current = '';
    let quote: string | undefined;

    for (const char of content.trim()) {
        if ((char === '"' || char === "'") && !quote) {
            quote = char;
            current += char;
            continue;
        }

        if (char === quote) {
            quote = undefined;
            current += char;
            continue;
        }

        if (/\s/.test(char) && !quote) {
            if (current) {
                tokens.push(current);
                current = '';
            }
            continue;
        }

        current += char;
    }

    if (quote) {
        return null;
    }

    if (current) {
        tokens.push(current);
    }

    return tokens;
}

function parseKeyValueToken(token: string): { key: string; value: string } | null {
    const separatorIndex = token.indexOf('=');
    const key = token.slice(0, separatorIndex);
    const rawValue = token.slice(separatorIndex + 1);

    if (!ATTRIBUTE_KEY.test(key)) {
        return null;
    }

    return {
        key,
        value: stripQuotes(rawValue)
    };
}

function stripQuotes(value: string): string {
    if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
    ) {
        return value.slice(1, -1);
    }

    return value;
}

function hasCommaOutsideQuotes(value: string): boolean {
    let quote: string | undefined;

    for (const char of value) {
        if ((char === '"' || char === "'") && !quote) {
            quote = char;
            continue;
        }

        if (char === quote) {
            quote = undefined;
            continue;
        }

        if (char === ',' && !quote) {
            return true;
        }
    }

    return false;
}
