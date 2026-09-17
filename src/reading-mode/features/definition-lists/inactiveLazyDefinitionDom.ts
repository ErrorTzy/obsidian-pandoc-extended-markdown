import {
    type DefinitionDomSignature,
    isDefinitionBlockContentElement,
    normalizeCandidateText
} from './definitionSignature';
import {
    getTextFromNodes,
    matchesDefinitionDescriptions
} from './definitionTextMatcher';
import {
    type PandocDefinitionDescription,
    parseMarkdownListItem,
    trimOuterBlankLines
} from './sourceParser';

interface ParagraphSplitBoundary {
    nodeIndex: number;
    textOffset?: number;
}

export interface InactiveDefinitionMarkerPlan {
    block: HTMLElement;
    paragraph: HTMLElement;
    movableNodes: Node[];
}

export function createInactiveDefinitionMarkerPlan(
    renderedDefinition: HTMLElement,
    sourceDefinition: PandocDefinitionDescription,
    definitionContainerDepth: number
): InactiveDefinitionMarkerPlan | null {
    const paragraph = renderedDefinition.ownerDocument.createElement('p');
    paragraph.setAttribute('dir', 'auto');
    const inlineNodes = getInlineContentNodes(renderedDefinition, true);
    const listItemPlan = inlineNodes
        ? null
        : getSourceOwnedListItemContent(renderedDefinition, sourceDefinition);
    if (!inlineNodes && !listItemPlan) {
        return null;
    }
    const movableNodes = inlineNodes ?? listItemPlan?.nodes ?? [];
    const hasContent = sourceDefinition.lines.some(line => line.trim().length > 0);
    const prefix = listItemPlan?.prefix ??
        (hasContent ? `${sourceDefinition.marker} ` : sourceDefinition.marker);
    paragraph.appendChild(renderedDefinition.ownerDocument.createTextNode(prefix));

    if (definitionContainerDepth > 0) {
        return { block: paragraph, paragraph, movableNodes };
    }
    const wrapper = renderedDefinition.ownerDocument.createElement('div');
    wrapper.className = 'el-p';
    wrapper.appendChild(paragraph);
    return { block: wrapper, paragraph, movableNodes };
}

function getSourceOwnedListItemContent(
    renderedDefinition: HTMLElement,
    sourceDefinition: PandocDefinitionDescription
): { prefix: string, nodes: Node[] } | null {
    const lines = trimOuterBlankLines(sourceDefinition.lines);
    if (lines.length !== 1) {
        return null;
    }
    const sourceItem = parseMarkdownListItem(lines[0]);
    const marker = lines[0].match(/^((?:[-+*]|\d+[.)])[ \t]+)/)?.[1];
    if (!sourceItem || sourceItem.checked !== undefined || !marker) {
        return null;
    }

    const list = getOnlyMeaningfulElementChild(
        renderedDefinition,
        sourceItem.ordered ? 'OL' : 'UL'
    );
    const item = list && list.children.length === 1 && list.children[0].tagName === 'LI'
        ? list.children[0] as HTMLElement
        : null;
    const nodes = item ? getInlineContentNodes(item, false) : null;
    if (!nodes) {
        return null;
    }
    return {
        prefix: `${sourceDefinition.marker} ${marker}`,
        nodes
    };
}

function getOnlyMeaningfulElementChild(
    parent: HTMLElement,
    tagName: string
): HTMLElement | null {
    const meaningful = Array.from(parent.childNodes).filter(node =>
        node.nodeType !== Node.TEXT_NODE || (node.textContent ?? '').trim().length > 0
    );
    return meaningful.length === 1 && isHtmlElement(meaningful[0]) &&
        meaningful[0].tagName === tagName
        ? meaningful[0]
        : null;
}

export function getInlineContentNodes(
    element: HTMLElement,
    unwrapParagraph: boolean
): Node[] | null {
    const children = Array.from(element.childNodes);
    const meaningfulChildren = children.filter(node =>
        node.nodeType !== Node.TEXT_NODE || (node.textContent ?? '').trim().length > 0
    );
    const contentNodes = unwrapParagraph && meaningfulChildren.length === 1 &&
        isHtmlElement(meaningfulChildren[0]) && meaningfulChildren[0].tagName === 'P'
        ? Array.from(meaningfulChildren[0].childNodes)
        : children;
    return contentNodes.every(isInlineContentNode) ? contentNodes : null;
}

