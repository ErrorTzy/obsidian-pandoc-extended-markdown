import { Modal } from 'obsidian';

import {
    optionLabel,
    optionValueTypeText,
    searchOptions
} from './gui-core';
import type {
    OptionSpec,
    PandocOptionCatalog
} from './gui-core';

export class PandocOptionSearchModal extends Modal {
    private readonly catalog: PandocOptionCatalog;
    private readonly onChoose: (option: OptionSpec) => void;
    private readonly optionFilter?: (option: OptionSpec) => boolean;
    private confirmButton?: HTMLButtonElement;
    private fuzzy = false;
    private query = '';
    private resultsEl?: HTMLElement;
    private selected?: OptionSpec;

    constructor(
        app: ConstructorParameters<typeof Modal>[0],
        catalog: PandocOptionCatalog,
        onChoose: (option: OptionSpec) => void,
        optionFilter?: (option: OptionSpec) => boolean
    ) {
        super(app);
        this.catalog = catalog;
        this.onChoose = onChoose;
        this.optionFilter = optionFilter;
    }

    onOpen(): void {
        this.modalEl.addClass('pem-pandoc-option-search-modal');
        this.titleEl.setText('Pandoc options');
        this.render();
    }

    onClose(): void {
        this.modalEl.removeClass('pem-pandoc-option-search-modal');
        this.contentEl.empty();
    }

    private render(): void {
        const content = this.contentEl;
        content.empty();
        const search = content.createDiv({ cls: 'pem-pandoc-option-search-box' });
        const input = search.createEl('input', {
            type: 'search',
            attr: { placeholder: 'Search keys or descriptions' }
        });
        input.value = this.query;
        input.oninput = () => {
            this.query = input.value;
            this.renderResults();
        };
        const fuzzy = search.createEl('label', { cls: 'pem-pandoc-fuzzy-toggle' });
        fuzzy.createEl('input', { type: 'checkbox' }, checkbox => {
            checkbox.checked = this.fuzzy;
            checkbox.onchange = () => {
                this.fuzzy = checkbox.checked;
                this.renderResults();
            };
        });
        fuzzy.createSpan({ text: 'Enable fuzzy search' });
        this.confirmButton = search.createEl('button', { text: 'Confirm' });
        this.confirmButton.disabled = !this.selected;
        this.confirmButton.onclick = () => this.confirmSelected();
        this.resultsEl = content.createDiv({ cls: 'pem-pandoc-option-results' });
        this.renderResults();
        input.focus();
    }

    private renderResults(): void {
        if (!this.resultsEl) return;
        this.resultsEl.empty();
        const results = searchOptions(this.catalog, this.query, 120, this.fuzzy)
            .filter(result => this.optionFilter?.(result.option) ?? true)
            .slice(0, 80);

        for (const { option } of results) {
            this.renderResult(this.resultsEl, option);
        }

        if (this.confirmButton) this.confirmButton.disabled = !this.selected;
    }

    private renderResult(container: HTMLElement, option: OptionSpec): void {
        const row = container.createDiv({
            cls: option === this.selected ? 'pem-pandoc-option-result is-selected' : 'pem-pandoc-option-result',
            attr: { title: option.description }
        });
        row.onclick = () => {
            this.selected = option;
            this.renderResults();
        };
        row.ondblclick = () => this.choose(option);
        row.createEl('div', { cls: 'pem-pandoc-option-result-key', text: optionLabel(option) });
        row.createEl('div', {
            cls: 'pem-pandoc-option-result-type',
            text: optionValueTypeText(option)
        });
        row.createEl('div', {
            cls: 'pem-pandoc-option-result-desc',
            text: option.description || option.valueKind
        });
    }

    private confirmSelected(): void {
        if (!this.selected) return;
        this.choose(this.selected);
    }

    private choose(option: OptionSpec): void {
        this.onChoose(option);
        this.close();
    }
}
