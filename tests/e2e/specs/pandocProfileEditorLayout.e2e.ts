import { browser, expect } from '@wdio/globals';

describe('Pandoc profile editor layout', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });
    });

    it('renders the command builder without horizontal overflow', async () => {
        await configurePandocExport();
        await openPandocProfileEditor();

        const layout = await getCommandBuilderLayout();
        expect(layout.modalTitle).toBe('Pandoc export command');
        expect(layout.contentOverflows).toBe(false);
        expect(layout.builderOverflows).toBe(false);
        expect(layout.previewOverflows).toBe(false);
        expect(layout.sectionTitles).toEqual(expect.arrayContaining([
            'Preset Options',
            'Command Options'
        ]));
        expect(layout.hasPresetIdField).toBe(false);
        expect(layout.presetFieldLabels).toEqual(['Preset', 'Name']);
        expect(layout.nameSharesActionRow).toBe(true);
        expect(layout.presetSelectStyledAsDropdown).toBe(true);
        expect(layout.presetSelectHasTriangle).toBe(true);
        expect(layout.footerButtons).toEqual(['Cancel changes', 'Save and close']);
        expect(layout.presetActionStates).toEqual(expect.objectContaining({
            newPreset: false,
            saveCurrent: false,
            resetCurrent: true,
            deleteCurrent: false,
            restorePreset: true
        }));
        expect(layout.visibleTypeLabels).toBeGreaterThanOrEqual(2);
        expect(layout.rowsWithoutSearchButtons).toBe(1);
        expect(layout.valueColumnLeftSpread).toBeLessThanOrEqual(1);
        expect(layout.typeColumnLeftSpread).toBeLessThanOrEqual(1);

        const rows = await getCommandRows();
        expect(rowType(rows, 'input file')).toBe('type: input file');
        expect(rowType(rows, '-t')).toBe('type: format string');
        expect(rowType(rows, '--resource-path')).toBe('type: folder path');
        expect(rowHasBrowseButton(rows, '--resource-path')).toBe(true);
        expect(rowType(rows, '-L')).toBe('type: file path');
        expect(rowHasBrowseButton(rows, '-L')).toBe(true);
    });

    it('uses key-only inline suggestions and a separate searchable option panel', async () => {
        await configurePandocExport();
        await openPandocProfileEditor();
        await addCustomOptionRow();

        await typeCustomOptionKey('fr');
        expect(await getInlineSuggestionText()).toContain('--from');

        await typeCustomOptionKey('table contents');
        expect(await getInlineSuggestionText()).toBe('');

        await openOptionSearchPanel();
        await searchOptionPanel('table contents');
        expect(await getOptionPanelText()).not.toContain('--toc');
        await setOptionPanelFuzzySearch(true);
        expect(await getOptionPanelText()).toContain('--toc');
        expect(await isConfirmNextToSearchBar()).toBe(true);
    });

    it('enables reset and restore immediately after command option edits', async () => {
        await configurePandocExport();
        await openPandocProfileEditor();
        await browser.waitUntil(async () => await hasFirstResourcePathInput(), {
            timeout: 5000,
            timeoutMsg: 'Expected resource path value input'
        });

        await typeFirstResourcePathValue('/tmp/pandoc-export-profile/assets');
        await browser.waitUntil(async () => {
            const states = (await getCommandBuilderLayout()).presetActionStates;
            return states.resetCurrent === false && states.restorePreset === false;
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected reset and restore to enable after editing a command option'
        });

        const states = (await getCommandBuilderLayout()).presetActionStates;
        expect(states.resetCurrent).toBe(false);
        expect(states.restorePreset).toBe(false);
    });

    it('expands option variables while blurred and suggests them while editing', async () => {
        await configurePandocExport();
        await openPandocProfileEditor();
        await browser.waitUntil(async () => await hasFirstResourcePathInput(), {
            timeout: 5000,
            timeoutMsg: 'Expected resource path value input'
        });

        const blurredValue = await getFirstResourcePathInputValue();
        expect(blurredValue).not.toContain('${');

        await focusFirstResourcePathInput();
        expect(await getFirstResourcePathInputValue()).toBe('${currentDir}');

        await blurFirstResourcePathInput();
        expect(await getFirstResourcePathInputValue()).toBe(blurredValue);

        await typeFirstResourcePathValue('$');
        expect(await getVariableSuggestionText()).toContain('${currentDir}');
        const variableSuggestions = await getVariableSuggestions();
        expect(variableSuggestions.some(suggestion =>
            suggestion.name === '${currentDir}' && suggestion.value === blurredValue)).toBe(true);
    });

    it('clips overflowing string values on the left with an indicator', async () => {
        await configurePandocExport();
        await openPandocProfileEditor();
        await browser.waitUntil(async () => await hasFirstResourcePathInput(), {
            timeout: 5000,
            timeoutMsg: 'Expected resource path value input'
        });

        await typeFirstResourcePathValue('/tmp/pandoc-export-profile/very/deep/path/final-output-name.html');
        await blurFirstResourcePathInput();
        await browser.waitUntil(async () => {
            const state = await getFirstResourcePathOverflowState();
            return state.overflows && state.scrollLeft > 0;
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected resource path value to overflow on the left'
        });

        const state = await getFirstResourcePathOverflowState();
        expect(state.textAlign).toBe('right');
        expect(state.overflowSide).toBe('left');
        expect(state.scrollLeft).toBeGreaterThan(0);
        expect(state.maxScrollLeft - state.scrollLeft).toBeLessThanOrEqual(1);
        expect(state.indicatorContent).toContain('...');
        expect(state.indicatorDisplay).not.toBe('none');
    });
});

