import { Modal } from 'obsidian';

import {
    optionLabel,
    optionValueTypeText,
    searchOptions
} from '../../../core';
import type {
    OptionSpec,
    PandocOptionCatalog
} from '../../../core';

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
        this.renderHeader(this.resultsEl);
        const results = searchOptions(this.catalog, this.query, 120, this.fuzzy)
            .filter(result => this.optionFilter?.(result.option) ?? true)
            .slice(0, 80);

        for (const { option } of results) {
            this.renderResult(this.resultsEl, option);
        }

        if (this.confirmButton) this.confirmButton.disabled = !this.selected;
    }

    private renderHeader(container: HTMLElement): void {
        const header = container.createDiv({ cls: 'pem-pandoc-option-result-header' });
        header.createEl('div', { text: 'Flag' });
        header.createEl('div', { text: 'Argument type' });
        header.createEl('div', { text: 'Description' });
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
        this.renderHighlightedCell(row, 'pem-pandoc-option-result-key', optionLabel(option));
        row.createEl('div', {
            cls: 'pem-pandoc-option-result-type',
            text: optionValueTypeText(option)
        });
        this.renderHighlightedCell(
            row,
            'pem-pandoc-option-result-desc',
            option.description || option.valueKind
        );
    }

    private confirmSelected(): void {
        if (!this.selected) return;
        this.choose(this.selected);
    }

    private choose(option: OptionSpec): void {
        this.onChoose(option);
        this.close();
    }

    private renderHighlightedCell(row: HTMLElement, className: string, text: string): void {
        const cell = row.createEl('div', { cls: className });
        const ranges = matchRanges(text, this.query, this.fuzzy);
        let position = 0;

        for (const range of ranges) {
            if (range.start > position) {
                cell.appendChild(document.createTextNode(text.slice(position, range.start)));
            }
            cell.createEl('mark', {
                cls: 'pem-pandoc-option-search-highlight',
                text: text.slice(range.start, range.end)
            });
            position = range.end;
        }

        if (position < text.length) {
            cell.appendChild(document.createTextNode(text.slice(position)));
        }
    }
}

interface MatchRange {
    start: number;
    end: number;
}

function matchRanges(text: string, query: string, fuzzy: boolean): MatchRange[] {
    const terms = highlightTerms(query);
    if (terms.length === 0) return [];

    const exactRanges = mergeRanges(terms.flatMap(term => exactMatchRanges(text, term)));
    if (exactRanges.length > 0 || !fuzzy) return exactRanges;

    return fuzzyMatchRanges(text, terms.join(''));
}

function highlightTerms(query: string): string[] {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    const terms = [normalizedQuery, ...normalizedQuery.split(/\s+/)]
        .filter(term => term.length > 0);
    return Array.from(new Set(terms));
}

function exactMatchRanges(text: string, term: string): MatchRange[] {
    const ranges: MatchRange[] = [];
    const normalizedText = text.toLowerCase();
    let position = 0;

    while (position < text.length) {
        const start = normalizedText.indexOf(term, position);
        if (start < 0) break;
        ranges.push({ start, end: start + term.length });
        position = start + term.length;
    }

    return ranges;
}

function fuzzyMatchRanges(text: string, query: string): MatchRange[] {
    const ranges: MatchRange[] = [];
    const normalizedText = text.toLowerCase();
    let position = 0;

    for (const char of query) {
        const start = normalizedText.indexOf(char, position);
        if (start < 0) return [];
        ranges.push({ start, end: start + 1 });
        position = start + 1;
    }

    return mergeRanges(ranges);
}

function mergeRanges(ranges: MatchRange[]): MatchRange[] {
    const sorted = [...ranges].sort((a, b) => a.start - b.start || b.end - a.end);
    const merged: MatchRange[] = [];

    for (const range of sorted) {
        const previous = merged.length > 0 ? merged[merged.length - 1] : undefined;
        if (previous && range.start <= previous.end) {
            previous.end = Math.max(previous.end, range.end);
        } else {
            merged.push({ ...range });
        }
    }

    return merged;
}
