import { CSS_CLASSES } from '../../core/constants';
import { ListPatterns } from '../../shared/patterns';
import { PlaceholderContext } from '../../shared/utils/placeholderProcessor';

export type CustomLabelReferenceAppender = (
    text: string,
    container: HTMLElement,
    placeholderContext?: PlaceholderContext
) => void;

export function processCustomLabelDefinitionParagraph(
    elem: HTMLParagraphElement,
    placeholderContext: PlaceholderContext | undefined,
    appendReferences: CustomLabelReferenceAppender
): boolean {
    const text = getTextWithLineBreaks(elem);
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const matches = lines.map(line => line.match(ListPatterns.CUSTOM_LABEL_LIST_WITH_CONTENT));

    if (matches.length === 0 || matches.some(match => match === null)) {
        return false;
    }

    const paragraphs = matches
        .map(match => match ? createCustomLabelParagraph(match, placeholderContext, appendReferences) : null)
        .filter((paragraph): paragraph is HTMLParagraphElement => paragraph !== null);

    if (elem.parentNode || paragraphs.length !== 1) {
        elem.replaceWith(...paragraphs);
    } else {
        elem.classList.add(CSS_CLASSES.CUSTOM_LABEL_ITEM);
        elem.replaceChildren(...Array.from(paragraphs[0].childNodes));
    }
    return true;
}

function createCustomLabelParagraph(
    match: RegExpMatchArray,
    placeholderContext: PlaceholderContext | undefined,
    appendReferences: CustomLabelReferenceAppender
): HTMLParagraphElement {
    const rawLabel = match[3];
    const content = match[5];
    const processedLabel = placeholderContext ? placeholderContext.processLabel(rawLabel) : rawLabel;
    const paragraph = document.createElement('p');
    const marker = document.createElement('span');
    const strong = document.createElement('strong');

    paragraph.className = CSS_CLASSES.CUSTOM_LABEL_ITEM;
    marker.className = CSS_CLASSES.PANDOC_LIST_MARKER;
    marker.textContent = `(${processedLabel})`;
    strong.appendChild(marker);
    paragraph.appendChild(strong);
    paragraph.appendChild(document.createTextNode('\t'));
    appendReferences(content, paragraph, placeholderContext);
    return paragraph;
}

function getTextWithLineBreaks(elem: Element): string {
    const parts: string[] = [];
    elem.childNodes.forEach(node => appendNodeText(node, parts));
    return parts.join('');
}

function appendNodeText(node: Node, parts: string[]): void {
    if (node.nodeName === 'BR') {
        parts.push('\n');
        return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.textContent || '');
        return;
    }

    if (node.nodeType === Node.ELEMENT_NODE && !isCodeElement(node as Element)) {
        node.childNodes.forEach(child => appendNodeText(child, parts));
    }
}

function isCodeElement(element: Element): boolean {
    return element.nodeName === 'CODE' || element.nodeName === 'PRE';
}
