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

export type PanelIdentityKind = 'title' | 'token' | 'text';

export interface PanelIdentityPart {
    text: string;
    kind?: PanelIdentityKind;
    className?: string;
    actionLabel?: string;
    onActivate?: () => void;
    render?: (element: HTMLElement) => void | Promise<void>;
}

export interface PanelItemSpec {
    key: string;
    identityParts: PanelIdentityPart[];
    renderContent: (element: HTMLElement) => void | Promise<void>;
    rowClassName?: string;
    contentClassName?: string;
    navigationLabel?: string;
    onContentActivate?: () => void;
}

export interface PanelCollectionOptions {
    title: string;
    items: PanelItemSpec[];
    expandedKeys: Set<string>;
    containerClassName?: string;
    emptyClassName?: string;
    emptyMessage?: string;
}
