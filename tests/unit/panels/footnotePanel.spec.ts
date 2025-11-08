import { FootnotePanelModule } from '../../../src/views/panels/modules/FootnotePanelModule';
import { App, MarkdownView, Plugin } from 'obsidian';

const highlightLineMock = jest.fn();

jest.mock('../../../src/views/editor/highlightUtils', () => ({
    highlightLine: (...args: any[]) => highlightLineMock(...args)
}));

jest.mock('obsidian', () => ({
    ...jest.requireActual('../../__mocks__/obsidian'),
    MarkdownRenderer: {
        render: jest.fn()
    }
}));

const renderContentWithMathMock = jest.fn((element: HTMLElement, content: string) => {
    let rendered = content;
    rendered = rendered.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    rendered = rendered.replace(/\*(.*?)\*/g, '<em>$1</em>');
    element.innerHTML = rendered;
});

jest.mock('../../../src/views/panels/utils/viewInteractions', () => ({
    renderContentWithMath: (...args: any[]) => renderContentWithMathMock(...args)
}));

class MockPlugin extends Plugin {
    settings = { moreExtendedSyntax: true };
    registerHoverLinkSource() {}
}

describe('FootnotePanelModule', () => {
    let app: App;
    let plugin: MockPlugin;
    let module: FootnotePanelModule;
    let mockMarkdownView: MarkdownView;
    let containerEl: HTMLElement & { empty?: () => void; createEl?: any };
    let editorSetCursor: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '';

        containerEl = document.createElement('div') as typeof containerEl;
        containerEl.empty = function() {
            while (this.firstChild) {
                this.removeChild(this.firstChild);
            }
        };
        const createElFunc = function(this: any, tag: string, options?: any) {
            const el = document.createElement(tag) as typeof containerEl;
            if (options?.text) el.textContent = options.text;
            if (options?.cls) el.className = options.cls;
            el.createEl = createElFunc;
            el.empty = containerEl.empty;
            this.appendChild(el);
            return el;
        };
        containerEl.createEl = createElFunc;
        document.body.appendChild(containerEl);

        app = new App();
        plugin = new MockPlugin(app, {} as any);

        mockMarkdownView = new MarkdownView();
        mockMarkdownView.file = { path: 'test.md' } as any;
        editorSetCursor = jest.fn();

        mockMarkdownView.editor = {
            getValue: jest.fn().mockReturnValue(`Footnote reference[^1].\n\n[^1]: Footnote *content* with math $E=mc^2$.`),
            setCursor: editorSetCursor,
            scrollIntoView: jest.fn(),
            cursorCoords: jest.fn().mockReturnValue({ top: 100, left: 10 })
        } as any;

        module = new FootnotePanelModule(plugin as any);
    });

    it('renders footnote content through renderContentWithMath', () => {
        module.onActivate(containerEl, mockMarkdownView);

        expect(renderContentWithMathMock).toHaveBeenCalledWith(
            expect.any(HTMLElement),
            'Footnote *content* with math $E=mc^2$.',
            app,
            plugin,
            expect.any(Object)
        );

        const contentEl = containerEl.querySelector(`.${'pem-footnote-panel-content'}`);
        expect(contentEl).not.toBeNull();
        expect(contentEl?.innerHTML).toContain('<em>content</em>');
        expect(contentEl?.textContent).toContain('E=mc^2');
    });

    it('moves cursor after the footnote marker when clicking the index', () => {
        module.onActivate(containerEl, mockMarkdownView);

        const marker = '[^1]';
        const referenceLine = 'Footnote reference[^1].';
        const expectedCh = referenceLine.indexOf(marker) + marker.length;

        const indexCell = containerEl.querySelector(`.${'pem-footnote-panel-index'}`);
        expect(indexCell).not.toBeNull();

        indexCell?.dispatchEvent(new MouseEvent('click'));

        expect(editorSetCursor).toHaveBeenCalledWith({ line: 0, ch: expectedCh });
        expect(highlightLineMock).toHaveBeenCalledWith(expect.any(MarkdownView), 0, { line: 0, ch: expectedCh });
    });
});