async function configurePandocExport(): Promise<void> {
    await browser.execute(async () => {
        // @ts-ignore
        const plugin = app.plugins.plugins['pandoc-extended-markdown'];
        if (!plugin?.settings) {
            throw new Error('Pandoc Extended Markdown plugin did not load.');
        }

        plugin.settings.pandocExport = {
            ...(plugin.settings.pandocExport ?? {}),
            enabled: true,
            pandocPath: '',
            showProgress: false
        };
        await plugin.saveSettings();
    });
}

async function openPandocProfileEditor(): Promise<void> {
    await browser.execute(() => {
        for (const button of Array.from(document.querySelectorAll('.modal-close-button'))) {
            (button as HTMLButtonElement).click();
        }
        // @ts-ignore
        app.setting.open();
        // @ts-ignore
        app.setting.openTabById('pandoc-extended-markdown');
    });
    await browser.waitUntil(async () => await hasEditPandocExportButton(), {
        timeout: 10000,
        timeoutMsg: 'Expected Pandoc export settings button'
    });
    await browser.execute(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const editButton = buttons.find(button => button.textContent === 'Edit pandoc export') as
            HTMLButtonElement | undefined;
        if (!editButton) {
            throw new Error('Edit pandoc export button not found.');
        }
        editButton.click();
    });
    await browser.waitUntil(async () => {
        const layout = await getCommandBuilderLayout();
        return layout.modalTitle === 'Pandoc export command' && layout.visibleTypeLabels > 0;
    }, {
        timeout: 10000,
        timeoutMsg: 'Expected Pandoc profile editor modal'
    });
}

async function hasEditPandocExportButton(): Promise<boolean> {
    return browser.execute(() => {
        return Array.from(document.querySelectorAll('button'))
            .some(button => button.textContent === 'Edit pandoc export');
    });
}

async function addCustomOptionRow(): Promise<void> {
    await browser.execute(() => {
        const button = document.querySelector(
            '.pem-pandoc-option-section > button[aria-label="Add option"]'
        ) as HTMLButtonElement | null;
        if (!button) throw new Error('Add option button not found.');
        button.click();
    });
}

async function typeCustomOptionKey(value: string): Promise<void> {
    await browser.execute((nextValue: string) => {
        const inputs = Array.from(document.querySelectorAll('.pem-pandoc-key-cell input'));
        const input = inputs.at(-1) as HTMLInputElement | undefined;
        if (!input) throw new Error('Custom option key input not found.');
        input.value = nextValue;
        input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }, value);
}

async function getInlineSuggestionText(): Promise<string> {
    return browser.execute(() => {
        const suggestions = Array.from(document.querySelectorAll('.pem-pandoc-key-cell .pem-pandoc-key-suggestions'));
        return suggestions.at(-1)?.textContent ?? '';
    });
}

async function getVariableSuggestionText(): Promise<string> {
    return browser.execute(() => {
        const modal = Array.from(document.querySelectorAll('.pem-pandoc-command-modal')).at(-1);
        const rows = Array.from(modal?.querySelectorAll('.pem-pandoc-builder-row') ?? []);
        const row = rows.find(item =>
            (item.querySelector('.pem-pandoc-key-input') as HTMLInputElement | null)?.value === '--resource-path');
        return row?.querySelector('.pem-pandoc-variable-suggestions')?.textContent ?? '';
    });
}

