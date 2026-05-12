import { finishRenderMath, renderMath } from 'obsidian';

export interface MathSegment {
    type: 'text' | 'math';
    content: string;
    display: boolean;
}

export function appendMathContent(
    element: HTMLElement,
    content: string,
    appendText: (text: string) => void
): boolean {
    if (!shouldRenderMathContent(element, content)) {
        return false;
    }

    const segments = splitMathSegments(content);
    if (!segments.some(segment => segment.type === 'math')) {
        return false;
    }

    segments.forEach(segment => {
        if (segment.type === 'text') {
            appendText(segment.content);
            return;
        }

        element.appendChild(renderMath(segment.content, segment.display));
    });

    void finishRenderMath();
    return true;
}

function shouldRenderMathContent(element: HTMLElement, content: string): boolean {
    return element.nodeName !== 'CODE' && content.includes('$');
}

function splitMathSegments(content: string): MathSegment[] {
    const segments: MathSegment[] = [];
    let index = 0;

    while (index < content.length) {
        const start = content.indexOf('$', index);
        if (start === -1) {
            appendTextSegment(segments, content.slice(index));
            break;
        }

        const display = content[start + 1] === '$';
        const delimiterLength = display ? 2 : 1;
        const end = content.indexOf(display ? '$$' : '$', start + delimiterLength);

        if (end === -1) {
            appendTextSegment(segments, content.slice(index));
            break;
        }

        appendTextSegment(segments, content.slice(index, start));
        segments.push({
            type: 'math',
            content: content.slice(start + delimiterLength, end).trim(),
            display
        });
        index = end + delimiterLength;
    }

    return segments;
}

function appendTextSegment(segments: MathSegment[], content: string): void {
    if (content.length === 0) {
        return;
    }

    segments.push({
        type: 'text',
        content,
        display: false
    });
}
