import { describe, expect, it } from '@jest/globals';

import {
    isPandocPreviewRenderTask,
    PandocPreviewSession,
    PandocPreviewWorkflowService
} from '../../../src/pandoc/core';
import type {
    PandocExportRequest,
    PandocPreviewRendererPort,
    PandocRunResult
} from '../../../src/pandoc/core';

function resultFor(outputPath: string): PandocRunResult {
    return {
        executable: 'pandoc',
        args: [],
        exitCode: 0,
        signal: null,
        stdout: '',
        stderr: '',
        timedOut: false,
        durationMs: 1,
        ok: true
    };
}

function request(): PandocExportRequest {
    return {
        currentFilePath: 'note.md',
        currentFileName: 'note.md',
        currentFileBaseName: 'note',
        profileId: 'html'
    };
}

describe('PandocPreviewWorkflowService', () => {
    it('creates a render task after exporting to a temp path', async () => {
        const service = createWorkflow();

        const task = await service.startPreview({
            request: request(),
            to: 'html',
            extension: '.html'
        });

        expect(isPandocPreviewRenderTask(task)).toBe(true);
        if (!isPandocPreviewRenderTask(task)) throw new Error('Expected render task.');
        expect(task.outputPath).toBe('/tmp/preview-1.html');
        expect(task.renderer.kind).toBe('html');
        expect(task.result.ok).toBe(true);
    });

    it('drops stale preview runs and removes their temp output', async () => {
        const removed: string[] = [];
        let releaseFirst: (() => void) | undefined;
        const firstRun = new Promise<void>(resolve => {
            releaseFirst = resolve;
        });
        let callCount = 0;
        const service = createWorkflow({
            removed,
            previewFile: async (_request, outputPath) => {
                callCount += 1;
                if (callCount === 1) await firstRun;
                return { ok: true, outputPath, result: resultFor(outputPath) };
            }
        });

        const stale = service.startPreview({
            request: request(),
            to: 'html',
            extension: '.html'
        });
        const current = service.startPreview({
            request: request(),
            to: 'html',
            extension: '.html'
        });

        await current;
        releaseFirst?.();

        expect(await stale).toBeUndefined();
        expect(removed).toEqual(['/tmp/preview-1.html']);
    });

    it('converts ODT fallback previews to embedded-resource HTML', async () => {
        const conversions: Array<{
            inputPath: string;
            outputPath: string;
            to?: string;
            extraArgs?: string[];
        }> = [];
        const service = createWorkflow({
            convertPreviewFile: async (inputPath, outputPath, to, _cwd, extraArgs) => {
                conversions.push({ inputPath, outputPath, to, extraArgs });
                return { ok: true, outputPath, result: resultFor(outputPath) };
            }
        });

        const task = await service.startPreview({
            request: request(),
            to: 'odt',
            extension: '.odt'
        });
        if (!isPandocPreviewRenderTask(task)) throw new Error('Expected render task.');

        const fallbackPath = await service.convertOdtFallback(task.run, task.outputPath);

        expect(fallbackPath).toBe('/tmp/preview-1.html');
        expect(conversions).toEqual([{
            inputPath: '/tmp/preview-1.odt',
            outputPath: '/tmp/preview-1.html',
            to: 'html',
            extraArgs: ['--standalone', '--embed-resources']
        }]);
    });

    it('hands preview artifacts to a renderer port', async () => {
        const artifacts: string[] = [];
        const renderer: PandocPreviewRendererPort = {
            render: async ({ artifact }) => {
                artifacts.push(`${artifact.kind}:${artifact.filePath}`);
            }
        };
        const service = createWorkflow();
        const task = await service.startPreview({
            request: request(),
            to: 'html',
            extension: '.html'
        });
        if (!isPandocPreviewRenderTask(task)) throw new Error('Expected render task.');

        const plan = await service.renderPreviewTask(task, renderer, readerPort());

        expect(plan?.artifact).toMatchObject({
            kind: 'html',
            label: 'HTML preview',
            filePath: '/tmp/preview-1.html'
        });
        expect(artifacts).toEqual(['html:/tmp/preview-1.html']);
    });

    it('renders ODT fallback artifacts with the source ODT path', async () => {
        const artifacts: Array<{ kind: string; filePath: string; sourcePath?: string }> = [];
        const service = createWorkflow();
        const task = await service.startPreview({
            request: request(),
            to: 'odt',
            extension: '.odt'
        });
        if (!isPandocPreviewRenderTask(task)) throw new Error('Expected render task.');

        const plan = await service.renderPreviewTask(task, {
            render: async ({ artifact }) => {
                artifacts.push({
                    kind: artifact.kind,
                    filePath: artifact.filePath,
                    sourcePath: artifact.sourcePath
                });
            }
        }, readerPort());

        expect(plan?.artifact).toMatchObject({
            kind: 'html',
            filePath: '/tmp/preview-1.html',
            sourcePath: '/tmp/preview-1.odt'
        });
        expect(artifacts).toEqual([{
            kind: 'html',
            filePath: '/tmp/preview-1.html',
            sourcePath: '/tmp/preview-1.odt'
        }]);
    });
});

function readerPort() {
    return {
        readText: async () => '',
        readBinary: async () => new Uint8Array()
    };
}

function createWorkflow(overrides: {
    removed?: string[];
    previewFile?: (
        request: PandocExportRequest,
        outputPath: string
    ) => Promise<{ ok: boolean; outputPath?: string; result?: PandocRunResult }>;
    convertPreviewFile?: (
        inputPath: string,
        outputPath: string,
        to: string,
        cwd?: string,
        extraArgs?: string[]
    ) => Promise<{ ok: boolean; outputPath?: string; result?: PandocRunResult }>;
} = {}): PandocPreviewWorkflowService {
    return new PandocPreviewWorkflowService({
        exportManager: {
            previewFile: overrides.previewFile ?? (async (_request, outputPath) => ({
                ok: true,
                outputPath,
                result: resultFor(outputPath)
            })),
            convertPreviewFile: overrides.convertPreviewFile ?? (async (_inputPath, outputPath) => ({
                ok: true,
                outputPath,
                result: resultFor(outputPath)
            }))
        },
        session: new PandocPreviewSession({
            makeTempPath: async (extension, runId) => `/tmp/preview-${runId}${extension}`,
            removeFile: async path => {
                overrides.removed?.push(path);
            }
        })
    });
}
