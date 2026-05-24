import { describe, expect, it } from '@jest/globals';

import {
    PandocProcessRunner,
    PandocRunRequest,
    PandocRunResult,
    PandocService
} from '../../../src/pandoc';

function createResult(request: PandocRunRequest, stdout: string, ok = true): PandocRunResult {
    return {
        executable: request.executable,
        args: [...request.args],
        cwd: request.cwd,
        exitCode: ok ? 0 : 1,
        signal: null,
        stdout,
        stderr: ok ? '' : 'failed',
        timedOut: false,
        durationMs: 1,
        ok
    };
}

describe('PandocService', () => {
    it('runs pandoc with normalized executable and merged environment', async () => {
        const requests: PandocRunRequest[] = [];
        const runner: PandocProcessRunner = async request => {
            requests.push(request);
            return createResult(request, '');
        };
        const service = new PandocService({
            pandocPath: '"/usr/local/bin/pandoc"',
            env: { PATH: '/bin', TEXINPUTS: '/tex:' },
            timeoutMs: 5000,
            runner
        });

        await service.run(['--version'], {
            env: { PATH: '/custom/bin' },
            cwd: '/vault'
        });

        expect(requests[0]).toEqual({
            executable: '/usr/local/bin/pandoc',
            args: ['--version'],
            cwd: '/vault',
            env: { PATH: '/custom/bin', TEXINPUTS: '/tex:' },
            timeoutMs: 5000
        });
    });

    it('reports version availability from pandoc version output', async () => {
        const service = new PandocService({
            runner: async request => createResult(request, 'pandoc 3.1.12\nFeatures: lua')
        });

        await expect(service.getVersion()).resolves.toMatchObject({
            available: true,
            version: '3.1.12',
            rawVersionLine: 'pandoc 3.1.12'
        });
    });

    it('converts string input through stdin when input is provided', async () => {
        const requests: PandocRunRequest[] = [];
        const service = new PandocService({
            runner: async request => {
                requests.push(request);
                return createResult(request, '<p>Hello</p>');
            }
        });

        const result = await service.convert({
            input: '# Hello',
            from: 'markdown',
            to: 'html'
        });

        expect(result.stdout).toBe('<p>Hello</p>');
        expect(requests[0]).toMatchObject({
            executable: 'pandoc',
            args: ['-f', 'markdown', '-t', 'html'],
            input: '# Hello'
        });
    });
});
