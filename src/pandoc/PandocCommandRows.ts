import { ElectronPandocDesktopAdapter } from './desktopAdapter';
import {
    createEmptyOptionRow,
    findOptionSpec,
    optionLabel,
    searchOptionKeys
} from './gui-core';
import { renderExportTemplate } from './template';
import type {
    OptionSpec,
    PandocOptionCatalog,
    ProfileDraft,
    ProfileOptionRow
} from './gui-core';
import type { ExportVariables } from './types';

type ValueInput = HTMLInputElement | HTMLSelectElement;

const TEMPLATE_VARIABLE_NAMES = [
    'currentPath',
    'currentDir',
    'currentFileName',
    'currentFileFullName',
    'outputPath',
    'outputDir',
    'outputFileName',
    'outputFileFullName',
    'vaultDir',
    'attachmentFolderPath',
    'embedDirs',
    'pluginDir',
    'luaFilterDir',
    'fromFormat'
];

export interface PandocCommandRowActions {
    nextOptionIndex(): number;
    getVariables(draft: ProfileDraft): ExportVariables;
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
    const control = createTypedValueControl(valueEl, row, draft, spec, actions);
    if (!isTemplateTextInput(control)) {
        control.onchange = () => {
            row.value = control.value;
            actions.updatePreview(draft);
        };
    }
    if (['directory', 'pathList'].includes(spec?.valueKind ?? '')) {
        addFolderButton(valueEl, control, value => {
            row.value = value;
            actions.updatePreview(draft);
            updateControlDisplay(control, row, draft, actions);
        });
    }
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
        control.value = renderValueForDisplay(row.value, draft, actions);
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
    if (type === 'number') {
        return createInput(container, row.value, value => {
            row.value = value;
        }, type, spec?.valuePlaceholder ?? 'Value');
    }

    return createTemplateValueInput(container, row, draft, actions, spec?.valuePlaceholder ?? 'Value');
}

function createTemplateValueInput(
    container: HTMLElement,
    row: ProfileOptionRow,
    draft: ProfileDraft,
    actions: PandocCommandRowActions,
    placeholder: string
): HTMLInputElement {
    const input = createInput(container, renderValueForDisplay(row.value, draft, actions), value => {
        row.value = value;
    }, 'text', placeholder);
    const suggestions = container.createDiv({ cls: 'pem-pandoc-key-suggestions pem-pandoc-variable-suggestions' });

    input.addEventListener('focus', () => {
        input.value = row.value;
    });
    input.oninput = () => {
        row.value = input.value;
        renderVariableSuggestions(suggestions, input, row, draft, actions);
        actions.updatePreview(draft);
    };
    input.addEventListener('blur', () => {
        window.setTimeout(() => suggestions.empty(), 120);
        input.value = renderValueForDisplay(row.value, draft, actions);
    });

    return input;
}

function renderValueForDisplay(
    value: string,
    draft: ProfileDraft,
    actions: PandocCommandRowActions
): string {
    return renderExportTemplate(value, actions.getVariables(draft));
}

function renderVariableSuggestions(
    container: HTMLElement,
    input: HTMLInputElement,
    row: ProfileOptionRow,
    draft: ProfileDraft,
    actions: PandocCommandRowActions
): void {
    const trigger = getVariableTrigger(input.value, input.selectionStart ?? input.value.length);
    container.empty();
    if (!trigger) return;

    for (const name of getVariableSuggestions(trigger.query, actions.getVariables(draft))) {
        const button = container.createEl('button', { text: `\${${name}}` });
        button.onmousedown = event => event.preventDefault();
        button.onclick = () => {
            insertVariable(input, row, trigger, name);
            actions.updatePreview(draft);
            container.empty();
        };
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

function getVariableSuggestions(query: string, variables: ExportVariables): string[] {
    const lowerQuery = query.toLowerCase();
    return TEMPLATE_VARIABLE_NAMES
        .filter(name => variables[name] !== undefined)
        .filter(name => name.toLowerCase().startsWith(lowerQuery))
        .slice(0, 8);
}

function insertVariable(
    input: HTMLInputElement,
    row: ProfileOptionRow,
    trigger: { start: number },
    name: string
): void {
    const cursor = input.selectionStart ?? input.value.length;
    const nextValue = `${input.value.slice(0, trigger.start)}\${${name}}${input.value.slice(cursor)}`;
    input.value = nextValue;
    row.value = nextValue;
    const nextCursor = trigger.start + name.length + 3;
    input.setSelectionRange(nextCursor, nextCursor);
    input.focus();
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

function addFolderButton(
    container: HTMLElement,
    input: ValueInput,
    onChoose: (value: string) => void
): void {
    createButton(container, 'Browse', () => {
        void chooseFolder(input, onChoose);
    });
}

async function chooseFolder(
    input: ValueInput,
    onChoose: (value: string) => void
): Promise<void> {
    const selected = await new ElectronPandocDesktopAdapter().chooseFolder(input.value);
    if (!selected) return;
    input.value = selected;
    onChoose(selected);
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
