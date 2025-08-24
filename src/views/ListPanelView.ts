// External libraries
import { ItemView, WorkspaceLeaf, MarkdownView, HoverLinkSource, setIcon } from 'obsidian';

// Types
import { PanelModule, PanelTabInfo } from './panels/PanelTypes';

// Constants
import { UI_CONSTANTS, ICONS, MESSAGES } from '../constants';

// Utils
import { handleError } from '../utils/errorHandler';

// Internal modules
import { CustomLabelPanelModule } from './panels/CustomLabelPanelModule';
import { ExampleListPanelModule } from './panels/ExampleListPanelModule';
import { PandocExtendedMarkdownPlugin } from '../main';

export const VIEW_TYPE_LIST_PANEL = 'list-panel-view';

export class ListPanelView extends ItemView {
    private plugin: PandocExtendedMarkdownPlugin;
    private panels: PanelTabInfo[] = [];
    private activePanel: PanelModule | null = null;
    private updateTimer: NodeJS.Timeout | null = null;
    private lastActiveMarkdownView: MarkdownView | null = null;
    private iconRowEl: HTMLElement | null = null;
    private contentContainerEl: HTMLElement | null = null;
    hoverLinkSource: HoverLinkSource;
    
    constructor(leaf: WorkspaceLeaf, plugin: PandocExtendedMarkdownPlugin) {
        super(leaf);
        this.plugin = plugin;
        
        this.hoverLinkSource = {
            display: 'List Panel',
            defaultMod: true
        };
        
        this.initializePanels();
    }
    
    private initializePanels(): void {
        const availablePanels: PanelTabInfo[] = [];
        
        // Register all available panels
        // Only register custom label panel if More Extended Syntax is enabled
        if (this.plugin.settings.moreExtendedSyntax) {
            const customLabelModule = new CustomLabelPanelModule(this.plugin);
            availablePanels.push({
                id: customLabelModule.id,
                displayName: customLabelModule.displayName,
                icon: customLabelModule.icon,
                module: customLabelModule
            });
        }
        
        const exampleListModule = new ExampleListPanelModule(this.plugin);
        availablePanels.push({
            id: exampleListModule.id,
            displayName: exampleListModule.displayName,
            icon: exampleListModule.icon,
            module: exampleListModule
        });
        
        // Sort panels according to settings order
        const panelOrder = this.plugin.settings.panelOrder || ['custom-labels', 'example-lists'];
        this.panels = [];
        
        // First, add panels in the specified order
        for (const panelId of panelOrder) {
            const panel = availablePanels.find(p => p.id === panelId);
            if (panel) {
                this.panels.push(panel);
            }
        }
        
        // Then, add any panels that weren't in the order (for extensibility)
        for (const panel of availablePanels) {
            if (!this.panels.some(p => p.id === panel.id)) {
                this.panels.push(panel);
            }
        }
    }
    
    getViewType(): string {
        return VIEW_TYPE_LIST_PANEL;
    }
    
    getDisplayText(): string {
        return 'List Panel';
    }
    
    getIcon(): string {
        return ICONS.LIST_PANEL_ID;
    }
    
