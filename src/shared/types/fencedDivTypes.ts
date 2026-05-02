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
    displayName: string;
    lineNumber: number;
    classes: string[];
    content: string;
}

export interface FencedDivStackItem {
    label?: string;
    classes: string[];
    openingLine: number;
    displayName?: string;
}
