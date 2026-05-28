import { Modal, Notice, Setting } from 'obsidian';

import { DEFAULT_EXPORT_PROFILES } from './defaultProfiles';
import { PandocExportPluginLike } from './ExportModal';
import { renderPandocRows } from './PandocCommandRows';
import { PandocOptionSearchModal } from './PandocOptionSearchModal';
import {
    buildProfileDraftPreview,
    compileProfileDrafts,
    createProfileDrafts,
    PandocCatalogService,
    validateProfileDraft
} from './gui-core';
import type {
    PandocOptionCatalog,
    ProfileDraft,
    ValidationIssue
} from './gui-core';

export class PandocProfileEditorModal extends Modal {
    private readonly plugin: PandocExportPluginLike;
    private drafts: ProfileDraft[];
    private catalog?: PandocOptionCatalog;
    private selectedId: string;
    private optionIndex = 0;
    private previewEl?: HTMLElement;

    constructor(plugin: PandocExportPluginLike) {
        super(plugin.app);
        this.plugin = plugin;
        this.drafts = createProfileDrafts(plugin.settings.pandocExport?.profiles ?? []);
        this.selectedId = this.drafts[0]?.id ?? '';
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
        this.renderPresetBar(content, draft);
        this.renderPresetDetails(content, draft);
        if (draft.type === 'pandoc') {
            renderPandocRows(content, draft, this.catalog, {
                nextOptionIndex: () => this.optionIndex++,
                openOptionSearch: onChoose => {
                    new PandocOptionSearchModal(this.app, this.catalog!, onChoose).open();
                },
                render: () => this.render(),
                updatePreview: current => this.updatePreview(current)
            });
        } else {
            this.renderCustomFields(content, draft);
        }
        this.renderValidation(content, validateProfileDraft(draft, this.catalog));
        this.renderFooter(content);
    }

    private renderCommandPreview(container: HTMLElement, draft: ProfileDraft): void {
        const panel = container.createDiv({ cls: 'pem-pandoc-command-panel' });
        panel.createEl('div', { cls: 'pem-pandoc-command-label', text: 'Preview command:' });
        this.previewEl = panel.createEl('code', { cls: 'pem-pandoc-command-preview' });
        this.updatePreview(draft);
    }

    private renderPresetBar(container: HTMLElement, draft: ProfileDraft): void {
        const bar = container.createDiv({ cls: 'pem-pandoc-preset-bar' });
        const select = bar.createEl('select', { attr: { 'aria-label': 'Load preset' } });
        for (const item of this.drafts) {
            select.createEl('option', { value: item.id, text: item.name || item.id });
        }
        select.value = draft.id;
        select.onchange = () => {
            this.selectedId = select.value;
            this.render();
        };

        this.createButton(bar, 'New preset', () => this.addProfile());
        this.createButton(bar, 'Save as preset', () => this.duplicateSelected());
        this.createButton(bar, 'Reset defaults', () => this.resetDefaults());
    }

    private renderPresetDetails(container: HTMLElement, draft: ProfileDraft): void {
        const details = container.createDiv({ cls: 'pem-pandoc-preset-details' });
        this.renderTextField(details, 'Preset ID', draft.id, value => {
            draft.id = value;
            this.selectedId = value;
        });
        this.renderTextField(details, 'Preset name', draft.name, value => {
            draft.name = value;
        });
        this.renderTextField(details, 'Output extension', draft.extension, value => {
            draft.extension = value;
            this.updatePreview(draft);
        });
    }

    private renderCustomFields(container: HTMLElement, draft: ProfileDraft): void {
        new Setting(container)
            .setName('Command template')
            .addTextArea(text => text
                .setValue(draft.customCommandTemplate)
                .onChange(value => {
                    draft.customCommandTemplate = value;
                    this.updatePreview(draft);
                }));
        new Setting(container).setName('Enable shell command').addToggle(toggle => toggle
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
        new Setting(container)
            .addButton(button => button
                .setButtonText('Remove preset')
                .onClick(() => this.removeSelected()))
            .addButton(button => button
                .setButtonText('Cancel')
                .onClick(() => this.close()))
            .addButton(button => button
                .setButtonText('Save profiles')
                .setCta()
                .onClick(() => this.save()));
    }

    private selectedDraft(): ProfileDraft | undefined {
        return this.drafts.find(draft => draft.id === this.selectedId) ?? this.drafts[0];
    }

    private addProfile(): void {
        const id = uniqueId('profile', this.drafts.map(draft => draft.id));
        this.drafts.push({
            id,
            name: 'New preset',
            type: 'pandoc',
            extension: '.html',
            from: 'markdown',
            to: 'html',
            standalone: true,
            resourcePaths: [],
            luaFilters: [],
            metadata: {},
            optionRows: [],
            customCommandTemplate: '',
            customShell: false
        });
        this.selectedId = id;
        this.render();
    }

    private duplicateSelected(): void {
        const draft = this.selectedDraft();
        if (!draft) return;
        const copy = cloneDraft(draft);
        copy.id = uniqueId(`${draft.id}-copy`, this.drafts.map(item => item.id));
        copy.name = `${draft.name} Copy`;
        this.drafts.push(copy);
        this.selectedId = copy.id;
        this.render();
    }

    private resetDefaults(): void {
        this.drafts = createProfileDrafts(DEFAULT_EXPORT_PROFILES);
        this.selectedId = this.drafts[0]?.id ?? '';
        this.render();
    }

    private removeSelected(): void {
        if (this.drafts.length <= 1) {
            new Notice('At least one export profile is required.');
            return;
        }
        this.drafts = this.drafts.filter(draft => draft.id !== this.selectedId);
        this.selectedId = this.drafts[0]?.id ?? '';
        this.render();
    }

    private async save(): Promise<void> {
        if (!this.catalog) return;
        const errors = this.drafts.flatMap(draft =>
            validateProfileDraft(draft, this.catalog!).filter(issue => issue.severity === 'error'));
        if (errors.length > 0) {
            new Notice(`Fix ${errors.length} Pandoc profile error(s) before saving.`);
            return;
        }

        const settings = this.plugin.settings.pandocExport;
        if (!settings) return;
        settings.profiles = compileProfileDrafts(this.drafts, this.catalog);
        await this.plugin.saveSettings();
        new Notice('Pandoc export profiles saved.');
        this.close();
    }

    private updatePreview(draft: ProfileDraft): void {
        if (!this.previewEl) return;
        this.previewEl.setText(buildProfileDraftPreview(draft, this.catalog).display);
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

function uniqueId(base: string, existing: string[]): string {
    let candidate = base;
    let index = 2;
    while (existing.includes(candidate)) {
        candidate = `${base}-${index}`;
        index += 1;
    }
    return candidate;
}

function cloneDraft(draft: ProfileDraft): ProfileDraft {
    return JSON.parse(JSON.stringify(draft)) as ProfileDraft;
}
