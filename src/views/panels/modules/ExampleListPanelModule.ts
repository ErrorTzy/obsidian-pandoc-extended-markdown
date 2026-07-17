import { MarkdownView } from 'obsidian';

import { ExampleListItem, extractExampleLists } from '../../../shared/extractors/exampleListExtractor';

import { CSS_CLASSES, ICONS, MESSAGES } from '../../../core/constants';

import { extractCustomLabels } from '../../../shared/extractors/customLabelExtractor';
import { isCustomLabelListsEnabled } from '../../../shared/types/settingsTypes';
import { renderContentWithMath } from '../utils/viewInteractions';

import { BasePanelModule } from './BasePanelModule';
import { PanelItemSpec } from './PanelTypes';

export class ExampleListPanelModule extends BasePanelModule {
    id = 'example-lists';
    displayName = 'Example Lists';
    icon = ICONS.EXAMPLE_LIST_SVG;

    private exampleItems: ExampleListItem[] = [];

    protected cleanupModuleData(): void {
        this.exampleItems = [];
    }

    protected extractData(content: string): void {
        this.exampleItems = extractExampleLists(content);
    }

    protected buildRenderingContext(content: string): void {
        super.buildRenderingContext(content);
        const exampleLabels = new Map<string, number>();
        this.exampleItems.forEach(item => {
            const label = item.rawLabel.substring(1);
            if (label) exampleLabels.set(label, item.renderedNumber);
        });

        const rawToProcessed = new Map<string, string>();
        if (isCustomLabelListsEnabled(this.plugin.settings)) {
            extractCustomLabels(content, true).forEach(label => {
                const match = label.rawLabel.match(/\{::([^}]+)\}/);
                if (match) rawToProcessed.set(match[1], label.label);
            });
        }
        this.currentContext = { ...this.currentContext, exampleLabels, rawToProcessed };
    }

    protected renderContent(activeView: MarkdownView): void {
        this.renderCollection({
            title: this.displayName,
            containerClassName: CSS_CLASSES.EXAMPLE_LIST_VIEW_CONTAINER,
            emptyClassName: CSS_CLASSES.EXAMPLE_LIST_VIEW_EMPTY,
            emptyMessage: MESSAGES.NO_EXAMPLE_LISTS,
            items: this.createItems(activeView)
        });
    }

    protected showNoFileMessage(): void {
        if (!this.containerEl) return;
        this.containerEl.createEl('div', {
            text: MESSAGES.NO_ACTIVE_FILE,
            cls: CSS_CLASSES.EXAMPLE_LIST_VIEW_EMPTY
        });
        this.exampleItems = [];
    }

    private createItems(activeView: MarkdownView): PanelItemSpec[] {
        const occurrences = new Map<string, number>();
        return this.exampleItems.map(item => {
            const identity = `${item.renderedNumber}:${item.rawLabel}`;
            const occurrence = occurrences.get(identity) ?? 0;
            occurrences.set(identity, occurrence + 1);
            const syntax = item.rawLabel === '@' ? '(@)' : `(@${item.rawLabel.substring(1)})`;
            return {
                key: `example:${identity}:${occurrence}`,
                rowClassName: CSS_CLASSES.EXAMPLE_LIST_VIEW_ROW,
                contentClassName: CSS_CLASSES.EXAMPLE_LIST_VIEW_CONTENT,
                identityParts: [
                    {
                        text: String(item.renderedNumber),
                        kind: 'token',
                        className: CSS_CLASSES.EXAMPLE_LIST_VIEW_NUMBER
                    },
                    {
                        text: item.rawLabel,
                        kind: 'token',
                        className: CSS_CLASSES.EXAMPLE_LIST_VIEW_LABEL,
                        actionLabel: `Copy example label ${syntax}`,
                        onActivate: () => this.copyText(syntax)
                    }
                ],
                renderContent: element => renderContentWithMath(
                    element,
                    item.content,
                    this.plugin.app,
                    this.plugin,
                    this.currentContext
                ),
                navigationLabel: `Go to example ${item.renderedNumber} in source`,
                onContentActivate: () => this.navigateToSource(activeView, item.position, item.lineNumber)
            };
        });
    }
}
