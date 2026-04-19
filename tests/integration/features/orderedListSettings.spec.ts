import { App } from 'obsidian';

import {
    DEFAULT_SETTINGS,
    PandocExtendedMarkdownSettingTab,
    normalizeSettings
} from '../../../src/core/settings';

describe('Ordered list marker settings', () => {
    function createSettingTab() {
        const app = new App();
        const plugin = {
            app,
            settings: normalizeSettings({}),
            saveSettings: jest.fn().mockResolvedValue(undefined),
            updateListPanelAvailability: jest.fn()
        };
        const tab = new PandocExtendedMarkdownSettingTab(app, plugin as any);

        return { app, plugin, tab };
    }

    it('enables ordered list marker cycling and default marker order by default', () => {
        const settings = normalizeSettings({});

        expect(settings.unorderedListMarkerOrder).toEqual(['-', '+', '*']);
        expect(settings.enableOrderedListMarkerCycling).toBe(true);
        expect(settings.orderedListMarkerOrder).toEqual([
            'decimal-period',
            'lower-alpha-period',
            'lower-roman-period',
            'upper-alpha-period',
            'upper-roman-period',
            'decimal-one-paren',
            'lower-alpha-one-paren',
            'lower-roman-one-paren',
            'upper-alpha-one-paren',
            'upper-roman-one-paren'
        ]);
    });

    it('renders a toggle and configurable ordered marker order in settings', async () => {
        const { plugin, tab } = createSettingTab();

        tab.display();

        expect(tab.containerEl.textContent).toContain('Cycle ordered list markers');
        expect(tab.containerEl.textContent).toContain('Unordered list marker order');
        expect(tab.containerEl.textContent).toContain('Ordered list marker order');
        expect(tab.containerEl.textContent).toContain('Dash');
        expect(tab.containerEl.textContent).toContain('Plus');
        expect(tab.containerEl.textContent).toContain('Asterisk');
        expect(tab.containerEl.textContent).toContain('Decimal period');
        expect(tab.containerEl.textContent).toContain('Decimal parenthesis');
        expect(tab.containerEl.textContent).toContain('Lowercase letters parenthesis');
        expect(tab.containerEl.textContent).toContain('Uppercase roman numerals parenthesis');

        const orderedToggle = Array.from(tab.containerEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
            .find(input => input.closest('.setting-item')?.textContent?.includes('Cycle ordered list markers'));

        expect(orderedToggle).toBeDefined();
        orderedToggle!.checked = false;
        orderedToggle!.dispatchEvent(new Event('change'));

        await Promise.resolve();

        expect(plugin.settings.enableOrderedListMarkerCycling).toBe(false);
        expect(plugin.saveSettings).toHaveBeenCalled();
    });

    it('toggles syntax features without rebuilding the settings tab', async () => {
        const { app, plugin, tab } = createSettingTab();

        tab.display();

        const markerOrderList = tab.containerEl.querySelector('.pem-unordered-list-order-list');
        const panelOrderList = tab.containerEl.querySelector('.pem-list-panel-order-list');
        const fancyToggle = Array.from(tab.containerEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
            .find(input => input.closest('.setting-item')?.textContent?.includes('Fancy lists'));

        expect(markerOrderList).toBeDefined();
        expect(panelOrderList).toBeDefined();
        expect(fancyToggle).toBeDefined();

        fancyToggle!.checked = false;
        fancyToggle!.dispatchEvent(new Event('change'));

        await Promise.resolve();

        expect(tab.containerEl.querySelector('.pem-unordered-list-order-list')).toBe(markerOrderList);
        expect(tab.containerEl.querySelector('.pem-list-panel-order-list')).toBe(panelOrderList);
        expect(plugin.settings.enableFancyLists).toBe(false);
        expect(plugin.saveSettings).toHaveBeenCalled();
        expect(app.workspace.updateOptions).toHaveBeenCalled();
    });

    it('refreshes panel order visibility after syntax toggles without rebuilding', async () => {
        const { tab } = createSettingTab();

        tab.display();

        const panelOrderList = tab.containerEl.querySelector('.pem-list-panel-order-list');
        const customLabelToggle = Array.from(tab.containerEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
            .find(input => input.closest('.setting-item')?.textContent?.includes('Custom label lists'));

        expect(panelOrderList).toBeDefined();
        expect(customLabelToggle).toBeDefined();
        expect(tab.containerEl.querySelector('[data-id="custom-labels"]')).toBeNull();

        customLabelToggle!.checked = true;
        customLabelToggle!.dispatchEvent(new Event('change'));

        await Promise.resolve();

        expect(tab.containerEl.querySelector('.pem-list-panel-order-list')).toBe(panelOrderList);
        expect(tab.containerEl.querySelector('[data-id="custom-labels"]')).toBeDefined();
    });

    it('selects unordered markers without rebuilding the settings tab', () => {
        const { tab } = createSettingTab();

        tab.display();

        const listEl = tab.containerEl.querySelector('.pem-unordered-list-order-list');
        const secondItem = tab.containerEl.querySelector<HTMLElement>(
            '[data-id="+"]'
        );

        expect(listEl).toBeDefined();
        expect(secondItem).toBeDefined();

        secondItem!.click();

        expect(tab.containerEl.querySelector('.pem-unordered-list-order-list')).toBe(listEl);
        expect(secondItem!.classList.contains('is-selected')).toBe(true);
        expect(secondItem!.getAttribute('aria-selected')).toBe('true');

        const buttons = Array.from(
            tab.containerEl.querySelectorAll<HTMLButtonElement>('.pem-unordered-list-order-container button')
        );
        expect(buttons.find(button => button.textContent === 'Move up')?.disabled).toBe(false);
        expect(buttons.find(button => button.textContent === 'Move down')?.disabled).toBe(false);
        expect(buttons.find(button => button.textContent === 'Move to top')?.disabled).toBe(false);
        expect(buttons.find(button => button.textContent === 'Move to bottom')?.disabled).toBe(false);
    });

    it('moves unordered markers without rebuilding the settings tab', async () => {
        const { plugin, tab } = createSettingTab();

        tab.display();

        const listEl = tab.containerEl.querySelector('.pem-unordered-list-order-list');
        const plusItem = tab.containerEl.querySelector<HTMLElement>('[data-id="+"]');
        const moveUp = Array.from(
            tab.containerEl.querySelectorAll<HTMLButtonElement>('.pem-unordered-list-order-container button')
        ).find(button => button.textContent === 'Move up');

        expect(listEl).toBeDefined();
        expect(plusItem).toBeDefined();
        expect(moveUp).toBeDefined();

        plusItem!.click();
        moveUp!.click();

        await Promise.resolve();

        expect(tab.containerEl.querySelector('.pem-unordered-list-order-list')).toBe(listEl);
        expect(plugin.settings.unorderedListMarkerOrder).toEqual(['+', '-', '*']);
        expect(plugin.saveSettings).toHaveBeenCalled();
        expect(tab.containerEl.querySelector('.pem-unordered-list-order-list')?.firstElementChild)
            .toHaveProperty('dataset.id', '+');
    });

    it('selects ordered marker styles without rebuilding the settings tab', () => {
        const { tab } = createSettingTab();

        tab.display();

        const listEl = tab.containerEl.querySelector('.pem-ordered-list-order-list');
        const secondItem = tab.containerEl.querySelector<HTMLElement>(
            '[data-id="lower-alpha-period"]'
        );

        expect(listEl).toBeDefined();
        expect(secondItem).toBeDefined();

        secondItem!.click();

        expect(tab.containerEl.querySelector('.pem-ordered-list-order-list')).toBe(listEl);
        expect(secondItem!.classList.contains('is-selected')).toBe(true);
        expect(secondItem!.getAttribute('aria-selected')).toBe('true');

        const buttons = Array.from(
            tab.containerEl.querySelectorAll<HTMLButtonElement>('.pem-ordered-list-order-container button')
        );
        expect(buttons.find(button => button.textContent === 'Move up')?.disabled).toBe(false);
        expect(buttons.find(button => button.textContent === 'Move down')?.disabled).toBe(false);
        expect(buttons.find(button => button.textContent === 'Move to top')?.disabled).toBe(false);
        expect(buttons.find(button => button.textContent === 'Move to bottom')?.disabled).toBe(false);
    });

    it('moves ordered marker styles without rebuilding the settings tab', async () => {
        const { plugin, tab } = createSettingTab();

        tab.display();

        const listEl = tab.containerEl.querySelector('.pem-ordered-list-order-list');
        const alphaItem = tab.containerEl.querySelector<HTMLElement>(
            '[data-id="lower-alpha-period"]'
        );
        const moveUp = Array.from(
            tab.containerEl.querySelectorAll<HTMLButtonElement>('.pem-ordered-list-order-container button')
        ).find(button => button.textContent === 'Move up');

        expect(listEl).toBeDefined();
        expect(alphaItem).toBeDefined();
        expect(moveUp).toBeDefined();

        alphaItem!.click();
        moveUp!.click();

        await Promise.resolve();

        expect(tab.containerEl.querySelector('.pem-ordered-list-order-list')).toBe(listEl);
        expect(plugin.settings.orderedListMarkerOrder.slice(0, 2)).toEqual([
            'lower-alpha-period',
            'decimal-period'
        ]);
        expect(plugin.saveSettings).toHaveBeenCalled();
        expect(tab.containerEl.querySelector('.pem-ordered-list-order-list')?.firstElementChild)
            .toHaveProperty('dataset.id', 'lower-alpha-period');
    });

    it('normalizes custom ordered marker orders without unknown styles', () => {
        const settings = normalizeSettings({
            unorderedListMarkerOrder: ['*', 'unknown-marker', '+'] as any,
            orderedListMarkerOrder: ['upper-alpha-period', 'unknown-style', 'decimal-period'] as any
        });

        expect(settings.unorderedListMarkerOrder).toEqual(['*', '+']);
        expect(settings.orderedListMarkerOrder).toEqual(['upper-alpha-period', 'decimal-period']);
        expect(DEFAULT_SETTINGS.unorderedListMarkerOrder).toEqual(['-', '+', '*']);
        expect(DEFAULT_SETTINGS.orderedListMarkerOrder).toContain('lower-roman-period');
    });
});
