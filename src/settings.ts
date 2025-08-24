import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { PandocExtendedMarkdownSettings, DEFAULT_SETTINGS } from './types/settingsTypes';
import { VIEW_TYPE_LIST_PANEL } from './views/ListPanelView';
import type { ListPanelView } from './views/ListPanelView';
import { ICONS } from './constants';

export { PandocExtendedMarkdownSettings, DEFAULT_SETTINGS };

interface PanelInfo {
    id: string;
    displayName: string;
    icon: string;
}

const AVAILABLE_PANELS: PanelInfo[] = [
    {
        id: 'custom-labels',
        displayName: 'Custom Label List Panel',
        icon: ICONS.CUSTOM_LABEL_SVG
    },
    {
        id: 'example-lists',
        displayName: 'Example List Panel',
        icon: ICONS.EXAMPLE_LIST_SVG
    }
];

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
                    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_LIST_PANEL);
                    for (const leaf of leaves) {
                        const view = leaf.view as ListPanelView;
                        if (view && view.refreshPanels) {
                            view.refreshPanels();
                        }
                    }
                }));

        // Panel Order Settings
        containerEl.createEl('h2', { text: 'Panel Order' });

        const panelOrderSetting = new Setting(containerEl)
            .setName('')
            .setDesc('Select a panel and use the buttons to change its order in the sidebar');
        
        // Make the description column narrower
        const infoEl = panelOrderSetting.infoEl;
        if (infoEl) {
            infoEl.style.flex = '0 0 auto';
            infoEl.style.maxWidth = '200px';
        }

        // Create flex container for list and buttons
        const flexContainer = panelOrderSetting.controlEl.createDiv();
        flexContainer.style.display = 'flex';
        flexContainer.style.gap = '12px';
        flexContainer.style.width = '100%';

        // Create container for the list (left side)
        const listEl = flexContainer.createDiv();
        listEl.setAttribute('role', 'listbox');
        listEl.tabIndex = 0;
        listEl.style.display = 'flex';
        listEl.style.flexDirection = 'column';
        listEl.style.gap = '6px';
        listEl.style.flex = '1';
        listEl.style.minWidth = '300px';
        listEl.style.border = '1px solid var(--background-modifier-border)';
        listEl.style.borderRadius = '6px';
        listEl.style.padding = '8px';

        // Ensure panel order includes all available panels
        const currentOrder = [...this.plugin.settings.panelOrder];
        for (const panel of AVAILABLE_PANELS) {
            if (!currentOrder.includes(panel.id)) {
                currentOrder.push(panel.id);
            }
        }
        // Remove panels that no longer exist
        this.plugin.settings.panelOrder = currentOrder.filter(id => 
            AVAILABLE_PANELS.some(panel => panel.id === id)
        );

        // Render panels
        for (const panelId of this.plugin.settings.panelOrder) {
            const panelInfo = AVAILABLE_PANELS.find(p => p.id === panelId);
            if (!panelInfo) continue;

            // Skip custom-labels if moreExtendedSyntax is disabled
            if (panelId === 'custom-labels' && !this.plugin.settings.moreExtendedSyntax) {
                continue;
            }

            const itemEl = listEl.createDiv();
            itemEl.setAttribute('role', 'option');
            itemEl.dataset.id = panelId;
            itemEl.tabIndex = 0;
            itemEl.style.padding = '6px 8px';
            itemEl.style.borderRadius = '6px';
            itemEl.style.cursor = 'pointer';
            itemEl.style.userSelect = 'none';
            itemEl.style.display = 'flex';
            itemEl.style.alignItems = 'center';
            itemEl.style.gap = '8px';

            // Add icon
            const iconContainer = itemEl.createDiv();
            iconContainer.style.width = '20px';
            iconContainer.style.height = '20px';
            iconContainer.style.flexShrink = '0';
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
            const textEl = itemEl.createSpan({ text: panelInfo.displayName });

            // Visual selection
            if (panelId === this.selectedPanelId) {
                itemEl.classList.add('is-selected');
                itemEl.setAttribute('aria-selected', 'true');
                itemEl.style.backgroundColor = 'var(--interactive-accent)';
                itemEl.style.color = 'var(--text-on-accent)';
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

        // Buttons area (right side)
        const btnWrap = flexContainer.createDiv();
        btnWrap.style.display = 'flex';
        btnWrap.style.flexDirection = 'column';
        btnWrap.style.gap = '6px';
        btnWrap.style.minWidth = '140px';

        const btnMoveUp = btnWrap.createEl('button', { text: 'Move up' });
        const btnMoveDown = btnWrap.createEl('button', { text: 'Move down' });
        const btnTop = btnWrap.createEl('button', { text: 'Move to top' });
        const btnBottom = btnWrap.createEl('button', { text: 'Move to bottom' });
        const btnReset = btnWrap.createEl('button', { text: 'Restore to Default' });

        // Style buttons to take full width
        [btnMoveUp, btnMoveDown, btnTop, btnBottom, btnReset].forEach(btn => {
            btn.style.width = '100%';
        });

        // Helper: get visible panels only
        const getVisiblePanels = () => {
            return this.plugin.settings.panelOrder.filter(id => {
                if (id === 'custom-labels' && !this.plugin.settings.moreExtendedSyntax) {
                    return false;
                }
                return AVAILABLE_PANELS.some(panel => panel.id === id);
            });
        };

        // Helper: compute current index
        const getIndex = () => {
            if (!this.selectedPanelId) return -1;
            const visiblePanels = getVisiblePanels();
            return visiblePanels.indexOf(this.selectedPanelId);
        };

        // Set disabled state for buttons based on selection
        const visiblePanels = getVisiblePanels();
        const idx = getIndex();
        btnMoveUp.disabled = idx <= 0;
        btnMoveDown.disabled = idx < 0 || idx >= visiblePanels.length - 1;
        btnTop.disabled = idx <= 0;
        btnBottom.disabled = idx < 0 || idx >= visiblePanels.length - 1;

        // Move up
        btnMoveUp.addEventListener('click', async () => {
            const i = this.plugin.settings.panelOrder.indexOf(this.selectedPanelId!);
            if (i > 0) {
                const arr = this.plugin.settings.panelOrder;
                [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
                await this.plugin.saveSettings();
                this.refreshListPanels();
                this.display();
            }
        });

        // Move down
        btnMoveDown.addEventListener('click', async () => {
            const i = this.plugin.settings.panelOrder.indexOf(this.selectedPanelId!);
            const arr = this.plugin.settings.panelOrder;
            if (i >= 0 && i < arr.length - 1) {
                [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
                await this.plugin.saveSettings();
                this.refreshListPanels();
                this.display();
            }
        });

        // Move to top
        btnTop.addEventListener('click', async () => {
            const i = this.plugin.settings.panelOrder.indexOf(this.selectedPanelId!);
            if (i > 0) {
                const arr = this.plugin.settings.panelOrder;
                const [item] = arr.splice(i, 1);
                arr.unshift(item);
                await this.plugin.saveSettings();
                this.refreshListPanels();
                this.display();
            }
        });

        // Move to bottom
        btnBottom.addEventListener('click', async () => {
            const i = this.plugin.settings.panelOrder.indexOf(this.selectedPanelId!);
            const arr = this.plugin.settings.panelOrder;
            if (i >= 0 && i < arr.length - 1) {
                const [item] = arr.splice(i, 1);
                arr.push(item);
                await this.plugin.saveSettings();
                this.refreshListPanels();
                this.display();
            }
        });

        // Reset default
        btnReset.addEventListener('click', async () => {
            this.plugin.settings.panelOrder = [...DEFAULT_SETTINGS.panelOrder];
            await this.plugin.saveSettings();
            this.selectedPanelId = undefined;
            this.refreshListPanels();
            this.display();
        });

        // Keyboard shortcuts while list is focused
        listEl.addEventListener('keydown', (evt) => {
            if (!this.selectedPanelId) return;
            if (evt.key === 'ArrowUp') {
                evt.preventDefault();
                btnMoveUp.click();
            } else if (evt.key === 'ArrowDown') {
                evt.preventDefault();
                btnMoveDown.click();
            }
        });
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