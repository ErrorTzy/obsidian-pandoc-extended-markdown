import { describe, expect, it } from '@jest/globals';
import { zipSync } from 'fflate';

import {
    inferOutputExtension,
    selectPreviewRendererPlan
} from '../../../src/pandoc/core';
import {
    renderPreviewFile,
    selectPreviewRenderer as selectObsidianPreviewRenderer
} from '../../../src/pandoc/gui/obsidian/renderers/previewRenderers';
import {
    ObsidianPandocPreviewRendererPort,
    ObsidianPandocPreviewRendererRegistry
} from '../../../src/pandoc/gui/obsidian/renderers';

describe('selectPreviewRenderer', () => {
    it('uses HTML preview for HTML and slide formats', () => {
        expect(selectObsidianPreviewRenderer('html', '.html').kind).toBe('html');
        expect(selectObsidianPreviewRenderer('revealjs', '.html').kind).toBe('html');
        expect(selectObsidianPreviewRenderer('chunkedhtml', '.html').kind).toBe('html');
    });

    it('uses text preview for text-like extensions', () => {
        expect(selectObsidianPreviewRenderer('latex', '.tex').kind).toBe('text');
        expect(selectObsidianPreviewRenderer('commonmark_x', '.md').kind).toBe('text');
        expect(selectObsidianPreviewRenderer('bbcode_xenforo', '.bbcode').kind).toBe('text');
        expect(selectObsidianPreviewRenderer('opendocument', '.fodt').kind).toBe('text');
    });

    it('uses the ODT add-on only when installed and enabled', () => {
        expect(selectObsidianPreviewRenderer('odt', '.odt', {
            enabled: true,
            status: 'installed',
            version: '0.5.9',
            installPath: '/addons/webodf'
        })).toMatchObject({
            kind: 'odt-addon',
            addonInstallPath: '/addons/webodf',
            addonVersion: '0.5.9'
        });

        expect(selectObsidianPreviewRenderer('odt', '.odt', {
            enabled: false,
            status: 'installed',
            installPath: '/addons/webodf'
        }).kind).toBe('odt-pandoc-fallback');
    });

    it('selects bundled renderers for PDF, DOCX, EPUB, and PPTX', () => {
        expect(selectObsidianPreviewRenderer('pdf', '.pdf').kind).toBe('pdf');
        expect(selectObsidianPreviewRenderer('docx', '.docx').kind).toBe('docx');
        expect(selectObsidianPreviewRenderer('epub', '.epub').kind).toBe('epub');
        expect(selectObsidianPreviewRenderer('pptx', '.pptx').kind).toBe('pptx');
    });

    it('selects a preview renderer for every pandoc output format', () => {
        const unsupported = PANDOC_OUTPUT_FORMATS
            .map(format => ({
                format,
                renderer: selectPreviewRendererPlan(format, inferOutputExtension(format))
            }))
            .filter(({ renderer }) => renderer.kind === 'unsupported');

        expect(unsupported).toEqual([]);
    });

    it('renders text previews as non-paged scrollable content', async () => {
        const container = withObsidianDomHelpers(document.createElement('div'));
        await renderPreviewFile({
            container,
            filePath: '/tmp/preview.md',
            renderer: { kind: 'text', label: 'Text preview' },
            readText: async () => '# Heading\n\nBody',
            readBinary: async () => new Uint8Array()
        });

        expect(container.querySelector('.pem-pandoc-flow-preview')).not.toBeNull();
        expect(container.querySelector('.pem-pandoc-paged-preview')).toBeNull();
        expect(container.querySelector('.pem-pandoc-paged-preview-page-controls')).toBeNull();
        expect(container.querySelector('.pem-pandoc-preview-text')?.textContent).toBe('# Heading\n\nBody');
    });

    it('renders HTML previews as non-paged scrollable content', async () => {
        const container = withObsidianDomHelpers(document.createElement('div'));
        await renderPreviewFile({
            container,
            filePath: '/tmp/preview.html',
            renderer: { kind: 'html', label: 'HTML preview' },
            readText: async () => '<h1>Rendered HTML</h1>',
            readBinary: async () => new Uint8Array()
        });

        const frame = container.querySelector<HTMLIFrameElement>('iframe.pem-pandoc-flow-preview-frame');
        expect(container.querySelector('.pem-pandoc-flow-preview')).not.toBeNull();
        expect(container.querySelector('.pem-pandoc-paged-preview')).toBeNull();
        expect(frame?.srcdoc).toBe('<h1>Rendered HTML</h1>');
    });

    it('renders the ODT fallback notice inside the non-paged preview framework', async () => {
        const container = withObsidianDomHelpers(document.createElement('div'));
        await renderPreviewFile({
            container,
            filePath: '/tmp/preview.html',
            renderer: {
                kind: 'html',
                label: 'ODT fallback preview',
                sourcePath: '/tmp/preview.odt'
            },
            readText: async () => '<h1>Fallback HTML</h1>',
            readBinary: async () => new Uint8Array()
        });

        const notice = container.querySelector<HTMLElement>('.pem-pandoc-flow-preview-notice');
        expect(container.querySelector('.pem-pandoc-flow-preview')).not.toBeNull();
        expect(container.querySelector('.pem-pandoc-paged-preview')).toBeNull();
        expect(container.querySelector('.pem-pandoc-preview-fallback-notice')).toBeNull();
        expect(notice?.textContent).toBe(
            'This preview is a fallback. Download odt support in plugin settings for the recommended renderer.'
        );
        expect(notice?.parentElement?.classList.contains('pem-pandoc-flow-preview')).toBe(true);
    });

    it('loads an installed WebODF add-on into a sandboxed iframe with the generated ODT bytes', async () => {
        const readPaths: string[] = [];
        const container = withObsidianDomHelpers(document.createElement('div'));
        await renderPreviewFile({
            container,
            filePath: '/tmp/preview.odt',
            renderer: {
                kind: 'odt-addon',
                label: 'ODT add-on preview',
                addonInstallPath: '/addons/webodf-0.5.9',
                addonVersion: '0.5.9'
            },
            readText: async path => {
                readPaths.push(path);
                return 'window.odf = { OdfCanvas: function () {} };';
            },
            readBinary: async () => new Uint8Array([1, 2, 3])
        });

        expect(readPaths).toEqual([
            '/addons/webodf-0.5.9/webodf.js-0.5.9/webodf.js'
        ]);
        const frames = Array.from(container.querySelectorAll('iframe'));
        expect(frames).toHaveLength(1);
        expect(frames[0].getAttribute('sandbox')).toBe('allow-scripts allow-same-origin');
        expect(frames[0].classList.contains('pem-pandoc-odt-preview')).toBe(true);
        expect(frames[0].classList.contains('pem-pandoc-scrollable-page')).toBe(true);
        expect(container.querySelector('.pem-pandoc-scrollable-page.pem-pandoc-odt-page-preview')).toBeNull();
        expect(frames[0].parentElement?.classList.contains('pem-pandoc-paged-preview-stage')).toBe(true);
        expect(frames[0].srcdoc).toContain('AQID');
        expect(frames[0].srcdoc).toContain('file:///addons/webodf-0.5.9/webodf.js-0.5.9/webodf.js');
        expect(frames[0].dataset.pemOdtReady).toBe('true');
        expect(frames[0].dataset.pemOdtText).toBe('Rendered ODT');
        expect(frames[0].dataset.pemOdtImageCount).toBe('1');
        expect(frames[0].dataset.pemOdtPageCount).toBe('3');
    });

    it('reports WebODF iframe errors instead of falling back to another renderer', async () => {
        const container = withObsidianDomHelpers(document.createElement('div'));
        container.dataset.pemFrameError = 'WebODF rendered an empty ODT preview.';
        await expect(renderPreviewFile({
            container,
            filePath: '/tmp/preview.odt',
            renderer: {
                kind: 'odt-addon',
                label: 'ODT add-on preview',
                addonInstallPath: '/addons/webodf-0.5.9',
                addonVersion: '0.5.9'
            },
            readText: async () => 'window.odf = { OdfCanvas: function () {} };',
            readBinary: async () => odtWithImage()
        })).rejects.toThrow('WebODF rendered an empty ODT preview.');
    });
});

