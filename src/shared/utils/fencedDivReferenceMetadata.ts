import { FencedDivAttributes, FencedDivReference } from '../types/fencedDivTypes';

const DEFAULT_TYPE_LABEL = 'Div';
const NUMBER_PLACEHOLDER = '&';
const PLACEHOLDER_DOT_TOKEN = 'PEMPLACEHOLDERDOT';
const NUMBERING_ESCAPE_CLASSES = new Set(['no-num', 'unnumbered']);

interface PlaceholderGroup {
    start: number;
    end: number;
    depth: number;
}

export interface FencedDivReferenceMetadata {
    title: string;
    titleTemplate: string;
    typeLabel: string;
    typeKey: string;
    number: number;
    numberParts: number[];
    numberingEnabled: boolean;
    referenceText: string;
    blockTitleText: string;
}

export type FencedDivTypeCounters = Map<string, number[]>;

export function createFencedDivReference(
    label: string,
    title: string,
    classes: string[],
    lineNumber: number,
    content: string,
    counters: FencedDivTypeCounters
): FencedDivReference {
    const metadata = createFencedDivReferenceMetadata(title, classes, counters);

    return createFencedDivReferenceFromMetadata(
        label,
        classes,
        lineNumber,
        content,
        metadata
    );
}

export function createFencedDivReferenceFromMetadata(
    label: string,
    classes: string[],
    lineNumber: number,
    content: string,
    metadata: FencedDivReferenceMetadata
): FencedDivReference {
    return {
        label,
        title: metadata.title,
        titleTemplate: metadata.titleTemplate,
        displayName: metadata.referenceText,
        typeLabel: metadata.typeLabel,
        typeKey: metadata.typeKey,
        number: metadata.number,
        numberParts: metadata.numberParts,
        numberingEnabled: metadata.numberingEnabled,
        referenceText: metadata.referenceText,
        blockTitleText: metadata.blockTitleText,
        lineNumber,
        classes,
        content
    };
}

export function createFencedDivReferenceMetadata(
    title: string | undefined,
    classes: string[],
    counters: FencedDivTypeCounters
): FencedDivReferenceMetadata {
    const normalizedTitle = normalizeTitle(title);
    const titleTemplate = normalizedTitle;
    const numberingEnabled = shouldNumberFencedDivTitle(titleTemplate, classes);
    const typeLabel = numberingEnabled
        ? getFencedDivTypeLabel(getTitleStem(titleTemplate), classes)
        : getFencedDivTypeLabel(unescapeEscapedAmpersands(titleTemplate), classes);
    const typeKey = getFencedDivTypeKey(typeLabel);
    const numberParts = numberingEnabled
        ? advanceFencedDivCounter(counters, typeKey, findFirstPlaceholderGroup(titleTemplate)?.depth || 1)
        : [];
    const number = numberParts[numberParts.length - 1] || 0;
    const referenceText = numberingEnabled
        ? renderNumberedTitle(titleTemplate, numberParts)
        : typeLabel;
    const blockTitleText = shouldRenderFencedDivBlockTitle(normalizedTitle, classes)
        ? referenceText
        : '';

    return {
        title: normalizedTitle,
        titleTemplate,
        typeLabel,
        typeKey,
        number,
        numberParts,
        numberingEnabled,
        referenceText,
        blockTitleText
    };
}

export function getFencedDivTitle(attributes: FencedDivAttributes): string {
    return normalizeTitle(attributes.keyValues.get('title'));
}

export function getFencedDivTypeLabel(title: string, classes: string[]): string {
    if (title) {
        return title;
    }

    const firstClass = classes.find(className => !isFencedDivControlClass(className));
    if (!firstClass) {
        return DEFAULT_TYPE_LABEL;
    }

    return humanizeClassName(firstClass) || DEFAULT_TYPE_LABEL;
}

export function getFencedDivTitleClass(classes: string[]): string | undefined {
    return classes.find(className => !isFencedDivControlClass(className));
}

export function isFencedDivControlClass(className: string): boolean {
    return isNumberingEscapeClass(className) || isPlaceholderOnlyTitle(humanizeClassName(className));
}

export function synthesizeFencedDivTitleFromClasses(classes: string[]): string {
    const titleClasses = classes.filter(className => !isNumberingEscapeClass(className));
    if (titleClasses.length === 0) {
        return '';
    }

    const titleParts = titleClasses.map(className => humanizeClassName(className));
    const placeholderIndex = titleParts.findIndex(part => Boolean(findFirstPlaceholderGroup(part)));
    if (placeholderIndex < 0) {
        return titleParts[0] || '';
    }

    if (!isPlaceholderOnlyTitle(titleParts[placeholderIndex] || '')) {
        return titleParts[placeholderIndex] || '';
    }

    const titleIndex = titleParts.findIndex(part => !isPlaceholderOnlyTitle(part));
    if (titleIndex < 0) {
        return titleParts[placeholderIndex] || '';
    }

    const placeholder = titleParts[placeholderIndex] || '';
    const title = titleParts[titleIndex] || '';
    return placeholderIndex < titleIndex
        ? `${placeholder} ${title}`
        : `${title} ${placeholder}`;
}

