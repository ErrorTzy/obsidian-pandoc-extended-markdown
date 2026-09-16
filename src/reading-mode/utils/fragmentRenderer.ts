import { App, MarkdownRenderChild, MarkdownRenderer } from 'obsidian';

import { getPandocContainerContent } from '../../shared/utils/pandocListMarkers';
import { ListBlockValidator } from '../../shared/utils/listBlockValidator';
import { readFullSourceText } from '../pipeline/sourceText';
import { ReadingModeContext } from '../pipeline/types';

const documentReferences = new WeakMap<ReadingModeContext, Promise<string>>();
const INTERNAL_MARKDOWN_FRAGMENT_ATTRIBUTE = 'data-pem-internal-markdown-fragment';

/** Return whether an Obsidian postprocessor target belongs to our own fragment render. */
export function isInternalMarkdownFragment(element: Element): boolean {
    return element.closest(`[${INTERNAL_MARKDOWN_FRAGMENT_ATTRIBUTE}]`) !== null;
}

/** Render a source fragment with the document's non-rendering link definitions. */
export async function renderMarkdownFragment(
    source: string,
    target: HTMLElement,
    context: ReadingModeContext,
    child: MarkdownRenderChild
): Promise<void> {
    markInternalMarkdownFragment(target);
    let references = documentReferences.get(context);
    if (!references) {
        references = prepareDocumentReferences(context);
        documentReferences.set(context, references);
    }
    const definitions = await references;
    // Document definitions come first, retaining normal first-definition wins
    // behavior even when the fragment contains a later duplicate definition.
    const sourceWithContext = definitions ? `${definitions}\n\n${source}` : source;
    await MarkdownRenderer.render(context.app as App, sourceWithContext, target, context.sourcePath, child);
}

async function prepareDocumentReferences(context: ReadingModeContext): Promise<string> {
    const source = context.fullSource ??
        await readFullSourceText(context.sourcePath, context.app) ??
        context.sectionInfo?.text ?? context.validationLines.join('\n');
    const analysis = ListBlockValidator.analyzeListBlocks(source.split('\n'), context.config);
    const candidates = analysis.referenceDefinitionRanges.map(range => analysis.sourceLines
        .slice(range.startIndex, range.endIndex + 1).map(getPandocContainerContent).join('\n'));
    const accepted: string[] = [];
    for (const candidate of candidates) {
        if (await isNonRenderingDefinition(candidate, context)) {
            accepted.push(candidate);
        }
    }
    return accepted.join('\n\n');
}

async function isNonRenderingDefinition(source: string, context: ReadingModeContext): Promise<boolean> {
    const target = document.createElement('div');
    markInternalMarkdownFragment(target);
    const child = new MarkdownRenderChild(target);
    child.load();
    try {
        // The shared parser supplies complete source ranges. The host renderer
        // remains authoritative for its reference grammar: Pandoc-only forms
        // which Obsidian renders as visible text must not leak into fragments.
        await MarkdownRenderer.render(context.app as App, source, target, context.sourcePath, child);
        return target.childElementCount === 0 && !target.textContent?.trim();
    } catch {
        return false;
    } finally {
        child.unload();
    }
}

function markInternalMarkdownFragment(element: HTMLElement): void {
    element.setAttribute(INTERNAL_MARKDOWN_FRAGMENT_ATTRIBUTE, '');
}
