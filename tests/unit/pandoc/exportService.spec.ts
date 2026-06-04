import { describe, expect, it } from '@jest/globals';

import {
    PandocExportExecutionService,
    PandocExportSystemPort
} from '../../../src/pandoc/core';
import type {
    ExportVariables,
    PandocRunRequest,
    PandocRunResult
} from '../../../src/pandoc';

function createVariables(overrides: Partial<ExportVariables> = {}): ExportVariables {
    return {
        vaultDir: '/vault',
        pluginDir: '/vault/.obsidian/plugins/pem',
        luaFilterDir: '/vault/.obsidian/plugins/pem/lua_filter',
        currentPath: '/vault/note.md',
        currentDir: '/vault',
        currentFileName: 'note',
        currentFileFullName: 'note.md',
        outputPath: '/exports/note.html',
        outputDir: '/exports',
        outputFileName: 'note',
        outputFileFullName: 'note.html',
        outputExtension: '.html',
        attachmentFolderPath: '/vault/assets',
        embedDirs: '/vault/assets',
        fromFormat: 'markdown',
        ...overrides
    };
}

function createResult(request: PandocRunRequest): PandocRunResult {
    return {
        executable: request.executable,
        args: [...request.args],
        cwd: request.cwd,
        exitCode: 0,
        signal: null,
        stdout: '',
        stderr: '',
        timedOut: false,
        durationMs: 1,
        ok: true
    };
}

describe('PandocExportExecutionService', () => {
    it('runs pandoc profiles through the process port', async () => {
        const requests: PandocRunRequest[] = [];
        const service = new PandocExportExecutionService({
            pandocPath: '"/bin/pandoc"',
            system: createSystemPort({
                runProcess: async request => {
                    requests.push(request);
                    return createResult(request);
                }
            })
        });

        const result = await service.exportPandocProfile({
            profile: {
                id: 'html',
                name: 'HTML',
                type: 'pandoc',
                extension: '.html',
                to: 'html',
                standalone: true
            },
            variables: createVariables(),
            env: { PATH: '/bin' },
            extraArgs: ['--toc']
        });

        expect(result.ok).toBe(true);
        expect(requests[0]).toMatchObject({
            executable: '/bin/pandoc',
            cwd: '/vault',
            env: { PATH: '/bin' },
            args: [
                '/vault/note.md',
                '-f',
                'markdown',
                '-t',
                'html',
                '-o',
                '/exports/note.html',
                '--standalone',
                '--toc'
            ]
        });
    });

    it('overrides preview output without mutating profile args', async () => {
        const requests: PandocRunRequest[] = [];
        const service = new PandocExportExecutionService({
            system: createSystemPort({
                runProcess: async request => {
                    requests.push(request);
                    return createResult(request);
                }
            })
        });

        await service.previewPandocProfile({
            profile: {
                id: 'html',
                name: 'HTML',
                type: 'pandoc',
                extension: '.html',
                to: 'html',
                extraArgs: ['--output=real.html']
            },
            variables: createVariables(),
            previewOutputPath: '/tmp/preview.html'
        });

        expect(requests[0].args).not.toContain('--output=real.html');
        expect(requests[0].args.slice(-2)).toEqual(['-o', '/tmp/preview.html']);
    });

    it('runs opted-in custom profiles through the shell port', async () => {
        const shellRequests: Array<{ command: string; cwd?: string }> = [];
        const service = new PandocExportExecutionService({
            system: createSystemPort({
                runShell: async request => {
                    shellRequests.push({ command: request.command, cwd: request.cwd });
                    return {
                        executable: request.command,
                        args: [],
                        cwd: request.cwd,
                        exitCode: 0,
                        signal: null,
                        stdout: '',
                        stderr: '',
                        timedOut: false,
                        durationMs: 1,
                        ok: true
                    };
                }
            })
        });

        const result = await service.exportCustomProfile({
            profile: {
                id: 'custom',
                name: 'Custom',
                type: 'custom',
                extension: '.txt',
                commandTemplate: 'echo ${outputPath}',
                shell: true
            },
            variables: createVariables()
        });

        expect(result.ok).toBe(true);
        expect(shellRequests).toEqual([{ command: 'echo /exports/note.html', cwd: '/vault' }]);
    });

    it('blocks custom profiles without shell opt-in', async () => {
        const service = new PandocExportExecutionService({
            system: createSystemPort()
        });

        const result = await service.exportCustomProfile({
            profile: {
                id: 'custom',
                name: 'Custom',
                type: 'custom',
                extension: '.txt',
                commandTemplate: 'echo ${outputPath}'
            },
            variables: createVariables()
        });

        expect(result.ok).toBe(false);
        expect(result.error).toContain('Custom shell profile');
    });
});

function createSystemPort(
    overrides: Partial<PandocExportSystemPort> = {}
): PandocExportSystemPort {
    return {
        ensureDir: async () => undefined,
        runProcess: async request => createResult(request),
        ...overrides
    };
}
