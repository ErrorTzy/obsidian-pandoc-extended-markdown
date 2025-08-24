// External libraries
import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

// Types
import { PandocExtendedMarkdownSettings, DEFAULT_SETTINGS } from './types/settingsTypes';
import type { ListPanelView } from './views/ListPanelView';

// Constants
import { PANEL_SETTINGS } from './constants';

// Internal modules
import { VIEW_TYPE_LIST_PANEL } from './views/ListPanelView';

export { PandocExtendedMarkdownSettings, DEFAULT_SETTINGS };

interface PanelOrderButtons {
    moveUp: HTMLButtonElement;
    moveDown: HTMLButtonElement;
    moveTop: HTMLButtonElement;
    moveBottom: HTMLButtonElement;
    reset: HTMLButtonElement;
}

export class PandocExtendedMarkdownSettingTab extends PluginSettingTab {
    plugin: Plugin & { settings: PandocExtendedMarkdownSettings; saveSettings: () => Promise<void> };
    private selectedPanelId?: string;

    constructor(app: App, plugin: Plugin & { settings: PandocExtendedMarkdownSettings; saveSettings: () => Promise<void> }) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        this.renderGeneralSettings(containerEl);
        this.renderPanelOrderSettings(containerEl);
    }

    private renderGeneralSettings(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName('Strict Pandoc mode')
            .setDesc('Enable strict pandoc formatting requirements. When enabled, lists must have empty lines before and after them, and capital letter lists require double spacing after markers.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.strictPandocMode)
                .onChange(async (value) => {
                    this.plugin.settings.strictPandocMode = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Auto-renumber lists')
            .setDesc('Automatically renumber all list items when inserting a new item. This ensures proper sequential ordering of fancy lists (A, B, C... or i, ii, iii...) when you add items in the middle of a list.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoRenumberLists)
                .onChange(async (value) => {
                    this.plugin.settings.autoRenumberLists = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Custom Label List')
            .setDesc('Should use it together with CustomLabelList.lua to enhance pandoc output. Enables custom label lists using {::LABEL} syntax. When strict pandoc mode is enabled, custom label lists must be preceded and followed by blank lines.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.moreExtendedSyntax)
                .onChange(async (value) => {
                    this.plugin.settings.moreExtendedSyntax = value;
                    await this.plugin.saveSettings();
                    
                    // Refresh list panel views if they exist
                    this.refreshListPanels();
                }));

        new Setting(containerEl)
            .setName('Use new processing pipeline (Experimental)')
            .setDesc('Enable the new two-phase processing pipeline that provides better extensibility and performance. This is an experimental feature - please report any issues.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useNewPipeline)
                .onChange(async (value) => {
                    this.plugin.settings.useNewPipeline = value;
                    await this.plugin.saveSettings();
                }));
    }

    private renderPanelOrderSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h2', { text: PANEL_SETTINGS.UI_TEXT.PANEL_ORDER_HEADING });

        const panelOrderSetting = new Setting(containerEl)
            .setName('')
            .setDesc(PANEL_SETTINGS.UI_TEXT.PANEL_ORDER_DESC);
        
        // Make the description column narrower
        const infoEl = panelOrderSetting.infoEl;
        if (infoEl) {
            infoEl.addClass('pandoc-panel-order-info');
        }

        // Create flex container for list and buttons
        const flexContainer = panelOrderSetting.controlEl.createDiv({
            cls: 'pandoc-panel-order-container'
        });

        // Create container for the list (left side)
        const listEl = flexContainer.createDiv({
            cls: 'pandoc-panel-order-list'
        });
        listEl.setAttribute('role', 'listbox');
        listEl.tabIndex = 0;

        // Ensure panel order is up to date
        this.syncPanelOrder();

        // Render panel list
        this.renderPanelList(listEl);

        // Create buttons
        const buttons = this.createPanelOrderButtons(flexContainer);

        // Setup button states and event handlers
        this.updateButtonStates(buttons);
        this.setupPanelOrderEventHandlers(listEl, buttons);
    }

    private syncPanelOrder(): void {
        const currentOrder = [...this.plugin.settings.panelOrder];
        for (const panel of PANEL_SETTINGS.AVAILABLE_PANELS) {
            if (!currentOrder.includes(panel.id)) {
                currentOrder.push(panel.id);
            }
        }
        // Remove panels that no longer exist
        this.plugin.settings.panelOrder = currentOrder.filter(id => 
            PANEL_SETTINGS.AVAILABLE_PANELS.some(panel => panel.id === id)
        );
    }

    private renderPanelList(listEl: HTMLElement): void {
        for (const panelId of this.plugin.settings.panelOrder) {
            const panelInfo = PANEL_SETTINGS.AVAILABLE_PANELS.find(p => p.id === panelId);
            if (!panelInfo) continue;

            // Skip custom-labels if moreExtendedSyntax is disabled
            if (panelId === 'custom-labels' && !this.plugin.settings.moreExtendedSyntax) {
                continue;
            }

            const itemEl = listEl.createDiv({
                cls: 'pandoc-panel-order-item'
            });
            itemEl.setAttribute('role', 'option');
            itemEl.dataset.id = panelId;
            itemEl.tabIndex = 0;

            // Add icon
            const iconContainer = itemEl.createDiv({
                cls: 'pandoc-panel-order-icon'
            });
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(panelInfo.icon, 'image/svg+xml');
            const svgElement = svgDoc.documentElement;
            if (svgElement && svgElement.nodeName === 'svg') {
                const clonedSvg = svgElement.cloneNode(true) as SVGElement;
                clonedSvg.setAttribute('width', '20');
                clonedSvg.setAttribute('height', '20');
                iconContainer.appendChild(clonedSvg);
            }

            // Add text
            itemEl.createSpan({ text: panelInfo.displayName });

            // Visual selection
            if (panelId === this.selectedPanelId) {
                itemEl.classList.add('is-selected');
                itemEl.setAttribute('aria-selected', 'true');
            } else {
                itemEl.setAttribute('aria-selected', 'false');
            }

            // Click selects the item
            itemEl.addEventListener('click', () => {
                this.selectedPanelId = panelId;
                this.display();
            });

            // Keyboard: Enter / Space selects
            itemEl.addEventListener('keydown', (evt) => {
                if (evt.key === 'Enter' || evt.key === ' ') {
                    evt.preventDefault();
                    this.selectedPanelId = panelId;
                    this.display();
                }
            });
        }
    }

    private createPanelOrderButtons(container: HTMLElement): PanelOrderButtons {
        const btnWrap = container.createDiv({
            cls: 'pandoc-panel-order-buttons'
        });

        const btnMoveUp = btnWrap.createEl('button', { 
            text: PANEL_SETTINGS.UI_TEXT.BTN_MOVE_UP,
            cls: 'pandoc-panel-order-button'
        });
        const btnMoveDown = btnWrap.createEl('button', { 
            text: PANEL_SETTINGS.UI_TEXT.BTN_MOVE_DOWN,
            cls: 'pandoc-panel-order-button'
        });
        const btnTop = btnWrap.createEl('button', { 
            text: PANEL_SETTINGS.UI_TEXT.BTN_MOVE_TOP,
            cls: 'pandoc-panel-order-button'
        });
        const btnBottom = btnWrap.createEl('button', { 
            text: PANEL_SETTINGS.UI_TEXT.BTN_MOVE_BOTTOM,
            cls: 'pandoc-panel-order-button'
        });
        const btnReset = btnWrap.createEl('button', { 
            text: PANEL_SETTINGS.UI_TEXT.BTN_RESTORE_DEFAULT,
            cls: 'pandoc-panel-order-button'
        });

        return {
            moveUp: btnMoveUp,
            moveDown: btnMoveDown,
            moveTop: btnTop,
            moveBottom: btnBottom,
            reset: btnReset
        };
    }

    private updateButtonStates(buttons: PanelOrderButtons): void {
        const visiblePanels = this.getVisiblePanels();
        const idx = this.getCurrentPanelIndex();
        
        buttons.moveUp.disabled = idx <= 0;
        buttons.moveDown.disabled = idx < 0 || idx >= visiblePanels.length - 1;
        buttons.moveTop.disabled = idx <= 0;
        buttons.moveBottom.disabled = idx < 0 || idx >= visiblePanels.length - 1;
    }

    private setupPanelOrderEventHandlers(listEl: HTMLElement, buttons: PanelOrderButtons): void {
        // Move up
        buttons.moveUp.addEventListener('click', async () => {
            await this.movePanelUp();
        });

        // Move down
        buttons.moveDown.addEventListener('click', async () => {
            await this.movePanelDown();
        });

        // Move to top
        buttons.moveTop.addEventListener('click', async () => {
            await this.movePanelToTop();
        });

        // Move to bottom
        buttons.moveBottom.addEventListener('click', async () => {
            await this.movePanelToBottom();
        });

        // Reset default
        buttons.reset.addEventListener('click', async () => {
            await this.resetPanelOrder();
        });

        // Keyboard shortcuts while list is focused
        listEl.addEventListener('keydown', (evt) => {
            if (!this.selectedPanelId) return;
            if (evt.key === 'ArrowUp') {
                evt.preventDefault();
                buttons.moveUp.click();
            } else if (evt.key === 'ArrowDown') {
                evt.preventDefault();
                buttons.moveDown.click();
            }
        });
    }

    private async movePanelUp(): Promise<void> {
        const i = this.plugin.settings.panelOrder.indexOf(this.selectedPanelId!);
        if (i > 0) {
            const arr = this.plugin.settings.panelOrder;
            [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
            await this.plugin.saveSettings();
            this.refreshListPanels();
            this.display();
        }
    }

    private async movePanelDown(): Promise<void> {
        const i = this.plugin.settings.panelOrder.indexOf(this.selectedPanelId!);
        const arr = this.plugin.settings.panelOrder;
        if (i >= 0 && i < arr.length - 1) {
            [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
            await this.plugin.saveSettings();
            this.refreshListPanels();
            this.display();
        }
    }

    private async movePanelToTop(): Promise<void> {
        const i = this.plugin.settings.panelOrder.indexOf(this.selectedPanelId!);
        if (i > 0) {
            const arr = this.plugin.settings.panelOrder;
            const [item] = arr.splice(i, 1);
            arr.unshift(item);
            await this.plugin.saveSettings();
            this.refreshListPanels();
            this.display();
        }
    }

    private async movePanelToBottom(): Promise<void> {
        const i = this.plugin.settings.panelOrder.indexOf(this.selectedPanelId!);
        const arr = this.plugin.settings.panelOrder;
        if (i >= 0 && i < arr.length - 1) {
            const [item] = arr.splice(i, 1);
            arr.push(item);
            await this.plugin.saveSettings();
            this.refreshListPanels();
            this.display();
        }
    }

    private async resetPanelOrder(): Promise<void> {
        this.plugin.settings.panelOrder = [...DEFAULT_SETTINGS.panelOrder];
        await this.plugin.saveSettings();
        this.selectedPanelId = undefined;
        this.refreshListPanels();
        this.display();
    }

    private getVisiblePanels(): string[] {
        return this.plugin.settings.panelOrder.filter(id => {
            if (id === 'custom-labels' && !this.plugin.settings.moreExtendedSyntax) {
                return false;
            }
            return PANEL_SETTINGS.AVAILABLE_PANELS.some(panel => panel.id === id);
        });
    }

    private getCurrentPanelIndex(): number {
        if (!this.selectedPanelId) return -1;
        const visiblePanels = this.getVisiblePanels();
        return visiblePanels.indexOf(this.selectedPanelId);
    }

    private refreshListPanels(): void {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_LIST_PANEL);
        for (const leaf of leaves) {
            const view = leaf.view as ListPanelView;
            if (view && view.refreshPanels) {
                view.refreshPanels();
            }
        }
    }
}