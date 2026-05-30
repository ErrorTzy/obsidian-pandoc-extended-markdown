import { Modal, Notice, Setting } from 'obsidian';

import { PandocExportPluginLike } from './ExportModal';
import { renderPandocRows } from './PandocCommandRows';
import { PandocFormatEditorModal } from './PandocFormatEditor';
import { PandocOptionSearchModal } from './PandocOptionSearchModal';
import { buildPreviewExportVariables } from './previewVariables';
import {
    buildProfileDraftPreview,
    compileProfileDraft,
    PandocPresetManager,
    PandocCatalogService,
    validateProfileDraft,
    validateProfileDraftNames
} from './gui-core';
import type {
    PandocOptionCatalog,
    ProfileDraft,
    ValidationIssue
} from './gui-core';

export class PandocProfileEditorModal extends Modal {
    private readonly plugin: PandocExportPluginLike;
    private readonly presets: PandocPresetManager;
    private catalog?: PandocOptionCatalog;
    private optionIndex = 0;
    private previewEl?: HTMLElement;
    private resetCurrentButton?: HTMLButtonElement;
    private restorePresetButton?: HTMLButtonElement;

    constructor(plugin: PandocExportPluginLike) {
        super(plugin.app);
        this.plugin = plugin;
        this.presets = new PandocPresetManager(plugin.settings.pandocExport?.profiles ?? []);
    }

    onOpen(): void {
        this.modalEl.addClass('pem-pandoc-command-modal');
        this.titleEl.setText('Pandoc export command');
        this.render();
        void this.loadCatalog();
    }

    onClose(): void {
        this.modalEl.removeClass('pem-pandoc-command-modal');
        this.contentEl.empty();
    }

    private async loadCatalog(): Promise<void> {
        const pandocPath = this.plugin.settings.pandocExport?.pandocPath;
        this.catalog = await new PandocCatalogService().loadCatalog({ pandocPath });
        this.render();
    }

    private render(): void {
        const content = this.contentEl;
        content.empty();
        content.addClass('pem-pandoc-command-builder');

        if (!this.catalog) {
            content.createEl('p', { text: 'Loading pandoc options...' });
            return;
        }

        const draft = this.selectedDraft();
        if (!draft) return;
        this.renderCommandPreview(content, draft);
        this.renderPresetOptions(content, draft);
        if (draft.type === 'pandoc') {
            renderPandocRows(content, draft, this.catalog, {
                nextOptionIndex: () => this.optionIndex++,
                getVariables: current => this.buildPreviewVariables(current),
                openFormatEditor: (row, spec, current) => {
                    new PandocFormatEditorModal(this.app, {
                        draft: current,
                        row,
                        spec,
                        catalog: this.catalog!,
                        getVariables: editorDraft => this.buildPreviewVariables(editorDraft),
                        onApply: value => {
                            row.value = value;
                            this.updatePreview(current);
                            this.render();
                        }
                    }).open();
                },
                openOptionSearch: onChoose => {
                    new PandocOptionSearchModal(
                        this.app,
                        this.catalog!,
                        onChoose,
                        option => !['from', 'to', 'output'].includes(option.mapsTo ?? '')
                    ).open();
                },
                render: () => this.render(),
                updatePreview: current => this.updatePreview(current)
            });
        } else {
            this.renderCustomFields(content, draft);
        }
        this.renderValidation(content, this.currentValidationIssues(draft));
        this.renderFooter(content);
    }

    private renderCommandPreview(container: HTMLElement, draft: ProfileDraft): void {
        const panel = container.createDiv({ cls: 'pem-pandoc-command-panel' });
        panel.createEl('div', { cls: 'pem-pandoc-command-label', text: 'Preview command:' });
        this.previewEl = panel.createEl('code', { cls: 'pem-pandoc-command-preview' });
        this.updatePreview(draft);
    }

    private renderPresetOptions(container: HTMLElement, draft: ProfileDraft): void {
        const section = container.createDiv({ cls: 'pem-pandoc-preset-section' });
        // eslint-disable-next-line obsidianmd/ui/sentence-case
        section.createEl('h3', { text: 'Preset Options' });

        const fields = section.createDiv({ cls: 'pem-pandoc-preset-fields' });
        const selectField = fields.createDiv({ cls: 'pem-pandoc-preset-field' });
        selectField.createEl('label', { text: 'Preset' });
        const selectFrame = selectField.createDiv({ cls: 'pem-pandoc-preset-select-frame' });
        const select = selectFrame.createEl('select', { attr: { 'aria-label': 'Load preset' } });
        for (const item of this.presets.visibleDrafts()) {
            select.createEl('option', { value: item.id, text: item.name });
        }
        select.value = draft.id;
        select.onchange = () => {
            this.presets.select(select.value);
            this.render();
        };

        const actions = section.createDiv({ cls: 'pem-pandoc-preset-actions' });
        this.renderTextField(actions, 'Name', draft.name, value => {
            draft.name = value;
        });
        this.createButton(actions, 'New preset', () => {
            this.presets.addPreset();
            this.render();
        });
        this.createButton(actions, 'Save current', () => {
            void this.saveCurrent();
        });
        this.resetCurrentButton = this.createButton(actions, 'Reset current', () => {
            this.presets.resetSelected();
            this.render();
        });
        this.createButton(actions, 'Delete current', () => {
            if (!this.presets.deleteSelected()) {
                new Notice('At least one export preset is required.');
            }
            this.render();
        }).disabled = !this.presets.canDeleteSelected();
        this.restorePresetButton = this.createButton(actions, 'Restore preset', () => {
            this.presets.restoreSelected();
            this.render();
        });
        this.refreshPresetActionStates();
    }

