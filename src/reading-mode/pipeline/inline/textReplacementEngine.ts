import { CSS_CLASSES } from '../../../core/constants';

import { InlineTextMatch, InlineTextProcessor, ReadingModeContext } from '../types';

interface ProcessorMatch extends InlineTextMatch {
    processor: InlineTextProcessor;
}

const SKIP_SELECTOR = [
    'code',
    'pre',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    '.math',
    '.cm-math',
    'mjx-container',
    `.${CSS_CLASSES.EXAMPLE_REF}`,
    `.${CSS_CLASSES.EXAMPLE_LIST}`,
    `.${CSS_CLASSES.PANDOC_LIST_MARKER}`,
    `.${CSS_CLASSES.CUSTOM_LABEL_REFERENCE_PROCESSED}`,
    `.${CSS_CLASSES.FENCED_DIV_REFERENCE}`,
    `.${CSS_CLASSES.FENCED_DIV_HEADER}`,
    `.${CSS_CLASSES.SUPERSCRIPT}`,
    `.${CSS_CLASSES.SUBSCRIPT}`
].join(', ');

export function processInlineTextNodes(
    element: HTMLElement,
    context: ReadingModeContext,
    processors: InlineTextProcessor[]
): void {
    const activeProcessors = processors
        .filter(processor => processor.isEnabled?.(context) ?? true)
        .sort((a, b) => a.priority - b.priority);

    if (activeProcessors.length === 0) {
        return;
    }

    const nodes = collectTextNodes(element);
    for (const node of nodes) {
        replaceTextNodeMatches(node, context, activeProcessors);
    }
}

function collectTextNodes(element: HTMLElement): Text[] {
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {
                const parent = node.parentElement;
                if (!parent || parent.closest(SKIP_SELECTOR)) {
                    return NodeFilter.FILTER_REJECT;
                }

                return node.textContent
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_REJECT;
            }
        }
    );
    const nodes: Text[] = [];

    while (walker.nextNode()) {
        nodes.push(walker.currentNode as Text);
    }

    return nodes;
}

function replaceTextNodeMatches(
    node: Text,
    context: ReadingModeContext,
    processors: InlineTextProcessor[]
): void {
    const parent = node.parentNode;
    const text = node.textContent || '';
    if (!parent || text.length === 0) {
        return;
    }

    const matches = collectMatches(text, node, context, processors);
    if (matches.length === 0) {
        return;
    }

    const replacements: Node[] = [];
    let lastIndex = 0;

    for (const match of matches) {
        if (match.start > lastIndex) {
            replacements.push(document.createTextNode(text.substring(lastIndex, match.start)));
        }

        const replacement = match.processor.createReplacement(match, context);
        replacements.push(...(Array.isArray(replacement) ? replacement : [replacement]));
        lastIndex = match.end;
    }

    if (lastIndex < text.length) {
        replacements.push(document.createTextNode(text.substring(lastIndex)));
    }

    for (const replacement of replacements) {
        parent.insertBefore(replacement, node);
    }
    parent.removeChild(node);
}

function collectMatches(
    text: string,
    node: Text,
    context: ReadingModeContext,
    processors: InlineTextProcessor[]
): ProcessorMatch[] {
    const candidates = processors.flatMap(processor =>
        processor.findMatches(text, node, context)
            .filter(match => isValidMatch(match, text))
            .map(match => ({ ...match, processor }))
    );

    candidates.sort((a, b) =>
        a.start - b.start ||
        a.processor.priority - b.processor.priority ||
        (a.end - a.start) - (b.end - b.start) ||
        a.processor.name.localeCompare(b.processor.name)
    );

    const accepted: ProcessorMatch[] = [];
    let occupiedUntil = 0;
    for (const match of candidates) {
        if (match.start < occupiedUntil) {
            continue;
        }

        accepted.push(match);
        occupiedUntil = match.end;
    }

    return accepted;
}

function isValidMatch(match: InlineTextMatch, text: string): boolean {
    return Number.isInteger(match.start) &&
        Number.isInteger(match.end) &&
        match.start >= 0 &&
        match.end > match.start &&
        match.end <= text.length;
}
