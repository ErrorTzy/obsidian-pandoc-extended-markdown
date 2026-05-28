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
    renderFormatRow(section, draft, '-f', draft.from, catalog.inputFormats, value => {
        draft.from = value;
    }, true, actions);
    renderFormatRow(section, draft, '-t', draft.to, catalog.outputFormats, value => {
        draft.to = value;
    }, false, actions);
    renderStandaloneRow(section, draft, actions);
    renderListRows(section, draft, '--resource-path', draft.resourcePaths, 'folder path', actions);
    renderListRows(section, draft, '-L', draft.luaFilters, 'file path', actions);
    renderMetadataRows(section, draft, actions);

    for (const row of draft.optionRows) {
        renderOptionRow(section, draft, row, catalog, actions);
    }

    createButton(section, '+', () => {
        draft.optionRows.push(createEmptyOptionRow(actions.nextOptionIndex()));
        actions.render();
    }, 'Add option');
}

function renderFormatRow(
    container: HTMLElement,
    draft: ProfileDraft,
    key: string,
    value: string,
    formats: string[],
    onChange: (value: string) => void,
    allowBlank: boolean,
    actions: PandocCommandRowActions
): void {
    const row = createRow(container, key, 'format string');
    const select = createSelect(row.valueEl, allowBlank ? [['', 'default markdown']] : []);
    for (const format of formats) select.createEl('option', { value: format, text: format });
    select.value = value;
    select.onchange = () => {
        onChange(select.value);
        actions.updatePreview(draft);
    };
}

function renderStandaloneRow(
    container: HTMLElement,
    draft: ProfileDraft,
    actions: PandocCommandRowActions
): void {
    const row = createRow(container, '-s', 'flag');
    const select = createSelect(row.valueEl, [['false', 'off'], ['true', 'on']]);
    select.value = draft.standalone ? 'true' : 'false';
    select.onchange = () => {
        draft.standalone = select.value === 'true';
        actions.updatePreview(draft);
    };
}

function renderListRows(
    container: HTMLElement,
    draft: ProfileDraft,
    key: string,
    values: string[],
    typeLabel: string,
    actions: PandocCommandRowActions
): void {
    for (const [index, value] of values.entries()) {
        const row = createRow(container, key, typeLabel);
        const input = createInput(row.valueEl, value, next => {
            values[index] = next;
            actions.updatePreview(draft);
        });
        if (typeLabel === 'folder path') addFolderButton(row.valueEl, input);
        createButton(row.actionsEl, 'x', () => {
            values.splice(index, 1);
            actions.render();
        }, 'Remove option');
    }
}

function renderMetadataRows(
    container: HTMLElement,
    draft: ProfileDraft,
    actions: PandocCommandRowActions
): void {
    for (const [key, value] of Object.entries(draft.metadata)) {
        const row = createRow(container, '-M', 'key=value');
        createInput(row.valueEl, `${key}=${value}`, next => {
            const nextMetadata = { ...draft.metadata };
            delete nextMetadata[key];
            Object.assign(nextMetadata, parseSingleKeyValue(next));
            draft.metadata = nextMetadata;
            actions.updatePreview(draft);
        });
        createButton(row.actionsEl, 'x', () => {
            delete draft.metadata[key];
            actions.render();
        }, 'Remove option');
    }
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
    if (spec?.valueKind === 'directory') addFolderButton(valueEl, control);
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
        const select = createSelect(container, []);
        for (const value of spec.values) select.createEl('option', { value, text: value });
        select.value = row.value;
        return select;
    }

    const type = ['integer', 'number'].includes(spec?.valueKind ?? '') ? 'number' : 'text';
    return createInput(container, row.value, value => {
        row.value = value;
    }, type, spec?.valuePlaceholder ?? 'Value');
}

function createRow(container: HTMLElement, key: string, typeLabel: string): {
    valueEl: HTMLElement;
    actionsEl: HTMLElement;
} {
    const row = container.createDiv({ cls: 'pem-pandoc-builder-row' });
    row.createEl('input', {
        type: 'text',
        cls: 'pem-pandoc-key-input',
        value: key,
        attr: { readonly: 'true' }
    });
    row.createEl('span', { cls: 'pem-pandoc-row-separator', text: ':' });
    const valueEl = row.createDiv({ cls: 'pem-pandoc-value-cell' });
    row.createEl('span', { cls: 'pem-pandoc-row-type', text: `type: ${typeLabel}` });
    const actionsEl = row.createDiv({ cls: 'pem-pandoc-row-actions' });
    return { valueEl, actionsEl };
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

function parseSingleKeyValue(text: string): Record<string, string> {
    const index = text.indexOf('=');
    if (index < 1) return {};
    return { [text.slice(0, index).trim()]: text.slice(index + 1).trim() };
}

function typeText(spec?: OptionSpec): string {
    if (!spec) return 'type: unknown';
    if (spec.valueKind === 'none') return 'type: flag';
    if (spec.valueKind === 'format') return 'type: format string';
    if (spec.valueKind === 'directory') return 'type: folder path';
    if (spec.valueKind === 'file') return 'type: file path';
    return `type: ${spec.valueKind}`;
}
