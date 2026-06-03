/**
 * @jest-environment jsdom
 */
import { describe, expect, it, jest } from '@jest/globals';
import { App } from 'obsidian';

import { PandocFormatEditorModal } from '../../../src/pandoc/PandocFormatEditor';
import { renderPandocRows } from '../../../src/pandoc/PandocCommandRows';
import { PandocOptionSearchModal } from '../../../src/pandoc/PandocOptionSearchModal';
import { buildTemplateVariableContext } from '../../../src/pandoc/templateVariables';
import { FALLBACK_PANDOC_CATALOG } from '../../../src/pandoc/gui-core';
import type { ProfileDraft } from '../../../src/pandoc/gui-core';
import type { ExportVariables } from '../../../src/pandoc/types';
import { FORMAT_EXTENSION_FIXTURE_CATALOG } from './formatExtensionFixture';

const variables: ExportVariables = {
    vaultDir: '/vault',
    pluginDir: '/plugin',
    luaFilterDir: '/plugin/lua_filter',
    currentPath: '/vault/note.md',
    currentDir: '/vault',
    currentFileName: 'note',
    currentFileFullName: 'note.md',
    outputPath: '/exports/note.html',
    outputDir: '/exports',
    outputFileName: 'note',
    outputFileFullName: 'note.html',
    attachmentFolderPath: '/vault/assets',
    embedDirs: '/vault/assets',
    fromFormat: 'markdown',
    metadata: {}
};

const relativeVariables: ExportVariables = {
    ...variables,
    pluginDir: '.obsidian/plugins/pandoc-extended-markdown',
    luaFilterDir: '.obsidian/plugins/pandoc-extended-markdown/lua_filter',
    currentPath: 'folder/note.md',
    currentDir: 'folder',
    outputPath: 'exports/note.html',
    outputDir: 'exports',
    attachmentFolderPath: 'folder/assets',
    embedDirs: 'folder/assets',
    outputExtension: '.html'
};

const absoluteFolderVariables: ExportVariables = {
    ...variables,
    pluginDir: '/vault/.obsidian/plugins/pandoc-extended-markdown',
    luaFilterDir: '/vault/.obsidian/plugins/pandoc-extended-markdown/lua_filter',
    currentPath: '/vault/folder/note.md',
    currentDir: '/vault/folder',
    outputPath: '/vault/exports/note.html',
    outputDir: '/vault/exports',
    attachmentFolderPath: '/vault/folder/assets',
    embedDirs: '/vault/folder/assets',
    outputExtension: '.html'
};

