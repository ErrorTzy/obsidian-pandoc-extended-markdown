export interface FootnotePanelItem {
    label: string;
    content: string;
    definitionLine: number;
    definitionPosition: { line: number; ch: number };
    referenceLine: number | null;
    referencePosition: { line: number; ch: number } | null;
    referenceLength: number | null;
}
