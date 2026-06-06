import { Modal, Notice, Setting } from 'obsidian';

import {
    buildTemplateVariableContext,
    TEMPLATE_VARIABLE_NAME
} from '../../../core';
import {
    getVariableSuggestions,
    renderTemplateValueDisplay
} from '../modals/PandocTemplateDisplay';
import {
    buildOptionDisplayExportVariables,
    buildPreviewExportVariables
} from '../workspace/previewVariables';
import type {
    ExportVariables,
    TemplateVariableContext
} from '../../../core';
import type {
    ObsidianPandocGuiDependencies
} from '../dependencies';
import type {
    PandocExportSettingsPlugin
} from './pandocExportSettingsSection';

interface EnvRowDraft {
    key: string;
    value: string;
}

interface AdvancedDraft {
    suggestRuntimeEnvVariables: boolean;
    envRows: EnvRowDraft[];
}

export class PandocExportAdvancedSettingsModal extends Modal {
    private readonly plugin: PandocExportSettingsPlugin;
    private readonly dependencies: ObsidianPandocGuiDependencies;
    private readonly draft: AdvancedDraft;

    constructor(
        plugin: PandocExportSettingsPlugin,
        dependencies: ObsidianPandocGuiDependencies
    ) {
        super(plugin.app);
        this.plugin = plugin;
        this.dependencies = dependencies;
        const settings = plugin.settings.pandocExport;
        this.draft = {
            suggestRuntimeEnvVariables: settings?.suggestRuntimeEnvVariables === true,
            envRows: Object.entries(settings?.env ?? {})
                .map(([key, value]) => ({ key, value }))
        };
    }

    onOpen(): void {
        this.modalEl.addClass('pem-pandoc-advanced-settings-modal');
        // eslint-disable-next-line obsidianmd/ui/sentence-case
        this.titleEl.setText('Advanced Pandoc settings');
        this.render();
    }

    onClose(): void {
        this.modalEl.removeClass('pem-pandoc-advanced-settings-modal');
        this.contentEl.empty();
    }

    private render(): void {
        this.contentEl.empty();
        this.renderRuntimeEnvToggle();
        this.renderEnvEditor();
        this.renderActions();
    }

    private renderRuntimeEnvToggle(): void {
        new Setting(this.contentEl)
            .setName('Suggest runtime environment variables')
            .setDesc([
                'Includes current process environment variable names and resolved values in template suggestions.',
                'Only enable this when you are comfortable exposing sensitive paths, tokens, or account data in the editor UI.'
            ].join(' '))
            .addToggle(toggle => toggle
                .setValue(this.draft.suggestRuntimeEnvVariables)
                .onChange(value => {
                    this.draft.suggestRuntimeEnvVariables = value;
                    this.render();
                }));
    }

    private renderEnvEditor(): void {
        const section = this.contentEl.createDiv({ cls: 'pem-pandoc-env-editor' });
        section.createEl('h3', { text: 'Pandoc process environment' });
        const table = section.createDiv({ cls: 'pem-pandoc-env-table' });
        const header = table.createDiv({ cls: 'pem-pandoc-env-row pem-pandoc-env-header' });
        header.createEl('span', { text: 'Variable' });
        header.createEl('span', { text: 'Value' });
        header.createEl('span', { text: '' });

        for (const row of this.draft.envRows) {
            this.renderEnvRow(table, row);
        }

        new Setting(section)
            .addButton(button => button
                .setButtonText('Add variable')
                .onClick(() => {
                    this.draft.envRows.push({ key: '', value: '' });
                    this.render();
                }));
    }

    private renderEnvRow(container: HTMLElement, row: EnvRowDraft): void {
        const rowEl = container.createDiv({ cls: 'pem-pandoc-env-row' });
        const keyInput = rowEl.createEl('input', {
            attr: {
                type: 'text',
                placeholder: 'TEXINPUTS'
            }
        });
        keyInput.value = row.key;
        keyInput.oninput = () => {
            row.key = keyInput.value;
        };

        const valueCell = rowEl.createDiv({ cls: 'pem-pandoc-env-value-cell' });
        this.renderTemplateInput(valueCell, row);
        const actions = rowEl.createDiv({ cls: 'pem-pandoc-env-row-actions' });
        actions.createEl('button', {
            text: 'X',
            attr: { 'aria-label': 'Remove variable' }
        }).onclick = () => {
            this.draft.envRows = this.draft.envRows.filter(item => item !== row);
            this.render();
        };
    }

    private renderTemplateInput(container: HTMLElement, row: EnvRowDraft): void {
        const frame = container.createDiv({ cls: 'pem-pandoc-string-input-frame' });
        const input = frame.createEl('input', {
            cls: 'pem-pandoc-string-input',
            attr: {
                type: 'text',
                placeholder: '${pluginDir}/textemplate/:'
            }
        });
        const display = frame.createDiv({ cls: 'pem-pandoc-string-display' });
        const suggestions = container.createDiv({
            cls: 'pem-pandoc-key-suggestions pem-pandoc-variable-suggestions'
        });
        const showDisplay = () => {
            const rendered = renderTemplateValueDisplay(
                row.value,
                this.templateContext().variables,
                this.displayTemplateContext().variables
            );
            frame.classList.toggle('has-muted-display-prefix', rendered.parts[0]?.muted === true);
            renderValueDisplay(display, rendered, row.value);
            input.value = display.textContent ?? '';
            frame.classList.add('is-display-mode');
        };

        input.value = row.value;
        input.addEventListener('focus', () => {
            frame.classList.remove('is-display-mode');
            input.value = row.value;
        });
        input.oninput = () => {
            row.value = input.value;
            renderVariableSuggestions(suggestions, input, this.templateContext(), name => {
                insertVariable(input, row, name);
                suggestions.empty();
            });
        };
        input.addEventListener('blur', () => {
            window.setTimeout(() => suggestions.empty(), 120);
            showDisplay();
        });
        display.onmousedown = event => event.preventDefault();
        display.onclick = () => input.focus();
        showDisplay();
    }