describe('Pandoc command rows', () => {
    it('renders path browse buttons, flag rows, and enum choices', () => {
        window.requestAnimationFrame = jest.fn(callback => {
            callback(0);
            return 0;
        });
        const container = enhanceElement(document.createElement('div'));
        const draft = createDraft();

        renderPandocRows(container, draft, FALLBACK_PANDOC_CATALOG, {
            nextOptionIndex: () => 1,
            getVariables: () => variables,
            openFormatEditor: () => undefined,
            openOptionSearch: () => undefined,
            render: () => undefined,
            updatePreview: () => undefined
        });

        const rows = Array.from(container.querySelectorAll('.pem-pandoc-builder-row'));
        expect(rowHasBrowseButton(rows, '--resource-path')).toBe(true);
        expect(rowHasBrowseButton(rows, '-L')).toBe(true);
        expect(rowHasBrowseButton(rows, 'output file')).toBe(true);
        expect(rowHasBrowseButton(rows, '--columns')).toBe(false);
        expect(rowHasValueControl(rows, '-s')).toBe(false);
        expect(rowHasValueControl(rows, '--toc')).toBe(true);
        expect(rowHasSeparator(rows, '-s')).toBe(false);
        expect(rowHasSeparator(rows, '--toc')).toBe(true);
        expect(rowSelectValues(rows, '--toc')).toEqual(['none', 'BOOLEAN']);
        expect(rowHasSeparator(rows, '--eol')).toBe(true);
        expect(rowSelectValues(rows, '--eol')).toEqual(['crlf', 'lf', 'native']);
        expect(rowSelectHasDropdownFrame(rows, '--eol')).toBe(true);
        expect(rowHasRemoveButton(rows, 'input file')).toBe(false);
        expect(rowHasRemoveButton(rows, 'from format')).toBe(false);
        expect(rowHasRemoveButton(rows, 'to format')).toBe(false);
        expect(rowHasRemoveButton(rows, 'output file')).toBe(false);
        expect(rowHasKeyInput(rows, 'from format')).toBe(false);
        expect(rowHasKeyInput(rows, 'to format')).toBe(false);
        expect(rowHasKeyInput(rows, 'output file')).toBe(false);
        expect(rowHasButton(rows, 'from format', 'Show -f option help')).toBe(false);
        expect(rowHasButton(rows, 'to format', 'Show -t option help')).toBe(false);
        expect(rowHasButton(rows, 'output file', 'Show -o option help')).toBe(false);
        expect(rowHasRemoveButton(rows, '--toc')).toBe(true);
    });

    it('renders hybrid enum, style, and file option values explicitly', () => {
        window.requestAnimationFrame = jest.fn(callback => {
            callback(0);
            return 0;
        });
        const presetContainer = enhanceElement(document.createElement('div'));
        const presetDraft = createDraft();
        presetDraft.optionRows = [
            { id: 'highlight', key: '--syntax-highlighting', value: 'default', enabled: true }
        ];

        renderPandocRows(presetContainer, presetDraft, FALLBACK_PANDOC_CATALOG, commandActions());

        const presetRow = findRow(presetContainer, '--syntax-highlighting');
        const presetSelects = Array.from(presetRow.querySelectorAll('.pem-pandoc-value-cell select')) as HTMLSelectElement[];
        expect(selectValues(presetSelects[0])).toEqual(['ENUM', 'STYLE', 'FILE']);
        expect(selectValues(presetSelects[1])).toEqual(expect.arrayContaining(['default', 'none', 'idiomatic']));
        expect(presetSelects.every(select => Boolean(select.closest('.pem-pandoc-select-frame')))).toBe(true);
        expect(presetRow.querySelector('.pem-pandoc-value-cell input')).toBeNull();

        const fileContainer = enhanceElement(document.createElement('div'));
        const fileDraft = createDraft();
        fileDraft.optionRows = [
            {
                id: 'highlight-file',
                key: '--syntax-highlighting',
                value: '${pluginDir}/theme.theme',
                enabled: true
            }
        ];

        renderPandocRows(fileContainer, fileDraft, FALLBACK_PANDOC_CATALOG, commandActions());

        const fileRow = findRow(fileContainer, '--syntax-highlighting');
        const typeSelect = fileRow.querySelector('.pem-pandoc-value-type-select') as HTMLSelectElement;
        expect(typeSelect.value).toBe('FILE');
        expect(typeSelect.closest('.pem-pandoc-value-type-select-frame')).not.toBeNull();
        expect(fileRow.querySelector('.pem-pandoc-value-cell input')).not.toBeNull();
        expect(rowHasBrowseButton([fileRow], '--syntax-highlighting')).toBe(true);
    });

    it('routes KEY:VAL and KEY=VAL options to paired key and value inputs', () => {
        const container = enhanceElement(document.createElement('div'));
        const draft = createDraft();
        const updatePreview = jest.fn();
        draft.optionRows = [
            { id: 'metadata-long', key: '--metadata', value: 'title:My note', enabled: true },
            { id: 'metadata-short', key: '-M', value: 'author=Jane Doe', enabled: true }
        ];

        renderPandocRows(container, draft, FALLBACK_PANDOC_CATALOG, {
            ...commandActions(),
            updatePreview
        });

        const row = findRow(container, '--metadata');
        const typeSelect = row.querySelector('.pem-pandoc-value-type-select') as HTMLSelectElement;
        const inputs = keyValueInputs(row);
        expect(typeSelect.value).toBe('KEY:VAL');
        expect(keyValueSeparator(row)).toBe(':');
        expect(inputs.map(input => input.getAttribute('placeholder'))).toEqual(['key', 'value']);
        expect(inputs.map(input => input.value)).toEqual(['title', 'My note']);

        const equalsRow = findRow(container, '-M');
        const equalsTypeSelect = equalsRow.querySelector('.pem-pandoc-value-type-select') as HTMLSelectElement;
        const equalsInputs = keyValueInputs(equalsRow);
        expect(equalsTypeSelect.value).toBe('KEY=VAL');
        expect(keyValueSeparator(equalsRow)).toBe('=');
        expect(equalsInputs.map(input => input.value)).toEqual(['author', 'Jane Doe']);

        inputs[0].value = 'author';
        inputs[0].dispatchEvent(new InputEvent('input', { bubbles: true }));
        inputs[1].value = 'Jane Doe';
        inputs[1].dispatchEvent(new InputEvent('input', { bubbles: true }));

        expect(draft.optionRows[0].value).toBe('author:Jane Doe');
        expect(updatePreview).toHaveBeenCalledTimes(2);

        const keyOnlyContainer = enhanceElement(document.createElement('div'));
        const keyOnlyDraft = createDraft();
        keyOnlyDraft.optionRows = [
            { id: 'metadata', key: '--metadata', value: 'title', enabled: true }
        ];
        renderPandocRows(keyOnlyContainer, keyOnlyDraft, FALLBACK_PANDOC_CATALOG, commandActions());
        const keyOnlyRow = findRow(keyOnlyContainer, '--metadata');
        const keyOnlyTypeSelect = keyOnlyRow.querySelector('.pem-pandoc-value-type-select') as HTMLSelectElement;
        keyOnlyTypeSelect.value = 'KEY:VAL';
        keyOnlyTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));

        expect(keyOnlyDraft.optionRows[0].value).toBe('title');
    });

    it('renders template variable suggestions with resolved preview values', () => {
        window.requestAnimationFrame = jest.fn(callback => {
            callback(0);
            return 0;
        });
        const container = enhanceElement(document.createElement('div'));
        const draft = createDraft();
        const availableVariables: ExportVariables = {
            ...variables,
            customToolDir: '/custom/tool'
        };

        renderPandocRows(container, draft, FALLBACK_PANDOC_CATALOG, {
            nextOptionIndex: () => 1,
            getVariables: () => availableVariables,
            openFormatEditor: () => undefined,
            openOptionSearch: () => undefined,
            render: () => undefined,
            updatePreview: () => undefined
        });

        const input = findValueInput(container, '--resource-path');
        input.focus();
        input.value = '$';
        input.dispatchEvent(new InputEvent('input', { bubbles: true }));

        const suggestions = input
            .closest('.pem-pandoc-builder-row')
            ?.querySelector('.pem-pandoc-variable-suggestions');
        const variableSuggestions = Array.from(
            suggestions?.querySelectorAll('.pem-pandoc-variable-suggestion') ?? []
        ).map(suggestion => ({
            name: suggestion.querySelector('.pem-pandoc-variable-suggestion-name')?.textContent,
            value: suggestion.querySelector('.pem-pandoc-variable-suggestion-value')?.textContent
        }));

        expect(suggestions?.textContent).toContain('${currentDir}');
        expect(suggestions?.textContent).toContain('/vault');
        expect(variableSuggestions).toContainEqual({
            name: '${currentPath}',
            value: '/vault/note.md'
        });
        expect(variableSuggestions).toContainEqual({
            name: '${luaFilterDir}',
            value: '/plugin/lua_filter'
        });
        expect(variableSuggestions).toContainEqual({
            name: '${customToolDir}',
            value: '/custom/tool'
        });
    });

    it('suggests opted-in runtime env variables after built-in export variables', () => {
        window.requestAnimationFrame = jest.fn(callback => {
            callback(0);
            return 0;
        });
        const container = enhanceElement(document.createElement('div'));
        const draft = createDraft();

        renderPandocRows(container, draft, FALLBACK_PANDOC_CATALOG, {
            nextOptionIndex: () => 1,
            getVariables: () => variables,
            getTemplateVariableContext: () => buildTemplateVariableContext(variables, {
                includeRuntimeEnv: true,
                runtimeEnv: {
                    PEM_ENV_DIR: '/env/dir',
                    currentDir: '/env/current'
                }
            }),
            openFormatEditor: () => undefined,
            openOptionSearch: () => undefined,
            render: () => undefined,
            updatePreview: () => undefined
        });

        const input = findValueInput(container, '--resource-path');
        input.focus();
        input.value = '$';
        input.dispatchEvent(new InputEvent('input', { bubbles: true }));

        const names = variableSuggestionTexts(input);
        expect(names).toContain('${PEM_ENV_DIR}');
        expect(names.indexOf('${luaFilterDir}')).toBeLessThan(names.indexOf('${PEM_ENV_DIR}'));
        expect(variableSuggestionValues(input).get('${currentDir}')).toBe('/vault');
    });

    it('renders blurred option values as absolute paths with appended prefixes muted', () => {
        window.requestAnimationFrame = jest.fn(callback => {
            callback(0);
            return 0;
        });
        const container = enhanceElement(document.createElement('div'));
        const draft = createDraft();

        renderPandocRows(container, draft, FALLBACK_PANDOC_CATALOG, {
            nextOptionIndex: () => 1,
            getVariables: () => absoluteFolderVariables,
            getDisplayVariables: () => relativeVariables,
            openFormatEditor: () => undefined,
            openOptionSearch: () => undefined,
            render: () => undefined,
            updatePreview: () => undefined
        });

        expect(findValueInput(container, 'input file').value).toBe('/vault/folder/note.md');
        expect(valueDisplayParts(container, 'input file')).toEqual([
            { text: '/vault/', muted: true },
            { text: 'folder/note.md', muted: false }
        ]);
        expect(valueDisplayFrame(container, 'input file').classList.contains('has-muted-display-prefix')).toBe(true);
        expect(outputFileInputs(container).map(input => input.value)).toEqual([
            '${outputDir}',
            '${currentFileName}${outputExtension}'
        ]);
        expect(valueDisplayParts(container, '--resource-path')).toEqual([
            { text: '/vault/', muted: true },
            { text: 'folder', muted: false }
        ]);
        expect(valueDisplayParts(container, '-L')).toEqual([
            { text: '/vault/', muted: true },
            { text: '.obsidian/plugins/pandoc-extended-markdown/lua_filter/CustomLabelList.lua', muted: false }
        ]);
    });

    it('renders output files as folder and file-name controls', () => {
        const container = enhanceElement(document.createElement('div'));
        const draft = createDraft();
        const updatePreview = jest.fn();

        renderPandocRows(container, draft, FALLBACK_PANDOC_CATALOG, {
            ...commandActions(),
            updatePreview
        });

        const [folderInput, fileInput] = outputFileInputs(container);
        expect(folderInput.value).toBe('${outputDir}');
        expect(fileInput.value).toBe('${currentFileName}${outputExtension}');

        folderInput.value = '/exports';
        folderInput.dispatchEvent(new InputEvent('input', { bubbles: true }));
        fileInput.value = 'custom.docx';
        fileInput.dispatchEvent(new InputEvent('input', { bubbles: true }));

        expect(draft.optionRows.find(row => row.key === '-o')?.value).toBe('/exports/custom.docx');
        expect(updatePreview).toHaveBeenCalledTimes(2);
    });

    it('mutes the whole resolved path when a root-level directory variable is empty', () => {
        window.requestAnimationFrame = jest.fn(callback => {
            callback(0);
            return 0;
        });
        const container = enhanceElement(document.createElement('div'));
        const draft = createDraft();

        renderPandocRows(container, draft, FALLBACK_PANDOC_CATALOG, {
            nextOptionIndex: () => 1,
            getVariables: () => variables,
            getDisplayVariables: () => ({
                ...variables,
                currentPath: 'note.md',
                currentDir: '',
                outputPath: 'note.html',
                outputDir: '',
                attachmentFolderPath: 'assets',
                embedDirs: '',
                outputExtension: '.html'
            }),
            openFormatEditor: () => undefined,
            openOptionSearch: () => undefined,
            render: () => undefined,
            updatePreview: () => undefined
        });

        expect(valueDisplayParts(container, '--resource-path')).toEqual([
            { text: '/vault', muted: true }
        ]);
    });

    it('renders format rows as text fields with editor helpers', () => {
        window.requestAnimationFrame = jest.fn(callback => {
            callback(0);
            return 0;
        });
        const container = enhanceElement(document.createElement('div'));
        const draft = createDraft();
        const openFormatEditor = jest.fn();
        draft.optionRows.find(row => row.key === '-f')!.value = '${fromFormat}';
        draft.optionRows.find(row => row.key === '-t')!.value = 'commonmark_x-attributes';

        renderPandocRows(container, draft, FORMAT_EXTENSION_FIXTURE_CATALOG, {
            nextOptionIndex: () => 1,
            getVariables: () => variables,
            openFormatEditor,
            openOptionSearch: () => undefined,
            render: () => undefined,
            updatePreview: () => undefined
        });

        const rows = Array.from(container.querySelectorAll('.pem-pandoc-builder-row'));
        expect(findValueInput(container, 'from format').value).toBe('markdown');
        expect(findValueInput(container, 'to format').value).toBe('commonmark_x-attributes');
        expect(rowSelectValues(rows, 'from format')).toEqual([]);
        expect(rowHasButton(rows, 'from format', 'Edit pandoc format')).toBe(true);
        expect(container.querySelector('.pem-pandoc-format-extension')).toBeNull();
        expect(container.textContent).not.toContain('default markdown');

        rowButton(rows, 'from format', 'Edit pandoc format').click();
        expect(openFormatEditor).toHaveBeenCalledWith(
            draft.optionRows.find(row => row.key === '-f'),
            expect.objectContaining({ valueKind: 'format' }),
            draft
        );
    });

    it('does not suggest core format and output options for custom rows', () => {
        const container = enhanceElement(document.createElement('div'));
        const draft = createDraft();
        draft.optionRows.push({ id: 'custom', key: '', value: '', enabled: true });

        renderPandocRows(container, draft, FALLBACK_PANDOC_CATALOG, {
            nextOptionIndex: () => 1,
            getVariables: () => variables,
            openFormatEditor: () => undefined,
            openOptionSearch: () => undefined,
            render: () => undefined,
            updatePreview: () => undefined
        });

        const inputs = Array.from(container.querySelectorAll('.pem-pandoc-key-input'));
        const input = inputs.at(-1) as HTMLInputElement;
        input.value = 'fr';
        input.dispatchEvent(new InputEvent('input', { bubbles: true }));

        const row = input.closest('.pem-pandoc-builder-row');
        expect(row?.querySelector('.pem-pandoc-key-suggestions')?.textContent).not.toContain('--from');

        input.value = 'resource';
        input.dispatchEvent(new InputEvent('input', { bubbles: true }));
        expect(row?.querySelector('.pem-pandoc-key-suggestions')?.textContent).toContain('--resource-path');
    });

    it('renders option search column headers and bare argument types', () => {
        const modal = new PandocOptionSearchModal(
            new App(),
            FALLBACK_PANDOC_CATALOG,
            () => undefined
        );

        modal.open();

        const header = modal.contentEl.querySelector('.pem-pandoc-option-result-header');
        const firstResult = modal.contentEl.querySelector('.pem-pandoc-option-result');

        expect(header?.textContent).toBe('FlagArgument typeDescription');
        expect(firstResult?.querySelector('.pem-pandoc-option-result-type')?.textContent).not.toContain('type:');

        modal.close();
    });

    it('highlights matching option search text', () => {
        const modal = new PandocOptionSearchModal(
            new App(),
            FALLBACK_PANDOC_CATALOG,
            () => undefined
        );

        modal.open();
        const input = modal.contentEl.querySelector('.pem-pandoc-option-search-box input') as HTMLInputElement;
        input.value = 'biblio';
        input.dispatchEvent(new InputEvent('input', { bubbles: true }));

        const rows = Array.from(modal.contentEl.querySelectorAll('.pem-pandoc-option-result'));
        const bibliographyRow = rows.find(row =>
            row.querySelector('.pem-pandoc-option-result-key')?.textContent?.includes('--bibliography'));
        const highlightedText = Array.from(
            bibliographyRow?.querySelectorAll('.pem-pandoc-option-search-highlight') ?? []
        ).map(mark => mark.textContent);

        expect(highlightedText).toEqual(expect.arrayContaining(['biblio']));
        expect(bibliographyRow?.querySelector('.pem-pandoc-option-result-key mark')?.textContent).toBe('biblio');
        expect(bibliographyRow?.querySelector('.pem-pandoc-option-result-desc mark')?.textContent).toBe('biblio');

        modal.close();
    });

    it('opens an extension description panel from help buttons', () => {
        const draft = createDraft();
        const row = draft.optionRows.find(item => item.key === '-f')!;
        const modal = new PandocFormatEditorModal(new App(), {
            draft,
            row,
            spec: { key: '-f', aliases: [], name: 'from', description: '', valueKind: 'format', mapsTo: 'from' },
            catalog: FORMAT_EXTENSION_FIXTURE_CATALOG,
            getVariables: () => variables,
            onApply: () => undefined
        });

        modal.open();
        expect(modal.contentEl.querySelector('.pem-pandoc-extension-detail')).toBeNull();

        const button = modal.contentEl.querySelector(
            'button[aria-label="Show wikilinks_title_after_pipe extension description"]'
        ) as HTMLButtonElement;
        button.click();

        const detail = modal.contentEl.querySelector('.pem-pandoc-extension-detail');
        expect(detail?.textContent).toContain('wikilinks_title_after_pipe');
        expect(detail?.textContent).toContain('Supports URL-first wikilinks.');
    });
});