const PANDOC_OUTPUT_FORMATS = [
    'ansi',
    'asciidoc',
    'asciidoc_legacy',
    'asciidoctor',
    'bbcode',
    'bbcode_fluxbb',
    'bbcode_hubzilla',
    'bbcode_phpbb',
    'bbcode_steam',
    'bbcode_xenforo',
    'beamer',
    'biblatex',
    'bibtex',
    'chunkedhtml',
    'commonmark',
    'commonmark_x',
    'context',
    'csljson',
    'djot',
    'docbook',
    'docbook4',
    'docbook5',
    'docx',
    'dokuwiki',
    'dzslides',
    'epub',
    'epub2',
    'epub3',
    'fb2',
    'gfm',
    'haddock',
    'html',
    'html4',
    'html5',
    'icml',
    'ipynb',
    'jats',
    'jats_archiving',
    'jats_articleauthoring',
    'jats_publishing',
    'jira',
    'json',
    'latex',
    'man',
    'markdown',
    'markdown_github',
    'markdown_mmd',
    'markdown_phpextra',
    'markdown_strict',
    'markua',
    'mediawiki',
    'ms',
    'muse',
    'native',
    'odt',
    'opendocument',
    'opml',
    'org',
    'pdf',
    'plain',
    'pptx',
    'revealjs',
    'rst',
    'rtf',
    's5',
    'slideous',
    'slidy',
    'tei',
    'texinfo',
    'textile',
    'typst',
    'vimdoc',
    'xml',
    'xwiki',
    'zimwiki'
];

