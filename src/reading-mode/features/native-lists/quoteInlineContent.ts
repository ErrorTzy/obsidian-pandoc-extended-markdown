interface TextPosition {
    node: Text;
    offset: number;
}

interface QuoteInsertion extends TextPosition {
    text: string;
}

/** Restore literal quote prefixes without replacing any rendered inline node.
 * The expected rendering must differ only by added `>` characters. */
export function restoreLiteralQuotePrefixes(paragraph: HTMLElement, expectedText: string): boolean {
    const positions: TextPosition[] = [];
    let actual = '';
    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        for (let offset = 0; offset < node.length; offset++) {
            if (!/\s/.test(node.data[offset])) {
                actual += node.data[offset];
                positions.push({ node, offset });
            }
        }
    }
    const desired = expectedText.replace(/\s/g, '');
    const insertions: QuoteInsertion[] = [];
    let desiredIndex = 0;
    for (let index = 0; index < actual.length; index++) {
        let prefix = '';
        while (desired[desiredIndex] !== actual[index]) {
            if (desired[desiredIndex++] !== '>') {
                return false;
            }
            prefix += '> ';
        }
        if (prefix) {
            insertions.push({ ...positions[index], text: prefix });
        }
        desiredIndex++;
    }
    const suffix = desired.slice(desiredIndex);
    if (suffix && !/^>+$/.test(suffix)) {
        return false;
    }

    // Apply only after the entire source/DOM comparison has succeeded.
    for (const insertion of insertions.reverse()) {
        insertAtInlineBoundary(paragraph, insertion);
    }
    if (suffix) {
        paragraph.appendChild(document.createTextNode(` ${suffix.split('').join(' ')}`));
    }
    return true;
}

function insertAtInlineBoundary(paragraph: HTMLElement, insertion: QuoteInsertion): void {
    const { node, offset, text } = insertion;
    let before: Node = node;
    if (offset === 0) {
        while (before.parentNode !== paragraph && before.parentNode &&
            before.previousSibling === null) {
            before = before.parentNode;
        }
    } else {
        before = node.splitText(offset);
    }
    before.parentNode?.insertBefore(document.createTextNode(` ${text}`), before);
}
