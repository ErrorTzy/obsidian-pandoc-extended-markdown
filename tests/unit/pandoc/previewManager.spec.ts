import { describe, expect, it, jest } from '@jest/globals';

import {
    normalizePandocExportSettings,
    PandocPreviewManager,
    PandocRunResult
} from '../../../src/pandoc';

function resultFor(args: string[] = []): PandocRunResult {
    return {
        executable: 'pandoc',
        args,
        exitCode: 0,
        signal: null,
        stdout: '',
        stderr: '',
        timedOut: false,
        durationMs: 1,
        ok: true
    };
}

function request() {
    return {
        currentFilePath: 'note.md',
        currentFileName: 'note.md',
        currentFileBaseName: 'note',
        profileId: 'html'
    };
}

describe('PandocPreviewManager', () => {
    it('cleans up tracked temp files', async () => {
        const removed: string[] = [];
        const manager = new PandocPreviewManager({
            exportManager: {
                previewFile: async (_request, outputPath) => ({
                    ok: true,
                    outputPath,
                    result: resultFor()
                }),
                convertPreviewFile: async () => ({ ok: true, outputPath: '/tmp/fallback.html' })
            },
            settings: normalizePandocExportSettings(),
            tempDir: '/tmp/pem',
            fileSystem: {
                exists: async () => false,
                ensureDir: async () => undefined,
                readText: async () => '<p>ok</p>',
                removeFile: async path => {
                    removed.push(path);
                }
            },
            renderFile: async () => undefined
        });

        await manager.refresh({
            request: request(),
            to: 'html',
            extension: '.html',
            container: document.createElement('div')
        });
        await manager.cleanup();

        expect(removed).toHaveLength(1);
        expect(removed[0]).toMatch(/pandoc-preview-\d+-1\.html$/);
    });

    it('ignores stale preview runs and removes their temp file', async () => {
        const removed: string[] = [];
        const renderFile = jest.fn(async () => undefined);
        let resolveFirst: ((value: unknown) => void) | undefined;
        const first = new Promise(resolve => {
            resolveFirst = resolve;
        });

        const manager = new PandocPreviewManager({
            exportManager: {
                previewFile: jest.fn()
                    .mockImplementationOnce(async (_request, outputPath) => {
                        await first;
                        return { ok: true, outputPath, result: resultFor() };
                    })
                    .mockImplementationOnce(async (_request, outputPath) => ({
                        ok: true,
                        outputPath,
                        result: resultFor()
                    })),
                convertPreviewFile: async () => ({ ok: true, outputPath: '/tmp/fallback.html' })
            },
            settings: normalizePandocExportSettings(),
            tempDir: '/tmp/pem',
            fileSystem: {
                exists: async () => false,
                ensureDir: async () => undefined,
                readText: async () => '<p>ok</p>',
                removeFile: async path => {
                    removed.push(path);
                }
            },
            renderFile
        });

        const container = document.createElement('div');
        const stale = manager.refresh({
            request: request(),
            to: 'html',
            extension: '.html',
            container
        });
        const current = manager.refresh({
            request: request(),
            to: 'html',
            extension: '.html',
            container
        });

        await current;
        resolveFirst?.(undefined);
        await stale;

        expect(renderFile).toHaveBeenCalledTimes(1);
        expect(removed).toHaveLength(1);
        expect(removed[0]).toMatch(/-1\.html$/);
    });

    it('falls back to Pandoc HTML preview when the ODT add-on render fails', async () => {
        const convertPreviewFile = jest.fn(async (_input, outputPath) => ({
            ok: true,
            outputPath,
            result: resultFor()
        }));
        const renderFile = jest.fn(async ({ renderer }: { renderer: { kind: string } }) => {
            if (renderer.kind === 'odt-addon') {
                throw new Error('WebODF failed');
            }
        });
        const settings = normalizePandocExportSettings();
        settings.preview.odtAddon = {
            enabled: true,
            status: 'installed',
            installPath: '/addons/webodf',
            version: '0.5.9'
        };
        const manager = new PandocPreviewManager({
            exportManager: {
                previewFile: async (_request, outputPath) => ({
                    ok: true,
                    outputPath,
                    result: resultFor()
                }),
                convertPreviewFile
            },
            settings,
            tempDir: '/tmp/pem',
            fileSystem: {
                exists: async () => false,
                ensureDir: async () => undefined,
                readText: async () => '<p>fallback</p>',
                readBinary: async () => new Uint8Array([1, 2, 3]),
                removeFile: async () => undefined
            },
            renderFile
        });

        await manager.refresh({
            request: request(),
            to: 'odt',
            extension: '.odt',
            container: document.createElement('div')
        });

        expect(convertPreviewFile).toHaveBeenCalledTimes(1);
        expect(renderFile).toHaveBeenCalledTimes(2);
        expect(renderFile.mock.calls[0][0]).toMatchObject({
            filePath: expect.stringMatching(/-1\.odt$/),
            renderer: { kind: 'odt-addon' }
        });
        expect(renderFile.mock.calls[1][0]).toMatchObject({
            filePath: expect.stringMatching(/-1\.html$/),
            renderer: { kind: 'html' }
        });
    });
});
