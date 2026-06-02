import { describe, expect, it } from '@jest/globals';
import { zipSync } from 'fflate';

import {
    renderPreviewFile,
    selectPreviewRenderer
} from '../../../src/pandoc';

describe('selectPreviewRenderer', () => {
    it('uses HTML preview for HTML and slide formats', () => {
        expect(selectPreviewRenderer('html', '.html').kind).toBe('html');
        expect(selectPreviewRenderer('revealjs', '.html').kind).toBe('html');
    });

    it('uses text preview for text-like extensions', () => {
        expect(selectPreviewRenderer('latex', '.tex').kind).toBe('text');
        expect(selectPreviewRenderer('commonmark_x', '.md').kind).toBe('text');
    });

    it('uses the ODT add-on only when installed and enabled', () => {
        expect(selectPreviewRenderer('odt', '.odt', {
            enabled: true,
            status: 'installed',
            version: '0.5.9',
            installPath: '/addons/webodf'
        })).toMatchObject({
            kind: 'odt-addon',
            addonInstallPath: '/addons/webodf',
            addonVersion: '0.5.9'
        });

        expect(selectPreviewRenderer('odt', '.odt', {
            enabled: false,
            status: 'installed',
            installPath: '/addons/webodf'
        }).kind).toBe('odt-pandoc-fallback');
    });

    it('selects bundled renderers for PDF, DOCX, EPUB, and PPTX', () => {
        expect(selectPreviewRenderer('pdf', '.pdf').kind).toBe('pdf');
        expect(selectPreviewRenderer('docx', '.docx').kind).toBe('docx');
        expect(selectPreviewRenderer('epub', '.epub').kind).toBe('epub');
        expect(selectPreviewRenderer('pptx', '.pptx').kind).toBe('pptx');
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
        expect(frames[0].srcdoc).toContain('AQID');
        expect(frames[0].srcdoc).toContain('file:///addons/webodf-0.5.9/webodf.js-0.5.9/webodf.js');
        expect(frames[0].dataset.pemOdtReady).toBe('true');
        expect(frames[0].dataset.pemOdtText).toBe('Rendered ODT');
        expect(frames[0].dataset.pemOdtImageCount).toBe('1');
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
        createEl(tag: string, options?: { cls?: string; attr?: Record<string, string> }): HTMLElement;
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
        const child = document.createElement(tag);
        Object.entries(options?.attr ?? {}).forEach(([name, value]) => child.setAttribute(name, value));
        if (options?.cls) child.className = options.cls;
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
            const error = container.dataset.pemFrameError;
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
                        imageCount: 1
                    }
                }));
            }, 0);
        }
    });
}
