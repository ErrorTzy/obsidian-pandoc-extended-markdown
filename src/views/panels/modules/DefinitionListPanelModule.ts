import { MarkdownView } from 'obsidian';

import {
    DefinitionListItem,
    extractDefinitionLists
} from '../../../shared/extractors/definitionListExtractor';

import { CSS_CLASSES, ICONS, MESSAGES } from '../../../core/constants';

import { renderContentWithMath } from '../utils/viewInteractions';

import { BasePanelModule } from './BasePanelModule';
import { PanelItemSpec } from './PanelTypes';

export class DefinitionListPanelModule extends BasePanelModule {
    id = 'definition-lists';
    displayName = 'Definition Lists';
    icon = ICONS.DEFINITION_LIST_SVG;

    private definitionItems: DefinitionListItem[] = [];

    protected cleanupModuleData(): void {
        this.definitionItems = [];
    }

    protected extractData(content: string): void {
        this.definitionItems = extractDefinitionLists(content);
    }

    protected renderContent(activeView: MarkdownView): void {
        this.renderCollection({
            title: this.displayName,
            containerClassName: CSS_CLASSES.DEFINITION_LIST_VIEW_CONTAINER,
            emptyClassName: CSS_CLASSES.DEFINITION_LIST_VIEW_EMPTY,
            emptyMessage: MESSAGES.NO_DEFINITION_LISTS,
            items: this.createItems(activeView)
        });
    }

    protected showNoFileMessage(): void {
        if (!this.containerEl) return;
        this.containerEl.createEl('div', {
            text: MESSAGES.NO_ACTIVE_FILE,
            cls: CSS_CLASSES.DEFINITION_LIST_VIEW_EMPTY
        });
        this.definitionItems = [];
    }

    private createItems(activeView: MarkdownView): PanelItemSpec[] {
        const occurrences = new Map<string, number>();
        return this.definitionItems.map(item => {
            const occurrence = occurrences.get(item.term) ?? 0;
            occurrences.set(item.term, occurrence + 1);
            return {
                key: `definition:${item.term}:${occurrence}`,
                rowClassName: CSS_CLASSES.DEFINITION_LIST_VIEW_ROW,
                contentClassName: CSS_CLASSES.DEFINITION_LIST_VIEW_DEFINITIONS,
                identityParts: [{
                    text: item.term,
                    kind: 'title',
                    className: CSS_CLASSES.DEFINITION_LIST_VIEW_TERM,
                    render: element => renderContentWithMath(
                        element,
                        item.term,
                        this.plugin.app,
                        this.plugin,
                        this.currentContext
                    )
                }],
                renderContent: element => this.renderDefinitions(element, item.definitions),
                navigationLabel: `Go to definition term ${item.term} in source`,
                onContentActivate: () => this.navigateToSource(activeView, item.position, item.lineNumber)
            };
        });
    }

    private renderDefinitions(element: HTMLElement, definitions: string[]): Promise<void> {
        if (definitions.length === 1) {
            return renderContentWithMath(
                element,
                definitions[0],
                this.plugin.app,
                this.plugin,
                this.currentContext
            );
        }

        const list = document.createElement('ul');
        element.append(list);
        const rendering = definitions.map(definition => {
            const item = document.createElement('li');
            list.append(item);
            return renderContentWithMath(
                item,
                definition,
                this.plugin.app,
                this.plugin,
                this.currentContext
            );
        });
        return Promise.all(rendering).then(() => undefined);
    }
}
