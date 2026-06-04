import {
    buildPandocConvertArgs,
    getPandocVersionLine,
    normalizePandocExecutable,
    parsePandocVersion
} from '../../core';
import { importDesktopModule } from './nodeModule';
import {
    PandocCommandOptions,
    PandocConvertRequest,
    PandocProcessRunner,
    PandocRunRequest,
    PandocRunResult,
    PandocServiceConfig,
    PandocVersionInfo
} from '../../core';

type ChildProcessModule = typeof import('child_process');
type ProcessLike = {
    env?: Record<string, string | undefined>;
};

export class PandocService {
    private readonly config: PandocServiceConfig;
    private readonly runner: PandocProcessRunner;

    constructor(config: PandocServiceConfig = {}) {
        this.config = config;
        this.runner = config.runner ?? runPandocProcess;
    }

    async run(args: string[], options: PandocCommandOptions = {}): Promise<PandocRunResult> {
        return this.runner({
            executable: this.getExecutable(options.pandocPath),
            args,
            cwd: options.cwd,
            env: this.getEnv(options.env),
            timeoutMs: options.timeoutMs ?? this.config.timeoutMs
        });
    }

    async runWithInput(
        args: string[],
        input: string,
        options: PandocCommandOptions = {}
    ): Promise<PandocRunResult> {
        return this.runner({
            executable: this.getExecutable(options.pandocPath),
            args,
            cwd: options.cwd,
            env: this.getEnv(options.env),
            input,
            timeoutMs: options.timeoutMs ?? this.config.timeoutMs
        });
    }

    async getVersion(options: PandocCommandOptions = {}): Promise<PandocVersionInfo> {
        const result = await this.run(['--version'], options);
        const version = result.ok ? parsePandocVersion(result.stdout) : undefined;

        return {
            available: result.ok && version !== undefined,
            version,
            rawVersionLine: getPandocVersionLine(result.stdout),
            result
        };
    }

    async convert(request: PandocConvertRequest): Promise<PandocRunResult> {
        const args = buildPandocConvertArgs(request);

        if (request.input !== undefined) {
            return this.runWithInput(args, request.input, request);
        }

        return this.run(args, request);
    }

    private getExecutable(pandocPath?: string): string {
        return normalizePandocExecutable(pandocPath ?? this.config.pandocPath);
    }

    private getEnv(env?: Record<string, string>): Record<string, string> | undefined {
        if (!this.config.env && !env) {
            return undefined;
        }

        return { ...(this.config.env ?? {}), ...(env ?? {}) };
    }
}

export async function runPandocProcess(request: PandocRunRequest): Promise<PandocRunResult> {
    const childProcess = await importChildProcess();
    const startedAt = Date.now();

    return new Promise(resolve => {
        const child = childProcess.spawn(request.executable, request.args, {
            cwd: request.cwd,
            env: getSpawnEnv(request.env),
            shell: false
        });

        let stdout = '';
        let stderr = '';
        let timedOut = false;
        let settled = false;
        const timeoutId = createTimeout(request.timeoutMs, () => {
            timedOut = true;
            child.kill();
        });

        child.stdout.on('data', (chunk: Uint8Array) => {
            stdout += chunk.toString();
        });
        child.stderr.on('data', (chunk: Uint8Array) => {
            stderr += chunk.toString();
        });
        child.on('error', error => {
            settle(resolve, request, startedAt, stdout, stderr, {
                exitCode: null,
                signal: null,
                error: error.message,
                timedOut
            }, timeoutId, () => settled, value => {
                settled = value;
            });
        });
        child.on('close', (exitCode, signal) => {
            settle(resolve, request, startedAt, stdout, stderr, {
                exitCode,
                signal,
                timedOut
            }, timeoutId, () => settled, value => {
                settled = value;
            });
        });

        child.stdin.end(request.input ?? '');
    });
}

async function importChildProcess(): Promise<ChildProcessModule> {
    return importDesktopModule<ChildProcessModule>('child_process');
}

function createTimeout(timeoutMs: number | undefined, onTimeout: () => void): number | undefined {
    if (!timeoutMs || timeoutMs <= 0) {
        return undefined;
    }

    return window.setTimeout(onTimeout, timeoutMs);
}

function getSpawnEnv(env?: Record<string, string>): Record<string, string> | undefined {
    if (!env) {
        return undefined;
    }

    return {
        ...getProcessEnv(),
        ...env
    };
}

function getProcessEnv(): Record<string, string> {
    const processLike = globalThis as typeof globalThis & { process?: ProcessLike };
    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(processLike.process?.env ?? {})) {
        if (value !== undefined) {
            result[key] = value;
        }
    }

    return result;
}

function settle(
    resolve: (result: PandocRunResult) => void,
    request: PandocRunRequest,
    startedAt: number,
    stdout: string,
    stderr: string,
    status: Pick<PandocRunResult, 'exitCode' | 'signal' | 'error' | 'timedOut'>,
    timeoutId: number | undefined,
    getSettled: () => boolean,
    setSettled: (value: boolean) => void
): void {
    if (getSettled()) {
        return;
    }

    setSettled(true);
    if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
    }

    const ok = status.exitCode === 0 && !status.error && !status.timedOut;
    resolve({
        executable: request.executable,
        args: [...request.args],
        cwd: request.cwd,
        exitCode: status.exitCode,
        signal: status.signal,
        stdout,
        stderr,
        error: status.error,
        timedOut: status.timedOut,
        durationMs: Date.now() - startedAt,
        ok
    });
}