    private renderActions(): void {
        new Setting(this.contentEl)
            .addButton(button => button
                .setButtonText('Cancel changes')
                .onClick(() => this.close()))
            .addButton(button => button
                .setButtonText('Save and close')
                .setCta()
                .onClick(async () => {
                    await this.save();
                }));
    }

    private async save(): Promise<void> {
        const env = validateEnvRows(this.draft.envRows);
        if (!env) return;
        const settings = this.plugin.settings.pandocExport;
        if (!settings) return;

        settings.suggestRuntimeEnvVariables = this.draft.suggestRuntimeEnvVariables;
        settings.env = env;
        await this.plugin.saveSettings();
        this.close();
    }

    private templateContext(): TemplateVariableContext {
        return buildTemplateVariableContext(this.previewVariables(), {
            includeRuntimeEnv: this.draft.suggestRuntimeEnvVariables,
            runtimeEnv: this.dependencies.runtimeEnv
        });
    }

    private displayTemplateContext(): TemplateVariableContext {
        return buildTemplateVariableContext(this.displayVariables(), {
            includeRuntimeEnv: this.draft.suggestRuntimeEnvVariables,
            runtimeEnv: this.dependencies.runtimeEnv
        });
    }

    private previewVariables(): ExportVariables {
        return buildPreviewExportVariables({
            app: this.plugin.app,
            manifest: this.plugin.manifest,
            settings: this.plugin.settings.pandocExport,
            extension: this.previewExtension(),
            pathDelimiter: this.dependencies.exportSystem.pathDelimiter(),
            platformOs: this.dependencies.exportSystem.platform().os
        });
    }

    private displayVariables(): ExportVariables {
        return buildOptionDisplayExportVariables({
            app: this.plugin.app,
            manifest: this.plugin.manifest,
            settings: this.plugin.settings.pandocExport,
            extension: this.previewExtension(),
            pathDelimiter: this.dependencies.exportSystem.pathDelimiter(),
            platformOs: this.dependencies.exportSystem.platform().os
        });
    }

    private previewExtension(): string {
        return this.plugin.settings.pandocExport?.profiles[0]?.extension ?? '.html';
    }
}

function validateEnvRows(rows: EnvRowDraft[]): Record<string, string> | undefined {
    const env: Record<string, string> = {};
    const seen = new Set<string>();

    for (const row of rows) {
        const key = row.key.trim();
        if (!key && row.value === '') continue;
        if (!key) {
            new Notice('Environment variable rows with values need a variable name.');
            return undefined;
        }
        if (!TEMPLATE_VARIABLE_NAME.test(key)) {
            new Notice(`Invalid environment variable name: ${key}`);
            return undefined;
        }
        if (seen.has(key)) {
            new Notice(`Duplicate environment variable name: ${key}`);
            return undefined;
        }

        seen.add(key);
        env[key] = row.value;
    }

    return env;
}

function renderValueDisplay(
    container: HTMLElement,
    display: ReturnType<typeof renderTemplateValueDisplay>,
    template: string
): void {
    container.empty();
    container.setAttribute('title', template);
    const content = container.createDiv({ cls: 'pem-pandoc-string-display-content' });
    for (const part of display.parts) {
        const span = content.createEl('span', { text: part.text });
        if (part.muted) span.addClass('pem-pandoc-string-display-muted');
    }
}

function renderVariableSuggestions(
    container: HTMLElement,
    input: HTMLInputElement,
    context: TemplateVariableContext,
    onChoose: (name: string) => void
): void {
    const trigger = getVariableTrigger(input.value, input.selectionStart ?? input.value.length);
    container.empty();
    if (!trigger) return;

    for (const suggestion of getVariableSuggestions(trigger.query, context)) {
        const button = container.createEl('button', { cls: 'pem-pandoc-variable-suggestion' });
        button.createEl('span', {
            cls: 'pem-pandoc-variable-suggestion-name',
            text: `\${${suggestion.name}}`
        });
        button.createEl('span', {
            cls: 'pem-pandoc-variable-suggestion-value',
            text: suggestion.value,
            attr: { title: suggestion.value }
        });
        button.onmousedown = event => event.preventDefault();
        button.onclick = () => onChoose(suggestion.name);
    }
}

function getVariableTrigger(value: string, cursor: number): { start: number; query: string } | undefined {
    const beforeCursor = value.slice(0, cursor);
    const match = beforeCursor.match(/\$[{]?([A-Za-z_][A-Za-z0-9_]*)?$/);
    if (!match) return undefined;

    return {
        start: match.index ?? cursor,
        query: match[1] ?? ''
    };
}

function insertVariable(
    input: HTMLInputElement,
    row: EnvRowDraft,
    name: string
): void {
    const cursor = input.selectionStart ?? input.value.length;
    const trigger = getVariableTrigger(input.value, cursor);
    if (!trigger) return;

    const nextValue = `${input.value.slice(0, trigger.start)}\${${name}}${input.value.slice(cursor)}`;
    input.value = nextValue;
    row.value = nextValue;
    const nextCursor = trigger.start + name.length + 3;
    input.setSelectionRange(nextCursor, nextCursor);
    input.focus();
}