export function getFencedDivTypeKey(typeLabel: string): string {
    return typeLabel
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || DEFAULT_TYPE_LABEL.toLowerCase();
}

export function createFencedDivTypeCounters(
    references: Iterable<FencedDivReference>
): FencedDivTypeCounters {
    const counters: FencedDivTypeCounters = new Map();

    for (const reference of references) {
        const numberParts = reference.numberParts || [];
        if (!reference.numberingEnabled || numberParts.length === 0) {
            continue;
        }

        counters.set(reference.typeKey, [...numberParts]);
    }

    return counters;
}

function normalizeTitle(title: string | undefined): string {
    return (title || '').trim();
}

function shouldRenderFencedDivBlockTitle(title: string, classes: string[]): boolean {
    return Boolean(title || classes.some(className => !isFencedDivControlClass(className)));
}

function humanizeClassName(className: string): string {
    return preservePlaceholderDots(className)
        .replace(/[_:-]+/g, ' ')
        .replace(/\./g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(new RegExp(PLACEHOLDER_DOT_TOKEN, 'g'), '.')
        .replace(/\b\w/g, char => char.toUpperCase());
}

function shouldNumberFencedDivTitle(title: string, classes: string[]): boolean {
    return Boolean(findFirstPlaceholderGroup(title)) &&
        !classes.some(className => isNumberingEscapeClass(className));
}

function isNumberingEscapeClass(className: string): boolean {
    return NUMBERING_ESCAPE_CLASSES.has(className.toLowerCase());
}

function getTitleStem(title: string): string {
    const placeholderGroup = findFirstPlaceholderGroup(title);
    const stem = placeholderGroup
        ? `${title.slice(0, placeholderGroup.start)}${title.slice(placeholderGroup.end)}`
        : title;

    return unescapeEscapedAmpersands(stem)
        .replace(/[^\w\s]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function advanceFencedDivCounter(
    counters: FencedDivTypeCounters,
    typeKey: string,
    depth: number
): number[] {
    const currentParts = counters.get(typeKey) || [];
    const nextParts = currentParts.slice(0, depth);

    for (let index = 0; index < depth - 1; index++) {
        nextParts[index] = nextParts[index] || 1;
    }

    nextParts[depth - 1] = (nextParts[depth - 1] || 0) + 1;
    counters.set(typeKey, nextParts);

    return [...nextParts];
}

function renderNumberedTitle(title: string, numberParts: number[]): string {
    const placeholderGroup = findFirstPlaceholderGroup(title);
    if (!placeholderGroup) {
        return unescapeEscapedAmpersands(title);
    }

    let index = 0;
    const renderedGroup = title
        .slice(placeholderGroup.start, placeholderGroup.end)
        .replace(/&/g, () => String(numberParts[index++] || 0));
    return unescapeEscapedAmpersands(
        `${title.slice(0, placeholderGroup.start)}${renderedGroup}${title.slice(placeholderGroup.end)}`
    );
}

function preservePlaceholderDots(value: string): string {
    let result = '';
    for (let index = 0; index < value.length; index++) {
        const char = value[index];
        result += char === '.' &&
            value[index - 1] === NUMBER_PLACEHOLDER &&
            value[index + 1] === NUMBER_PLACEHOLDER
            ? PLACEHOLDER_DOT_TOKEN
            : char;
    }
    return result;
}

function isPlaceholderOnlyTitle(value: string): boolean {
    const placeholderGroup = findFirstPlaceholderGroup(value);
    return Boolean(placeholderGroup && placeholderGroup.start === 0 && placeholderGroup.end === value.length);
}

function findFirstPlaceholderGroup(value: string): PlaceholderGroup | undefined {
    let escaped = false;

    for (let index = 0; index < value.length; index++) {
        const char = value[index];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (char === '\\') {
            escaped = true;
            continue;
        }

        if (char !== NUMBER_PLACEHOLDER) {
            continue;
        }

        let end = index + 1;
        let depth = 1;
        while (
            value[end] === '.' &&
            value[end + 1] === NUMBER_PLACEHOLDER
        ) {
            depth++;
            end += 2;
        }

        return { start: index, end, depth };
    }

    return undefined;
}

function unescapeEscapedAmpersands(value: string): string {
    return value.replace(/\\&/g, '&');
}
