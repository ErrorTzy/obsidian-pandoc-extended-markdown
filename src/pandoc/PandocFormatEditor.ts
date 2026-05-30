import { App, Modal, Setting } from 'obsidian';

import {
    getFormatExtensionChoices,
    parsePandocFormatValue,
    selectedCompatibleExtensions
} from './gui-core';
import { createPandocSelect } from './PandocSelect';
import { renderExportTemplate } from './template';
import type {
    FormatExtensionSpec,
    OptionSpec,
    PandocOptionCatalog,
    ProfileDraft,
    ProfileOptionRow
} from './gui-core';
import type { ExportVariables } from './types';

type LockedModifier = {
    operator: '+' | '-';
    name: string;
};

export interface PandocFormatEditorModalConfig {
    draft: ProfileDraft;
    row: ProfileOptionRow;
    spec: OptionSpec;
    catalog: PandocOptionCatalog;
    getVariables(draft: ProfileDraft): ExportVariables;
    onApply(value: string): void;
}

export class PandocFormatEditorModal extends Modal {
    private readonly config: PandocFormatEditorModalConfig;
    private baseFormat: string;
    private baseToken: string;
    private readonly originalResolvedBase: string;
    private selectedExtensions: Set<string>;
    private lockedModifiers: LockedModifier[];
    private previewEl?: HTMLElement;
    private activeExtensionName?: string;

    constructor(app: App, config: PandocFormatEditorModalConfig) {
        super(app);
        this.config = config;

        const resolvedValue = this.renderValue(config.row.value);
        const raw = parsePandocFormatValue(config.row.value);
        const resolved = parsePandocFormatValue(resolvedValue);
        this.baseFormat = resolved.baseFormat;
        this.originalResolvedBase = resolved.baseFormat;
        this.baseToken = raw.baseFormat && raw.baseFormat !== resolved.baseFormat ?
            raw.baseFormat :
            resolved.baseFormat;
        this.selectedExtensions = new Set(selectedCompatibleExtensions(config.catalog, resolvedValue));
        this.lockedModifiers = this.getLockedModifiers(resolved.baseFormat, resolved.modifiers);
    }

    onOpen(): void {
        this.modalEl.addClass('pem-pandoc-format-modal');
        this.titleEl.setText('Pandoc format');
        this.render();
    }

    onClose(): void {
        this.modalEl.removeClass('pem-pandoc-format-modal');
        this.contentEl.empty();
    }

    private render(): void {
        this.contentEl.empty();
        const panel = this.contentEl.createDiv({ cls: 'pem-pandoc-format-panel' });
        this.renderFormatColumn(panel);
        this.renderExtensionColumn(panel);
        this.updatePreview();
    }

    private renderFormatColumn(container: HTMLElement): void {
        const column = container.createDiv({ cls: 'pem-pandoc-format-column' });
        const field = column.createDiv({ cls: 'pem-pandoc-format-field' });
        field.createEl('label', { text: 'Format' });
        const select = createPandocSelect(field, [], { 'aria-label': 'Base pandoc format' });
        for (const format of this.availableFormats()) {
            select.createEl('option', { value: format, text: format });
        }
        if (this.baseFormat && !this.availableFormats().includes(this.baseFormat)) {
            select.createEl('option', { value: this.baseFormat, text: this.baseFormat });
        }
        select.value = this.baseFormat;
        select.onchange = () => {
            this.baseFormat = select.value;
            this.baseToken = select.value;
            this.selectedExtensions = new Set();
            this.lockedModifiers = [];
            this.render();
        };

        const preview = column.createDiv({ cls: 'pem-pandoc-format-preview' });
        preview.createEl('div', { cls: 'pem-pandoc-command-label', text: 'Preview' });
        this.previewEl = preview.createEl('code');

        new Setting(column.createDiv({ cls: 'pem-pandoc-format-footer' }))
            .addButton(button => button
                .setButtonText('Cancel')
                .onClick(() => this.close()))
            .addButton(button => button
                .setButtonText('Confirm')
                .setCta()
                .onClick(() => {
                    this.config.onApply(this.rawValue());
                    this.close();
                }));
    }

    private renderExtensionColumn(container: HTMLElement): void {
        const column = container.createDiv({ cls: 'pem-pandoc-extension-column' });
        column.createEl('h3', { text: 'Extensions' });

        const choices = getFormatExtensionChoices(this.config.catalog, this.resolvedValue());
        if (choices.length === 0) {
            column.createEl('p', {
                cls: 'pem-pandoc-extension-empty',
                text: 'No runtime extension metadata is available for this format.'
            });
            return;
        }

        const list = column.createDiv({ cls: 'pem-pandoc-format-extension-list' });
        this.renderExtensionSection(list, 'Compatible', choices.filter(choice =>
            choice.state === 'compatible' || choice.state === 'enabled'));
        this.renderExtensionSection(list, 'Included', choices.filter(choice => choice.state === 'included'));
        this.renderExtensionSection(list, 'Incompatible', choices.filter(choice => choice.state === 'incompatible'));
        this.renderExtensionDetail(column, choices);
    }