function isInlineContentNode(node: Node): boolean {
    if (!isHtmlElement(node)) {
        return true;
    }
    return !isDefinitionBlockContentElement(node) &&
        Array.from(node.childNodes).every(isInlineContentNode);
}

export function getColdListReplacementTarget(list: HTMLElement): HTMLElement | null {
    const parent = list.parentElement;
    if (!parent) {
        return null;
    }
    if (parent.tagName !== 'P') {
        return parent.tagName === 'BLOCKQUOTE' || parent.tagName === 'DIV' ? list : null;
    }
    return hasOnlyWhitespaceSiblings(parent, list) ? parent : null;
}

function hasOnlyWhitespaceSiblings(parent: HTMLElement, child: HTMLElement): boolean {
    return Array.from(parent.childNodes).every(node =>
        node === child ||
        (node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim().length === 0)
    );
}

export function hasNestedListContainer(
    list: HTMLElement,
    layout: HTMLElement | null
): boolean {
    let current = list.parentElement;
    while (current && current !== layout) {
        if (current.matches('li, dt, dd, dl, ol, ul')) {
            return true;
        }
        current = current.parentElement;
    }
    return !current;
}

export function preflightInactiveDefinitionSplit(
    list: HTMLElement,
    replacementTarget: HTMLElement,
    markerContainer: HTMLElement,
    layout: HTMLElement,
    termNodes: Node[],
    definitions: HTMLElement[],
    markerPlans: InactiveDefinitionMarkerPlan[]
): boolean {
    if (!replacementTarget.parentNode || layout.parentNode !== markerContainer ||
        (!replacementTarget.contains(list) && replacementTarget !== list)) {
        return false;
    }
    if (termNodes.some(node => !list.contains(node))) {
        return false;
    }
    return markerPlans.every((plan, index) =>
        plan.movableNodes.every(node => definitions[index]?.contains(node))
    );
}

function isHtmlElement(node: Node): node is HTMLElement {
    return node.nodeType === Node.ELEMENT_NODE;
}

export function findParagraphSplitBoundary(
    nodes: Node[],
    signature: DefinitionDomSignature
): ParagraphSplitBoundary | null {
    for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
        const node = nodes[nodeIndex];
        if (node.nodeName === 'BR' && matchesParagraphSplit(
            getTextFromNodes(nodes.slice(0, nodeIndex)),
            getTextFromNodes(nodes.slice(nodeIndex + 1)),
            signature
        )) {
            return { nodeIndex };
        }
        if (node.nodeType !== Node.TEXT_NODE) {
            continue;
        }
        const text = node.textContent ?? '';
        for (let textOffset = 0; textOffset < text.length; textOffset++) {
            if (text[textOffset] !== '\n') {
                continue;
            }
            const before = getTextFromNodes(nodes.slice(0, nodeIndex)) +
                text.slice(0, textOffset);
            const after = text.slice(textOffset + 1) +
                getTextFromNodes(nodes.slice(nodeIndex + 1));
            if (matchesParagraphSplit(before, after, signature)) {
                return { nodeIndex, textOffset };
            }
        }
    }
    return null;
}

function matchesParagraphSplit(
    before: string,
    after: string,
    signature: DefinitionDomSignature
): boolean {
    return signature.termTexts.length === 1 &&
        normalizeCandidateText(before) === normalizeCandidateText(signature.termTexts[0]) &&
        matchesDefinitionDescriptions(after, signature.definitionTexts);
}

export function detachMarkerNodes(nodes: Node[], boundary: ParagraphSplitBoundary): Node[] {
    const node = nodes[boundary.nodeIndex];
    if (boundary.textOffset === undefined) {
        node.parentNode?.removeChild(node);
        return nodes.slice(boundary.nodeIndex + 1);
    }

    const text = node as Text;
    const markerText = text.splitText(boundary.textOffset + 1);
    text.deleteData(boundary.textOffset, 1);
    if (text.data.length === 0) {
        text.remove();
    }
    return [markerText, ...nodes.slice(boundary.nodeIndex + 1)];
}
