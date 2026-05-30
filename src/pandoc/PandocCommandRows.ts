import { addBrowseButton } from './PandocPathBrowse';
import { createPandocCommandRowSlots } from './PandocCommandRowSlots';
import {
    createEmptyOptionRow,
    findOptionSpec,
    optionLabel,
    optionValueTypeText,
    searchOptionKeys
} from './gui-core';
import { createTemplateValueInput } from './PandocTemplateValueInput';
import type {
    OptionField,
    OptionSpec,
    PandocOptionCatalog,
    ProfileDraft,
    ProfileOptionRow
} from './gui-core';
import type { ExportVariables } from './types';
import type { TemplateVariableContext } from './templateVariables';

type ValueInput = HTMLInputElement | HTMLSelectElement;
type ValueControl = ValueInput | undefined;

const PROTECTED_CORE_FIELDS: OptionField[] = ['from', 'to', 'output'];

export interface PandocCommandRowActions {
    nextOptionIndex(): number;
    getVariables(draft: ProfileDraft): ExportVariables;
    getDisplayVariables?(draft: ProfileDraft): ExportVariables;
    getTemplateVariableContext?(draft: ProfileDraft): TemplateVariableContext;
    getDisplayTemplateVariableContext?(draft: ProfileDraft): TemplateVariableContext;
    openFormatEditor(row: ProfileOptionRow, spec: OptionSpec, draft: ProfileDraft): void;
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
    // eslint-disable-next-line obsidianmd/ui/sentence-case
    section.createEl('h3', { text: 'Command Options' });
    const protectedRowIds = protectedCoreRowIds(draft.optionRows, catalog);

    for (const row of draft.optionRows) {
        renderOptionRow(section, draft, row, catalog, actions, protectedRowIds);
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
    actions: PandocCommandRowActions,
    protectedRowIds: Set<string>
): void {
    const spec = findOptionSpec(catalog, row.key);
    const slots = createPandocCommandRowSlots(container);
    renderKeyCell(slots.key, row, draft, catalog, actions, protectedRowIds.has(row.id), spec);
    if (row.role === 'input' || spec?.valueKind !== 'none') {
        slots.separator.textContent = ':';
    }
    renderValueControl(slots.value, draft, row, spec, actions);
    slots.type.textContent = typeText(row, spec);
    if (isProtectedRow(row, protectedRowIds)) return;

    createButton(slots.actions, 'x', () => {
        draft.optionRows = draft.optionRows.filter(item => item.id !== row.id);
        actions.render();
    }, 'Remove option');
}

function renderKeyCell(
    cell: HTMLElement,
    row: ProfileOptionRow,
    draft: ProfileDraft,
    catalog: PandocOptionCatalog,
    actions: PandocCommandRowActions,
    protectedCoreRow: boolean,
    spec?: OptionSpec
): void {
    if (row.role === 'input') {
        // eslint-disable-next-line obsidianmd/ui/sentence-case
        cell.createEl('span', { cls: 'pem-pandoc-key-label', text: 'input file' });
        return;
    }

    if (protectedCoreRow) {
        cell.createEl('span', { cls: 'pem-pandoc-key-label', text: coreOptionLabel(spec) });
        return;
    }

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
        window.setTimeout(() => {
            suggestions.empty();
            actions.render();
        }, 120);
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
    for (const { option } of searchOptionKeys(catalog, query, 6)
        .filter(result => !isProtectedCoreOption(result.option))) {
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
    const control = createTypedValueControl(container, row, draft, spec, actions);
    if (!control) return;
    if (!isTemplateTextInput(control)) {
        control.onchange = () => {
            row.value = control.value;
            actions.updatePreview(draft);
        };
    }
    addBrowseButton(container, spec?.valueKind, control, value => {
        row.value = value;
        actions.updatePreview(draft);
        updateControlDisplay(control, row, draft, actions);
    });
}

function isTemplateTextInput(control: ValueInput): control is HTMLInputElement {
    return control instanceof HTMLInputElement && control.type === 'text' && !control.disabled;
}

function updateControlDisplay(
    control: ValueInput,
    row: ProfileOptionRow,
    draft: ProfileDraft,
    actions: PandocCommandRowActions
): void {
    if (isTemplateTextInput(control)) {
        control.dispatchEvent(new Event('pem-pandoc-refresh-display'));
    } else {
        row.value = control.value;
    }
}

function createTypedValueControl(
    container: HTMLElement,
    row: ProfileOptionRow,
    draft: ProfileDraft,
    spec: OptionSpec | undefined,
    actions: PandocCommandRowActions
): ValueControl {
    if (spec?.valueKind === 'none') return undefined;
    if (spec?.valueKind === 'format') {
        const input = createTemplateValueInput(container, row, draft, actions, spec.valuePlaceholder ?? 'FORMAT');
        createButton(container, '...', () => {
            actions.openFormatEditor(row, spec, draft);
        }, 'Edit pandoc format');
        return input;
    }

    if (spec?.values?.length) {
        const select = createSelect(container);
        for (const value of spec.values) select.createEl('option', { value, text: value });
        select.value = row.value;
        return select;
    }

    const type = ['integer', 'number'].includes(spec?.valueKind ?? '') ? 'number' : 'text';
    if (type === 'number') {
        return createInput(container, row.value, value => {
            row.value = value;
            actions.updatePreview(draft);
        }, type, spec?.valuePlaceholder ?? 'Value');
    }

    return createTemplateValueInput(container, row, draft, actions, spec?.valuePlaceholder ?? 'Value');
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

function createSelect(container: HTMLElement, options: string[][] = []): HTMLSelectElement {
    const select = container.createEl('select');
    for (const [value, text] of options) select.createEl('option', { value, text });
    return select;
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

function coreOptionLabel(spec?: OptionSpec): string {
    if (spec?.mapsTo === 'from') {
        return 'from format';
    }
    if (spec?.mapsTo === 'to') {
        return 'to format';
    }
    if (spec?.mapsTo === 'output') {
        return 'output file';
    }
    return 'built-in option';
}

function typeText(row: ProfileOptionRow, spec?: OptionSpec): string {
    if (row.role === 'input') return 'type: input file';
    return optionValueTypeText(spec);
}

function isProtectedRow(row: ProfileOptionRow, protectedRowIds: Set<string>): boolean {
    return row.role === 'input' || protectedRowIds.has(row.id);
}

function protectedCoreRowIds(
    rows: ProfileOptionRow[],
    catalog: PandocOptionCatalog
): Set<string> {
    const ids = new Set<string>();
    const seen = new Set<OptionField>();

    for (const row of rows) {
        const spec = findOptionSpec(catalog, row.key);
        const field = spec?.mapsTo;
        if (!field || !isProtectedCoreField(field) || seen.has(field)) continue;
        ids.add(row.id);
        seen.add(field);
    }

    return ids;
}

function isProtectedCoreOption(option: OptionSpec): boolean {
    return Boolean(option.mapsTo && isProtectedCoreField(option.mapsTo));
}

function isProtectedCoreField(field: OptionField): boolean {
    return PROTECTED_CORE_FIELDS.includes(field);
}
