import { describe, expect, it } from '@jest/globals';

import {
    CommonPandocSystemPort,
    getPandocPlatformEnvDefaults
} from '../../../src/pandoc/os/common';
import type {
    PandocRunRequest,
    PandocRunResult
} from '../../../src/pandoc/core';

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

describe('CommonPandocSystemPort', () => {
    it('adapts process requests to PandocService', async () => {
        const calls: Array<{ args: string[]; pandocPath?: string; cwd?: string }> = [];
        const port = new CommonPandocSystemPort({
            service: {
                run: async (args, options) => {
                    calls.push({
                        args,
                        pandocPath: options.pandocPath,
                        cwd: options.cwd
                    });
                    return createResult({
                        executable: options.pandocPath ?? 'pandoc',
                        args,
                        cwd: options.cwd,
                        env: options.env
                    });
                }
            } as any
        });

        const result = await port.runProcess({
            executable: '/bin/pandoc',
            args: ['note.md', '-o', 'note.html'],
            cwd: '/vault'
        });

        expect(result.ok).toBe(true);
        expect(calls).toEqual([{
            args: ['note.md', '-o', 'note.html'],
            pandocPath: '/bin/pandoc',
            cwd: '/vault'
        }]);
    });

    it('adapts filesystem and platform helpers', async () => {
        const written: Array<{ path: string; data: Uint8Array | string }> = [];
        const port = new CommonPandocSystemPort({
            platform: {
                os: 'windows',
                arch: 'x64',
                isDesktop: true
            },
            fileSystem: {
                exists: async path => path === '/out/note.html',
                ensureDir: async () => undefined,
                readText: async () => 'text',
                readBinary: async () => new Uint8Array([1, 2]),
                writeFile: async (path, data) => {
                    written.push({ path, data });
                },
                removeFile: async () => undefined
            }
        });

        expect(await port.exists('/out/note.html')).toBe(true);
        expect(await port.readText('/out/note.html')).toBe('text');
        expect(await port.readBinary('/out/note.html')).toEqual(new Uint8Array([1, 2]));
        await port.writeFile('/out/note.html', 'html');
        expect(written).toEqual([{ path: '/out/note.html', data: 'html' }]);
        expect(port.platform()).toMatchObject({ os: 'windows', arch: 'x64' });
        expect(port.pathDelimiter()).toBe(';');
    });

    it('selects platform environment defaults outside core', () => {
        expect(getPandocPlatformEnvDefaults({ os: 'mac' }).PATH)
            .toContain('/opt/homebrew/bin');
        expect(getPandocPlatformEnvDefaults({ os: 'windows' }).PATH)
            .toContain('AppData\\Local\\Pandoc');
        expect(getPandocPlatformEnvDefaults({ os: 'linux' })).toEqual({});
        expect(getPandocPlatformEnvDefaults({ os: 'unknown' })).toEqual({});
    });
});
