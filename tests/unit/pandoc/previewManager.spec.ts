import { describe, expect, it, jest } from '@jest/globals';

import {
    normalizePandocExportSettings,
    PandocPreviewRendererPort,
    PandocRunResult
} from '../../../src/pandoc';
import { PandocPreviewManager } from '../../../src/pandoc/gui/obsidian/previewManager';

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
            makeTempPath: makeTempPath('/tmp/pem'),
            system: {
                readText: async () => '<p>ok</p>',
                readBinary: async () => new Uint8Array(),
                removeFile: async path => {
                    removed.push(path);
                }
            },
            renderer: rendererPort()
        });

        await manager.refresh({
            request: request(),
            to: 'html',
            extension: '.html'
        });
        await manager.cleanup();

        expect(removed).toHaveLength(1);
        expect(removed[0]).toMatch(/pandoc-preview-\d+-1\.html$/);
    });

    it('ignores stale preview runs and removes their temp file', async () => {
        const removed: string[] = [];
        const renderer = rendererPort();
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
            makeTempPath: makeTempPath('/tmp/pem'),
            system: {
                readText: async () => '<p>ok</p>',
                readBinary: async () => new Uint8Array(),
                removeFile: async path => {
                    removed.push(path);
                }
            },
            renderer
        });

        const stale = manager.refresh({
            request: request(),
            to: 'html',
            extension: '.html'
        });
        const current = manager.refresh({
            request: request(),
            to: 'html',
            extension: '.html'
        });

        await current;
        resolveFirst?.(undefined);
        await stale;

        expect(renderer.render).toHaveBeenCalledTimes(1);
        expect(removed).toHaveLength(1);
        expect(removed[0]).toMatch(/-1\.html$/);
    });

    it('falls back to Pandoc HTML preview when the ODT add-on render fails', async () => {
        const convertPreviewFile = jest.fn(async (_input, outputPath) => ({
            ok: true,
            outputPath,
            result: resultFor()
        }));
        const renderer: PandocPreviewRendererPort = {
            render: jest.fn(async ({ artifact }) => {
                if (artifact.kind === 'odt-addon') {
                    throw new Error('WebODF failed');
                }
            })
        };
        const render = jest.mocked(renderer.render);
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
            makeTempPath: makeTempPath('/tmp/pem'),
            system: {
                readText: async () => '<p>fallback</p>',
                readBinary: async () => new Uint8Array([1, 2, 3]),
                removeFile: async () => undefined
            },
            renderer
        });

        await manager.refresh({
            request: request(),
            to: 'odt',
            extension: '.odt'
        });

        expect(convertPreviewFile).toHaveBeenCalledTimes(1);
        expect(render).toHaveBeenCalledTimes(2);
        expect(render.mock.calls[0][0]).toMatchObject({
            artifact: {
                filePath: expect.stringMatching(/-1\.odt$/),
                kind: 'odt-addon'
            }
        });
        expect(render.mock.calls[1][0]).toMatchObject({
            artifact: {
                filePath: expect.stringMatching(/-1\.html$/),
                kind: 'html',
                sourcePath: expect.stringMatching(/-1\.odt$/)
            }
        });
    });
});

function rendererPort(): PandocPreviewRendererPort {
    return {
        render: jest.fn(async () => undefined)
    };
}

function makeTempPath(tempDir: string): (extension: string, runId: number) => Promise<string> {
    return async (extension, runId) => `${tempDir}/pandoc-preview-${Date.now()}-${runId}${extension}`;
}