async function getVariableSuggestions(): Promise<Array<{ name: string; value: string }>> {
    return browser.execute(() => {
        const modal = Array.from(document.querySelectorAll('.pem-pandoc-command-modal')).at(-1);
        const rows = Array.from(modal?.querySelectorAll('.pem-pandoc-builder-row') ?? []);
        const row = rows.find(item =>
            (item.querySelector('.pem-pandoc-key-input') as HTMLInputElement | null)?.value === '--resource-path');
        return Array.from(row?.querySelectorAll('.pem-pandoc-variable-suggestion') ?? [])
            .map(suggestion => ({
                name: suggestion.querySelector('.pem-pandoc-variable-suggestion-name')?.textContent ?? '',
                value: suggestion.querySelector('.pem-pandoc-variable-suggestion-value')?.textContent ?? ''
            }));
    });
}

async function getFirstResourcePathInputValue(): Promise<string> {
    return browser.execute(() => {
        const modal = Array.from(document.querySelectorAll('.pem-pandoc-command-modal')).at(-1);
        const rows = Array.from(modal?.querySelectorAll('.pem-pandoc-builder-row') ?? []);
        const row = rows.find(item =>
            (item.querySelector('.pem-pandoc-key-input') as HTMLInputElement | null)?.value === '--resource-path');
        const input = row?.querySelector('.pem-pandoc-value-cell input') as HTMLInputElement | null;
        if (!input) throw new Error('Resource path value input not found.');
        return input.value;
    });
}

async function hasFirstResourcePathInput(): Promise<boolean> {
    return browser.execute(() => {
        const modal = Array.from(document.querySelectorAll('.pem-pandoc-command-modal')).at(-1);
        const rows = Array.from(modal?.querySelectorAll('.pem-pandoc-builder-row') ?? []);
        return rows.some(item =>
            (item.querySelector('.pem-pandoc-key-input') as HTMLInputElement | null)?.value === '--resource-path' &&
            Boolean(item.querySelector('.pem-pandoc-value-cell input')));
    });
}

async function focusFirstResourcePathInput(): Promise<void> {
    await browser.execute(() => {
        const modal = Array.from(document.querySelectorAll('.pem-pandoc-command-modal')).at(-1);
        const rows = Array.from(modal?.querySelectorAll('.pem-pandoc-builder-row') ?? []);
        const row = rows.find(item =>
            (item.querySelector('.pem-pandoc-key-input') as HTMLInputElement | null)?.value === '--resource-path');
        const input = row?.querySelector('.pem-pandoc-value-cell input') as HTMLInputElement | null;
        if (!input) throw new Error('Resource path value input not found.');
        input.focus();
    });
}

async function blurFirstResourcePathInput(): Promise<void> {
    await browser.execute(() => {
        const modal = Array.from(document.querySelectorAll('.pem-pandoc-command-modal')).at(-1);
        const rows = Array.from(modal?.querySelectorAll('.pem-pandoc-builder-row') ?? []);
        const row = rows.find(item =>
            (item.querySelector('.pem-pandoc-key-input') as HTMLInputElement | null)?.value === '--resource-path');
        const input = row?.querySelector('.pem-pandoc-value-cell input') as HTMLInputElement | null;
        if (!input) throw new Error('Resource path value input not found.');
        input.blur();
    });
}

async function typeFirstResourcePathValue(value: string): Promise<void> {
    await browser.execute((nextValue: string) => {
        const modal = Array.from(document.querySelectorAll('.pem-pandoc-command-modal')).at(-1);
        const rows = Array.from(modal?.querySelectorAll('.pem-pandoc-builder-row') ?? []);
        const row = rows.find(item =>
            (item.querySelector('.pem-pandoc-key-input') as HTMLInputElement | null)?.value === '--resource-path');
        const input = row?.querySelector('.pem-pandoc-value-cell input') as HTMLInputElement | null;
        if (!input) throw new Error('Resource path value input not found.');
        input.focus();
        input.value = nextValue;
        input.setSelectionRange(nextValue.length, nextValue.length);
        input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }, value);
}

