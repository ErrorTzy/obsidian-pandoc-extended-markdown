import type { PandocRunResult } from '../../core';
import { importDesktopModule } from './nodeModule';

type ChildProcessModule = typeof import('child_process');

export interface ShellRunRequest {
    command: string;
    cwd?: string;
    env?: Record<string, string>;
}

export type ShellRunner = (request: ShellRunRequest) => Promise<PandocRunResult>;

export async function runShellCommand(request: ShellRunRequest): Promise<PandocRunResult> {
    const childProcess = await importChildProcess();
    const startedAt = Date.now();

    return new Promise(resolve => {
        childProcess.exec(request.command, {
            cwd: request.cwd,
            env: request.env ? { ...getProcessEnv(), ...request.env } : undefined
        }, (error, stdout, stderr) => {
            resolve({
                executable: request.command,
                args: [],
                cwd: request.cwd,
                exitCode: typeof error?.code === 'number' ? error.code : error ? 1 : 0,
                signal: null,
                stdout,
                stderr,
                error: error?.message,
                timedOut: false,
                durationMs: Date.now() - startedAt,
                ok: !error
            });
        });
    });
}

async function importChildProcess(): Promise<ChildProcessModule> {
    return importDesktopModule<ChildProcessModule>('child_process');
}

function getProcessEnv(): Record<string, string> {
    const processLike = globalThis as typeof globalThis & {
        process?: { env?: Record<string, string | undefined> };
    };
    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(processLike.process?.env ?? {})) {
        if (value !== undefined) {
            result[key] = value;
        }
    }

    return result;
}
