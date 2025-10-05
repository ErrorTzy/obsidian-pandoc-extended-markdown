import { MarkdownView, Notice } from 'obsidian';

import { FootnotePanelItem } from '../../../shared/types/footnoteTypes';
import { CSS_CLASSES, ICONS, MESSAGES } from '../../../core/constants';
import { extractFootnotes } from '../../../shared/extractors/footnoteExtractor';
import { handleError } from '../../../shared/utils/errorHandler';
import { highlightLine } from '../../editor/highlightUtils';
import { renderContentWithMath } from '../utils/viewInteractions';
import { PandocExtendedMarkdownPlugin } from '../../../core/main';
import { BasePanelModule } from './BasePanelModule';

type EditorPosition = { line: number; ch: number };

export class FootnotePanelModule extends BasePanelModule {
    id = 'footnotes';
    displayName = MESSAGES.FOOTNOTE_VIEW_TITLE;
    icon = ICONS.FOOTNOTE_SVG;

    private footnotes: FootnotePanelItem[] = [];

    constructor(plugin: PandocExtendedMarkdownPlugin) {
        super(plugin);
    }

    protected cleanupModuleData(): void {
        this.footnotes = [];
    }

    protected extractData(content: string): void {
        this.footnotes = extractFootnotes(content);
    }

    protected renderContent(activeView: MarkdownView): void {
        if (!this.containerEl) return;

        if (this.footnotes.length === 0) {
            this.containerEl.createEl('div', {
                text: MESSAGES.NO_FOOTNOTES,
                cls: CSS_CLASSES.FOOTNOTE_PANEL_EMPTY
            });
            return;
        }

        this.renderFootnoteTable(activeView);
    }

    private renderFootnoteTable(activeView: MarkdownView): void {
        if (!this.containerEl) return;

        const table = this.containerEl.createEl('table', {
            cls: CSS_CLASSES.FOOTNOTE_PANEL_CONTAINER
        });
        const tbody = table.createEl('tbody');

        for (const footnote of this.footnotes) {
            this.renderFootnoteRow(tbody, footnote, activeView);
        }
    }

    private renderFootnoteRow(tbody: HTMLElement, footnote: FootnotePanelItem, activeView: MarkdownView): void {
        const row = tbody.createEl('tr', {
            cls: CSS_CLASSES.FOOTNOTE_PANEL_ROW
        });

        const indexCell = row.createEl('td', {
            cls: CSS_CLASSES.FOOTNOTE_PANEL_INDEX,
            text: footnote.label
        });

        const contentCell = row.createEl('td', {
            cls: CSS_CLASSES.FOOTNOTE_PANEL_CONTENT
        });

        renderContentWithMath(
            contentCell,
            footnote.content,
            this.plugin.app,
            this.plugin,
            this.currentContext
        );

        this.setupReferenceClick(indexCell, footnote, activeView);
        this.setupDefinitionClick(contentCell, footnote, activeView);
    }

    private setupReferenceClick(element: HTMLElement, footnote: FootnotePanelItem, activeView: MarkdownView): void {
        element.addEventListener('click', () => {
            try {
                if (!footnote.referencePosition) {
                    new Notice(MESSAGES.FOOTNOTE_REFERENCE_NOT_FOUND);
                    return;
                }

                this.focusEditor(activeView);
                const offset = footnote.referenceLength ?? 0;
                const targetPosition: EditorPosition = {
                    line: footnote.referencePosition.line,
                    ch: footnote.referencePosition.ch + offset
                };
                this.scrollToPosition(activeView, targetPosition, footnote.referencePosition.line);
            } catch (error) {
                handleError(error, 'Scroll to footnote reference');
            }
        }, { signal: this.abortController?.signal });
    }

    private setupDefinitionClick(element: HTMLElement, footnote: FootnotePanelItem, activeView: MarkdownView): void {
        element.addEventListener('click', () => {
            try {
                this.focusEditor(activeView);
                this.scrollToPosition(activeView, footnote.definitionPosition, footnote.definitionLine);
            } catch (error) {
                handleError(error, 'Scroll to footnote definition');
            }
        }, { signal: this.abortController?.signal });
    }

    private focusEditor(activeView: MarkdownView | null): void {
        if (!activeView) return;

        const leaves = this.plugin.app.workspace.getLeavesOfType('markdown');
        const targetLeaf = leaves.find((leaf: any) => leaf.view === activeView);
        if (targetLeaf) {
            this.plugin.app.workspace.setActiveLeaf(targetLeaf, { focus: true });
        }
    }

    private scrollToPosition(view: MarkdownView | null, position: EditorPosition | null, fallbackLine?: number): void {
        if (!view || !view.editor) {
            return;
        }

        const editor = view.editor;

        if (!position) {
            if (typeof fallbackLine === 'number') {
                highlightLine(view, fallbackLine);
            }
            return;
        }

        editor.setCursor(position);
        editor.scrollIntoView({ from: position, to: position }, true);
        highlightLine(view, position.line, position);
    }
}
