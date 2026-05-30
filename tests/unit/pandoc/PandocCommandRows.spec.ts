/**
 * @jest-environment jsdom
 */
import { describe, expect, it, jest } from '@jest/globals';
import { App } from 'obsidian';

import { PandocFormatEditorModal } from '../../../src/pandoc/PandocFormatEditor';
import { renderPandocRows } from '../../../src/pandoc/PandocCommandRows';
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
        expect(rowHasBrowseButton(rows, '--columns')).toBe(false);
        expect(rowHasValueControl(rows, '-s')).toBe(false);
        expect(rowHasValueControl(rows, '--toc')).toBe(false);
        expect(rowHasSeparator(rows, '-s')).toBe(false);
        expect(rowHasSeparator(rows, '--toc')).toBe(false);
        expect(rowHasSeparator(rows, '--eol')).toBe(true);
        expect(rowSelectValues(rows, '--eol')).toEqual(['crlf', 'lf', 'native']);
        expect(rowHasRemoveButton(rows, 'input file')).toBe(false);
        expect(rowHasRemoveButton(rows, '-f')).toBe(false);
        expect(rowHasRemoveButton(rows, '-t')).toBe(false);
        expect(rowHasRemoveButton(rows, '-o')).toBe(false);
        expect(rowHasRemoveButton(rows, '--toc')).toBe(true);
    });

    it('renders template variable suggestions with resolved preview values', () => {
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

        const input = findValueInput(container, '--resource-path');
        input.focus();
        input.value = '$';
        input.dispatchEvent(new InputEvent('input', { bubbles: true }));

        const suggestions = input
            .closest('.pem-pandoc-builder-row')
            ?.querySelector('.pem-pandoc-variable-suggestions');
        const firstSuggestion = suggestions?.querySelector('.pem-pandoc-variable-suggestion');
        expect(suggestions?.textContent).toContain('${currentDir}');
        expect(suggestions?.textContent).toContain('/vault');
        expect(firstSuggestion?.querySelector('.pem-pandoc-variable-suggestion-name')?.textContent)
            .toBe('${currentPath}');
        expect(firstSuggestion?.querySelector('.pem-pandoc-variable-suggestion-value')?.textContent)
            .toBe('/vault/note.md');
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
        expect(findValueInput(container, '-f').value).toBe('markdown');
        expect(findValueInput(container, '-t').value).toBe('commonmark_x-attributes');
        expect(rowSelectValues(rows, '-f')).toEqual([]);
        expect(rowHasButton(rows, '-f', 'Edit pandoc format')).toBe(true);
        expect(container.querySelector('.pem-pandoc-format-extension')).toBeNull();
        expect(container.textContent).not.toContain('default markdown');

        rowButton(rows, '-f', 'Edit pandoc format').click();
        expect(openFormatEditor).toHaveBeenCalledWith(
            draft.optionRows.find(row => row.key === '-f'),
            expect.objectContaining({ valueKind: 'format' }),
            draft
        );
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

function rowHasBrowseButton(rows: Element[], key: string): boolean | undefined {
    const row = rows.find(item => getRowKey(item) === key);
    return Array.from(row?.querySelectorAll('button') ?? [])
        .some(button => button.textContent === 'Browse');
}

function rowHasValueControl(rows: Element[], key: string): boolean | undefined {
    const row = rows.find(item => getRowKey(item) === key);
    return Boolean(row?.querySelector('.pem-pandoc-value-cell input, .pem-pandoc-value-cell select'));
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