function createDraft(): ProfileDraft {
    return {
        id: 'html',
        name: 'HTML',
        type: 'pandoc',
        extension: '.html',
        from: '',
        to: '',
        standalone: false,
        resourcePaths: [],
        luaFilters: [],
        metadata: {},
        optionRows: [
            { id: 'input', key: 'input file', value: '${currentPath}', enabled: true, role: 'input' },
            { id: 'from', key: '-f', value: 'markdown', enabled: true },
            { id: 'to', key: '-t', value: 'html', enabled: true },
            { id: 'output', key: '-o', value: '${outputDir}/${currentFileName}${outputExtension}', enabled: true },
            { id: 'resource', key: '--resource-path', value: '${currentDir}', enabled: true },
            { id: 'lua', key: '-L', value: '${luaFilterDir}/CustomLabelList.lua', enabled: true },
            { id: 'columns', key: '--columns', value: '80', enabled: true },
            { id: 'standalone', key: '-s', value: '', enabled: true },
            { id: 'toc', key: '--toc', value: '', enabled: true },
            { id: 'eol', key: '--eol', value: 'lf', enabled: true }
        ],
        customCommandTemplate: '',
        customShell: false
    };
}

function commandActions() {
    return {
        nextOptionIndex: () => 1,
        getVariables: () => variables,
        openFormatEditor: () => undefined,
        openOptionSearch: () => undefined,
        render: () => undefined,
        updatePreview: () => undefined
    };
}

