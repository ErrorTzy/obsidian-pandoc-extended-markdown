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
        const customLabelModule = new CustomLabelPanelModule(this.plugin);
        this.panels.push({
            id: customLabelModule.id,
            displayName: customLabelModule.displayName,
            icon: customLabelModule.icon,
            module: customLabelModule
        });
        
        const exampleListModule = new ExampleListPanelModule(this.plugin);
        this.panels.push({
            id: exampleListModule.id,
            displayName: exampleListModule.displayName,
            icon: exampleListModule.icon,
            module: exampleListModule
        });
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
}