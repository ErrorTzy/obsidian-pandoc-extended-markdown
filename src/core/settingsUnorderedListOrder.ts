import { Setting } from 'obsidian';

import {
    DEFAULT_SETTINGS,
    PandocExtendedMarkdownSettings
} from '../shared/types/settingsTypes';
import {
    UNORDERED_LIST_MARKERS,
    UnorderedListMarker,
    normalizeUnorderedListMarkerOrder
} from '../shared/types/unorderedListTypes';

import { PANEL_SETTINGS } from './constants';

interface OrderButtons {
    moveUp: HTMLButtonElement;
    moveDown: HTMLButtonElement;
    moveTop: HTMLButtonElement;
    moveBottom: HTMLButtonElement;
    reset: HTMLButtonElement;
}

export interface UnorderedListOrderControlConfig {
    containerEl: HTMLElement;
    settings: PandocExtendedMarkdownSettings;
    saveSettings: () => Promise<void>;
    selectedMarkerId?: UnorderedListMarker;
    setSelectedMarkerId: (markerId: UnorderedListMarker | undefined) => void;
}

export class UnorderedListOrderControl {
    private selectedMarkerId?: UnorderedListMarker;

    constructor(private config: UnorderedListOrderControlConfig) {}

    render(): void {
        this.selectedMarkerId = this.config.selectedMarkerId;

        new Setting(this.config.containerEl)
            .setName(PANEL_SETTINGS.UI_TEXT.UNORDERED_LIST_ORDER_HEADING)
            .setHeading();

        const orderSetting = new Setting(this.config.containerEl)
            .setDesc(PANEL_SETTINGS.UI_TEXT.UNORDERED_LIST_ORDER_DESC);
        orderSetting.infoEl?.addClass('pem-panel-order-info');

        const flexContainer = orderSetting.controlEl.createDiv({
            cls: 'pem-panel-order-container pem-unordered-list-order-container'
        });
        const listEl = flexContainer.createDiv({
            cls: 'pem-panel-order-list pem-unordered-list-order-list'
        });
        listEl.setAttribute('role', 'listbox');
        listEl.tabIndex = 0;

        this.syncOrder();
        const buttons = this.createButtons(flexContainer);

        this.renderList(listEl, buttons);
        this.updateButtonStates(buttons);
        this.setupHandlers(listEl, buttons);
    }

    private syncOrder(): void {
        this.config.settings.unorderedListMarkerOrder = normalizeUnorderedListMarkerOrder(
            this.config.settings.unorderedListMarkerOrder
        );
    }

    private renderList(listEl: HTMLElement, buttons: OrderButtons): void {
        for (const markerId of this.config.settings.unorderedListMarkerOrder) {
            const marker = UNORDERED_LIST_MARKERS.find(item => item.id === markerId);
            if (!marker) continue;

            const itemEl = listEl.createDiv({
                cls: 'pem-panel-order-item pem-unordered-list-order-item'
            });
            itemEl.setAttribute('role', 'option');
            itemEl.dataset.id = markerId;
            itemEl.tabIndex = 0;

            itemEl.createSpan({
                text: marker.marker,
                cls: 'pem-unordered-list-order-marker'
            });
            itemEl.createSpan({
                text: marker.displayName,
                cls: 'pem-unordered-list-order-label'
            });

            if (markerId === this.selectedMarkerId) {
                itemEl.classList.add('is-selected');
                itemEl.setAttribute('aria-selected', 'true');
            } else {
                itemEl.setAttribute('aria-selected', 'false');
            }

            itemEl.addEventListener('click', () => {
                this.selectMarker(markerId, listEl, buttons);
            });
            itemEl.addEventListener('keydown', (evt) => {
                if (evt.key === 'Enter' || evt.key === ' ') {
                    evt.preventDefault();
                    this.selectMarker(markerId, listEl, buttons);
                }
            });
        }
    }

    private selectMarker(
        markerId: UnorderedListMarker,
        listEl: HTMLElement,
        buttons: OrderButtons
    ): void {
        this.selectedMarkerId = markerId;
        this.config.setSelectedMarkerId(markerId);

        for (const item of Array.from(listEl.children)) {
            const itemEl = item as HTMLElement;
            const isSelected = itemEl.dataset.id === markerId;
            itemEl.classList.toggle('is-selected', isSelected);
            itemEl.setAttribute('aria-selected', String(isSelected));
        }

        this.updateButtonStates(buttons);
    }