async function getFirstResourcePathOverflowState(): Promise<{
    overflows: boolean;
    scrollLeft: number;
    maxScrollLeft: number;
    textAlign: string;
    overflowSide: string | null;
    indicatorContent: string;
    indicatorDisplay: string;
}> {
    return browser.execute(() => {
        const modal = Array.from(document.querySelectorAll('.pem-pandoc-command-modal')).at(-1);
        const rows = Array.from(modal?.querySelectorAll('.pem-pandoc-builder-row') ?? []);
        const row = rows.find(item =>
            (item.querySelector('.pem-pandoc-key-input') as HTMLInputElement | null)?.value === '--resource-path');
        const frame = row?.querySelector('.pem-pandoc-string-input-frame') as HTMLElement | null;
        const input = row?.querySelector('.pem-pandoc-value-cell input') as HTMLInputElement | null;
        if (!frame || !input) throw new Error('Resource path string input frame not found.');
        const indicator = window.getComputedStyle(frame, '::before');
        return {
            overflows: input.scrollWidth > input.clientWidth + 1,
            scrollLeft: input.scrollLeft,
            maxScrollLeft: input.scrollWidth - input.clientWidth,
            textAlign: window.getComputedStyle(input).textAlign,
            overflowSide: frame.getAttribute('data-overflow-side'),
            indicatorContent: indicator.content,
            indicatorDisplay: indicator.display
        };
    });
}

async function openOptionSearchPanel(): Promise<void> {
    await browser.execute(() => {
        const buttons = Array.from(document.querySelectorAll('.pem-pandoc-key-cell button'));
        const button = buttons.at(-1) as HTMLButtonElement | undefined;
        if (!button) throw new Error('Option search button not found.');
        button.click();
    });
    await browser.waitUntil(async () => await hasOptionPanel(), {
        timeout: 5000,
        timeoutMsg: 'Expected option search panel'
    });
}

async function searchOptionPanel(value: string): Promise<void> {
    await browser.execute((query: string) => {
        const input = document.querySelector(
            '.pem-pandoc-option-search-box input'
        ) as HTMLInputElement | null;
        if (!input) throw new Error('Option search input not found.');
        input.value = query;
        input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }, value);
}

async function getOptionPanelText(): Promise<string> {
    return browser.execute(() => {
        return document.querySelector('.pem-pandoc-option-search-modal')?.textContent ?? '';
    });
}