    async onOpen() {
        this.renderView();
        await this.updateView();
        
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                this.scheduleUpdate();
            })
        );
        
        this.registerEvent(
            this.app.workspace.on('editor-change', () => {
                this.scheduleUpdate();
            })
        );
        
        this.registerEvent(
            this.app.workspace.on('file-open', () => {
                this.scheduleUpdate();
            })
        );
        
        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                this.scheduleUpdate();
            })
        );
        
        this.plugin.registerHoverLinkSource(VIEW_TYPE_LIST_PANEL, this.hoverLinkSource);
    }
    
    async onClose() {
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }
        
        for (const panel of this.panels) {
            panel.module.destroy();
        }
        
        this.contentEl.empty();
    }
    
    private renderView(): void {
        this.contentEl.empty();
        
        const viewContainer = this.contentEl.createDiv({
            cls: 'pandoc-list-panel-view-container'
        });
        
        this.iconRowEl = viewContainer.createDiv({
            cls: 'pandoc-list-panel-icon-row'
        });
        
        for (const panel of this.panels) {
            const iconButton = this.iconRowEl.createDiv({
                cls: 'pandoc-list-panel-icon-button',
                attr: {
                    'aria-label': panel.displayName,
                    'data-panel-id': panel.id
                }
            });
            
            // Create SVG element safely without innerHTML
            const iconContainer = iconButton.createDiv();
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(panel.icon, 'image/svg+xml');
            const svgElement = svgDoc.documentElement;
            if (svgElement && svgElement.nodeName === 'svg') {
                iconContainer.appendChild(svgElement.cloneNode(true));
            }
            
            iconButton.addEventListener('click', () => {
                this.switchToPanel(panel);
            });
        }
        
        const separator = viewContainer.createEl('hr', {
            cls: 'pandoc-list-panel-separator'
        });
        
        this.contentContainerEl = viewContainer.createDiv({
            cls: 'pandoc-list-panel-content-container'
        });
        
        if (this.panels.length > 0) {
            this.switchToPanel(this.panels[0]);
        }
    }
    
    private switchToPanel(panelInfo: PanelTabInfo): void {
        if (this.activePanel === panelInfo.module) {
            return;
        }
        
        if (this.activePanel) {
            this.activePanel.onDeactivate();
        }
        
        const allButtons = this.iconRowEl?.querySelectorAll('.pandoc-list-panel-icon-button');
        allButtons?.forEach(btn => btn.removeClass('is-active'));
        
        const activeButton = this.iconRowEl?.querySelector(`[data-panel-id="${panelInfo.id}"]`);
        activeButton?.addClass('is-active');
        
        this.activePanel = panelInfo.module;
        
        if (this.contentContainerEl) {
            this.contentContainerEl.empty();
            
            this.activePanel.onActivate(this.contentContainerEl, this.lastActiveMarkdownView);
        }
    }
    
    private scheduleUpdate(): void {
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }
        
        this.updateTimer = setTimeout(() => {
            this.updateView();
        }, UI_CONSTANTS.UPDATE_DEBOUNCE_MS);
    }
    
    async updateView(): Promise<void> {
        try {
            // Use proper API to get active markdown view
            let markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
            
            if (markdownView && markdownView.file) {
                this.lastActiveMarkdownView = markdownView;
            }
            
            if (!markdownView || !markdownView.file) {
                markdownView = this.lastActiveMarkdownView;
            }
            
            if (this.activePanel && this.activePanel.shouldUpdate()) {
                this.activePanel.onUpdate(markdownView);
            }
        } catch (error) {
            handleError(error, 'Update list panel view');
        }
    }
    
    getCustomLabels(): any[] {
        const customLabelPanel = this.panels.find(p => p.id === 'custom-labels');
        if (customLabelPanel && customLabelPanel.module instanceof CustomLabelPanelModule) {
            return customLabelPanel.module.getCustomLabels();
        }
        return [];
    }
    
    refreshPanels(): void {
        // Store current active panel id
        const activePanelId = this.activePanel?.id;
        
        // Destroy all current panels
        for (const panel of this.panels) {
            if (panel.module === this.activePanel) {
                panel.module.onDeactivate();
            }
            panel.module.destroy();
        }
        
        // Clear panels array
        this.panels = [];
        this.activePanel = null;
        
        // Re-initialize panels with current settings
        this.initializePanels();
        
        // Re-render the view
        this.renderView();
        
        // Try to restore previously active panel if it still exists
        if (activePanelId) {
            const panelToRestore = this.panels.find(p => p.id === activePanelId);
            if (panelToRestore) {
                this.switchToPanel(panelToRestore);
            }
        }
    }
}