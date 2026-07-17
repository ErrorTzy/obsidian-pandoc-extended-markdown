import { MarkdownView } from 'obsidian';

import { FencedDivPanelItem, extractFencedDivs } from '../../../shared/extractors/fencedDivExtractor';

import { CSS_CLASSES, ICONS, MESSAGES } from '../../../core/constants';

import { renderContentWithMath } from '../utils/viewInteractions';

import { BasePanelModule } from './BasePanelModule';
import { PanelItemSpec } from './PanelTypes';

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
        this.renderCollection({
            title: this.displayName,
            containerClassName: CSS_CLASSES.FENCED_DIV_PANEL_CONTAINER,
            emptyClassName: CSS_CLASSES.FENCED_DIV_PANEL_EMPTY,
            emptyMessage: MESSAGES.NO_FENCED_DIVS,
            items: this.createItems(activeView)
        });
    }

    protected showNoFileMessage(): void {
        if (!this.containerEl) return;
        this.containerEl.createEl('div', {
            text: MESSAGES.NO_ACTIVE_FILE,
            cls: CSS_CLASSES.FENCED_DIV_PANEL_EMPTY
        });
        this.fencedDivItems = [];
    }

    private createItems(activeView: MarkdownView): PanelItemSpec[] {
        const occurrences = new Map<string, number>();
        return this.fencedDivItems.map(item => {
            const identity = item.label || `${item.blockTitleText}:${item.classes.join('.')}`;
            const occurrence = occurrences.get(identity) ?? 0;
            occurrences.set(identity, occurrence + 1);
            return {
                key: `fenced-div:${identity}:${occurrence}`,
                rowClassName: CSS_CLASSES.FENCED_DIV_PANEL_ROW,
                contentClassName: CSS_CLASSES.FENCED_DIV_PANEL_CONTENT,
                identityParts: this.createIdentityParts(item),
                renderContent: element => renderContentWithMath(
                    element,
                    item.content,
                    this.plugin.app,
                    this.plugin,
                    this.currentContext
                ),
                navigationLabel: `Go to ${item.blockTitleText || 'fenced div'} content in source`,
                onContentActivate: () => this.navigateToSource(
                    activeView,
                    item.contentPosition,
                    item.contentLineNumber
                )
            };
        });
    }

    private createIdentityParts(item: FencedDivPanelItem): PanelItemSpec['identityParts'] {
        const parts: PanelItemSpec['identityParts'] = [{
            text: item.blockTitleText,
            kind: 'title',
            className: CSS_CLASSES.FENCED_DIV_PANEL_TITLE
        }];
        if (item.label) {
            const reference = `@${item.label}`;
            parts.push({
                text: reference,
                kind: 'token',
                className: CSS_CLASSES.FENCED_DIV_PANEL_LABEL,
                actionLabel: `Copy fenced div reference ${reference}`,
                onActivate: () => this.copyText(reference)
            });
        }
        return parts;
    }
}
