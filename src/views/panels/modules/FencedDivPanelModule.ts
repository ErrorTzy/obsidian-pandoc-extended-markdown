import { MarkdownView } from 'obsidian';

import { BasePanelModule } from './BasePanelModule';

import { CSS_CLASSES, ICONS, MESSAGES } from '../../../core/constants';
import { FencedDivPanelItem, extractFencedDivs } from '../../../shared/extractors/fencedDivExtractor';
import { handleError } from '../../../shared/utils/errorHandler';
import { setupRenderedHoverPreview } from '../../../shared/utils/hoverPopovers';
import { truncateContentWithRendering } from '../utils/contentTruncator';
import { renderContentWithMath, setupLabelClickHandler } from '../utils/viewInteractions';
import { highlightLine } from '../../editor/highlightUtils';

export class FencedDivPanelModule extends BasePanelModule {
    id = 'fenced-divs';
    displayName = 'Fenced Divs';
    icon = ICONS.FENCED_DIV_SVG;

    private fencedDivItems: FencedDivPanelItem[] = [];

    protected cleanupModuleData(): void {
        this.fencedDivItems = [];
    }

    protected extractData(content: string): void {
        this.fencedDivItems = extractFencedDivs(content, this.plugin.settings);
    }

    protected renderContent(activeView: MarkdownView): void {
        this.renderFencedDivItems(activeView);
    }

    protected showNoFileMessage(): void {
        if (!this.containerEl) return;

        this.containerEl.createEl('div', {
            text: MESSAGES.NO_ACTIVE_FILE,
            cls: CSS_CLASSES.FENCED_DIV_PANEL_EMPTY
        });
        this.fencedDivItems = [];
    }

    private renderFencedDivItems(activeView: MarkdownView): void {
        if (!this.containerEl) return;

        if (this.fencedDivItems.length === 0) {
            this.containerEl.createEl('div', {
                text: MESSAGES.NO_FENCED_DIVS,
                cls: CSS_CLASSES.FENCED_DIV_PANEL_EMPTY
            });
            return;
        }

        const container = this.containerEl.createEl('table', {
            cls: CSS_CLASSES.FENCED_DIV_PANEL_CONTAINER
        });

        const tbody = container.createEl('tbody');
        for (const item of this.fencedDivItems) {
            this.renderFencedDivRow(tbody, item, activeView);
        }
    }

    private renderFencedDivRow(tbody: HTMLElement, item: FencedDivPanelItem, activeView: MarkdownView): void {
        const row = tbody.createEl('tr', {
            cls: CSS_CLASSES.FENCED_DIV_PANEL_ROW
        });

        const titleEl = row.createEl('td', {
            cls: CSS_CLASSES.FENCED_DIV_PANEL_TITLE
        });
        titleEl.textContent = item.title;

        const labelEl = row.createEl('td', {
            cls: CSS_CLASSES.FENCED_DIV_PANEL_LABEL
        });
        this.renderLabel(labelEl, item);

        const contentEl = row.createEl('td', {
            cls: CSS_CLASSES.FENCED_DIV_PANEL_CONTENT
        });
        this.renderContentCell(contentEl, item);
        this.setupContentClickHandler(contentEl, item, activeView);
    }

    private renderLabel(labelEl: HTMLElement, item: FencedDivPanelItem): void {
        if (!item.label) {
            labelEl.textContent = '';
            return;
        }

        const referenceLabel = `@${item.label}`;
        labelEl.textContent = referenceLabel;
        setupLabelClickHandler(labelEl, referenceLabel, this.abortController?.signal);
    }

    private renderContentCell(contentEl: HTMLElement, item: FencedDivPanelItem): void {
        const truncatedContent = truncateContentWithRendering(item.content);
        renderContentWithMath(contentEl, truncatedContent, this.plugin.app, this.plugin, this.currentContext);

        if (truncatedContent !== item.content) {
            setupRenderedHoverPreview(
                contentEl,
                item.content,
                this.plugin.app,
                this.plugin,
                this.currentContext,
                CSS_CLASSES.HOVER_POPOVER_CONTENT,
                this.abortController?.signal
            );
        }
    }

    private setupContentClickHandler(
        element: HTMLElement,
        item: FencedDivPanelItem,
        activeView: MarkdownView
    ): void {
        const clickHandler = () => {
            try {
                if (!activeView?.editor) {
                    return;
                }

                const leaves = this.plugin.app.workspace.getLeavesOfType('markdown');
                const targetLeaf = leaves.find((leaf) => leaf.view === activeView);
                if (targetLeaf) {
                    this.plugin.app.workspace.setActiveLeaf(targetLeaf, { focus: true });
                }

                activeView.editor.setCursor(item.contentPosition);
                activeView.editor.scrollIntoView({
                    from: item.contentPosition,
                    to: item.contentPosition
                }, true);
                highlightLine(activeView, item.contentLineNumber);
            } catch (error) {
                handleError(error, 'Scroll to fenced div content');
            }
        };

        element.addEventListener('click', clickHandler, { signal: this.abortController?.signal });
    }
}