    private renderCustomFields(container: HTMLElement, draft: ProfileDraft): void {
        const section = container.createDiv({ cls: 'pem-pandoc-option-section' });
        // eslint-disable-next-line obsidianmd/ui/sentence-case
        section.createEl('h3', { text: 'Command Options' });
        this.renderTextField(section, 'Output extension', draft.extension, value => {
            draft.extension = value;
        });

        new Setting(section)
            .setName('Command template')
            .addTextArea(text => text
                .setValue(draft.customCommandTemplate)
                .onChange(value => {
                    draft.customCommandTemplate = value;
                    this.updatePreview(draft);
                }));
        new Setting(section).setName('Enable shell command').addToggle(toggle => toggle
            .setValue(draft.customShell)
            .onChange(value => {
                draft.customShell = value;
                this.updatePreview(draft);
            }));
    }

    private renderValidation(container: HTMLElement, issues: ValidationIssue[]): void {
        if (issues.length === 0) return;
        const list = container.createEl('ul', { cls: 'pem-pandoc-validation' });
        for (const issue of issues) {
            list.createEl('li', {
                cls: `is-${issue.severity}`,
                text: issue.message
            });
        }
    }

    private renderFooter(container: HTMLElement): void {
        new Setting(container.createDiv({ cls: 'pem-pandoc-command-footer' }))
            .addButton(button => button
                .setButtonText('Cancel changes')
                .onClick(() => this.close()))
            .addButton(button => button
                .setButtonText('Save and close')
                .setCta()
                .onClick(() => {
                    void this.saveAndClose();
                }));
    }

    private selectedDraft(): ProfileDraft | undefined {
        return this.presets.selectedDraft();
    }

    private async saveCurrent(): Promise<void> {
        if (!this.catalog) return;
        const draft = this.selectedDraft();
        if (!draft) return;
        const errors = [
            ...validateProfileDraftNames(this.presets.visibleDrafts()),
            ...validateProfileDraft(draft, this.catalog)
        ]
            .filter(issue => issue.severity === 'error');
        if (errors.length > 0) {
            new Notice(`Fix ${errors.length} Pandoc preset error(s) before saving.`);
            return;
        }

        const settings = this.plugin.settings.pandocExport;
        if (!settings) return;
        settings.profiles = this.presets.saveSelected(this.catalog);
        await this.plugin.saveSettings();
        new Notice('Current pandoc preset saved.');
        this.render();
    }

    private async saveAndClose(): Promise<void> {
        if (!this.catalog) return;
        const errors = this.allValidationIssues()
            .filter(issue => issue.severity === 'error');
        if (errors.length > 0) {
            new Notice(`Fix ${errors.length} Pandoc preset error(s) before saving.`);
            return;
        }

        const settings = this.plugin.settings.pandocExport;
        if (!settings) return;
        settings.profiles = this.presets.saveAll(this.catalog);
        await this.plugin.saveSettings();
        this.close();
    }

    private updatePreview(draft: ProfileDraft): void {
        if (!this.previewEl) return;
        this.previewEl.setText(buildProfileDraftPreview(
            draft,
            this.catalog,
            this.buildPreviewVariables(draft)
        ).display);
        this.refreshPresetActionStates();
    }

    private refreshPresetActionStates(): void {
        if (this.resetCurrentButton) {
            this.resetCurrentButton.disabled = !this.presets.canResetSelected();
        }
        if (this.restorePresetButton) {
            this.restorePresetButton.disabled = !this.presets.canRestoreSelected();
        }
    }

    private currentValidationIssues(draft: ProfileDraft): ValidationIssue[] {
        if (!this.catalog) return [];
        return [
            ...validateProfileDraftNames(this.presets.visibleDrafts()),
            ...validateProfileDraft(draft, this.catalog)
        ];
    }

    private allValidationIssues(): ValidationIssue[] {
        if (!this.catalog) return [];
        return [
            ...validateProfileDraftNames(this.presets.visibleDrafts()),
            ...this.presets.visibleDrafts().flatMap(draft => validateProfileDraft(draft, this.catalog!))
        ];
    }

    private buildPreviewVariables(draft: ProfileDraft) {
        const profile = draft.type === 'pandoc' && this.catalog ?
            compileProfileDraft(draft, this.catalog) :
            undefined;

        return buildPreviewExportVariables({
            app: this.plugin.app,
            manifest: this.plugin.manifest,
            settings: this.plugin.settings.pandocExport,
            extension: profile?.extension ?? draft.extension
        });
    }

    private renderTextField(
        container: HTMLElement,
        label: string,
        value: string,
        onChange: (value: string) => void
    ): void {
        const field = container.createDiv({ cls: 'pem-pandoc-preset-field' });
        field.createEl('label', { text: label });
        this.createInput(field, value, next => {
            onChange(next);
            this.updatePreview(this.selectedDraft()!);
        });
    }

    private createInput(
        container: HTMLElement,
        value: string,
        onInput: (value: string) => void,
        type = 'text',
        placeholder = ''
    ): HTMLInputElement {
        const input = container.createEl('input', { type, attr: { placeholder } });
        input.value = value;
        input.oninput = () => onInput(input.value);
        return input;
    }

    private createButton(
        container: HTMLElement,
        text: string,
        onClick: () => void,
        label = text
    ): HTMLButtonElement {
        const button = container.createEl('button', { text, attr: { 'aria-label': label } });
        button.onclick = onClick;
        return button;
    }

}
