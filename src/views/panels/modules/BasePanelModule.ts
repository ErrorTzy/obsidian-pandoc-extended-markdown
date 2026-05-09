import { MarkdownView } from 'obsidian';
import { PanelModule } from './PanelTypes';
import { PandocExtendedMarkdownPlugin } from '../../../core/main';
import { MESSAGES } from '../../../core/constants';
import { ProcessingContext } from '../../../shared/rendering/ContentProcessorRegistry';
import { FencedDivReference } from '../../../shared/types/fencedDivTypes';
import { extractExampleLists } from '../../../shared/extractors/exampleListExtractor';
import { extractCustomLabels } from '../../../shared/extractors/customLabelExtractor';
import { extractFencedDivs } from '../../../shared/extractors/fencedDivExtractor';
import {
    isCustomLabelListsEnabled,
    isSyntaxFeatureEnabled
} from '../../../shared/types/settingsTypes';
import { FencedDivTypeCounters, createFencedDivReference } from '../../../shared/utils/fencedDivReferenceMetadata';

/**
 * Base class for all panel modules.
 * Provides common lifecycle management, state handling, and update mechanisms.
 */
export abstract class BasePanelModule implements PanelModule {
    abstract id: string;
    abstract displayName: string;
    abstract icon: string;

    isActive = false;

    protected plugin: PandocExtendedMarkdownPlugin;
    protected containerEl: HTMLElement | null = null;
    protected lastActiveMarkdownView: MarkdownView | null = null;
    protected abortController: AbortController | null = null;
    protected currentContext: ProcessingContext = {};

    constructor(plugin: PandocExtendedMarkdownPlugin) {
        this.plugin = plugin;
    }

    onActivate(containerEl: HTMLElement, activeView: MarkdownView | null): void {
        this.isActive = true;
        this.containerEl = containerEl;
        this.lastActiveMarkdownView = activeView;
        // Create new abort controller for cleanup
        this.abortController = new AbortController();
        this.updateContent(activeView);
    }

    onDeactivate(): void {
        this.isActive = false;
        // Clean up all event listeners
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        if (this.containerEl) {
            this.containerEl.empty();
            this.containerEl = null;
        }
        this.cleanupModuleData();
    }

    onUpdate(activeView: MarkdownView | null): void {
        if (!this.isActive || !this.containerEl) return;

        if (activeView && activeView.file) {
            this.lastActiveMarkdownView = activeView;
        } else if (!activeView) {
            activeView = this.lastActiveMarkdownView;
        }

        this.updateContent(activeView);
    }

    shouldUpdate(): boolean {
        return this.isActive;
    }

    destroy(): void {
        this.onDeactivate();
        this.lastActiveMarkdownView = null;
    }

    /**
     * Main update method that orchestrates content extraction and rendering.
     */
    protected updateContent(activeView: MarkdownView | null): void {
        if (!this.containerEl) return;

        this.containerEl.empty();

        if (!activeView || !activeView.file) {
            this.showNoFileMessage();
            return;
        }

        const content = activeView.editor.getValue();

        // Extract module-specific data
        this.extractData(content);

        // Build context for reference processing
        this.buildRenderingContext(content);

        // Render the content
        this.renderContent(activeView);
    }

    /**
     * Shows a message when no file is open.
     */
    protected showNoFileMessage(): void {
        if (!this.containerEl) return;

        this.containerEl.createEl('div', {
            text: MESSAGES.NO_ACTIVE_FILE
        });
    }

    /**
     * Builds the rendering context for processing references.
     * Common implementation that can be overridden if needed.
     */
    protected buildRenderingContext(content: string): void {
        const exampleLabels = new Map<string, number>();
        const exampleContent = new Map<string, string>();

        if (isSyntaxFeatureEnabled(this.plugin.settings, 'enableExampleLists')) {
            const exampleItems = extractExampleLists(content);
            exampleItems.forEach(item => {
                const label = item.rawLabel.substring(1);
                if (label) {
                    exampleLabels.set(label, item.renderedNumber);
                    exampleContent.set(label, item.content.trim());
                }
            });
        }

        const customLabelMap = new Map<string, string>();
        const rawToProcessed = new Map<string, string>();

        if (isCustomLabelListsEnabled(this.plugin.settings)) {
            const customLabels = extractCustomLabels(content, true);
            customLabels.forEach(label => {
                customLabelMap.set(label.rawLabel, label.content);
                if (label.processedLabel !== label.rawLabel) {
                    rawToProcessed.set(label.rawLabel, label.processedLabel);
                }
            });
        }

        const fencedDivLabels = new Map<string, FencedDivReference>();
        if (isSyntaxFeatureEnabled(this.plugin.settings, 'enableFencedDivs')) {
            const fencedDivs = extractFencedDivs(content, this.plugin.settings);
            const typeCounters: FencedDivTypeCounters = new Map();
            fencedDivs.forEach(item => {
                if (!item.label || fencedDivLabels.has(item.label)) {
                    return;
                }

                fencedDivLabels.set(
                    item.label,
                    createFencedDivReference(
                        item.label,
                        item.title,
                        item.classes,
                        item.lineNumber + 1,
                        item.content,
                        typeCounters
                    )
                );
            });
        }

        this.currentContext = {
            exampleLabels,
            exampleContent,
            customLabels: customLabelMap,
            rawToProcessed,
            fencedDivLabels
        };
    }

    /**
     * Extract module-specific data from the content.
     * Must be implemented by subclasses.
     */
    protected abstract extractData(content: string): void;

    /**
     * Render the module-specific content.
     * Must be implemented by subclasses.
     */
    protected abstract renderContent(activeView: MarkdownView): void;

    /**
     * Clean up module-specific data.
     * Should be implemented by subclasses if they have data to clean up.
     */
    protected cleanupModuleData(): void {
        // Default implementation does nothing
        // Subclasses should override to clean up their specific data
    }
}
