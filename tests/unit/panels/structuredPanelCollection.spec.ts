import {
    StructuredPanelCollection,
    PanelCollectionOptions
} from '../../../src/views/panels/StructuredPanelCollection';

type ResizeCallback = ResizeObserverCallback;

class MockResizeObserver {
    static instances: MockResizeObserver[] = [];

    readonly observe = jest.fn();
    readonly disconnect = jest.fn();

    constructor(readonly callback: ResizeCallback) {
        MockResizeObserver.instances.push(this);
    }
}

function createOptions(expandedKeys = new Set<string>()): PanelCollectionOptions {
    return {
        title: 'Definitions',
        expandedKeys,
        items: [
            {
                key: 'term:alpha:0',
                rowClassName: 'legacy-row',
                contentClassName: 'legacy-content',
                identityParts: [{ text: 'A complete term', kind: 'title' }],
                renderContent: async element => {
                    element.textContent = 'Complete rendered content that is never source-truncated.';
                },
                onContentActivate: jest.fn()
            },
            {
                key: 'term:beta:0',
                identityParts: [{
                    text: '@a-very-long-reference-label',
                    kind: 'token',
                    actionLabel: 'Copy reference',
                    onActivate: jest.fn()
                }],
                renderContent: element => {
                    element.textContent = 'Short content';
                }
            }
        ]
    };
}

async function flushRendering(): Promise<void> {
    await new Promise(resolve => window.setTimeout(resolve, 0));
}

describe('StructuredPanelCollection', () => {
    const originalResizeObserver = global.ResizeObserver;

    beforeEach(() => {
        document.body.innerHTML = '';
        MockResizeObserver.instances = [];
        global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
    });

    afterAll(() => {
        global.ResizeObserver = originalResizeObserver;
    });

    it('renders semantic collection markup and complete wrapped metadata', async () => {
        const host = document.createElement('div');
        document.body.append(host);

        new StructuredPanelCollection(host, createOptions(), new AbortController().signal).render();
        await flushRendering();

        expect(host.querySelector('section')).not.toBeNull();
        expect(host.querySelector('ol')).not.toBeNull();
        expect(host.querySelectorAll('article')).toHaveLength(2);
        expect(host.querySelector('table')).toBeNull();
        expect(host.querySelector('.legacy-content')?.textContent)
            .toBe('Complete rendered content that is never source-truncated.');
        expect(host.querySelector('.pem-panel-identity-token')?.textContent)
            .toBe('@a-very-long-reference-label');
    });

    it('shows item and bulk controls only for content that overflows three lines', async () => {
        const host = document.createElement('div');
        const collection = new StructuredPanelCollection(
            host,
            createOptions(),
            new AbortController().signal
        );
        collection.render();
        await flushRendering();

        const previews = host.querySelectorAll<HTMLElement>('.pem-panel-item-preview');
        Object.defineProperties(previews[0], {
            scrollHeight: { configurable: true, value: 80 },
            clientHeight: { configurable: true, value: 42 }
        });
        Object.defineProperties(previews[1], {
            scrollHeight: { configurable: true, value: 20 },
            clientHeight: { configurable: true, value: 42 }
        });
        MockResizeObserver.instances[0].callback([], MockResizeObserver.instances[0] as unknown as ResizeObserver);

        const toggles = host.querySelectorAll<HTMLButtonElement>('.pem-panel-item-toggle');
        expect(toggles[0].hidden).toBe(false);
        expect(toggles[1].hidden).toBe(true);
        expect(previews[0].classList).toContain('is-overflowing');
        expect(previews[1].classList).not.toContain('is-overflowing');
        expect(host.querySelector<HTMLElement>('.pem-panel-bulk-actions')?.hidden).toBe(false);
        expect(previews[0].classList).toContain('is-collapsed');
    });

    it('supports item and bulk expansion with accessible state and isolated clicks', async () => {
        const host = document.createElement('div');
        const options = createOptions();
        new StructuredPanelCollection(host, options, new AbortController().signal).render();
        await flushRendering();

        const previews = host.querySelectorAll<HTMLElement>('.pem-panel-item-preview');
        previews.forEach(preview => Object.defineProperties(preview, {
            scrollHeight: { configurable: true, value: 80 },
            clientHeight: { configurable: true, value: 42 }
        }));
        MockResizeObserver.instances[0].callback([], MockResizeObserver.instances[0] as unknown as ResizeObserver);

        const article = host.querySelector<HTMLElement>('article')!;
        const sourceAction = options.items[0].onContentActivate as jest.Mock;
        const toggle = article.querySelector<HTMLButtonElement>('.pem-panel-item-toggle')!;
        toggle.click();

        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(toggle.textContent).toContain('Show less');
        expect(sourceAction).not.toHaveBeenCalled();
        expect(options.expandedKeys.has('term:alpha:0')).toBe(true);

        host.querySelector<HTMLButtonElement>('.pem-panel-collapse-all')!.click();
        expect(options.expandedKeys.size).toBe(0);
        host.querySelector<HTMLButtonElement>('.pem-panel-expand-all')!.click();
        expect(options.expandedKeys).toEqual(new Set(['term:alpha:0', 'term:beta:0']));
    });

    it('disconnects its single resize observer when the render cycle aborts', async () => {
        const abortController = new AbortController();
        const host = document.createElement('div');
        new StructuredPanelCollection(host, createOptions(), abortController.signal).render();
        await flushRendering();

        expect(MockResizeObserver.instances).toHaveLength(1);
        abortController.abort();
        expect(MockResizeObserver.instances[0].disconnect).toHaveBeenCalledTimes(1);
    });
});
