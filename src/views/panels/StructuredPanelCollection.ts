import {
    PanelCollectionOptions,
    PanelIdentityPart,
    PanelItemSpec
} from './modules/PanelTypes';

export type { PanelCollectionOptions, PanelIdentityPart, PanelItemSpec } from './modules/PanelTypes';

interface RenderedItem {
    spec: PanelItemSpec;
    article: HTMLElement;
    preview: HTMLElement;
    toggle: HTMLButtonElement;
    overflow: boolean;
}

let collectionId = 0;

/** Renders and controls one accessible, responsive panel item collection. */
export class StructuredPanelCollection {
    private readonly items: RenderedItem[] = [];
    private observer: ResizeObserver | null = null;
    private bulkActions: HTMLElement | null = null;
    private expandAllButton: HTMLButtonElement | null = null;
    private collapseAllButton: HTMLButtonElement | null = null;
    private readonly id = ++collectionId;

    constructor(
        private readonly host: HTMLElement,
        private readonly options: PanelCollectionOptions,
        private readonly abortSignal: AbortSignal
    ) {}

    render(): void {
        this.pruneExpansionState();

        const section = this.createElement('section', 'pem-panel-collection');
        if (this.options.containerClassName) {
            section.classList.add(this.options.containerClassName);
        }
        this.host.append(section);

        const headingId = `pem-panel-heading-${this.id}`;
        section.setAttribute('aria-labelledby', headingId);
        this.renderHeader(section, headingId);

        if (this.options.items.length === 0) {
            this.renderEmptyState(section);
            return;
        }

        const list = this.createElement('ol', 'pem-panel-item-list');
        section.append(list);
        const rendering = this.options.items.map((item, index) => this.renderItem(list, item, index));

        void Promise.allSettled(rendering).then(() => {
            if (!this.abortSignal.aborted) {
                this.startOverflowTracking(section);
            }
        });
    }

    private renderHeader(section: HTMLElement, headingId: string): void {
        const header = this.createElement('header', 'pem-panel-collection-header');
        const heading = this.createElement('h2', 'pem-panel-collection-heading');
        heading.id = headingId;
        heading.textContent = `${this.options.title} · ${this.options.items.length}`;

        this.bulkActions = this.createElement('div', 'pem-panel-bulk-actions');
        this.bulkActions.hidden = true;
        this.expandAllButton = this.createButton('Expand all', 'pem-panel-expand-all', () => {
            this.items.filter(item => item.overflow).forEach(item => this.options.expandedKeys.add(item.spec.key));
            this.updateExpandedState();
        });
        this.collapseAllButton = this.createButton('Collapse all', 'pem-panel-collapse-all', () => {
            this.items.filter(item => item.overflow).forEach(item => this.options.expandedKeys.delete(item.spec.key));
            this.updateExpandedState();
        });
        this.bulkActions.append(this.expandAllButton, this.collapseAllButton);
        header.append(heading, this.bulkActions);
        section.append(header);
    }

    private renderEmptyState(section: HTMLElement): void {
        if (!this.options.emptyMessage) {
            return;
        }
        const empty = this.createElement('div', `pem-panel-empty ${this.options.emptyClassName ?? ''}`);
        empty.textContent = this.options.emptyMessage;
        section.append(empty);
    }

    private async renderItem(list: HTMLElement, spec: PanelItemSpec, index: number): Promise<void> {
        const listItem = this.createElement('li', 'pem-panel-list-item');
        const article = this.createElement('article', 'pem-panel-item');
        if (spec.rowClassName) {
            article.classList.add(spec.rowClassName);
        }

        const bodyId = `pem-panel-item-${this.id}-${index}`;
        article.dataset.panelItemKey = spec.key;
        const identity = this.createElement('div', 'pem-panel-item-identity');
        const identityRendering = spec.identityParts.map(part => this.renderIdentityPart(identity, part));
        const body = this.createElement('div', 'pem-panel-item-body');
        const preview = this.createElement('div', 'pem-panel-item-preview is-collapsed');
        preview.id = bodyId;
        if (spec.contentClassName) {
            preview.classList.add(spec.contentClassName);
        }
        this.setupContentNavigation(preview, spec);

        const toggle = this.createButton('Show more⌄', 'pem-panel-item-toggle', () => {
            if (this.options.expandedKeys.has(spec.key)) {
                this.options.expandedKeys.delete(spec.key);
            } else {
                this.options.expandedKeys.add(spec.key);
            }
            this.updateExpandedState();
        });
        toggle.setAttribute('aria-controls', bodyId);
        toggle.setAttribute('aria-expanded', 'false');
        toggle.hidden = true;

        body.append(preview, toggle);
        article.append(identity, body);
        listItem.append(article);
        list.append(listItem);

        const renderedItem = { spec, article, preview, toggle, overflow: false };
        this.items.push(renderedItem);
        this.applyExpandedState(renderedItem);
        await Promise.all([spec.renderContent(preview), ...identityRendering]);
    }

