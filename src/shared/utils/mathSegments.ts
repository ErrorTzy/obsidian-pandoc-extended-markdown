export type MathDelimiter = '$' | '$$';

export interface TextMathSegment {
    type: 'text';
    content: string;
}

export interface LatexMathSegment {
    type: 'math';
    delimiter: MathDelimiter;
    raw: string;
    content: string;
    display: boolean;
    closed: boolean;
}

export type MarkdownMathSegment = TextMathSegment | LatexMathSegment;

export function splitMathSegments(content: string): MarkdownMathSegment[] {
    const segments: MarkdownMathSegment[] = [];
    let textStart = 0;
    let index = 0;

    while (index < content.length) {
        const delimiter = getMathDelimiterAt(content, index);
        if (!delimiter) {
            index++;
            continue;
        }

        appendTextSegment(segments, content, textStart, index);
        const contentStart = index + delimiter.length;
        const closingIndex = findClosingMathDelimiter(content, contentStart, delimiter);
        const contentEnd = closingIndex ?? content.length;
        const rawEnd = closingIndex === undefined
            ? content.length
            : closingIndex + delimiter.length;
        segments.push({
            type: 'math',
            delimiter,
            raw: content.slice(index, rawEnd),
            content: content.slice(contentStart, contentEnd).trimEnd(),
            display: delimiter === '$$',
            closed: closingIndex !== undefined
        });
        index = rawEnd;
        textStart = index;
    }

    appendTextSegment(segments, content, textStart, content.length);
    return segments;
}

function appendTextSegment(
    segments: MarkdownMathSegment[],
    content: string,
    start: number,
    end: number
): void {
    if (end > start) {
        segments.push({ type: 'text', content: content.slice(start, end) });
    }
}

function getMathDelimiterAt(content: string, index: number): MathDelimiter | null {
    if (content[index] !== '$' || isEscaped(content, index)) {
        return null;
    }

    return content[index + 1] === '$' ? '$$' : '$';
}

function findClosingMathDelimiter(
    content: string,
    start: number,
    delimiter: MathDelimiter
): number | undefined {
    for (let index = start; index < content.length; index++) {
        if (isEscaped(content, index)) continue;
        if (delimiter === '$$' && content.startsWith('$$', index)) return index;
        if (delimiter === '$' && isSingleDollarDelimiter(content, index)) return index;
    }

    return undefined;
}

function isSingleDollarDelimiter(content: string, index: number): boolean {
    return content[index] === '$' &&
        content[index - 1] !== '$' &&
        content[index + 1] !== '$';
}

function isEscaped(content: string, index: number): boolean {
    let slashCount = 0;
    for (let current = index - 1; current >= 0 && content[current] === '\\'; current--) {
        slashCount++;
    }

    return slashCount % 2 === 1;
}
