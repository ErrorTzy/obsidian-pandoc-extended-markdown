import { Text } from '@codemirror/state';
import { EditorSuggest } from 'obsidian';
import type { Editor, EditorPosition, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from 'obsidian';
import type { PandocExtendedMarkdownPlugin } from '../../core/main';
import type { FencedDivSuggestion } from '../../shared/types/fencedDivTypes';
import { CSS_CLASSES, TEXT_PROCESSING } from '../../core/constants';
import { scanFencedDivs } from '../../live-preview/scanners/fencedDivScanner';
import { isSyntaxFeatureEnabled } from '../../shared/types/settingsTypes';
import { withErrorBoundary } from '../../shared/utils/errorHandler';

const CITATION_QUERY_STOP = /[\s,;)\]}]/;
const NO_PREVIEW_TEXT = '(no content)';

type DivFactory = (options?: { cls?: string }) => HTMLElement;
type ObsidianDivParent = HTMLElement & {
    createDiv?: DivFactory;
};

export class FencedDivReferenceSuggest extends EditorSuggest<FencedDivSuggestion> {
    plugin: PandocExtendedMarkdownPlugin;

    constructor(plugin: PandocExtendedMarkdownPlugin) {
        super(plugin.app);
        this.plugin = plugin;
    }

    onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
        if (!isSyntaxFeatureEnabled(this.plugin.settings, 'enableFencedDivs')) {
            return null;
        }

        const line = editor.getLine(cursor.line).substring(0, cursor.ch);
        const startIndex = line.lastIndexOf('@');
        if (startIndex < 0 || line[startIndex - 1] === '(') {
            return null;
        }

        const query = line.substring(startIndex + 1);
        if (CITATION_QUERY_STOP.test(query)) {
            return null;
        }

        return {
            start: {
                ch: startIndex,
                line: cursor.line
            },
            end: cursor,
            query
        };
    }

    getSuggestions(context: EditorSuggestContext): FencedDivSuggestion[] {
        return withErrorBoundary(
            () => this.getSuggestionsInternal(context),
            [],
            'FencedDivReferenceSuggest.getSuggestions'
        );
    }

    private getSuggestionsInternal(context: EditorSuggestContext): FencedDivSuggestion[] {
        if (!isSyntaxFeatureEnabled(this.plugin.settings, 'enableFencedDivs')) {
            return [];
        }

        const query = context.query.toLowerCase();
        const doc = Text.of(context.editor.getValue().split('\n'));
        const labels = scanFencedDivs(doc, this.plugin.settings);
        const suggestions: FencedDivSuggestion[] = [];

        for (const reference of labels.values()) {
            const labelMatches = reference.label.toLowerCase().startsWith(query);
            const displayNameMatches = reference.displayName.toLowerCase().startsWith(query);
            if (query && !labelMatches && !displayNameMatches) {
                continue;
            }

            suggestions.push({
                label: reference.label,
                displayName: reference.displayName,
                previewText: this.createPreviewText(reference.content),
                lineNumber: reference.lineNumber
            });
        }

        return suggestions.sort((a, b) => a.label.localeCompare(b.label));
    }

    renderSuggestion(suggestion: FencedDivSuggestion, el: HTMLElement): void {
        withErrorBoundary(
            () => this.renderSuggestionInternal(suggestion, el),
            undefined,
            'FencedDivReferenceSuggest.renderSuggestion'
        );
    }

    private renderSuggestionInternal(suggestion: FencedDivSuggestion, el: HTMLElement): void {
        const container = this.createDiv(el, CSS_CLASSES.SUGGESTION_CONTENT);
        const title = this.createDiv(container, CSS_CLASSES.SUGGESTION_TITLE);
        title.textContent = `@${suggestion.label}`;

        const preview = this.createDiv(container, CSS_CLASSES.SUGGESTION_PREVIEW);
        preview.textContent = `${suggestion.displayName} - ${suggestion.previewText}`;
    }

    selectSuggestion(suggestion: FencedDivSuggestion, evt: MouseEvent | KeyboardEvent): void {
        if (!this.context) return;

        const { editor, start, end } = this.context;
        const replacement = `@${suggestion.label}`;
        editor.replaceRange(replacement, start, end);
        editor.setCursor({
            line: start.line,
            ch: start.ch + replacement.length
        });
    }

    private createPreviewText(content: string): string {
        if (!content) {
            return NO_PREVIEW_TEXT;
        }

        const normalized = content.replace(/\s+/g, ' ').trim();
        if (normalized.length <= TEXT_PROCESSING.PREVIEW_TRUNCATE_LENGTH) {
            return normalized;
        }

        return normalized.substring(0, TEXT_PROCESSING.PREVIEW_TRUNCATE_LENGTH) +
            TEXT_PROCESSING.PREVIEW_ELLIPSIS;
    }

    private createDiv(parent: HTMLElement, className: string): HTMLElement {
        const obsidianParent = parent as ObsidianDivParent;
        if (obsidianParent.createDiv) {
            return obsidianParent.createDiv({ cls: className });
        }

        const div = document.createElement('div');
        div.className = className;
        parent.appendChild(div);
        return div;
    }
}
