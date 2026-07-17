import { EditorPosition, MarkdownView, Notice } from 'obsidian';

import { FootnotePanelItem } from '../../../shared/types/footnoteTypes';

import { CSS_CLASSES, ICONS, MESSAGES } from '../../../core/constants';

import { extractFootnotes } from '../../../shared/extractors/footnoteExtractor';
import { renderContentWithMath } from '../utils/viewInteractions';

import { BasePanelModule } from './BasePanelModule';
import { PanelItemSpec } from './PanelTypes';

export class FootnotePanelModule extends BasePanelModule {
    id = 'footnotes';
    displayName = MESSAGES.FOOTNOTE_VIEW_TITLE;
    icon = ICONS.FOOTNOTE_SVG;

    private footnotes: FootnotePanelItem[] = [];

    protected cleanupModuleData(): void {
        this.footnotes = [];
    }

    protected extractData(content: string): void {
        this.footnotes = extractFootnotes(content);
    }

    protected renderContent(activeView: MarkdownView): void {
        this.renderCollection({
            title: this.displayName,
            containerClassName: CSS_CLASSES.FOOTNOTE_PANEL_CONTAINER,
            emptyClassName: CSS_CLASSES.FOOTNOTE_PANEL_EMPTY,
            emptyMessage: MESSAGES.NO_FOOTNOTES,
            items: this.createItems(activeView)
        });
    }

    private createItems(activeView: MarkdownView): PanelItemSpec[] {
        const occurrences = new Map<string, number>();
        return this.footnotes.map(footnote => {
            const occurrence = occurrences.get(footnote.label) ?? 0;
            occurrences.set(footnote.label, occurrence + 1);
            return {
                key: `footnote:${footnote.label}:${occurrence}`,
                rowClassName: CSS_CLASSES.FOOTNOTE_PANEL_ROW,
                contentClassName: CSS_CLASSES.FOOTNOTE_PANEL_CONTENT,
                identityParts: [{
                    text: `[^${footnote.label}]`,
                    kind: 'token',
                    className: CSS_CLASSES.FOOTNOTE_PANEL_INDEX,
                    actionLabel: `Go to footnote ${footnote.label} reference`,
                    onActivate: () => this.navigateToReference(activeView, footnote)
                }],
                renderContent: element => renderContentWithMath(
                    element,
                    footnote.content,
                    this.plugin.app,
                    this.plugin,
                    this.currentContext
                ),
                navigationLabel: `Go to footnote ${footnote.label} definition`,
                onContentActivate: () => this.navigateToSource(
                    activeView,
                    footnote.definitionPosition,
                    footnote.definitionLine
                )
            };
        });
    }

    private navigateToReference(activeView: MarkdownView, footnote: FootnotePanelItem): void {
        if (!footnote.referencePosition) {
            new Notice(MESSAGES.FOOTNOTE_REFERENCE_NOT_FOUND);
            return;
        }
        const position: EditorPosition = {
            line: footnote.referencePosition.line,
            ch: footnote.referencePosition.ch + (footnote.referenceLength ?? 0)
        };
        this.navigateToSource(activeView, position, footnote.referencePosition.line);
    }
}
