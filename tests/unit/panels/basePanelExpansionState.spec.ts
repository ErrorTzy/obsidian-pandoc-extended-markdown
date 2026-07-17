import { App, MarkdownView, Plugin } from 'obsidian';

import { BasePanelModule } from '../../../src/views/panels/modules/BasePanelModule';

jest.mock('obsidian');

class MockPlugin extends Plugin {
    settings = { enableCustomLabelLists: false };
}

class ExpansionTestPanel extends BasePanelModule {
    id = 'expansion-test';
    displayName = 'Expansion test';
    icon = '';

    private identity = '';

    protected extractData(content: string): void {
        this.identity = content.split(':')[0];
    }

    protected renderContent(): void {
        this.renderCollection({
            title: this.displayName,
            items: [{
                key: this.identity,
                identityParts: [{ text: this.identity, kind: 'title' }],
                renderContent: element => {
                    element.textContent = 'A body long enough to use the fallback expansion control.';
                }
            }]
        });
    }
}

async function flushRendering(): Promise<void> {
    await new Promise(resolve => window.setTimeout(resolve, 0));
}

describe('BasePanelModule expansion state', () => {
    let panel: ExpansionTestPanel;
    let view: MarkdownView;
    let container: HTMLElement & { empty: () => void };

    beforeEach(() => {
        const app = new App();
        panel = new ExpansionTestPanel(new MockPlugin(app, {}) as never);
        view = new MarkdownView();
        view.file = { path: 'first.md' } as never;
        view.editor = {
            getValue: jest.fn().mockReturnValue('alpha: initial body')
        } as never;
        container = document.createElement('div') as typeof container;
        container.empty = () => container.replaceChildren();
        Object.defineProperty(global, 'ResizeObserver', {
            configurable: true,
            value: undefined
        });
    });

    it('preserves expansion across rerenders and deactivation for the same note', async () => {
        panel.onActivate(container, view);
        await flushRendering();
        container.querySelector<HTMLButtonElement>('.pem-panel-item-toggle')?.click();
        expect(container.querySelector('.pem-panel-item-toggle')?.getAttribute('aria-expanded')).toBe('true');

        panel.onUpdate(view);
        await flushRendering();
        expect(container.querySelector('.pem-panel-item-toggle')?.getAttribute('aria-expanded')).toBe('true');

        panel.onDeactivate();
        panel.onActivate(container, view);
        await flushRendering();
        expect(container.querySelector('.pem-panel-item-toggle')?.getAttribute('aria-expanded')).toBe('true');
    });

    it('resets expansion when the note or semantic identity changes', async () => {
        panel.onActivate(container, view);
        await flushRendering();
        container.querySelector<HTMLButtonElement>('.pem-panel-item-toggle')?.click();

        view.editor.getValue = jest.fn().mockReturnValue('beta: edited identity') as never;
        panel.onUpdate(view);
        await flushRendering();
        expect(container.querySelector('.pem-panel-item-toggle')?.getAttribute('aria-expanded')).toBe('false');

        container.querySelector<HTMLButtonElement>('.pem-panel-item-toggle')?.click();
        view.file = { path: 'second.md' } as never;
        panel.onUpdate(view);
        await flushRendering();
        expect(container.querySelector('.pem-panel-item-toggle')?.getAttribute('aria-expanded')).toBe('false');
    });
});
