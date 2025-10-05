import { ListPatterns } from '../patterns';
import { withErrorBoundary } from '../utils/errorHandler';
import { FootnotePanelItem } from '../types/footnoteTypes';

type EditorPosition = { line: number; ch: number };

interface FootnoteReferenceInfo {
    position: EditorPosition;
    length: number;
}

interface FootnoteParseResult {
    item: FootnotePanelItem;
    nextIndex: number;
}

export function extractFootnotes(content: string): FootnotePanelItem[] {
    return withErrorBoundary(() => {
        const lines = content.split('\n');
        const referencePositions = collectReferencePositions(lines);
        const items: FootnotePanelItem[] = [];

        let index = 0;
        while (index < lines.length) {
            const parseResult = parseFootnoteDefinition(lines, index);
            if (!parseResult) {
                index += 1;
                continue;
            }

            const { item, nextIndex } = parseResult;
            const referenceInfo = referencePositions.get(item.label);
            if (referenceInfo) {
                item.referenceLine = referenceInfo.position.line;
                item.referencePosition = referenceInfo.position;
                item.referenceLength = referenceInfo.length;
            }

            items.push(item);
            index = nextIndex;
        }

        return items;
    }, [], 'Extract footnotes');
}

function collectReferencePositions(lines: string[]): Map<string, FootnoteReferenceInfo> {
    const positions = new Map<string, FootnoteReferenceInfo>();

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex];
        if (ListPatterns.FOOTNOTE_DEFINITION.test(line)) {
            continue;
        }

        const referencePattern = new RegExp(ListPatterns.FOOTNOTE_REFERENCE.source, 'g');
        let match: RegExpExecArray | null;

        while ((match = referencePattern.exec(line)) !== null) {
            const label = match[1]?.trim();
            if (!label || positions.has(label)) {
                continue;
            }

            positions.set(label, {
                position: {
                    line: lineIndex,
                    ch: match.index
                },
                length: match[0]?.length ?? 0
            });
        }
    }

    return positions;
}

function parseFootnoteDefinition(lines: string[], startIndex: number): FootnoteParseResult | null {
    const line = lines[startIndex];
    const match = line.match(ListPatterns.FOOTNOTE_DEFINITION);

    if (!match) {
        return null;
    }

    const rawLabel = match[1]?.trim();
    if (!rawLabel) {
        return null;
    }

    const initialContent = match[2] ?? '';
    const builder = new FootnoteContentBuilder();

    if (initialContent.trim()) {
        builder.addText(initialContent.trim());
    }

    let nextIndex = startIndex + 1;
    while (nextIndex < lines.length) {
        const nextLine = lines[nextIndex];

        const continuationMatch = nextLine.match(ListPatterns.FOOTNOTE_CONTINUATION);
        if (continuationMatch) {
            const continuationText = continuationMatch[2]?.trim() ?? '';
            if (continuationText) {
                builder.addText(continuationText);
            } else {
                builder.addParagraphBreak();
            }
            nextIndex += 1;
            continue;
        }

        if (!nextLine.trim()) {
            const lookahead = nextIndex + 1 < lines.length ? lines[nextIndex + 1] : '';
            if (lookahead && ListPatterns.FOOTNOTE_CONTINUATION.test(lookahead)) {
                builder.addParagraphBreak();
                nextIndex += 1;
                continue;
            }
        }

        break;
    }

    const content = builder.build();
    const definitionPosition: EditorPosition = {
        line: startIndex,
        ch: Math.max(0, line.indexOf(match[0]))
    };

    const item: FootnotePanelItem = {
        label: rawLabel,
        content,
        definitionLine: startIndex,
        definitionPosition,
        referenceLine: null,
        referencePosition: null,
        referenceLength: null
    };

    return { item, nextIndex };
}

class FootnoteContentBuilder {
    private paragraphs: Array<string | null> = [];
    private current: string[] = [];

    addText(text: string): void {
        if (!text) {
            return;
        }
        this.current.push(text);
    }

    addParagraphBreak(): void {
        this.commitCurrentParagraph();
        const last = this.paragraphs[this.paragraphs.length - 1];
        if (last === null) {
            return;
        }
        this.paragraphs.push(null);
    }

    build(): string {
        this.commitCurrentParagraph();

        while (this.paragraphs.length > 0 && this.paragraphs[this.paragraphs.length - 1] === null) {
            this.paragraphs.pop();
        }

        if (this.paragraphs.length === 0) {
            return '';
        }

        let result = '';
        let appendedParagraphs = 0;
        let pendingBlank = false;

        for (const paragraph of this.paragraphs) {
            if (paragraph === null) {
                if (appendedParagraphs > 0) {
                    pendingBlank = true;
                }
                continue;
            }

            if (pendingBlank || appendedParagraphs > 0) {
                result += '\n\n';
                pendingBlank = false;
            }

            if (paragraph.length > 0) {
                result += paragraph;
                appendedParagraphs += 1;
            }
        }

        return result;
    }

    private commitCurrentParagraph(): void {
        if (this.current.length === 0) {
            return;
        }
        this.paragraphs.push(this.current.join(' '));
        this.current = [];
    }
}