describe('ObsidianPandocPreviewRendererPort', () => {
    it('dispatches by rendererId and falls back to artifact kind', async () => {
        const rendered: string[] = [];
        const registry = new ObsidianPandocPreviewRendererRegistry();
        registry.register({
            id: 'custom-html',
            label: 'Custom HTML',
            render: async request => {
                rendered.push(`${request.artifact.rendererId}:${request.artifact.filePath}`);
            }
        });
        registry.register({
            id: 'text',
            label: 'Text',
            render: async request => {
                rendered.push(`${request.artifact.kind}:${request.artifact.filePath}`);
            }
        });
        const container = withObsidianDomHelpers(document.createElement('div'));
        const port = new ObsidianPandocPreviewRendererPort(container, registry);

        await port.render({
            artifact: {
                kind: 'html',
                rendererId: 'custom-html',
                label: 'Custom',
                filePath: '/tmp/custom.html'
            },
            readText: async () => '',
            readBinary: async () => new Uint8Array()
        });
        await port.render({
            artifact: {
                kind: 'text',
                label: 'Text',
                filePath: '/tmp/preview.txt'
            },
            readText: async () => '',
            readBinary: async () => new Uint8Array()
        });

        expect(rendered).toEqual([
            'custom-html:/tmp/custom.html',
            'text:/tmp/preview.txt'
        ]);
    });

    it('renders unsupported output for unknown renderer ids', async () => {
        const container = withObsidianDomHelpers(document.createElement('div'));
        const port = new ObsidianPandocPreviewRendererPort(
            container,
            new ObsidianPandocPreviewRendererRegistry()
        );

        await port.render({
            artifact: {
                kind: 'html',
                rendererId: 'missing',
                label: 'Missing preview',
                filePath: '/tmp/missing.html'
            },
            readText: async () => '',
            readBinary: async () => new Uint8Array()
        });

        expect(container.querySelector('.pem-pandoc-preview-message')?.textContent).toBe(
            'Missing preview. Export still works; use an external app to inspect this format.'
        );
    });
});

function odtWithImage(): Uint8Array {
    return zipSync({
        'META-INF/manifest.xml': asciiBytes(
            '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">' +
            '<manifest:file-entry manifest:full-path="Pictures/0.png" manifest:media-type="image/png"/>' +
            '</manifest:manifest>'
        ),
        'Pictures/0.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    });
}

function asciiBytes(text: string): Uint8Array {
    return new Uint8Array(Array.from(text).map(char => char.charCodeAt(0)));
}

function withObsidianDomHelpers(element: HTMLElement): HTMLElement {
    const helper = element as HTMLElement & {
        empty(): void;
        addClass(cls: string): void;
        createDiv(options?: { cls?: string }): HTMLElement;
        createEl(
            tag: string,
            options?: { cls?: string; text?: string; attr?: Record<string, string> }
        ): HTMLElement;
    };
    helper.empty = () => {
        element.replaceChildren();
    };
    helper.addClass = cls => {
        element.classList.add(cls);
    };
    helper.createDiv = options => {
        const div = withObsidianDomHelpers(document.createElement('div'));
        if (options?.cls) div.className = options.cls;
        element.appendChild(div);
        return div;
    };
    helper.createEl = (tag, options) => {
        const child = withObsidianDomHelpers(document.createElement(tag));
        (child as HTMLElement & { setText(text: string): void }).setText = text => {
            child.textContent = text;
        };
        Object.entries(options?.attr ?? {}).forEach(([name, value]) => child.setAttribute(name, value));
        if (options?.cls) child.className = options.cls;
        if (options?.text) child.textContent = options.text;
        if (tag === 'iframe') installReadyIframe(child as HTMLIFrameElement, element);
        element.appendChild(child);
        return child;
    };

    return helper;
}

function installReadyIframe(frame: HTMLIFrameElement, container: HTMLElement): void {
    let srcdoc = '';
    Object.defineProperty(frame, 'srcdoc', {
        get: () => srcdoc,
        set: value => {
            srcdoc = value;
            const token = value.match(/const token = "([^"]+)"/)?.[1];
            if (!token) return;
            const error = container.closest<HTMLElement>('[data-pem-frame-error]')?.dataset.pemFrameError;
            window.setTimeout(() => {
                window.dispatchEvent(new MessageEvent('message', {
                    data: error ? {
                        token,
                        type: 'error',
                        message: error
                    } : {
                        token,
                        type: 'ready',
                        text: 'Rendered ODT',
                        imageCount: 1,
                        pageCount: 3
                    }
                }));
            }, 0);
        }
    });
}