    private async renderIdentityPart(container: HTMLElement, part: PanelIdentityPart): Promise<void> {
        const kind = part.kind ?? 'text';
        const className = `pem-panel-identity-part pem-panel-identity-${kind}`;
        const element = part.onActivate
            ? this.createButton(part.text, className, part.onActivate)
            : this.createElement('span', className);

        if (!part.onActivate) {
            element.textContent = part.text;
        } else if (part.actionLabel) {
            element.setAttribute('aria-label', part.actionLabel);
        }
        if (part.className) {
            element.classList.add(part.className);
        }
        container.append(element);
        if (part.render) {
            element.textContent = '';
            await part.render(element);
        }
    }

    private setupContentNavigation(preview: HTMLElement, spec: PanelItemSpec): void {
        if (!spec.onContentActivate) {
            return;
        }
        preview.classList.add('pem-panel-item-navigable');
        preview.tabIndex = 0;
        preview.setAttribute('role', 'link');
        preview.setAttribute('aria-label', spec.navigationLabel ?? 'Go to source');
        preview.addEventListener('click', spec.onContentActivate, { signal: this.abortSignal });
        preview.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                spec.onContentActivate?.();
            }
        }, { signal: this.abortSignal });
    }

    private startOverflowTracking(section: HTMLElement): void {
        if (typeof ResizeObserver === 'undefined') {
            this.items.forEach(item => item.overflow = true);
            this.updateOverflowControls();
            return;
        }

        this.observer = new ResizeObserver(() => this.measureOverflow());
        this.observer.observe(section);
        this.abortSignal.addEventListener('abort', () => this.disconnectObserver(), { once: true });
        this.measureOverflow();
    }

    private measureOverflow(): void {
        this.items.forEach(item => {
            const expanded = this.options.expandedKeys.has(item.spec.key);
            if (expanded) {
                item.preview.classList.add('is-collapsed');
            }
            item.overflow = item.preview.scrollHeight > item.preview.clientHeight + 1;
            if (expanded) {
                item.preview.classList.remove('is-collapsed');
            }
        });
        this.updateOverflowControls();
    }

    private updateOverflowControls(): void {
        this.items.forEach(item => {
            item.preview.classList.toggle('is-overflowing', item.overflow);
            item.toggle.hidden = !item.overflow;
        });
        if (this.bulkActions) {
            this.bulkActions.hidden = !this.items.some(item => item.overflow);
        }
        this.updateExpandedState();
    }

    private updateExpandedState(): void {
        this.items.forEach(item => this.applyExpandedState(item));
        const overflowing = this.items.filter(item => item.overflow);
        const expandedCount = overflowing.filter(item => this.options.expandedKeys.has(item.spec.key)).length;
        if (this.expandAllButton) {
            this.expandAllButton.disabled = overflowing.length === 0 || expandedCount === overflowing.length;
        }
        if (this.collapseAllButton) {
            this.collapseAllButton.disabled = expandedCount === 0;
        }
    }

    private applyExpandedState(item: RenderedItem): void {
        const expanded = this.options.expandedKeys.has(item.spec.key);
        item.article.classList.toggle('is-expanded', expanded);
        item.preview.classList.toggle('is-collapsed', !expanded);
        item.toggle.setAttribute('aria-expanded', String(expanded));
        item.toggle.textContent = expanded ? 'Show less⌃' : 'Show more⌄';
        item.toggle.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} item`);
    }

    private pruneExpansionState(): void {
        const currentKeys = new Set(this.options.items.map(item => item.key));
        for (const key of this.options.expandedKeys) {
            if (!currentKeys.has(key)) {
                this.options.expandedKeys.delete(key);
            }
        }
    }

    private disconnectObserver(): void {
        this.observer?.disconnect();
        this.observer = null;
    }

    private createButton(text: string, className: string, action: () => void): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `pem-panel-action ${className}`;
        button.textContent = text;
        button.addEventListener('click', event => {
            event.stopPropagation();
            action();
        }, { signal: this.abortSignal });
        return button;
    }

    private createElement<K extends keyof HTMLElementTagNameMap>(
        tag: K,
        className: string
    ): HTMLElementTagNameMap[K] {
        const element = document.createElement(tag);
        element.className = className.trim();
        return element;
    }
}
