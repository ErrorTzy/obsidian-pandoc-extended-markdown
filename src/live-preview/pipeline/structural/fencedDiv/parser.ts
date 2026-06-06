import { FencedDivAttributes } from '../../../../shared/types/fencedDivTypes';
import {
    getFencedDivTitleClass,
    isFencedDivControlClass,
    synthesizeFencedDivTitleFromClasses
} from '../../../../shared/utils/fencedDivReferenceMetadata';

const OPENING_FENCE = /^(:{3,})(.*)$/;
const CLOSING_FENCE = /^:{3,}[ \t]*$/;
const ATTRIBUTE_KEY = /^[A-Za-z:][A-Za-z0-9_:.-]*$/;
const ATTRIBUTE_ID = /^#[^\s@,=]+$/;
const ATTRIBUTE_CLASS = /^\.[\p{L}][\p{L}\p{N}_:.-]*$/u;
const TRAILING_COLONS = /^[ \t]*:+[ \t]*$/;
const TRAILING_VISUAL_COLONS = /[ \t]+:+[ \t]*$/;
const UNBRACED_CLASS = /^(\S+)(?:[ \t]+:+)?$/;
const READABLE_CLASS = /^[^\s#={},]+$/;
const HTML_BLOCK_TAGS = new Set([
    'address', 'article', 'aside', 'base', 'basefont', 'blockquote', 'body',
    'caption', 'center', 'col', 'colgroup', 'dd', 'details', 'dialog', 'dir',
    'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form',
    'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header',
    'hr', 'html', 'iframe', 'legend', 'li', 'link', 'main', 'menu', 'menuitem',
    'nav', 'noframes', 'ol', 'optgroup', 'option', 'p', 'param', 'search',
    'section', 'summary', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead',
    'title', 'tr', 'track', 'ul'
]);

interface ParsedAttributeTokens {
    id?: string;
    classes: string[];
    keyValues: Map<string, string>;
}

interface FencedDivParserSettings {
    enableReadableFencedDivSyntax?: boolean;
}

export function isFencedDivClosing(lineText: string): boolean {
    return CLOSING_FENCE.test(lineText);
}

export function allowsFencedDivOpeningAfterLine(lineText: string): boolean {
    const trimmedLine = lineText.trim();
    if (!trimmedLine) {
        return true;
    }

    return isAtxHeading(trimmedLine) ||
        isThematicBreak(trimmedLine) ||
        isSingleLineHtmlBlock(trimmedLine);
}

export function parseFencedDivOpening(
    lineText: string,
    settings?: FencedDivParserSettings
): FencedDivAttributes | null {
    const openingMatch = lineText.match(OPENING_FENCE);
    if (!openingMatch) {
        return null;
    }

    const fence = openingMatch[1] || '';
    const rawAttributes = (openingMatch[2] || '').trim();
    if (!rawAttributes) {
        return null;
    }

    const parsedAttributes = parseOpeningAttributes(
        rawAttributes,
        openingMatch[2] || '',
        settings
    );
    if (!parsedAttributes) {
        return null;
    }

    return {
        indent: '',
        fence,
        rawAttributes,
        markerText: `${fence}${openingMatch[2] || ''}`,
        ...parsedAttributes
    };
}

function parseOpeningAttributes(
    rawAttributes: string,
    rawTextAfterFence: string,
    settings?: FencedDivParserSettings
): ParsedAttributeTokens | null {
    if (rawAttributes.startsWith('{')) {
        return parseBracedAttributes(rawAttributes) ||
            parseReadableBracedTitleAfterAttributes(rawAttributes, rawTextAfterFence, settings);
    }

    if (settings?.enableReadableFencedDivSyntax !== false && /^[ \t]+/.test(rawTextAfterFence)) {
        return parseReadableBracedTitleBeforeAttributes(rawAttributes) ||
            parseReadableShorthandAttributes(rawAttributes) ||
            parseUnbracedAttributes(rawAttributes);
    }

    return parseUnbracedAttributes(rawAttributes);
}

function isAtxHeading(lineText: string): boolean {
    return /^#{1,6}(?:[ \t]+|$)/.test(lineText);
}

function isThematicBreak(lineText: string): boolean {
    return /^(?:\*[ \t]*){3,}$/.test(lineText) ||
        /^(?:-[ \t]*){3,}$/.test(lineText) ||
        /^(?:_[ \t]*){3,}$/.test(lineText);
}

function isSingleLineHtmlBlock(lineText: string): boolean {
    const match = lineText.match(/^<([A-Za-z][A-Za-z0-9-]*)(?:\s[^>]*)?>.*<\/\1>$/);
    return Boolean(match?.[1] && HTML_BLOCK_TAGS.has(match[1].toLowerCase()));
}

export function getFencedDivCssClass(classes: string[]): string | undefined {
    const primaryClass = getFencedDivTitleClass(classes);
    if (!primaryClass) {
        return undefined;
    }

    return normalizeFencedDivCssClass(primaryClass);
}

export function getFencedDivCssClasses(classes: string[]): string[] {
    const cssClasses: string[] = [];
    const seen = new Set<string>();

    for (const className of classes) {
        if (isFencedDivControlClass(className)) {
            continue;
        }

        const cssClass = normalizeFencedDivCssClass(className);
        if (!cssClass || seen.has(cssClass)) {
            continue;
        }

        seen.add(cssClass);
        cssClasses.push(cssClass);
    }

    return cssClasses;
}

function normalizeFencedDivCssClass(className: string): string | undefined {
    return className
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || undefined;
}

function parseBracedAttributes(rawAttributes: string): ParsedAttributeTokens | null {
    const closingBraceIndex = findClosingBrace(rawAttributes);
    if (closingBraceIndex < 0) {
        return null;
    }

    const trailingText = rawAttributes.slice(closingBraceIndex + 1);
    if (trailingText && !TRAILING_COLONS.test(trailingText)) {
        return null;
    }

    const bracedAttributeText = rawAttributes.slice(0, closingBraceIndex + 1);
    const content = rawAttributes.slice(1, closingBraceIndex);
    const tokens = splitAttributeTokens(content);
    if (!tokens) {
        return null;
    }

    const parsedTokens = parseAttributeTokens(tokens);
    if (parsedTokens) {
        return parsedTokens;
    }

    return tokens.length === 1
        ? createUnbracedClass(bracedAttributeText)
        : null;
}

function parseReadableBracedTitleAfterAttributes(
    rawAttributes: string,
    rawTextAfterFence: string,
    settings?: FencedDivParserSettings
): ParsedAttributeTokens | null {
    if (settings?.enableReadableFencedDivSyntax === false || !/^[ \t]+/.test(rawTextAfterFence)) {
        return null;
    }

    const closingBraceIndex = findClosingBrace(rawAttributes);
    if (closingBraceIndex < 0) {
        return null;
    }

    const title = stripTrailingVisualColons(rawAttributes.slice(closingBraceIndex + 1)).trim();
    if (!title) {
        return null;
    }

    const parsedAttributes = parseBracedAttributeSlice(rawAttributes, 0, closingBraceIndex);
    return parsedAttributes
        ? withTitle(parsedAttributes, title)
        : null;
}

function parseReadableBracedTitleBeforeAttributes(rawAttributes: string): ParsedAttributeTokens | null {
    const attributeText = stripTrailingVisualColons(rawAttributes).trim();
    const closingBraceIndex = attributeText.length - 1;
    if (attributeText[closingBraceIndex] !== '}') {
        return null;
    }

    for (let index = 0; index < attributeText.length; index++) {
        if (attributeText[index] !== '{') {
            continue;
        }

        const localClosingBraceIndex = findClosingBrace(attributeText.slice(index));
        if (localClosingBraceIndex < 0 || index + localClosingBraceIndex !== closingBraceIndex) {
            continue;
        }

        const title = attributeText.slice(0, index).trim();
        if (!title) {
            return null;
        }

        const parsedAttributes = parseBracedAttributeSlice(
            attributeText,
            index,
            closingBraceIndex
        );
        return parsedAttributes
            ? withTitle(parsedAttributes, title)
            : null;
    }

    return null;
}

function parseBracedAttributeSlice(
    text: string,
    openingBraceIndex: number,
    closingBraceIndex: number
): ParsedAttributeTokens | null {
    const content = text.slice(openingBraceIndex + 1, closingBraceIndex);
    const tokens = splitAttributeTokens(content);
    return tokens
        ? parseAttributeTokens(tokens)
        : null;
}

function withTitle(attributes: ParsedAttributeTokens, title: string): ParsedAttributeTokens {
    attributes.keyValues.set('title', title);
    return attributes;
}

function parseUnbracedAttributes(rawAttributes: string): ParsedAttributeTokens | null {
    const unbracedMatch = rawAttributes.match(UNBRACED_CLASS);
    if (!unbracedMatch) {
        return null;
    }

    return createUnbracedClassWithTitle(unbracedMatch[1] || '');
}

function createUnbracedClass(className: string): ParsedAttributeTokens {
    return {
        classes: [className],
        keyValues: new Map()
    };
}

function createUnbracedClassWithTitle(className: string): ParsedAttributeTokens {
    const attributes = createUnbracedClass(className);
    attributes.keyValues = withSynthesizedTitle(attributes.keyValues, attributes.classes);
    return attributes;
}

function parseReadableShorthandAttributes(rawAttributes: string): ParsedAttributeTokens | null {
    const attributeText = rawAttributes.replace(TRAILING_VISUAL_COLONS, '').trim();
    if (!attributeText) {
        return null;
    }

    const tokens = splitAttributeTokens(attributeText);
    if (!tokens || tokens.length === 0) {
        return null;
    }

    const classes: string[] = [];
    const keyValues = new Map<string, string>();
    let id: string | undefined;

    for (const token of tokens) {
        if (ATTRIBUTE_ID.test(token)) {
            id = token.slice(1);
            continue;
        }

        if (token.includes('=')) {
            const parsedKeyValue = parseKeyValueToken(token);
            if (!parsedKeyValue) {
                return null;
            }
            keyValues.set(parsedKeyValue.key, parsedKeyValue.value);
            continue;
        }

        if (isReadableClassToken(token)) {
            classes.push(token);
            continue;
        }

        return null;
    }

    return {
        id,
        classes,
        keyValues: withSynthesizedTitle(keyValues, classes)
    };
}

function isReadableClassToken(token: string): boolean {
    return READABLE_CLASS.test(token) && !/^:+$/.test(token);
}

function stripTrailingVisualColons(text: string): string {
    return text.replace(TRAILING_VISUAL_COLONS, '');
}

function parseAttributeTokens(tokens: string[]): ParsedAttributeTokens | null {
    const classes: string[] = [];
    const keyValues = new Map<string, string>();
    let id: string | undefined;

    for (const token of tokens) {
        if (token === '') {
            continue;
        }

        if (token.startsWith('-')) {
            const parsedDashToken = parseDashToken(token);
            if (!parsedDashToken) {
                return null;
            }
            classes.push(...parsedDashToken.classes);
            for (const [key, value] of parsedDashToken.keyValues) {
                keyValues.set(key, value);
            }
            continue;
        }

        if (ATTRIBUTE_ID.test(token)) {
            id = token.slice(1);
            continue;
        }

        if (ATTRIBUTE_CLASS.test(token)) {
            classes.push(token.slice(1));
            continue;
        }

        if (token.includes('=')) {
            const parsedKeyValue = parseKeyValueToken(token);
            if (!parsedKeyValue) {
                return null;
            }
            keyValues.set(parsedKeyValue.key, parsedKeyValue.value);
            continue;
        }

        return null;
    }

    return {
        id,
        classes,
        keyValues: withSynthesizedTitle(keyValues, classes)
    };
}

function parseDashToken(token: string): ParsedAttributeTokens | null {
    if (/^-+$/.test(token)) {
        return {
            classes: Array.from({ length: token.length }, () => 'unnumbered'),
            keyValues: new Map()
        };
    }

    const dashKeyValueMatch = token.match(/^-([^=]+)=(.*)$/);
    if (!dashKeyValueMatch) {
        return null;
    }

    const key = dashKeyValueMatch[1] || '';
    if (!ATTRIBUTE_KEY.test(key)) {
        return null;
    }

    return {
        classes: ['unnumbered'],
        keyValues: new Map([[key, stripQuotes(dashKeyValueMatch[2] || '')]])
    };
}

function splitAttributeTokens(content: string): string[] | null {
    const tokens: string[] = [];
    let current = '';
    let quote: string | undefined;
    let escaped = false;

    for (const char of content.trim()) {
        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }

        if (char === '\\' && quote) {
            current += char;
            escaped = true;
            continue;
        }

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

    if (quote || escaped) {
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

function withSynthesizedTitle(
    keyValues: Map<string, string>,
    classes: string[]
): Map<string, string> {
    if (keyValues.has('title')) {
        return keyValues;
    }

    const title = synthesizeFencedDivTitleFromClasses(classes);
    if (title) {
        keyValues.set('title', title);
    }
    return keyValues;
}

function stripQuotes(value: string): string {
    if (value.length < 2) {
        return value;
    }

    const quote = value[0];
    if ((quote !== '"' && quote !== "'") || value[value.length - 1] !== quote) {
        return value;
    }

    let unquoted = '';
    const quotedValue = value.slice(1, -1);
    for (let index = 0; index < quotedValue.length; index++) {
        const char = quotedValue[index];

        if (char === '\\' && index + 1 < quotedValue.length) {
            unquoted += quotedValue[index + 1];
            index++;
            continue;
        }

        unquoted += char;
    }

    return unquoted;
}

function findClosingBrace(value: string): number {
    let quote: string | undefined;
    let escaped = false;

    for (let index = 0; index < value.length; index++) {
        const char = value[index];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (char === '\\' && quote) {
            escaped = true;
            continue;
        }

        if ((char === '"' || char === "'") && !quote) {
            quote = char;
            continue;
        }

        if (char === quote) {
            quote = undefined;
            continue;
        }

        if (char === '}' && !quote) {
            return index;
        }
    }

    return -1;
}
