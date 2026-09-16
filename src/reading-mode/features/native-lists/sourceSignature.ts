import { MarkdownRenderChild, MarkdownRenderer } from 'obsidian';

import { normalizeNativeListText } from './sourceLine';

import { ReadingModeContext } from '../../pipeline/types';
import { renderMarkdownFragment } from '../../utils/fragmentRenderer';

export async function renderNativeListLeadText(
    sourceLine: string,
    context: ReadingModeContext
): Promise<string | null> {
    return inspectRenderedMarkdown(sourceLine, context, target => {
        const list = target.querySelector<HTMLElement>('ul, ol');
        const item = list
            ? Array.from(list.children).find(
                (child): child is HTMLLIElement => child.tagName === 'LI'
            )
            : null;
        return item ? normalizeNativeListText(getNativeListItemLeadText(item)) : null;
    });
}

export async function renderParagraphText(
    source: string,
    context: ReadingModeContext
): Promise<string | null> {
    return inspectRenderedMarkdown(source, context, target => {
        const paragraphs = target.querySelectorAll('p');
        const paragraph = paragraphs.item(paragraphs.length - 1);
        return paragraph ? normalizeNativeListText(paragraph.textContent ?? '') : null;
    });
}

export async function renderBlockQuoteLeadText(
    source: string,
    context: ReadingModeContext
): Promise<string | null> {
    return inspectRenderedMarkdown(source, context, target => {
        const paragraph = target.querySelector('blockquote > p');
        return paragraph ? normalizeNativeListText(paragraph.textContent ?? '') : null;
    });
}

export function getNativeListItemLeadText(item: HTMLLIElement): string {
    const parts: string[] = [];

    for (const node of Array.from(item.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
            parts.push(node.textContent ?? '');
            continue;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) {
            continue;
        }
        const element = node as HTMLElement;
        if (element.matches('input')) {
            continue;
        }
        if (element.matches('br, ul, ol')) {
            break;
        }
        if (isBlockContainer(element)) {
            parts.push(getTextBeforeBreak(element));
            break;
        }
        parts.push(element.textContent ?? '');
    }

    return parts.join('');
}

async function inspectRenderedMarkdown<T>(
    source: string,
    context: ReadingModeContext,
    inspect: (target: HTMLElement) => T
): Promise<T> {
    const target = document.createElement('div');
    if (!context.app || typeof MarkdownRenderer?.render !== 'function') {
        return inspect(target);
    }

    const renderChild = new MarkdownRenderChild(target);
    renderChild.load();
    try {
        await renderMarkdownFragment(
            source,
            target,
            context,
            renderChild
        );
        return inspect(target);
    } finally {
        renderChild.unload();
    }
}

function getTextBeforeBreak(element: HTMLElement): string {
    const parts: string[] = [];
    for (const node of Array.from(element.childNodes)) {
        if (node.nodeType === Node.ELEMENT_NODE &&
            (node as HTMLElement).matches('br, ul, ol')) {
            break;
        }
        parts.push(node.textContent ?? '');
    }
    return parts.join('');
}

function isBlockContainer(element: HTMLElement): boolean {
    return element.matches('p, div, pre, blockquote, table');
}
