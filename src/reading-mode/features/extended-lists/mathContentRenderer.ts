import { finishRenderMath, renderMath } from 'obsidian';

import { splitMathSegments } from '../../../shared/utils/mathSegments';

export function appendMathContent(
    element: HTMLElement,
    content: string,
    appendText: (text: string) => void
): boolean {
    if (!shouldRenderMathContent(element, content)) {
        return false;
    }

    const segments = splitMathSegments(content);
    if (!segments.some(segment => segment.type === 'math' && segment.closed)) {
        return false;
    }

    segments.forEach(segment => {
        if (segment.type === 'text' || !segment.closed) {
            appendText(segment.type === 'text' ? segment.content : segment.raw);
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
