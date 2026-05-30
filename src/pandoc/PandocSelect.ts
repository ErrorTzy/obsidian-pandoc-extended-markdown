export function createPandocSelect(
    container: HTMLElement,
    options: string[][] = [],
    attr: Record<string, string> = {},
    frameClass = ''
): HTMLSelectElement {
    const frame = container.createDiv({
        cls: ['pem-pandoc-select-frame', frameClass].filter(Boolean).join(' ')
    });
    const select = frame.createEl('select', { attr });
    for (const [value, text] of options) select.createEl('option', { value, text });
    return select;
}
