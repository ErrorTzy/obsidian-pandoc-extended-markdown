import { Setting } from 'obsidian';

import type { ExportProfile } from './types';
import type { ValidationIssue } from './gui-core';

export interface OverwriteOptionState {
    overwrite: boolean;
}

export interface OverwriteOptionActions {
    onOverwriteChange(value: boolean): void;
}

export function renderPreviewPane(
    container: HTMLElement,
    onRefresh: () => void
): { statusEl: HTMLElement; bodyEl: HTMLElement } {
    const pane = container.createDiv({ cls: 'pem-pandoc-preview-pane' });
    const header = pane.createDiv({ cls: 'pem-pandoc-preview-header' });
    header.createEl('h3', { text: 'Preview' });
    const statusEl = header.createEl('span', { cls: 'pem-pandoc-preview-status' });
    createButton(header, 'Refresh', onRefresh);
    const bodyEl = pane.createDiv({ cls: 'pem-pandoc-preview-body' });

    return { statusEl, bodyEl };
}

export function renderCommandPreview(
    container: HTMLElement,
    display: string
): HTMLElement {
    const panel = container.createDiv({ cls: 'pem-pandoc-command-panel' });
    panel.createEl('div', { cls: 'pem-pandoc-command-label', text: 'Preview command:' });
    const previewEl = panel.createEl('code', { cls: 'pem-pandoc-command-preview' });
    previewEl.setText(display);

    return previewEl;
}

export function renderPresetOptions(
    container: HTMLElement,
    profiles: ExportProfile[],
    selectedId: string,
    onSelect: (profileId: string) => void
): void {
    const section = container.createDiv({ cls: 'pem-pandoc-preset-section' });
    // eslint-disable-next-line obsidianmd/ui/sentence-case
    section.createEl('h3', { text: 'Preset Options' });
    const fields = section.createDiv({ cls: 'pem-pandoc-preset-fields' });
    const field = fields.createDiv({ cls: 'pem-pandoc-preset-field' });
    field.createEl('label', { text: 'Preset' });
    const select = field.createEl('select');

    for (const profile of profiles) {
        select.createEl('option', { value: profile.id, text: profile.name });
    }
    select.value = selectedId;
    select.onchange = () => onSelect(select.value);
}

export function renderOverwriteOption(
    container: HTMLElement,
    state: OverwriteOptionState,
    actions: OverwriteOptionActions
): void {
    const section = container.createDiv({ cls: 'pem-pandoc-preset-section' });

    new Setting(section)
        .setName('Replace existing file')
        .addToggle(toggle => toggle
            .setValue(state.overwrite)
            .onChange(value => actions.onOverwriteChange(value)));
}

export function renderValidation(container: HTMLElement, issues: ValidationIssue[]): void {
    if (issues.length === 0) return;
    const list = container.createEl('ul', { cls: 'pem-pandoc-validation' });
    for (const issue of issues) {
        list.createEl('li', {
            cls: `is-${issue.severity}`,
            text: issue.message
        });
    }
}

export function renderFooter(
    container: HTMLElement,
    onCancel: () => void,
    onExport: () => void
): void {
    new Setting(container.createDiv({ cls: 'pem-pandoc-command-footer' }))
        .addButton(button => button
            .setButtonText('Cancel')
            .onClick(onCancel))
        .addButton(button => button
            .setButtonText('Export')
            .setCta()
            .onClick(onExport));
}

function createButton(container: HTMLElement, text: string, onClick: () => void): HTMLButtonElement {
    const button = container.createEl('button', { text, attr: { 'aria-label': text } });
    button.onclick = onClick;
    return button;
}