    private renderExtensionSection(
        container: HTMLElement,
        title: string,
        choices: ReturnType<typeof getFormatExtensionChoices>
    ): void {
        if (choices.length === 0) return;

        const section = container.createDiv({ cls: 'pem-pandoc-format-extension-section' });
        section.createEl('div', { cls: 'pem-pandoc-format-extension-heading', text: title });
        for (const choice of choices) {
            const row = section.createDiv({
                cls: `pem-pandoc-format-extension is-${choice.state}`
            });
            const checkbox = row.createEl('input', { type: 'checkbox' });
            checkbox.checked = choice.checked;
            checkbox.disabled = !choice.editable;
            checkbox.onchange = () => {
                this.updateSelectedExtension(choice.name, checkbox.checked);
            };
            row.onclick = event => {
                if (!choice.editable || event.target === checkbox) return;
                checkbox.checked = !checkbox.checked;
                this.updateSelectedExtension(choice.name, checkbox.checked);
            };
            row.createEl('span', { cls: 'pem-pandoc-format-extension-name', text: choice.name });
            this.renderExtensionHelpButton(row, choice);
        }
    }

    private renderExtensionHelpButton(
        row: HTMLElement,
        choice: ReturnType<typeof getFormatExtensionChoices>[number]
    ): void {
        const button = row.createEl('button', {
            cls: 'pem-pandoc-extension-help',
            text: '?',
            attr: {
                type: 'button',
                'aria-label': `Show ${choice.name} extension description`
            }
        });
        button.disabled = !choice.description;
        button.onclick = event => {
            event.preventDefault();
            event.stopPropagation();
            this.activeExtensionName = choice.name;
            this.render();
        };
    }

    private renderExtensionDetail(
        container: HTMLElement,
        choices: ReturnType<typeof getFormatExtensionChoices>
    ): void {
        const choice = choices.find(item => item.name === this.activeExtensionName);
        if (!choice?.description) return;

        const panel = container.createDiv({ cls: 'pem-pandoc-extension-detail' });
        const header = panel.createDiv({ cls: 'pem-pandoc-extension-detail-header' });
        header.createEl('code', { text: choice.name });
        header.createEl('span', {
            cls: `pem-pandoc-extension-detail-state is-${choice.state}`,
            text: choice.state
        });
        panel.createEl('p', { text: choice.description });
    }

    private updateSelectedExtension(name: string, checked: boolean): void {
        if (checked) {
            this.selectedExtensions.add(name);
        } else {
            this.selectedExtensions.delete(name);
        }
        this.render();
    }

    private availableFormats(): string[] {
        if (this.config.spec.mapsTo === 'from') return this.config.catalog.inputFormats;
        if (this.config.spec.mapsTo === 'to') return this.config.catalog.outputFormats;
        return Array.from(new Set([
            ...this.config.catalog.inputFormats,
            ...this.config.catalog.outputFormats
        ])).sort();
    }

    private getLockedModifiers(baseFormat: string, modifiers: LockedModifier[]): LockedModifier[] {
        const specs = new Map((this.config.catalog.formatExtensions[baseFormat] ?? [])
            .map(extension => [extension.name, extension]));

        return modifiers.filter(modifier => !isEditableExtension(modifier, specs.get(modifier.name)));
    }

    private rawValue(): string {
        return this.composeValue(this.activeBaseToken());
    }

    private resolvedValue(): string {
        return this.composeValue(this.baseFormat);
    }

    private composeValue(base: string): string {
        return [
            base,
            ...Array.from(this.selectedExtensions).sort().map(extension => `+${extension}`),
            ...this.lockedModifiers.map(modifier => `${modifier.operator}${modifier.name}`)
        ].join('');
    }

    private activeBaseToken(): string {
        return this.baseFormat === this.originalResolvedBase ? this.baseToken : this.baseFormat;
    }

    private updatePreview(): void {
        this.previewEl?.setText(this.rawValue());
    }

    private renderValue(value: string): string {
        return renderExportTemplate(value, this.config.getVariables(this.config.draft));
    }
}

function isEditableExtension(
    modifier: LockedModifier,
    spec: FormatExtensionSpec | undefined
): boolean {
    return modifier.operator === '+' && spec?.defaultEnabled === false;
}
