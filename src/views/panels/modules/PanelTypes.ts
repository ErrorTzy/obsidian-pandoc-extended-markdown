import { MarkdownView } from 'obsidian';
import { PandocExtendedMarkdownPlugin } from '../../../core/main';

export interface PanelModule {
    id: string;
    displayName: string;
    icon: string;
    isActive: boolean;
    
    onActivate(containerEl: HTMLElement, activeView: MarkdownView | null): void;
    onDeactivate(): void;
    onUpdate(activeView: MarkdownView | null): void;
    shouldUpdate(): boolean;
    destroy(): void;
}

export interface PanelModuleConstructor {
    new(plugin: PandocExtendedMarkdownPlugin): PanelModule;
}

export interface PanelTabInfo {
    id: string;
    displayName: string;
    icon: string;
    module: PanelModule;
}