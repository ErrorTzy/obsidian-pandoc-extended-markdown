import {
    addBrowseButton,
    addFolderBrowseButton
} from './PandocPathBrowse';
import { createPandocSelect } from './PandocSelect';
import { createTemplateValueInput } from './PandocTemplateValueInput';
import {
    basename,
    dirname,
    joinPath
} from './pathUtils';
import type { PandocCommandRowActions } from './PandocCommandRows';
import { resolvePandocValueWidget } from './gui-core';
import type {
    OptionValueAlternative,
    PandocValueWidgetRoute,
    OptionSpec,
    ProfileDraft,
    ProfileOptionRow
} from './gui-core';

type ValueInput = HTMLInputElement | HTMLSelectElement;
type ValueControl = ValueInput | undefined;

const hybridValueSelections = new WeakMap<ProfileOptionRow, OptionValueAlternative['id']>();

export function optionHasValueControl(spec: OptionSpec | undefined): boolean {
    return resolvePandocValueWidget(spec).widgetType !== 'noneWidget' || Boolean(hybridAlternatives(spec));
}

export function renderValueControl(
    container: HTMLElement,
    draft: ProfileDraft,
    row: ProfileOptionRow,
    spec: OptionSpec | undefined,
    actions: PandocCommandRowActions
): void {
    const alternatives = hybridAlternatives(spec);
    if (alternatives) {
        renderHybridValueControl(container, draft, row, spec!, alternatives, actions);
        return;
    }
    const control = createWidgetControl(container, row, draft, spec, resolvePandocValueWidget(spec), actions);
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

function renderHybridValueControl(
    container: HTMLElement,
    draft: ProfileDraft,
    row: ProfileOptionRow,
    spec: OptionSpec,
    alternatives: OptionValueAlternative[],
    actions: PandocCommandRowActions
): void {
    const selected = selectedAlternative(row, spec, alternatives);
    const typeSelect = createSelect(container, alternatives.map(alternative => [
        alternative.id,
        alternative.label
    ]), 'pem-pandoc-value-type-select-frame');
    const valueContainer = container.createDiv({ cls: 'pem-pandoc-hybrid-value' });
    typeSelect.addClass('pem-pandoc-value-type-select');
    typeSelect.value = selected.id;
    typeSelect.onchange = () => {
        const next = alternatives.find(alternative => alternative.id === typeSelect.value) ?? alternatives[0];
        hybridValueSelections.set(row, next.id);
        if (!valueBelongsToAlternative(row.value, next, alternatives)) row.value = '';
        actions.render();
        actions.updatePreview(draft);
    };
    renderAlternativeValueControl(valueContainer, draft, row, selected, spec, actions);
}

function renderAlternativeValueControl(
    container: HTMLElement,
    draft: ProfileDraft,
    row: ProfileOptionRow,
    alternative: OptionValueAlternative,
    spec: OptionSpec,
    actions: PandocCommandRowActions
): void {
    const route = resolvePandocValueWidget(alternative);
    const control = createWidgetControl(container, row, draft, alternative, route, actions, spec);
    if (!control) return;
    if (!isTemplateTextInput(control)) {
        control.onchange = () => {
            row.value = control.value;
            hybridValueSelections.set(row, alternative.id);
            actions.updatePreview(draft);
        };
    }
    addBrowseButton(container, alternative.valueKind, control, value => {
        row.value = value;
        hybridValueSelections.set(row, alternative.id);
        actions.updatePreview(draft);
        updateControlDisplay(control, row, draft, actions);
    });
}

function createWidgetControl(
    container: HTMLElement,
    row: ProfileOptionRow,
    draft: ProfileDraft,
    source: OptionSpec | OptionValueAlternative | undefined,
    route: PandocValueWidgetRoute,
    actions: PandocCommandRowActions,
    formatSpec?: OptionSpec
): ValueControl {
    if (route.widgetType === 'noneWidget') return undefined;
    if (route.widgetType === 'selectWidget') {
        return createSelectControl(container, row, draft, source, route, actions);
    }
    if (route.widgetType === 'keyValueWidget') {
        renderKeyValueControl(container, row, draft, route, actions);
        return undefined;
    }
    if (route.widgetType === 'outputFileWidget') {
        renderOutputFileControl(container, row, draft, actions);
        return undefined;
    }
    if (route.widgetType === 'formatWidget') {
        const spec = formatSpec ?? (source as OptionSpec | undefined);
        const input = createTemplateValueInput(container, row, draft, actions, route.placeholder);
        createButton(container, '...', () => {
            if (spec) actions.openFormatEditor(row, spec, draft);
        }, 'Edit pandoc format');
        return input;
    }
    if (route.widgetType === 'numberWidget') {
        return createInput(container, row.value, value => {
            row.value = value;
            actions.updatePreview(draft);
        }, route.inputType, route.placeholder);
    }
    return createTemplateValueInput(container, row, draft, actions, route.placeholder);
}

function createSelectControl(
    container: HTMLElement,
    row: ProfileOptionRow,
    draft: ProfileDraft,
    source: OptionSpec | OptionValueAlternative | undefined,
    route: PandocValueWidgetRoute,
    actions: PandocCommandRowActions
): ValueControl {
    if (!source?.values?.length) {
        return createInput(container, row.value, value => {
            row.value = value;
            actions.updatePreview(draft);
        }, 'text', route.placeholder);
    }

    const select = createSelect(container);
    for (const value of source.values) select.createEl('option', { value, text: value });
    select.value = row.value;
    return select;
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

function renderKeyValueControl(
    container: HTMLElement,
    row: ProfileOptionRow,
    draft: ProfileDraft,
    route: PandocValueWidgetRoute,
    actions: PandocCommandRowActions
): void {
    const control = container.createDiv({ cls: 'pem-pandoc-key-value-control' });
    const pair = splitKeyValue(row.value, route.separator ?? '=');
    const keyInput = createInput(control, pair.key, update, 'text', 'key');
    control.createEl('span', { cls: 'pem-pandoc-key-value-separator', text: route.separator ?? '=' });
    const valueInput = createInput(control, pair.value, update, 'text', 'value');

    function update(): void {
        row.value = joinKeyValue(keyInput.value, valueInput.value, route.separator ?? '=');
        actions.updatePreview(draft);
    }
}

function renderOutputFileControl(
    container: HTMLElement,
    row: ProfileOptionRow,
    draft: ProfileDraft,
    actions: PandocCommandRowActions
): void {
    const value = splitOutputFileValue(row.value);
    const control = container.createDiv({ cls: 'pem-pandoc-output-file-control' });
    const folderInput = createInput(control, value.folder, update, 'text', 'Folder');
    addFolderBrowseButton(control, folderInput, value => {
        folderInput.value = value;
        update();
    });
    const fileInput = createInput(control, value.fileName, update, 'text', 'File name');
    folderInput.addClass('pem-pandoc-output-folder-input');
    fileInput.addClass('pem-pandoc-output-file-name-input');

    function update(): void {
        row.value = joinOutputFileValue(folderInput.value, fileInput.value);
        actions.updatePreview(draft);
    }
}

function splitOutputFileValue(value: string): { folder: string; fileName: string } {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '-') return { folder: '', fileName: trimmed };

    return {
        folder: dirname(trimmed),
        fileName: basename(trimmed)
    };
}

function joinOutputFileValue(folder: string, fileName: string): string {
    const trimmedFolder = folder.trim();
    const trimmedFileName = fileName.trim();
    if (!trimmedFolder) return trimmedFileName;
    if (!trimmedFileName) return trimmedFolder;
    return joinPath(trimmedFolder, trimmedFileName);
}

function splitKeyValue(value: string, separator: string): { key: string; value: string } {
    const index = value.indexOf(separator);
    if (index < 0) return { key: value, value: '' };
    return {
        key: value.slice(0, index),
        value: value.slice(index + 1)
    };
}

function joinKeyValue(key: string, value: string, separator: string): string {
    if (!value && !key.includes(separator)) return key;
    return `${key}${separator}${value}`;
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

function createSelect(
    container: HTMLElement,
    options: string[][] = [],
    frameClass = ''
): HTMLSelectElement {
    return createPandocSelect(container, options, {}, frameClass);
}

function hybridAlternatives(spec: OptionSpec | undefined): OptionValueAlternative[] | undefined {
    const alternatives = spec?.valueAlternatives?.filter(alternative => {
        if (alternative.valueKind === 'enum') return Boolean(alternative.values?.length);
        return true;
    });
    return alternatives && alternatives.length > 1 ? alternatives : undefined;
}

function selectedAlternative(
    row: ProfileOptionRow,
    spec: OptionSpec,
    alternatives: OptionValueAlternative[]
): OptionValueAlternative {
    const stored = alternatives.find(alternative => alternative.id === hybridValueSelections.get(row));
    if (stored && (!row.value || valueBelongsToAlternative(row.value, stored, alternatives))) return stored;

    const valueAlternative = alternatives.find(alternative => alternative.values?.includes(row.value));
    if (valueAlternative) return valueAlternative;
    const custom = alternatives.find(alternative =>
        isCustomAlternative(alternative) && valueBelongsToAlternative(row.value, alternative, alternatives));
    if (custom && row.value) return custom;
    const path = alternatives.find(alternative => resolvePandocValueWidget(alternative).widgetType === 'pathWidget');
    if (path && row.value && valueBelongsToAlternative(row.value, path, alternatives)) return path;
    const openCustom = alternatives.find(isCustomAlternative);
    if (openCustom && row.value) return openCustom;
    if (path && row.value) return path;
    return alternatives.find(alternative => alternative.valueKind === spec.valueKind) ?? alternatives[0];
}

function valueBelongsToAlternative(
    value: string,
    alternative: OptionValueAlternative,
    alternatives: OptionValueAlternative[]
): boolean {
    const route = resolvePandocValueWidget(alternative);
    if (!value) return true;
    if (route.widgetType === 'noneWidget') return false;
    if (alternative.values) return alternative.values.includes(value);
    if (alternatives.some(item => item.values?.includes(value))) return false;
    if (alternative.id === 'URL') return looksLikeUrlValue(value);
    if (route.widgetType === 'keyValueWidget') return true;
    if (route.widgetType === 'keyWidget') return !knownKeyValueSeparators(alternatives)
        .some(separator => value.includes(separator));
    if (route.widgetType === 'pathWidget') return looksLikePathValue(value);
    return true;
}

function looksLikeUrlValue(value: string): boolean {
    return /^[a-z][a-z0-9+.-]*:/i.test(value);
}

function looksLikePathValue(value: string): boolean {
    return /[\\/]/.test(value) || value.includes('.') || value.includes('${');
}

function isCustomAlternative(alternative: OptionValueAlternative): boolean {
    const widgetType = resolvePandocValueWidget(alternative).widgetType;
    return widgetType !== 'noneWidget' &&
        widgetType !== 'selectWidget' &&
        widgetType !== 'pathWidget';
}

function knownKeyValueSeparators(alternatives: OptionValueAlternative[]): string[] {
    return alternatives
        .map(alternative => resolvePandocValueWidget(alternative).separator)
        .filter((separator): separator is string => Boolean(separator));
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