function findRow(container: HTMLElement, key: string): Element {
    const rows = Array.from(container.querySelectorAll('.pem-pandoc-builder-row'));
    const row = rows.find(item => getRowKey(item) === key);
    if (!row) throw new Error(`Row not found for ${key}.`);
    return row;
}

function selectValues(select: HTMLSelectElement): string[] {
    return Array.from(select.options).map(option => option.value);
}

function rowHasBrowseButton(rows: Element[], key: string): boolean | undefined {
    const row = rows.find(item => getRowKey(item) === key);
    return Array.from(row?.querySelectorAll('button') ?? [])
        .some(button => button.textContent === 'Browse');
}

function rowHasValueControl(rows: Element[], key: string): boolean | undefined {
    const row = rows.find(item => getRowKey(item) === key);
    return Boolean(row?.querySelector('.pem-pandoc-value-cell input, .pem-pandoc-value-cell select'));
}

function rowHasKeyInput(rows: Element[], key: string): boolean | undefined {
    const row = rows.find(item => getRowKey(item) === key);
    return Boolean(row?.querySelector('.pem-pandoc-key-input'));
}

function rowHasSeparator(rows: Element[], key: string): boolean | undefined {
    const row = rows.find(item => getRowKey(item) === key);
    return row?.querySelector('.pem-pandoc-row-separator')?.textContent === ':';
}

