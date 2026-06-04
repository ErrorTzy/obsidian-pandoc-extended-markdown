import type {
    PandocPlatformInfo,
    PandocSystemPort
} from '../../core';
import type {
    PandocProcessRequest,
    PandocRunResult,
    PandocShellRequest
} from '../../core';
import {
    NodePandocExportFileSystem,
    type PandocExportFileSystem
} from './fileSystem';
import {
    PandocService
} from './PandocService';
import {
    runShellCommand,
    type ShellRunner
} from './shellRunner';
import {
    createPandocPreviewTempPath
} from './tempPath';
import {
    sha256Hex
} from './hash';

export interface CommonPandocSystemPortConfig {
    service?: PandocService;
    fileSystem?: PandocExportFileSystem;
    shellRunner?: ShellRunner;
    platform?: PandocPlatformInfo;
    pathDelimiter?: string;
}

export class CommonPandocSystemPort implements PandocSystemPort {
    private readonly service: PandocService;
    private readonly fileSystem: PandocExportFileSystem;
    private readonly shellRunner: ShellRunner;
    private readonly platformInfo?: PandocPlatformInfo;
    private readonly delimiter?: string;

    constructor(config: CommonPandocSystemPortConfig = {}) {
        this.service = config.service ?? new PandocService();
        this.fileSystem = config.fileSystem ?? new NodePandocExportFileSystem();
        this.shellRunner = config.shellRunner ?? runShellCommand;
        this.platformInfo = config.platform;
        this.delimiter = config.pathDelimiter;
    }

    runProcess(request: PandocProcessRequest): Promise<PandocRunResult> {
        return this.service.run(request.args, {
            pandocPath: request.executable,
            cwd: request.cwd,
            env: request.env,
            timeoutMs: request.timeoutMs
        });
    }

    runShell(request: PandocShellRequest): Promise<PandocRunResult> {
        return this.shellRunner(request);
    }

    exists(path: string): Promise<boolean> {
        return this.fileSystem.exists(path);
    }

    ensureDir(path: string): Promise<void> {
        return this.fileSystem.ensureDir(path);
    }

    readText(path: string): Promise<string> {
        if (!this.fileSystem.readText) {
            throw new Error('Text file reading is unavailable.');
        }

        return this.fileSystem.readText(path);
    }

    readBinary(path: string): Promise<Uint8Array> {
        if (!this.fileSystem.readBinary) {
            throw new Error('Binary file reading is unavailable.');
        }

        return this.fileSystem.readBinary(path);
    }

    writeFile(path: string, data: Uint8Array | string): Promise<void> {
        if (!this.fileSystem.writeFile) {
            throw new Error('File writing is unavailable.');
        }

        return this.fileSystem.writeFile(path, data);
    }

    removeFile(path: string): Promise<void> {
        if (!this.fileSystem.removeFile) {
            throw new Error('File removal is unavailable.');
        }

        return this.fileSystem.removeFile(path);
    }

    makeTempPath(extension: string): Promise<string> {
        return createPandocPreviewTempPath({
            extension,
            runId: 0
        });
    }

    platform(): PandocPlatformInfo {
        return this.platformInfo ?? detectPlatformInfo();
    }

    pathDelimiter(): string {
        return this.delimiter ?? (this.platform().os === 'windows' ? ';' : ':');
    }

    hash(data: Uint8Array | string): Promise<string> {
        return sha256Hex(data);
    }
}

function detectPlatformInfo(): PandocPlatformInfo {
    const processLike = globalThis as typeof globalThis & {
        process?: {
            arch?: string;
            platform?: string;
        };
    };
    const platform = processLike.process?.platform;

    return {
        os: platform === 'darwin' ? 'mac' :
            platform === 'win32' ? 'windows' :
                platform === 'linux' ? 'linux' :
                    'unknown',
        arch: processLike.process?.arch,
        isDesktop: true
    };
}
