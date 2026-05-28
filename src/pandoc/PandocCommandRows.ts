import { ElectronPandocDesktopAdapter } from './desktopAdapter';
import {
    createEmptyOptionRow,
    findOptionSpec,
    optionLabel,
    searchOptionKeys
} from './gui-core';
import type {
    OptionSpec,
    PandocOptionCatalog,
    ProfileDraft,
    ProfileOptionRow
} from './gui-core';

type ValueInput = HTMLInputElement | HTMLSelectElement;

export interface PandocCommandRowActions {
    nextOptionIndex(): number;
    openOptionSearch(onChoose: (option: OptionSpec) => void): void;
    render(): void;
    updatePreview(draft: ProfileDraft): void;
}

export function renderPandocRows(
    container: HTMLElement,
    draft: ProfileDraft,
    catalog: PandocOptionCatalog,
    actions: PandocCommandRowActions
): void {
    const section = container.createDiv({ cls: 'pem-pandoc-option-section' });
    section.createEl('h3', { text: 'Options' });

    for (const row of draft.optionRows) {
        renderOptionRow(section, draft, row, catalog, actions);
    }

    createButton(section, '+', () => {
        draft.optionRows.push(createEmptyOptionRow(actions.nextOptionIndex()));
        actions.render();
    }, 'Add option');
}

function renderOptionRow(
    container: HTMLElement,
    draft: ProfileDraft,
    row: ProfileOptionRow,
    catalog: PandocOptionCatalog,
    actions: PandocCommandRowActions
): void {
    const spec = findOptionSpec(catalog, row.key);
    const item = container.createDiv({ cls: 'pem-pandoc-builder-row' });
    createKeyCell(item, row, draft, catalog, actions);
    item.createEl('span', { cls: 'pem-pandoc-row-separator', text: ':' });
    renderValueControl(item, draft, row, spec, actions);
    item.createEl('span', { cls: 'pem-pandoc-row-type', text: typeText(spec) });
    const controls = item.createDiv({ cls: 'pem-pandoc-row-actions' });
    createButton(controls, 'x', () => {
        draft.optionRows = draft.optionRows.filter(item => item.id !== row.id);
        actions.render();
    }, 'Remove option');
}

function createKeyCell(
    container: HTMLElement,
    row: ProfileOptionRow,
    draft: ProfileDraft,
    catalog: PandocOptionCatalog,
    actions: PandocCommandRowActions
): void {
    const cell = container.createDiv({ cls: 'pem-pandoc-key-cell' });
    const input = cell.createEl('input', {
        type: 'text',
        cls: 'pem-pandoc-key-input',
        attr: { placeholder: '--toc' }
    });
    const suggestions = cell.createDiv({ cls: 'pem-pandoc-key-suggestions' });
    createButton(cell, '...', () => {
        actions.openOptionSearch(option => {
            row.key = option.key;
            actions.render();
        });
    }, 'Search pandoc options');
    input.value = row.key;
    input.oninput = () => {
        row.key = input.value;
        renderKeySuggestions(suggestions, row, input.value, catalog, actions);
        actions.updatePreview(draft);
    };
    input.onblur = () => {
        window.setTimeout(() => suggestions.empty(), 120);
    };
}

function renderKeySuggestions(
    container: HTMLElement,
    row: ProfileOptionRow,
    query: string,
    catalog: PandocOptionCatalog,
    actions: PandocCommandRowActions
): void {
    container.empty();
    for (const { option } of searchOptionKeys(catalog, query, 6)) {
        const button = container.createEl('button', { text: optionLabel(option) });
        button.onmousedown = event => event.preventDefault();
        button.onclick = () => {
            row.key = option.key;
            actions.render();
        };
    }
}

function renderValueControl(
    container: HTMLElement,
    draft: ProfileDraft,
    row: ProfileOptionRow,
    spec: OptionSpec | undefined,
    actions: PandocCommandRowActions
): void {
    const valueEl = container.createDiv({ cls: 'pem-pandoc-value-cell' });
    const control = createTypedValueControl(valueEl, row, spec);
    control.onchange = () => {
        row.value = control.value;
        actions.updatePreview(draft);
    };
    if (['directory', 'pathList'].includes(spec?.valueKind ?? '')) {
        addFolderButton(valueEl, control);
    }
}

function createTypedValueControl(
    container: HTMLElement,
    row: ProfileOptionRow,
    spec?: OptionSpec
): ValueInput {
    if (spec?.valueKind === 'none') return createDisabledInput(container, 'no value');
    if (spec?.valueKind === 'boolean') {
        const select = createSelect(container, [['', 'on'], ['false', 'off']]);
        select.value = row.value;
        return select;
    }
    if (spec?.values?.length) {
        const select = createSelect(container, spec.mapsTo === 'from' ? [['', 'default markdown']] : []);
        for (const value of spec.values) select.createEl('option', { value, text: value });
        select.value = row.value;
        return select;
    }

    const type = ['integer', 'number'].includes(spec?.valueKind ?? '') ? 'number' : 'text';
    return createInput(container, row.value, value => {
        row.value = value;
    }, type, spec?.valuePlaceholder ?? 'Value');
}

function createInput(
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

function createSelect(container: HTMLElement, options: string[][]): HTMLSelectElement {
    const select = container.createEl('select');
    for (const [value, text] of options) select.createEl('option', { value, text });
    return select;
}

function createDisabledInput(container: HTMLElement, placeholder: string): HTMLInputElement {
    const input = createInput(container, '', () => undefined, 'text', placeholder);
    input.disabled = true;
    return input;
}

function createButton(
    container: HTMLElement,
    text: string,
    onClick: () => void,
    label = text
): HTMLButtonElement {
    const button = container.createEl('button', { text, attr: { 'aria-label': label } });
    button.onclick = onClick;
    return button;
}

function addFolderButton(container: HTMLElement, input: ValueInput): void {
    createButton(container, 'Browse', () => {
        void chooseFolder(input);
    });
}

async function chooseFolder(input: ValueInput): Promise<void> {
    const selected = await new ElectronPandocDesktopAdapter().chooseFolder(input.value);
    if (!selected) return;
    input.value = selected;
    input.dispatchEvent(new Event('change'));
}

function typeText(spec?: OptionSpec): string {
    if (!spec) return 'type: unknown';
    if (spec.valueKind === 'none') return 'type: flag';
    if (spec.valueKind === 'format') return 'type: format string';
    if (spec.valueKind === 'directory') return 'type: folder path';
    if (spec.valueKind === 'pathList') return 'type: folder path';
    if (spec.valueKind === 'file') return 'type: file path';
    return `type: ${spec.valueKind}`;
}
