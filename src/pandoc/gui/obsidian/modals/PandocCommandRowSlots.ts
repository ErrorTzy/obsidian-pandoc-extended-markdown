export interface PandocCommandRowSlots {
    row: HTMLElement;
    key: HTMLElement;
    separator: HTMLElement;
    value: HTMLElement;
    type: HTMLElement;
    actions: HTMLElement;
}

export function createPandocCommandRowSlots(container: HTMLElement): PandocCommandRowSlots {
    const row = container.createDiv({ cls: 'pem-pandoc-builder-row' });
    return {
        row,
        key: row.createDiv({ cls: 'pem-pandoc-key-cell' }),
        separator: row.createEl('span', { cls: 'pem-pandoc-row-separator' }),
        value: row.createDiv({ cls: 'pem-pandoc-value-cell' }),
        type: row.createEl('span', { cls: 'pem-pandoc-row-type' }),
        actions: row.createDiv({ cls: 'pem-pandoc-row-actions' })
    };
}
