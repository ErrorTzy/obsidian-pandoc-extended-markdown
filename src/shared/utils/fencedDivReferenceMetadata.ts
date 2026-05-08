import { FencedDivAttributes, FencedDivReference } from '../types/fencedDivTypes';

const DEFAULT_TYPE_LABEL = 'Div';

export interface FencedDivReferenceMetadata {
    title: string;
    typeLabel: string;
    typeKey: string;
    number: number;
    referenceText: string;
}

export type FencedDivTypeCounters = Map<string, number>;

export function createFencedDivReference(
    label: string,
    title: string,
    classes: string[],
    lineNumber: number,
    content: string,
    counters: FencedDivTypeCounters
): FencedDivReference {
    const metadata = createFencedDivReferenceMetadata(title, classes, counters);

    return {
        label,
        title: metadata.title,
        displayName: metadata.referenceText,
        typeLabel: metadata.typeLabel,
        typeKey: metadata.typeKey,
        number: metadata.number,
        referenceText: metadata.referenceText,
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
    const typeLabel = getFencedDivTypeLabel(normalizedTitle, classes);
    const typeKey = getFencedDivTypeKey(typeLabel);
    const number = (counters.get(typeKey) || 0) + 1;
    counters.set(typeKey, number);

    return {
        title: normalizedTitle,
        typeLabel,
        typeKey,
        number,
        referenceText: `${typeLabel} ${number}`
    };
}

export function getFencedDivTitle(attributes: FencedDivAttributes): string {
    return normalizeTitle(attributes.keyValues.get('title'));
}

export function getFencedDivTypeLabel(title: string, classes: string[]): string {
    if (title) {
        return title;
    }

    const firstClass = classes[0];
    if (!firstClass) {
        return DEFAULT_TYPE_LABEL;
    }

    return humanizeClassName(firstClass) || DEFAULT_TYPE_LABEL;
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
    const counters = new Map<string, number>();

    for (const reference of references) {
        const current = counters.get(reference.typeKey) || 0;
        counters.set(reference.typeKey, Math.max(current, reference.number));
    }

    return counters;
}

function normalizeTitle(title: string | undefined): string {
    return (title || '').trim();
}

function humanizeClassName(className: string): string {
    return className
        .replace(/[_:.-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, char => char.toUpperCase());
}