function rowSelectValues(rows: Element[], key: string): string[] {
    const row = rows.find(item => getRowKey(item) === key);
    const select = row?.querySelector('.pem-pandoc-value-cell select') as HTMLSelectElement | null;
    return Array.from(select?.options ?? []).map(option => option.value);
}

function rowSelectHasDropdownFrame(rows: Element[], key: string): boolean {
    const row = rows.find(item => getRowKey(item) === key);
    const select = row?.querySelector('.pem-pandoc-value-cell select') as HTMLSelectElement | null;
    return Boolean(select?.closest('.pem-pandoc-select-frame'));
}

function rowHasRemoveButton(rows: Element[], key: string): boolean | undefined {
    const row = rows.find(item => getRowKey(item) === key);
    return Boolean(row?.querySelector('button[aria-label="Remove option"]'));
}

function rowHasButton(rows: Element[], key: string, label: string): boolean {
    return Boolean(rowButton(rows, key, label, false));
}

function rowButton(rows: Element[], key: string, label: string, required = true): HTMLButtonElement {
    const row = rows.find(item => getRowKey(item) === key);
    const button = Array.from(row?.querySelectorAll('button') ?? [])
        .find(item => item.getAttribute('aria-label') === label) as HTMLButtonElement | undefined;
    if (!button && required) throw new Error(`Button not found for ${key}: ${label}.`);
    return button as HTMLButtonElement;
}

