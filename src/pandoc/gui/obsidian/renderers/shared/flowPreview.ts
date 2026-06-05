export function createFlowPreview(
    container: HTMLElement,
    cls: string,
    noticeText?: string
): HTMLElement {
    clearPagerToolbar(container);
    const preview = container.createDiv({
        cls: `pem-pandoc-flow-preview ${cls}${noticeText ? ' has-notice' : ''}`
    });
    if (noticeText) {
        preview.createEl('div', {
            cls: 'pem-pandoc-flow-preview-notice',
            text: noticeText,
            attr: { 'aria-live': 'polite' }
        });
    }

    return preview.createDiv({ cls: 'pem-pandoc-flow-preview-viewport' });
}

export function previewNoticeFor(metadata: Record<string, unknown> | undefined): string | undefined {
    const notice = metadata?.previewNotice;
    return typeof notice === 'string' ? notice : undefined;
}

function clearPagerToolbar(container: HTMLElement): void {
    const pane = container.closest('.pem-pandoc-preview-pane');
    pane?.querySelector<HTMLElement>('.pem-pandoc-preview-toolbar-left')?.replaceChildren();
    pane?.querySelector<HTMLElement>('.pem-pandoc-preview-toolbar-center')?.replaceChildren();
}
