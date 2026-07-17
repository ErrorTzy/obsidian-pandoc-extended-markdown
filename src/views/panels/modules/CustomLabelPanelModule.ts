import { MarkdownView } from 'obsidian';

import { CustomLabel, extractCustomLabels } from '../../../shared/extractors/customLabelExtractor';

import { CSS_CLASSES, ICONS, MESSAGES } from '../../../core/constants';

import { isCustomLabelListsEnabled } from '../../../shared/types/settingsTypes';
import { renderContentWithMath } from '../utils/viewInteractions';

import { BasePanelModule } from './BasePanelModule';
import { PanelItemSpec } from './PanelTypes';

export class CustomLabelPanelModule extends BasePanelModule {
    id = 'custom-labels';
    displayName = 'Custom Labels';
    icon = ICONS.CUSTOM_LABEL_SVG;

    private labels: CustomLabel[] = [];

    protected cleanupModuleData(): void {
        this.labels = [];
    }

    protected extractData(content: string): void {
        this.labels = extractCustomLabels(content, isCustomLabelListsEnabled(this.plugin.settings));
    }

    protected buildRenderingContext(content: string): void {
        super.buildRenderingContext(content);
        const rawToProcessed = new Map<string, string>();
        this.labels.forEach(label => {
            const match = label.rawLabel.match(/\{::([^}]+)\}/);
            if (match) {
                rawToProcessed.set(match[1], label.label);
            }
        });
        this.currentContext = { ...this.currentContext, rawToProcessed };
    }

    protected renderContent(activeView: MarkdownView): void {
        this.renderCollection({
            title: this.displayName,
            containerClassName: CSS_CLASSES.CUSTOM_LABEL_VIEW_CONTAINER,
            emptyClassName: CSS_CLASSES.CUSTOM_LABEL_VIEW_EMPTY,
            emptyMessage: MESSAGES.NO_CUSTOM_LABELS,
            items: this.createItems(activeView)
        });
    }

    protected showNoFileMessage(): void {
        if (!this.containerEl) return;
        this.containerEl.createEl('div', {
            text: MESSAGES.NO_ACTIVE_FILE,
            cls: CSS_CLASSES.CUSTOM_LABEL_VIEW_EMPTY
        });
        this.labels = [];
    }

    getCustomLabels(): CustomLabel[] {
        return this.labels;
    }

    private createItems(activeView: MarkdownView): PanelItemSpec[] {
        const occurrences = new Map<string, number>();
        return this.labels.map(label => {
            const occurrence = occurrences.get(label.rawLabel) ?? 0;
            occurrences.set(label.rawLabel, occurrence + 1);
            return {
                key: `custom-label:${label.rawLabel}:${occurrence}`,
                rowClassName: CSS_CLASSES.CUSTOM_LABEL_VIEW_ROW,
                contentClassName: CSS_CLASSES.CUSTOM_LABEL_VIEW_CONTENT,
                identityParts: [{
                    text: label.label,
                    kind: 'token',
                    className: CSS_CLASSES.CUSTOM_LABEL_VIEW_LABEL,
                    actionLabel: `Copy custom label ${label.rawLabel}`,
                    onActivate: () => this.copyText(label.rawLabel)
                }],
                renderContent: element => renderContentWithMath(
                    element,
                    label.renderedContent || label.content,
                    this.plugin.app,
                    this.plugin,
                    this.currentContext
                ),
                navigationLabel: `Go to custom label ${label.label} in source`,
                onContentActivate: () => this.navigateToSource(activeView, label.position, label.lineNumber)
            };
        });
    }
}
