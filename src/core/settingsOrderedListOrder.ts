import { Setting } from 'obsidian';

import {
    DEFAULT_SETTINGS,
    PandocExtendedMarkdownSettings
} from '../shared/types/settingsTypes';
import {
    ORDERED_LIST_MARKER_STYLES,
    OrderedListMarkerStyle,
    normalizeOrderedListMarkerOrder
} from '../shared/types/orderedListTypes';

import { PANEL_SETTINGS } from './constants';

interface OrderButtons {
    moveUp: HTMLButtonElement;
    moveDown: HTMLButtonElement;
    moveTop: HTMLButtonElement;
    moveBottom: HTMLButtonElement;
    reset: HTMLButtonElement;
}

export interface OrderedListOrderControlConfig {
    containerEl: HTMLElement;
    settings: PandocExtendedMarkdownSettings;
    saveSettings: () => Promise<void>;
    selectedStyleId?: OrderedListMarkerStyle;
    setSelectedStyleId: (styleId: OrderedListMarkerStyle | undefined) => void;
    refresh: () => void;
}

export class OrderedListOrderControl {
    private selectedStyleId?: OrderedListMarkerStyle;

    constructor(private config: OrderedListOrderControlConfig) {}

    render(): void {
        this.selectedStyleId = this.config.selectedStyleId;

        new Setting(this.config.containerEl)
            .setName(PANEL_SETTINGS.UI_TEXT.ORDERED_LIST_ORDER_HEADING)
            .setHeading();

        const orderSetting = new Setting(this.config.containerEl)
            .setDesc(PANEL_SETTINGS.UI_TEXT.ORDERED_LIST_ORDER_DESC);
        orderSetting.infoEl?.addClass('pem-panel-order-info');

        const flexContainer = orderSetting.controlEl.createDiv({
            cls: 'pem-panel-order-container pem-ordered-list-order-container'
        });
        const listEl = flexContainer.createDiv({
            cls: 'pem-panel-order-list pem-ordered-list-order-list'
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
        this.config.settings.orderedListMarkerOrder = normalizeOrderedListMarkerOrder(
            this.config.settings.orderedListMarkerOrder
        );
    }

    private renderList(listEl: HTMLElement, buttons: OrderButtons): void {
        for (const styleId of this.config.settings.orderedListMarkerOrder) {
            const style = ORDERED_LIST_MARKER_STYLES.find(item => item.id === styleId);
            if (!style) continue;

            const itemEl = listEl.createDiv({
                cls: 'pem-panel-order-item pem-ordered-list-order-item'
            });
            itemEl.setAttribute('role', 'option');
            itemEl.dataset.id = styleId;
            itemEl.tabIndex = 0;

            itemEl.createSpan({
                text: style.marker,
                cls: 'pem-ordered-list-order-marker'
            });
            itemEl.createSpan({
                text: style.displayName,
                cls: 'pem-ordered-list-order-label'
            });

            if (styleId === this.selectedStyleId) {
                itemEl.classList.add('is-selected');
                itemEl.setAttribute('aria-selected', 'true');
            } else {
                itemEl.setAttribute('aria-selected', 'false');
            }

            itemEl.addEventListener('click', () => {
                this.selectStyle(styleId, listEl, buttons);
            });
            itemEl.addEventListener('keydown', (evt) => {
                if (evt.key === 'Enter' || evt.key === ' ') {
                    evt.preventDefault();
                    this.selectStyle(styleId, listEl, buttons);
                }
            });
        }
    }

    private selectStyle(
        styleId: OrderedListMarkerStyle,
        listEl: HTMLElement,
        buttons: OrderButtons
    ): void {
        this.selectedStyleId = styleId;
        this.config.setSelectedStyleId(styleId);

        for (const item of Array.from(listEl.children)) {
            const itemEl = item as HTMLElement;
            const isSelected = itemEl.dataset.id === styleId;
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
        const lastIndex = this.config.settings.orderedListMarkerOrder.length - 1;

        buttons.moveUp.disabled = idx <= 0;
        buttons.moveDown.disabled = idx < 0 || idx >= lastIndex;
        buttons.moveTop.disabled = idx <= 0;
        buttons.moveBottom.disabled = idx < 0 || idx >= lastIndex;
    }

    private setupHandlers(listEl: HTMLElement, buttons: OrderButtons): void {
        buttons.moveUp.addEventListener('click', () => void this.moveSelected(-1));
        buttons.moveDown.addEventListener('click', () => void this.moveSelected(1));
        buttons.moveTop.addEventListener('click', () => void this.moveToEdge('top'));
        buttons.moveBottom.addEventListener('click', () => void this.moveToEdge('bottom'));
        buttons.reset.addEventListener('click', () => void this.resetOrder());

        listEl.addEventListener('keydown', (evt) => {
            if (!this.selectedStyleId) return;
            if (evt.key === 'ArrowUp') {
                evt.preventDefault();
                buttons.moveUp.click();
            } else if (evt.key === 'ArrowDown') {
                evt.preventDefault();
                buttons.moveDown.click();
            }
        });
    }

    private async moveSelected(offset: -1 | 1): Promise<void> {
        const index = this.getSelectedIndex();
        const nextIndex = index + offset;
        const order = this.config.settings.orderedListMarkerOrder;

        if (index < 0 || nextIndex < 0 || nextIndex >= order.length) {
            return;
        }

        [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
        await this.config.saveSettings();
        this.config.refresh();
    }

    private async moveToEdge(edge: 'top' | 'bottom'): Promise<void> {
        const index = this.getSelectedIndex();
        const order = this.config.settings.orderedListMarkerOrder;

        if (index < 0) return;

        const [styleId] = order.splice(index, 1);
        if (edge === 'top') {
            order.unshift(styleId);
        } else {
            order.push(styleId);
        }

        await this.config.saveSettings();
        this.config.refresh();
    }

    private async resetOrder(): Promise<void> {
        this.config.settings.orderedListMarkerOrder = [
            ...DEFAULT_SETTINGS.orderedListMarkerOrder
        ];
        this.config.setSelectedStyleId(undefined);
        await this.config.saveSettings();
        this.config.refresh();
    }

    private getSelectedIndex(): number {
        if (!this.selectedStyleId) return -1;
        return this.config.settings.orderedListMarkerOrder.indexOf(this.selectedStyleId);
    }
}