function findValueInput(container: HTMLElement, key: string): HTMLInputElement {
    const rows = Array.from(container.querySelectorAll('.pem-pandoc-builder-row'));
    const row = rows.find(item => getRowKey(item) === key);
    const input = row?.querySelector('.pem-pandoc-value-cell input') as HTMLInputElement | null;
    if (!input) throw new Error(`Value input not found for ${key}.`);
    return input;
}

function keyValueInputs(row: Element): HTMLInputElement[] {
    return Array.from(row.querySelectorAll('.pem-pandoc-key-value-control input')) as HTMLInputElement[];
}

function keyValueSeparator(row: Element): string {
    return row.querySelector('.pem-pandoc-key-value-separator')?.textContent ?? '';
}

function outputFileInputs(container: HTMLElement): HTMLInputElement[] {
    const row = findRow(container, 'output file');
    return [
        row.querySelector('.pem-pandoc-output-folder-input') as HTMLInputElement,
        row.querySelector('.pem-pandoc-output-file-name-input') as HTMLInputElement
    ];
}

function variableSuggestionTexts(input: HTMLInputElement): string[] {
    return Array.from(input
        .closest('.pem-pandoc-builder-row')
        ?.querySelectorAll('.pem-pandoc-variable-suggestion-name') ?? [])
        .map(suggestion => suggestion.textContent ?? '');
}

