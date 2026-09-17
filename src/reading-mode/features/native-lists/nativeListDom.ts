/** Return the Obsidian layout block which owns a rendered native list. */
export function getNativeListBlock(list: HTMLElement): HTMLElement {
    const parent = list.parentElement;
    return parent?.matches('.el-ul, .el-ol') ? parent : list;
}

/** Return only list items owned directly by the supplied list. */
export function getDirectListItems(list: HTMLElement): HTMLLIElement[] {
    return Array.from(list.children)
        .filter((child): child is HTMLLIElement => child.tagName === 'LI');
}

/** Resolve the displayed number of an ordered item, respecting explicit values. */
export function getOrderedListItemNumber(
    list: HTMLOListElement,
    items: HTMLLIElement[],
    itemIndex: number
): number {
    let number = list.start;
    for (let index = 0; index <= itemIndex; index++) {
        const item = items[index];
        if (!item) {
            break;
        }
        const explicitValue = Number(item.getAttribute('value'));
        if (item.hasAttribute('value') && Number.isFinite(explicitValue)) {
            number = explicitValue;
        }
        if (index < itemIndex) {
            number++;
        }
    }
    return number;
}

/** Remove an empty native list and its empty Obsidian layout wrapper, if present. */
export function removeEmptyNativeListBlock(list: HTMLElement): void {
    if (getDirectListItems(list).length > 0 || list.textContent?.trim()) {
        return;
    }

    const block = getNativeListBlock(list);
    list.remove();
    if (block !== list && block.childElementCount === 0 && !block.textContent?.trim()) {
        block.remove();
    }
}
