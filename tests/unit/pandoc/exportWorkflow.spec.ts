import { describe, expect, it, jest } from '@jest/globals';

import {
    normalizePandocExportSettings,
    PandocExportExecutionService,
    PandocExportWorkflowService
} from '../../../src/pandoc/core';
import type {
    ExportVariables,
    PandocExportSettings,
    PandocRunRequest,
    PandocRunResult
} from '../../../src/pandoc/core';

function createVariables(outputPath: string): ExportVariables {
    return {
        vaultDir: '/vault',
        pluginDir: '/vault/.obsidian/plugins/pem',
        luaFilterDir: '/vault/.obsidian/plugins/pem/lua_filter',
        currentPath: '/vault/note.md',
        currentDir: '/vault',
        currentFileName: 'note',
        currentFileFullName: 'note.md',
        outputPath,
        outputDir: '/exports',
        outputFileName: 'note',
        outputFileFullName: 'note.html',
        outputExtension: '.html',
        attachmentFolderPath: '/vault/assets',
        embedDirs: '/vault/assets',
        fromFormat: 'markdown'
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

describe('PandocExportWorkflowService', () => {
    it('confirms overwrites before creating variables and running export', async () => {
        const requests: PandocRunRequest[] = [];
        const settings = createSettings();
        const service = createWorkflow(settings, {
            exists: async () => true,
            confirmOverwrite: async path => path.replace('.html', '-copy.html'),
            runProcess: async request => {
                requests.push(request);
                return createResult(request);
            }
        });

        const result = await service.exportFile({
            request: createRequest(),
            defaultOutputFolder: '/exports',
            createVariableContext: outputPath => {
                const variables = createVariables(outputPath);
                return { variables, templateVariables: variables, env: { PATH: '/bin' } };
            }
        });

        expect(result.ok).toBe(true);
        expect(result.outputPath).toBe('/exports/note-copy.html');
        expect(requests[0].args).toContain('/exports/note-copy.html');
        expect(settings.lastOutputFolder).toBe('/exports');
        expect(service.getLastExportRequest()).toMatchObject({
            profileId: 'html',
            currentFilePath: 'note.md'
        });
    });

    it('returns a cancelled result when overwrite confirmation declines', async () => {
        const runProcess = jest.fn(async request => createResult(request));
        const service = createWorkflow(createSettings(), {
            exists: async () => true,
            confirmOverwrite: async () => undefined,
            runProcess
        });

        const result = await service.exportFile({
            request: createRequest(),
            defaultOutputFolder: '/exports',
            createVariableContext: outputPath => {
                const variables = createVariables(outputPath);
                return { variables, templateVariables: variables, env: {} };
            }
        });

        expect(result).toMatchObject({
            ok: false,
            error: 'Export cancelled.'
        });
        expect(runProcess).not.toHaveBeenCalled();
    });

    it('persists last export settings and schedules post-export actions', async () => {
        const saved: PandocExportSettings[] = [];
        const opened: string[] = [];
        const revealed: string[] = [];
        const settings = createSettings({
            openOutputFile: true,
            revealOutputFile: true,
            showOverwriteConfirmation: false
        });
        const service = createWorkflow(settings, {
            saveSettings: async value => {
                saved.push({ ...value });
            },
            openOutput: async path => {
                opened.push(path);
            },
            revealOutput: async path => {
                revealed.push(path);
            }
        });

        const result = await service.exportFile({
            request: createRequest(),
            defaultOutputFolder: '/exports',
            createVariableContext: outputPath => {
                const variables = createVariables(outputPath);
                return { variables, templateVariables: variables, env: {} };
            }
        });

        expect(result.ok).toBe(true);
        expect(saved[0]).toMatchObject({
            lastExportProfileId: 'html',
            lastOutputFolder: '/exports'
        });
        expect(opened).toEqual(['/exports/note.html']);
        expect(revealed).toEqual(['/exports/note.html']);
    });

    it('runs previews without persisting last export settings', async () => {
        const saveSettings = jest.fn(async () => undefined);
        const service = createWorkflow(createSettings(), { saveSettings });

        const result = await service.previewFile({
            request: createRequest(),
            defaultOutputFolder: '/exports',
            previewOutputPath: '/tmp/preview.html',
            createVariableContext: outputPath => {
                const variables = createVariables(outputPath);
                return { variables, templateVariables: variables, env: {} };
            }
        });

        expect(result).toMatchObject({
            ok: true,
            outputPath: '/tmp/preview.html'
        });
        expect(saveSettings).not.toHaveBeenCalled();
    });
});

function createSettings(overrides: Partial<PandocExportSettings> = {}): PandocExportSettings {
    return normalizePandocExportSettings({
        openOutputFile: false,
        profiles: [{
            id: 'html',
            name: 'HTML',
            type: 'pandoc',
            to: 'html',
            extension: '.html'
        }],
        ...overrides
    });
}

function createRequest() {
    return {
        currentFilePath: 'note.md',
        currentFileName: 'note.md',
        currentFileBaseName: 'note',
        profileId: 'html'
    };
}

function createWorkflow(
    settings: PandocExportSettings,
    overrides: {
        exists?: (path: string) => Promise<boolean>;
        runProcess?: (request: PandocRunRequest) => Promise<PandocRunResult>;
        confirmOverwrite?: (path: string) => Promise<string | undefined>;
        saveSettings?: (settings: PandocExportSettings) => Promise<void>;
        openOutput?: (path: string) => Promise<void>;
        revealOutput?: (path: string) => Promise<void>;
    } = {}
): PandocExportWorkflowService {
    const execution = new PandocExportExecutionService({
        system: {
            exists: overrides.exists ?? (async () => false),
            ensureDir: async () => undefined,
            runProcess: overrides.runProcess ?? (async request => createResult(request))
        }
    });

    return new PandocExportWorkflowService({
        settings,
        execution,
        system: {
            exists: overrides.exists ?? (async () => false)
        },
        user: {
            confirmOverwrite: overrides.confirmOverwrite,
            openOutput: overrides.openOutput,
            revealOutput: overrides.revealOutput
        },
        saveSettings: overrides.saveSettings
    });
}
