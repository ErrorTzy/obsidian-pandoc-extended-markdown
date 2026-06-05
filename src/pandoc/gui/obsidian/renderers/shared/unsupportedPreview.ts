export function renderUnsupportedPreview(container: HTMLElement, label: string): void {
    container.createEl('p', {
        cls: 'pem-pandoc-preview-message',
        text: `${label}. Export still works; use an external app to inspect this format.`
    });
}
