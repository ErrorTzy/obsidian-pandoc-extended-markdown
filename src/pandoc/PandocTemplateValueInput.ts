import {
    getVariableSuggestions,
    renderTemplateValueDisplay
} from './PandocTemplateDisplay';
import type { PandocCommandRowActions } from './PandocCommandRows';
import type { ValueDisplay } from './PandocTemplateDisplay';
import type {
    ProfileDraft,
    ProfileOptionRow
} from './gui-core';

export function createTemplateValueInput(
    container: HTMLElement,
    row: ProfileOptionRow,
    draft: ProfileDraft,
    actions: PandocCommandRowActions,
    placeholder: string
): HTMLInputElement {
    const frame = container.createDiv({ cls: 'pem-pandoc-string-input-frame' });
    const input = createTextInput(frame, '', value => {
        row.value = value;
    }, placeholder);
    const display = frame.createDiv({ cls: 'pem-pandoc-string-display' });
    input.addClass('pem-pandoc-string-input');
    connectStringOverflowIndicator(frame, input);
    const suggestions = container.createDiv({ cls: 'pem-pandoc-key-suggestions pem-pandoc-variable-suggestions' });
    const showResolvedDisplay = () => {
        const rendered = renderValueForDisplay(row.value, draft, actions);
        frame.classList.toggle('has-muted-display-prefix', rendered.parts[0]?.muted === true);
        renderDisplayElement(display, rendered, row.value);
        input.value = display.textContent ?? '';
        frame.classList.add('is-display-mode');
        refreshStringOverflowIndicator(frame, input);
    };

    input.addEventListener('focus', () => {
        frame.classList.remove('is-display-mode');
        input.value = row.value;
        refreshStringOverflowIndicator(frame, input);
    });
    input.oninput = () => {
        row.value = input.value;
        refreshStringOverflowIndicator(frame, input);
        renderVariableSuggestions(suggestions, input, row, draft, actions);
        actions.updatePreview(draft);
    };
    input.addEventListener('blur', () => {
        window.setTimeout(() => suggestions.empty(), 120);
        showResolvedDisplay();
    });
    input.addEventListener('pem-pandoc-refresh-display', () => {
        if (document.activeElement === input) return;
        showResolvedDisplay();
    });
    display.onmousedown = event => event.preventDefault();
    display.onclick = () => input.focus();
    showResolvedDisplay();

    return input;
}

function connectStringOverflowIndicator(frame: HTMLElement, input: HTMLInputElement): void {
    refreshStringOverflowIndicator(frame, input);
    input.addEventListener('change', () => refreshStringOverflowIndicator(frame, input));
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => refreshStringOverflowIndicator(frame, input));
    observer.observe(input);
}

function refreshStringOverflowIndicator(frame: HTMLElement, input: HTMLInputElement): void {
    window.requestAnimationFrame(() => {
        const isOverflowing = input.value.length > 0 && input.scrollWidth > input.clientWidth + 1;
        frame.classList.toggle('is-overflowing', isOverflowing);
        if (isOverflowing) {
            frame.setAttribute('data-overflow-side', 'left');
            input.scrollLeft = input.scrollWidth;
        } else {
            frame.removeAttribute('data-overflow-side');
            input.scrollLeft = 0;
        }
    });
}

function renderValueForDisplay(
    value: string,
    draft: ProfileDraft,
    actions: PandocCommandRowActions
): ValueDisplay {
    return renderTemplateValueDisplay(
        value,
        actions.getVariables(draft),
        actions.getDisplayVariables?.(draft) ?? actions.getVariables(draft)
    );
}

function renderDisplayElement(
    container: HTMLElement,
    display: ValueDisplay,
    template: string
): void {
    container.empty();
    container.setAttribute('title', template);
    const content = container.createDiv({ cls: 'pem-pandoc-string-display-content' });
    for (const part of display.parts) {
        const span = content.createEl('span', { text: part.text });
        if (part.muted) span.addClass('pem-pandoc-string-display-muted');
    }
}

function renderVariableSuggestions(
    container: HTMLElement,
    input: HTMLInputElement,
    row: ProfileOptionRow,
    draft: ProfileDraft,
    actions: PandocCommandRowActions
): void {
    const trigger = getVariableTrigger(input.value, input.selectionStart ?? input.value.length);
    container.empty();
    if (!trigger) return;

    for (const suggestion of getVariableSuggestions(trigger.query, actions.getVariables(draft))) {
        const button = container.createEl('button', { cls: 'pem-pandoc-variable-suggestion' });
        button.createEl('span', {
            cls: 'pem-pandoc-variable-suggestion-name',
            text: `\${${suggestion.name}}`
        });
        button.createEl('span', {
            cls: 'pem-pandoc-variable-suggestion-value',
            text: suggestion.value,
            attr: { title: suggestion.value }
        });
        button.onmousedown = event => event.preventDefault();
        button.onclick = () => {
            insertVariable(input, row, trigger, suggestion.name);
            actions.updatePreview(draft);
            container.empty();
        };
    }
}

function getVariableTrigger(value: string, cursor: number): { start: number; query: string } | undefined {
    const beforeCursor = value.slice(0, cursor);
    const match = beforeCursor.match(/\$[{]?([A-Za-z_][A-Za-z0-9_]*)?$/);
    if (!match) return undefined;

    return {
        start: match.index ?? cursor,
        query: match[1] ?? ''
    };
}

function insertVariable(
    input: HTMLInputElement,
    row: ProfileOptionRow,
    trigger: { start: number },
    name: string
): void {
    const cursor = input.selectionStart ?? input.value.length;
    const nextValue = `${input.value.slice(0, trigger.start)}\${${name}}${input.value.slice(cursor)}`;
    input.value = nextValue;
    row.value = nextValue;
    const nextCursor = trigger.start + name.length + 3;
    input.setSelectionRange(nextCursor, nextCursor);
    input.focus();
}

function createTextInput(
    container: HTMLElement,
    value: string,
    onInput: (value: string) => void,
    placeholder: string
): HTMLInputElement {
    const input = container.createEl('input', { type: 'text', attr: { placeholder } });
    input.value = value;
    input.oninput = () => onInput(input.value);
    return input;
}