function variableSuggestionValues(input: HTMLInputElement): Map<string, string> {
    return new Map(Array.from(input
        .closest('.pem-pandoc-builder-row')
        ?.querySelectorAll('.pem-pandoc-variable-suggestion') ?? [])
        .map(suggestion => [
            suggestion.querySelector('.pem-pandoc-variable-suggestion-name')?.textContent ?? '',
            suggestion.querySelector('.pem-pandoc-variable-suggestion-value')?.textContent ?? ''
        ]));
}

function valueDisplayParts(container: HTMLElement, key: string): Array<{ text: string; muted: boolean }> {
    const rows = Array.from(container.querySelectorAll('.pem-pandoc-builder-row'));
    const row = rows.find(item => getRowKey(item) === key);
    const display = row?.querySelector('.pem-pandoc-string-display');
    if (!display) throw new Error(`Value display not found for ${key}.`);

    return Array.from(display.querySelectorAll('.pem-pandoc-string-display-content > span')).map(span => ({
        text: span.textContent ?? '',
        muted: span.classList.contains('pem-pandoc-string-display-muted')
    }));
}

function valueDisplayFrame(container: HTMLElement, key: string): HTMLElement {
    const rows = Array.from(container.querySelectorAll('.pem-pandoc-builder-row'));
    const row = rows.find(item => getRowKey(item) === key);
    const frame = row?.querySelector('.pem-pandoc-string-input-frame') as HTMLElement | null;
    if (!frame) throw new Error(`Value display frame not found for ${key}.`);
    return frame;
}

function getRowKey(row: Element): string {
    return (row.querySelector('.pem-pandoc-key-input') as HTMLInputElement | null)?.value ??
        row.querySelector('.pem-pandoc-key-label')?.textContent ??
        '';
}

function enhanceElement(element: HTMLElement): HTMLElement {
    const extended = element as HTMLElement & {
        createEl: typeof createElement;
        createDiv: typeof createDiv;
        addClass: (className: string) => void;
        empty: () => void;
    };
    extended.createEl = createElement;
    extended.createDiv = createDiv;
    extended.addClass = className => extended.classList.add(className);
    extended.empty = () => { extended.textContent = ''; };
    return extended;
}

function createElement(
    this: HTMLElement,
    tag: string,
    options?: { text?: string; cls?: string; attr?: Record<string, string> }
): HTMLElement {
    const element = enhanceElement(document.createElement(tag));
    if (options?.text) element.textContent = options.text;
    if (options?.cls) element.className = options.cls;
    for (const [key, value] of Object.entries(options?.attr ?? {})) {
        element.setAttribute(key, value);
    }
    this.appendChild(element);
    return element;
}

function createDiv(
    this: HTMLElement,
    options?: { text?: string; cls?: string; attr?: Record<string, string> }
): HTMLElement {
    return createElement.call(this, 'div', options);
}
