/**
 * @jest-environment jsdom
 */
import { describe, expect, it, jest } from '@jest/globals';

import { renderPandocRows } from '../../../src/pandoc/PandocCommandRows';
import { FALLBACK_PANDOC_CATALOG } from '../../../src/pandoc/gui-core';
import type { ProfileDraft } from '../../../src/pandoc/gui-core';
import type { ExportVariables } from '../../../src/pandoc/types';

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
    const row = rows.find(item =>
        (item.querySelector('.pem-pandoc-key-input') as HTMLInputElement | null)?.value === key);
    return Array.from(row?.querySelectorAll('button') ?? [])
        .some(button => button.textContent === 'Browse');
}

function rowHasValueControl(rows: Element[], key: string): boolean | undefined {
    const row = rows.find(item =>
        (item.querySelector('.pem-pandoc-key-input') as HTMLInputElement | null)?.value === key);
    return Boolean(row?.querySelector('.pem-pandoc-value-cell input, .pem-pandoc-value-cell select'));
}

function rowHasSeparator(rows: Element[], key: string): boolean | undefined {
    const row = rows.find(item =>
        (item.querySelector('.pem-pandoc-key-input') as HTMLInputElement | null)?.value === key);
    return Boolean(row?.querySelector('.pem-pandoc-row-separator'));
}

function rowSelectValues(rows: Element[], key: string): string[] {
    const row = rows.find(item =>
        (item.querySelector('.pem-pandoc-key-input') as HTMLInputElement | null)?.value === key);
    const select = row?.querySelector('.pem-pandoc-value-cell select') as HTMLSelectElement | null;
    return Array.from(select?.options ?? []).map(option => option.value);
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
