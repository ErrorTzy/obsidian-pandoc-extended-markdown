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
        expect(layout.visibleTypeLabels).toBeGreaterThanOrEqual(2);
        expect(layout.rowsWithoutSearchButtons).toBe(0);

        const rows = await getCommandRows();
        expect(rowType(rows, '-t')).toBe('type: format string');
        expect(rowType(rows, '--resource-path')).toBe('type: folder path');
        expect(rowHasBrowseButton(rows, '--resource-path')).toBe(true);
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
        const suggestions = Array.from(document.querySelectorAll('.pem-pandoc-key-suggestions'));
        return suggestions.at(-1)?.textContent ?? '';
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
            const type = row.querySelector('.pem-pandoc-row-type');
            const buttons = Array.from(row.querySelectorAll('button'));
            return {
                key: keyInput?.value ?? '',
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
    visibleTypeLabels: number;
    rowsWithoutSearchButtons: number;
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
        const modal = document.querySelector('.pem-pandoc-command-modal');
        const content = modal?.querySelector('.modal-content') as HTMLElement | null;
        const builder = modal?.querySelector('.pem-pandoc-command-builder') as HTMLElement | null;
        const preview = modal?.querySelector('.pem-pandoc-command-preview') as HTMLElement | null;
        const labels = Array.from(modal?.querySelectorAll('.pem-pandoc-row-type') ?? []);
        const rows = Array.from(modal?.querySelectorAll('.pem-pandoc-builder-row') ?? []);

        return {
            modalTitle: modal?.querySelector('.modal-title')?.textContent ?? '',
            contentOverflows: overflows(content),
            builderOverflows: overflows(builder),
            previewOverflows: overflows(preview),
            visibleTypeLabels: labels.filter(isVisible).length,
            rowsWithoutSearchButtons: rows.filter(row =>
                !row.querySelector('.pem-pandoc-key-cell button[aria-label="Search pandoc options"]')
            ).length
        };
    });
}