async function setOptionPanelFuzzySearch(value: boolean): Promise<void> {
    await browser.execute((checked: boolean) => {
        const input = document.querySelector(
            '.pem-pandoc-fuzzy-toggle input'
        ) as HTMLInputElement | null;
        if (!input) throw new Error('Fuzzy search checkbox not found.');
        input.checked = checked;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
}

async function isConfirmNextToSearchBar(): Promise<boolean> {
    return browser.execute(() => {
        const confirm = document.querySelector('.pem-pandoc-option-search-box button');
        return confirm?.textContent === 'Confirm';
    });
}

async function hasOptionPanel(): Promise<boolean> {
    return browser.execute(() => {
        return Boolean(document.querySelector('.pem-pandoc-option-search-modal'));
    });
}

async function getCommandRows(): Promise<Array<{
    key: string;
    type: string;
    hasBrowseButton: boolean;
}>> {
    return browser.execute(() => {
        return Array.from(document.querySelectorAll('.pem-pandoc-builder-row')).map(row => {
            const keyInput = row.querySelector('.pem-pandoc-key-input') as HTMLInputElement | null;
            const keyLabel = row.querySelector('.pem-pandoc-key-label');
            const type = row.querySelector('.pem-pandoc-row-type');
            const buttons = Array.from(row.querySelectorAll('button'));
            return {
                key: keyInput?.value ?? keyLabel?.textContent ?? '',
                type: type?.textContent ?? '',
                hasBrowseButton: buttons.some(button => button.textContent === 'Browse')
            };
        });
    });
}

function rowType(rows: Array<{ key: string; type: string }>, key: string): string | undefined {
    return rows.find(row => row.key === key)?.type;
}

function rowHasBrowseButton(
    rows: Array<{ key: string; hasBrowseButton: boolean }>,
    key: string
): boolean | undefined {
    return rows.find(row => row.key === key)?.hasBrowseButton;
}

async function getCommandBuilderLayout(): Promise<{
    modalTitle: string;
    contentOverflows: boolean;
    builderOverflows: boolean;
    previewOverflows: boolean;
    sectionTitles: string[];
    footerButtons: string[];
    hasPresetIdField: boolean;
    presetFieldLabels: string[];
    nameSharesActionRow: boolean;
    presetSelectStyledAsDropdown: boolean;
    presetSelectHasTriangle: boolean;
    presetActionStates: Record<string, boolean | undefined>;
    visibleTypeLabels: number;
    rowsWithoutSearchButtons: number;
    valueColumnLeftSpread: number;
    typeColumnLeftSpread: number;
}> {
    return browser.execute(() => {
        const overflows = (element: HTMLElement | null): boolean => {
            if (!element) return true;
            return element.scrollWidth > element.clientWidth + 1;
        };
        const isVisible = (element: Element): boolean => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        };
        const spread = (values: number[]): number => {
            if (values.length === 0) return 0;
            return Math.max(...values) - Math.min(...values);
        };
        const modal = document.querySelector('.pem-pandoc-command-modal');
        const content = modal?.querySelector('.modal-content') as HTMLElement | null;
        const builder = modal?.querySelector('.pem-pandoc-command-builder') as HTMLElement | null;
        const preview = modal?.querySelector('.pem-pandoc-command-preview') as HTMLElement | null;
        const buttons = Array.from(modal?.querySelectorAll('button') ?? []);
        const presetSelect = modal?.querySelector('.pem-pandoc-preset-fields select') as HTMLSelectElement | null;
        const presetSelectStyle = presetSelect ? getComputedStyle(presetSelect) : undefined;
        const presetSelectFrame = modal?.querySelector('.pem-pandoc-preset-select-frame') as HTMLElement | null;
        const presetSelectFrameAfter = presetSelectFrame ?
            getComputedStyle(presetSelectFrame, '::after') :
            undefined;
        const nameField = Array.from(modal?.querySelectorAll('.pem-pandoc-preset-field') ?? [])
            .find(field => field.querySelector('label')?.textContent === 'Name');
        const labels = Array.from(modal?.querySelectorAll('.pem-pandoc-row-type') ?? []);
        const rows = Array.from(modal?.querySelectorAll('.pem-pandoc-builder-row') ?? []);
        const findButton = (text: string): HTMLButtonElement | undefined =>
            buttons.find(button => button.textContent === text) as HTMLButtonElement | undefined;
        const valueLefts = rows
            .map(row => row.querySelector('.pem-pandoc-value-cell')?.getBoundingClientRect().left)
            .filter((left): left is number => left !== undefined);
        const typeLefts = labels.map(label => label.getBoundingClientRect().left);

        return {
            modalTitle: modal?.querySelector('.modal-title')?.textContent ?? '',
            contentOverflows: overflows(content),
            builderOverflows: overflows(builder),
            previewOverflows: overflows(preview),
            sectionTitles: Array.from(modal?.querySelectorAll('h3') ?? [])
                .map(title => title.textContent ?? ''),
            footerButtons: Array.from(modal?.querySelectorAll('.pem-pandoc-command-footer button') ?? [])
                .map(button => button.textContent ?? ''),
            hasPresetIdField: Array.from(modal?.querySelectorAll('.pem-pandoc-preset-field label') ?? [])
                .some(label => label.textContent === 'Preset ID'),
            presetFieldLabels: Array.from(modal?.querySelectorAll('.pem-pandoc-preset-field label') ?? [])
                .map(label => label.textContent ?? ''),
            nameSharesActionRow: Boolean(nameField?.closest('.pem-pandoc-preset-actions')),
            presetSelectStyledAsDropdown: Boolean(
                presetSelect &&
                presetSelectStyle &&
                presetSelectStyle.cursor === 'pointer' &&
                presetSelectStyle.backgroundColor !== getComputedStyle(content!).backgroundColor
            ),
            presetSelectHasTriangle: Boolean(
                presetSelectFrameAfter &&
                presetSelectFrameAfter.content !== 'none' &&
                presetSelectFrameAfter.borderTopWidth !== '0px'
            ),
            presetActionStates: {
                newPreset: findButton('New preset')?.disabled,
                saveCurrent: findButton('Save current')?.disabled,
                resetCurrent: findButton('Reset current')?.disabled,
                deleteCurrent: findButton('Delete current')?.disabled,
                restorePreset: findButton('Restore preset')?.disabled
            },
            visibleTypeLabels: labels.filter(isVisible).length,
            rowsWithoutSearchButtons: rows.filter(row =>
                !row.querySelector('.pem-pandoc-key-cell button[aria-label="Search pandoc options"]')
            ).length,
            valueColumnLeftSpread: spread(valueLefts),
            typeColumnLeftSpread: spread(typeLefts)
        };
    });
}