    private createButtons(container: HTMLElement): OrderButtons {
        const btnWrap = container.createDiv({ cls: 'pem-panel-order-buttons' });

        return {
            moveUp: btnWrap.createEl('button', {
                text: PANEL_SETTINGS.UI_TEXT.BTN_MOVE_UP,
                cls: 'pem-panel-order-button'
            }),
            moveDown: btnWrap.createEl('button', {
                text: PANEL_SETTINGS.UI_TEXT.BTN_MOVE_DOWN,
                cls: 'pem-panel-order-button'
            }),
            moveTop: btnWrap.createEl('button', {
                text: PANEL_SETTINGS.UI_TEXT.BTN_MOVE_TOP,
                cls: 'pem-panel-order-button'
            }),
            moveBottom: btnWrap.createEl('button', {
                text: PANEL_SETTINGS.UI_TEXT.BTN_MOVE_BOTTOM,
                cls: 'pem-panel-order-button'
            }),
            reset: btnWrap.createEl('button', {
                text: PANEL_SETTINGS.UI_TEXT.BTN_RESTORE_DEFAULT,
                cls: 'pem-panel-order-button'
            })
        };
    }

    private updateButtonStates(buttons: OrderButtons): void {
        const idx = this.getSelectedIndex();
        const lastIndex = this.config.settings.unorderedListMarkerOrder.length - 1;

        buttons.moveUp.disabled = idx <= 0;
        buttons.moveDown.disabled = idx < 0 || idx >= lastIndex;
        buttons.moveTop.disabled = idx <= 0;
        buttons.moveBottom.disabled = idx < 0 || idx >= lastIndex;
    }

    private setupHandlers(listEl: HTMLElement, buttons: OrderButtons): void {
        buttons.moveUp.addEventListener('click', () => void this.moveSelected(-1, listEl, buttons));
        buttons.moveDown.addEventListener('click', () => void this.moveSelected(1, listEl, buttons));
        buttons.moveTop.addEventListener('click', () => void this.moveToEdge('top', listEl, buttons));
        buttons.moveBottom.addEventListener('click', () => void this.moveToEdge('bottom', listEl, buttons));
        buttons.reset.addEventListener('click', () => void this.resetOrder(listEl, buttons));

        listEl.addEventListener('keydown', (evt) => {
            if (!this.selectedMarkerId) return;
            if (evt.key === 'ArrowUp') {
                evt.preventDefault();
                buttons.moveUp.click();
            } else if (evt.key === 'ArrowDown') {
                evt.preventDefault();
                buttons.moveDown.click();
            }
        });
    }

    private async moveSelected(
        offset: -1 | 1,
        listEl: HTMLElement,
        buttons: OrderButtons
    ): Promise<void> {
        const index = this.getSelectedIndex();
        const nextIndex = index + offset;
        const order = this.config.settings.unorderedListMarkerOrder;

        if (index < 0 || nextIndex < 0 || nextIndex >= order.length) {
            return;
        }

        [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
        await this.config.saveSettings();
        this.rerenderList(listEl, buttons);
    }

    private async moveToEdge(
        edge: 'top' | 'bottom',
        listEl: HTMLElement,
        buttons: OrderButtons
    ): Promise<void> {
        const index = this.getSelectedIndex();
        const order = this.config.settings.unorderedListMarkerOrder;

        if (index < 0) return;

        const [markerId] = order.splice(index, 1);
        if (edge === 'top') {
            order.unshift(markerId);
        } else {
            order.push(markerId);
        }

        await this.config.saveSettings();
        this.rerenderList(listEl, buttons);
    }

    private async resetOrder(
        listEl: HTMLElement,
        buttons: OrderButtons
    ): Promise<void> {
        this.config.settings.unorderedListMarkerOrder = [
            ...DEFAULT_SETTINGS.unorderedListMarkerOrder
        ];
        this.selectedMarkerId = undefined;
        this.config.setSelectedMarkerId(undefined);
        await this.config.saveSettings();
        this.rerenderList(listEl, buttons);
    }

    private rerenderList(listEl: HTMLElement, buttons: OrderButtons): void {
        listEl.empty();
        this.renderList(listEl, buttons);
        this.updateButtonStates(buttons);
    }

    private getSelectedIndex(): number {
        if (!this.selectedMarkerId) return -1;
        return this.config.settings.unorderedListMarkerOrder.indexOf(this.selectedMarkerId);
    }
}
