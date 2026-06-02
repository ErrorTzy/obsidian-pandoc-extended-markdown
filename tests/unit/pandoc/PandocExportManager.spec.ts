import { describe, expect, it, jest } from '@jest/globals';

import {
    normalizePandocExportSettings,
    PandocExportManager,
    PandocProcessRunner,
    PandocRunRequest,
    PandocRunResult
} from '../../../src/pandoc';

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

function createApp() {
    return {
        vault: {
            adapter: {
                getBasePath: () => '/vault',
                getFullPath: (path: string) => `/vault/${path}`
            },
            config: {}
        },
        metadataCache: {
            getCache: () => null,
            getFirstLinkpathDest: () => null
        }
    } as any;
}

describe('PandocExportManager', () => {
    it('calls PandocService with argument arrays for pandoc profiles', async () => {
        const requests: PandocRunRequest[] = [];
        const runner: PandocProcessRunner = async request => {
            requests.push(request);
            return createResult(request);
        };
        const settings = normalizePandocExportSettings({
            pandocPath: '/bin/pandoc',
            openOutputFile: false
        });
        const manager = new PandocExportManager({
            app: createApp(),
            manifest: { id: 'pandoc-extended-markdown', dir: '.obsidian/plugins/pem' } as any,
            settings,
            service: {
                run: (args: string[], options: { pandocPath?: string; cwd?: string; env?: Record<string, string> }) =>
                    runner({
                        executable: options.pandocPath ?? 'pandoc',
                        args,
                        cwd: options.cwd,
                        env: options.env
                    })
            } as any,
            fileSystem: {
                exists: async () => false,
                ensureDir: async () => undefined
            },
            desktop: {
                chooseFolder: async () => undefined,
                confirmOverwrite: async () => undefined,
                openPath: async () => undefined,
                revealPath: async () => undefined
            }
        });

        const result = await manager.exportFile({
            currentFilePath: 'note.md',
            currentFileName: 'note.md',
            currentFileBaseName: 'note',
            profileId: 'html',
            outputFolder: '/exports'
        });

        expect(result.ok).toBe(true);
        expect(requests[0]).toMatchObject({
            executable: '/bin/pandoc',
            cwd: '/vault',
            args: expect.arrayContaining([
                '/vault/note.md',
                '-o',
                '/exports/note.html',
                '--lua-filter',
                '/vault/.obsidian/plugins/pem/lua_filter/FencedDivExtendedSyntax.lua'
            ])
        });
    });

    it('gates advanced custom profiles behind explicit shell opt-in', async () => {
        const settings = normalizePandocExportSettings({
            openOutputFile: false,
            profiles: [{
                id: 'custom',
                name: 'Custom',
                type: 'custom',
                extension: '.txt',
                commandTemplate: 'echo ${outputPath}'
            }]
        });
        const manager = new PandocExportManager({
            app: createApp(),
            manifest: { id: 'pandoc-extended-markdown' } as any,
            settings,
            fileSystem: {
                exists: async () => false,
                ensureDir: async () => undefined
            },
            desktop: {
                chooseFolder: async () => undefined,
                confirmOverwrite: async () => undefined,
                openPath: async () => undefined,
                revealPath: async () => undefined
            }
        });

        const result = await manager.exportFile({
            currentFilePath: 'note.md',
            currentFileName: 'note.md',
            currentFileBaseName: 'note',
            profileId: 'custom',
            outputFolder: '/exports'
        });

        expect(result.ok).toBe(false);
        expect(result.error).toContain('Custom shell profile');
    });

    it('keeps successful exports successful when post-export open fails', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const requests: PandocRunRequest[] = [];
        const runner: PandocProcessRunner = async request => {
            requests.push(request);
            return createResult(request);
        };
        const settings = normalizePandocExportSettings({
            openOutputFile: true
        });
        const manager = new PandocExportManager({
            app: createApp(),
            manifest: { id: 'pandoc-extended-markdown', dir: '.obsidian/plugins/pem' } as any,
            settings,
            service: {
                run: (args: string[], options: { pandocPath?: string; cwd?: string; env?: Record<string, string> }) =>
                    runner({
                        executable: options.pandocPath ?? 'pandoc',
                        args,
                        cwd: options.cwd,
                        env: options.env
                    })
            } as any,
            fileSystem: {
                exists: async () => false,
                ensureDir: async () => undefined
            },
            desktop: {
                chooseFolder: async () => undefined,
                confirmOverwrite: async () => undefined,
                openPath: async () => {
                    throw new Error('open failed');
                },
                revealPath: async () => undefined
            }
        });

        const result = await manager.exportFile({
            currentFilePath: 'note.md',
            currentFileName: 'note.md',
            currentFileBaseName: 'note',
            profileId: 'html',
            outputFolder: '/exports'
        });

        expect(result.ok).toBe(true);
        expect(result.outputPath).toBe('/exports/note.html');
        expect(requests).toHaveLength(1);
        expect(warnSpy).toHaveBeenCalledWith(
            'Failed to open exported file.',
            expect.any(Error)
        );
        warnSpy.mockRestore();
    });

    it('does not wait for post-export open to finish before reporting success', async () => {
        const settings = normalizePandocExportSettings({
            openOutputFile: true
        });
        const manager = new PandocExportManager({
            app: createApp(),
            manifest: { id: 'pandoc-extended-markdown', dir: '.obsidian/plugins/pem' } as any,
            settings,
            service: {
                run: (args: string[], options: { pandocPath?: string; cwd?: string; env?: Record<string, string> }) =>
                    Promise.resolve(createResult({
                        executable: options.pandocPath ?? 'pandoc',
                        args,
                        cwd: options.cwd,
                        env: options.env
                    }))
            } as any,
            fileSystem: {
                exists: async () => false,
                ensureDir: async () => undefined
            },
            desktop: {
                chooseFolder: async () => undefined,
                confirmOverwrite: async () => undefined,
                openPath: () => new Promise(() => undefined),
                revealPath: async () => undefined
            }
        });

        await expect(manager.exportFile({
            currentFilePath: 'note.md',
            currentFileName: 'note.md',
            currentFileBaseName: 'note',
            profileId: 'html',
            outputFolder: '/exports'
        })).resolves.toMatchObject({
            ok: true,
            outputPath: '/exports/note.html'
        });
    });

    it('runs previews with a temp output override without persisting settings', async () => {
        const requests: PandocRunRequest[] = [];
        const saveSettings = jest.fn<() => Promise<void>>(async () => undefined);
        const settings = normalizePandocExportSettings({
            profiles: [{
                id: 'html',
                name: 'HTML',
                type: 'pandoc',
                to: 'html',
                extension: '.html',
                extraArgs: ['--output=real.html']
            }]
        });
        const manager = new PandocExportManager({
            app: createApp(),
            manifest: { id: 'pandoc-extended-markdown', dir: '.obsidian/plugins/pem' } as any,
            settings,
            saveSettings,
            service: {
                run: (args: string[], options: { pandocPath?: string; cwd?: string; env?: Record<string, string> }) => {
                    const request = {
                        executable: options.pandocPath ?? 'pandoc',
                        args,
                        cwd: options.cwd,
                        env: options.env
                    };
                    requests.push(request);
                    return Promise.resolve(createResult(request));
                }
            } as any,
            fileSystem: {
                exists: async () => false,
                ensureDir: async () => undefined
            }
        });

        const result = await manager.previewFile({
            currentFilePath: 'note.md',
            currentFileName: 'note.md',
            currentFileBaseName: 'note',
            profileId: 'html',
            outputFolder: '/exports',
            outputFileName: 'note.html'
        }, '/tmp/preview.html');

        expect(result.ok).toBe(true);
        expect(requests[0].args.slice(-2)).toEqual(['-o', '/tmp/preview.html']);
        expect(requests[0].args).not.toContain('--output=real.html');
        expect(saveSettings).not.toHaveBeenCalled();
        expect(settings.lastExportProfileId).toBeUndefined();
        expect(settings.lastOutputFolder).toBeUndefined();
    });
});
