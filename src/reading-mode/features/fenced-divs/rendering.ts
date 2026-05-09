import { setTooltip } from 'obsidian';

import { CSS_CLASSES, DECORATION_STYLES } from '../../../core/constants';
import { pluginStateManager } from '../../../core/state/pluginStateManager';
import { FencedDivReference } from '../../../shared/types/fencedDivTypes';
import { processInlineTextNodes } from '../../pipeline/inline/textReplacementEngine';
import { FencedDivReferenceInlineProcessor } from '../../pipeline/inline/fencedDivReferenceInlineProcessor';
import { ReadingModeContext } from '../../pipeline/types';
import { getFencedDivCssClasses } from '../../../live-preview/pipeline/structural/fencedDiv/parser';
import {
    createFencedDivReference,
    createFencedDivTypeCounters
} from '../../../shared/utils/fencedDivReferenceMetadata';

const MAX_DEPTH_CLASS = 6;

export function createFencedDivElement(
    label: string | undefined,
    classes: string[],
    depth: number,
    title: string = '',
    blockTitleText: string = ''
): { block: HTMLElement, content: HTMLElement } {
    const block = document.createElement('div');
    const sourceClasses = getFencedDivSourceClasses(classes);
    const semanticClasses = getFencedDivCssClasses(classes)
        .map(className => `pem-fenced-div-${className}`);
    const depthClass = Math.min(depth, MAX_DEPTH_CLASS);
    block.className = [
        'pem-fenced-div',
        ...sourceClasses,
        depth > 1 ? 'pem-fenced-div-inner' : undefined,
        depth > 1 ? `pem-fenced-div-depth-${depthClass}` : undefined,
        ...semanticClasses
    ].filter(Boolean).join(' ');

    if (label) {
        block.dataset.pandocDivId = label;
    }
    if (classes.length > 0) {
        block.dataset.pandocDivClasses = classes.join(' ');
    }
    if (title) {
        block.setAttribute('title', title);
    }

    if (blockTitleText) {
        const titleElement = document.createElement('div');
        titleElement.className = CSS_CLASSES.FENCED_DIV_TITLE;
        titleElement.textContent = blockTitleText;
        if (label) {
            titleElement.dataset.pandocDivId = label;
            setTooltip(titleElement, `#${label}`, { delay: DECORATION_STYLES.TOOLTIP_DELAY_MS });
        }
        block.appendChild(titleElement);
    }

    const content = document.createElement('div');
    content.className = 'pem-fenced-div-content';

    block.appendChild(content);

    return { block, content };
}

export function hydrateRenderedFencedDivLabels(
    element: HTMLElement,
    labels: Map<string, FencedDivReference>
): void {
    const blocks = Array.from(element.querySelectorAll<HTMLElement>('.pem-fenced-div[data-pandoc-div-id]'));
    const typeCounters = createFencedDivTypeCounters(labels.values());
    for (const block of blocks) {
        const label = block.dataset.pandocDivId;
        if (!label) {
            continue;
        }

        const existing = labels.get(label);
        if (existing) {
            ensureFencedDivTitleElement(block, existing);
            continue;
        }

        const content = block.querySelector('.pem-fenced-div-content')?.textContent?.trim() ?? '';
        const reference = createFencedDivReference(
            label,
            block.getAttribute('title') || '',
            getRenderedFencedDivClasses(block),
            0,
            content,
            typeCounters
        );

        labels.set(label, reference);
        ensureFencedDivTitleElement(block, reference);
    }
}

export function processHydratedFencedDivReferences(
    element: HTMLElement,
    docPath: string
): void {
    const counters = pluginStateManager.getDocumentCounters(docPath);
    if (counters.fencedDivLabels.size === 0) {
        return;
    }

    processInlineTextNodes(
        element,
        {
            element,
            postProcessorContext: {} as ReadingModeContext['postProcessorContext'],
            section: element.closest<HTMLElement>('.markdown-preview-section'),
            sectionInfo: null,
            sourcePath: docPath,
            config: { strictLineBreaks: false, strictPandocMode: false, enableFencedDivs: true },
            renderContext: {},
            counters,
            validationLines: []
        },
        [new FencedDivReferenceInlineProcessor()]
    );
}

function getFencedDivSourceClasses(classes: string[]): string[] {
    const sourceClasses: string[] = [];
    const seen = new Set<string>();

    for (const className of classes) {
        if (!className || /\s/.test(className) || seen.has(className)) {
            continue;
        }

        seen.add(className);
        sourceClasses.push(className);
    }

    return sourceClasses;
}

function ensureFencedDivTitleElement(
    block: HTMLElement,
    reference: FencedDivReference
): void {
    if (!reference.blockTitleText) {
        return;
    }

    let titleElement = block.querySelector<HTMLElement>(':scope > .pem-fenced-div-title');
    if (!titleElement) {
        titleElement = document.createElement('div');
        titleElement.className = CSS_CLASSES.FENCED_DIV_TITLE;
        const content = block.querySelector(':scope > .pem-fenced-div-content');
        block.insertBefore(titleElement, content || block.firstChild);
    }

    titleElement.textContent = reference.blockTitleText;
    titleElement.dataset.pandocDivId = reference.label;
    setTooltip(titleElement, `#${reference.label}`, { delay: DECORATION_STYLES.TOOLTIP_DELAY_MS });
}

function getRenderedFencedDivClasses(block: HTMLElement): string[] {
    const storedClasses = block.dataset.pandocDivClasses?.split(/\s+/).filter(Boolean);
    if (storedClasses?.length) {
        return storedClasses;
    }

    return Array.from(block.classList)
        .filter(className =>
            className.startsWith('pem-fenced-div-') &&
            className !== 'pem-fenced-div-inner' &&
            !className.startsWith('pem-fenced-div-depth-')
        )
        .map(className => className.replace('pem-fenced-div-', ''));
}
