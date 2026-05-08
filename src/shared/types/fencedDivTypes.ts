export interface FencedDivAttributes {
    indent: string;
    fence: string;
    rawAttributes: string;
    markerText: string;
    id?: string;
    classes: string[];
    keyValues: Map<string, string>;
}

export interface FencedDivReference {
    label: string;
    title: string;
    displayName: string;
    typeLabel: string;
    typeKey: string;
    number: number;
    referenceText: string;
    blockTitleText: string;
    lineNumber: number;
    classes: string[];
    content: string;
}

export interface FencedDivSuggestion {
    label: string;
    displayName: string;
    previewText: string;
    lineNumber: number;
}

export interface FencedDivStackItem {
    label?: string;
    classes: string[];
    openingLine: number;
    displayName?: string;
}
