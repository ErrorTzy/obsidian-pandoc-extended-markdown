import { MarkdownRenderChild, MarkdownRenderer } from 'obsidian';

import { isFencedDivClosing, parseFencedDivOpening } from '../../../live-preview/pipeline/structural/fencedDiv/parser';
import { parsePandocListMarker } from '../../../shared/utils/pandocListMarkers';
import { ReadingModeContext } from '../../pipeline/types';
import { renderMarkdownFragment } from '../../utils/fragmentRenderer';

import { getRenderedListSignature, inspectCapturedListClosing } from './capturedListClosing';
import { CapturedListClosingSignatures } from './types';

/**
 * Render full candidate prefixes only for closings actually captured in this
 * preview. Matching uses the host renderer, including its inline extensions;
 * links, code and other inline syntax are never guessed from source regexes.
 */
export async function prepareCapturedListClosingSignatures(
    root: HTMLElement,
    sourceText: string,
    context: ReadingModeContext,
    isCurrent: () => boolean
): Promise<CapturedListClosingSignatures> {
    const signatures: CapturedListClosingSignatures = new Map();
    const captures = Array.from(root.querySelectorAll('ul, ol'))
        .filter(list => !list.parentElement?.closest('ul, ol'))
        .flatMap(list => {
            const capture = inspectCapturedListClosing(list);
            return capture ? [capture] : [];
        });
    if (!captures.length || !context.app || typeof MarkdownRenderer?.render !== 'function') {
        return signatures;
    }

    const sourceLines = sourceText.split('\n');
    const renderCache = new Map<string, Promise<string | null>>();
    let candidateStarts: number[] = [];
    for (let index = 0; index < sourceLines.length && isCurrent(); index++) {
        const line = sourceLines[index];
        if (isFencedDivClosing(line)) {
            const targets = new Set(captures.filter(capture => capture.marker === line.trim())
                .map(capture => capture.signature));
            const matches = new Map<number, string>();
            for (const startIndex of candidateStarts) {
                if (!targets.size || !isCurrent()) {
                    break;
                }
                const source = sourceLines.slice(startIndex, index).join('\n');
                let rendered = renderCache.get(source);
                if (!rendered) {
                    rendered = renderSourceSignature(source, context);
                    renderCache.set(source, rendered);
                }
                const signature = await rendered;
                if (signature && targets.has(signature)) {
                    matches.set(startIndex, signature);
                    targets.delete(signature);
                }
            }
            signatures.set(index, matches);
            candidateStarts = [];
        } else if (parseFencedDivOpening(line, context.config)) {
            candidateStarts = [];
        } else if (parsePandocListMarker(line, true)) {
            candidateStarts.push(index);
        }
    }
    return signatures;
}

async function renderSourceSignature(source: string, context: ReadingModeContext): Promise<string | null> {
    const target = document.createElement('div');
    const child = new MarkdownRenderChild(target);
    child.load();
    try {
        await renderMarkdownFragment(source, target, context, child);
        return getRenderedListSignature(target);
    } catch {
        return null;
    } finally {
        child.unload();
    }
}
