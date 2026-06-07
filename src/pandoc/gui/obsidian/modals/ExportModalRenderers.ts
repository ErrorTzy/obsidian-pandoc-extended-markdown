import { Setting } from 'obsidian';

import { createPandocSelect } from './PandocSelect';
import type {
    PandocExportSettings,
    ProfileDraft,
    ValidationIssue
} from '../../../core';

export interface OutputActionOptionState {
    settings: PandocExportSettings;
}

export interface OutputActionOptionActions {
    onShowOverwriteConfirmationChange(value: boolean): void;
    onOpenOutputFileChange(value: boolean): void;
    onRevealOutputFileChange(value: boolean): void;
}

export interface PresetOptionState {
    drafts: ProfileDraft[];
    selectedId: string;
    canDelete: boolean;
    canReset: boolean;
    canRestore: boolean;
}

export interface PresetOptionActions {
    onSelect(profileId: string): void;
    onNameChange(value: string): void;
    onNewPreset(): void;
    onSaveCurrent(): void;
    onResetCurrent(): void;
    onDeleteCurrent(): void;
    onRestorePreset(): void;
}

export function renderPreviewPane(
    container: HTMLElement,
    onRefresh: () => void
): {
    statusEl: HTMLElement;
    bodyEl: HTMLElement;
    refreshButtonEl: HTMLButtonElement;
} {
    const pane = container.createDiv({ cls: 'pem-pandoc-preview-pane' });
    const header = pane.createDiv({ cls: 'pem-pandoc-preview-header' });
    header.createDiv({ cls: 'pem-pandoc-preview-toolbar-left' });
    header.createDiv({ cls: 'pem-pandoc-preview-toolbar-center' });
    const right = header.createDiv({ cls: 'pem-pandoc-preview-toolbar-right' });
    const statusEl = right.createEl('span', {
        cls: 'pem-pandoc-preview-status',
        attr: { 'aria-live': 'polite' }
    });
    const refreshButtonEl = createButton(right, 'Refresh', onRefresh);
    const bodyEl = pane.createDiv({ cls: 'pem-pandoc-preview-body' });

    return { statusEl, bodyEl, refreshButtonEl };
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
    state: PresetOptionState,
    actions: PresetOptionActions
): void {
    const section = container.createDiv({ cls: 'pem-pandoc-preset-section' });
    // eslint-disable-next-line obsidianmd/ui/sentence-case
    section.createEl('h3', { text: 'Preset Options' });
    const fields = section.createDiv({ cls: 'pem-pandoc-preset-fields' });
    const selectField = fields.createDiv({ cls: 'pem-pandoc-preset-field' });
    selectField.createEl('label', { text: 'Preset' });
    const select = createPandocSelect(
        selectField,
        [],
        { 'aria-label': 'Load preset' },
        'pem-pandoc-preset-select-frame'
    );

    for (const draft of state.drafts) {
        select.createEl('option', { value: draft.id, text: draft.name });
    }
    select.value = state.selectedId;
    select.onchange = () => actions.onSelect(select.value);

    const draft = state.drafts.find(item => item.id === state.selectedId);
    const actionRow = section.createDiv({ cls: 'pem-pandoc-preset-actions' });
    if (draft) {
        const nameField = actionRow.createDiv({ cls: 'pem-pandoc-preset-field' });
        nameField.createEl('label', { text: 'Name' });
        const nameInput = nameField.createEl('input', { type: 'text' });
        nameInput.value = draft.name;
        nameInput.oninput = () => actions.onNameChange(nameInput.value);
    }
    createButton(actionRow, 'New preset', () => actions.onNewPreset());
    createButton(actionRow, 'Save current', () => actions.onSaveCurrent());
    createButton(actionRow, 'Reset current', () => actions.onResetCurrent()).disabled = !state.canReset;
    createButton(actionRow, 'Delete current', () => actions.onDeleteCurrent()).disabled = !state.canDelete;
    createButton(actionRow, 'Restore preset', () => actions.onRestorePreset()).disabled = !state.canRestore;
}

export function renderOutputActionOptions(
    container: HTMLElement,
    state: OutputActionOptionState,
    actions: OutputActionOptionActions
): void {
    const section = container.createDiv({ cls: 'pem-pandoc-preset-section' });
    // eslint-disable-next-line obsidianmd/ui/sentence-case
    section.createEl('h3', { text: 'Output Actions' });

    new Setting(section)
        .setName('Confirm before replacing files')
        .addToggle(toggle => toggle
            .setValue(state.settings.showOverwriteConfirmation)
            .onChange(value => actions.onShowOverwriteConfirmationChange(value)));
    new Setting(section)
        .setName('Open output file after export')
        .addToggle(toggle => toggle
            .setValue(state.settings.openOutputFile)
            .onChange(value => actions.onOpenOutputFileChange(value)));
    new Setting(section)
        .setName('Reveal output file after export')
        .addToggle(toggle => toggle
            .setValue(state.settings.revealOutputFile)
            .onChange(value => actions.onRevealOutputFileChange(value)));
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
