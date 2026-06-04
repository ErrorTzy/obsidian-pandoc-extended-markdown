import {
    buildPandocProfileArgs
} from '../args/profileArgs';
import {
    normalizePandocExecutable
} from '../args/pandocPath';
import {
    overridePandocOutputArgs
} from '../args/previewOutput';
import type {
    PandocShellRequest,
    PandocSystemPort
} from '../ports';
import {
    renderExportTemplate
} from '../templates/template';
import {
    createCustomShellDisabledResult
} from './exportPlan';
import type {
    CustomExportProfile,
    ExportVariables,
    PandocExportProfile,
    PandocRunResult
} from './types';

export type PandocExportSystemPort = Pick<
    PandocSystemPort,
    'ensureDir' | 'exists' | 'runProcess' | 'runShell'
>;

export interface PandocExportExecutionServiceConfig {
    pandocPath?: string;
    system: PandocExportSystemPort;
}

export interface ExecutePandocProfileRequest {
    profile: PandocExportProfile;
    variables: ExportVariables;
    env?: Record<string, string>;
    extraArgs?: string[];
}

export interface ExecuteCustomProfileRequest {
    profile: CustomExportProfile;
    variables: ExportVariables;
    env?: Record<string, string>;
}

export interface PreviewPandocProfileRequest extends ExecutePandocProfileRequest {
    previewOutputPath: string;
}

export interface ConvertPreviewFileRequest {
    inputPath: string;
    outputPath: string;
    to: string;
    cwd?: string;
    env?: Record<string, string>;
}

export class PandocExportExecutionService {
    private readonly config: PandocExportExecutionServiceConfig;

    constructor(config: PandocExportExecutionServiceConfig) {
        this.config = config;
    }

    exportPandocProfile(request: ExecutePandocProfileRequest): Promise<PandocRunResult> {
        return this.runPandoc(
            buildPandocProfileArgs(request),
            request.variables.currentDir,
            request.env
        );
    }

    previewPandocProfile(request: PreviewPandocProfileRequest): Promise<PandocRunResult> {
        const args = buildPandocProfileArgs(request);
        return this.runPandoc(
            overridePandocOutputArgs(args, request.previewOutputPath),
            request.variables.currentDir,
            request.env
        );
    }

    convertPreviewFile(request: ConvertPreviewFileRequest): Promise<PandocRunResult> {
        return this.runPandoc(
            [request.inputPath, '-t', request.to, '-o', request.outputPath],
            request.cwd,
            request.env
        );
    }

    exportCustomProfile(request: ExecuteCustomProfileRequest): Promise<PandocRunResult> {
        const { profile } = request;
        if (profile.shell !== true) {
            return Promise.resolve(createCustomShellDisabledResult(profile.commandTemplate));
        }

        const command = renderExportTemplate(profile.commandTemplate, request.variables);
        const shellRequest: PandocShellRequest = {
            command,
            cwd: request.variables.currentDir,
            env: request.env
        };

        if (!this.config.system.runShell) {
            return Promise.resolve(createMissingShellRunnerResult(shellRequest));
        }

        return this.config.system.runShell(shellRequest);
    }

    ensureOutputDir(outputPath: string): Promise<void> {
        return this.config.system.ensureDir(outputPath);
    }

    private runPandoc(
        args: string[],
        cwd: string | undefined,
        env?: Record<string, string>
    ): Promise<PandocRunResult> {
        return this.config.system.runProcess({
            executable: normalizePandocExecutable(this.config.pandocPath),
            args,
            cwd,
            env
        });
    }
}

function createMissingShellRunnerResult(request: PandocShellRequest): PandocRunResult {
    return {
        executable: request.command,
        args: [],
        cwd: request.cwd,
        exitCode: 1,
        signal: null,
        stdout: '',
        stderr: 'Custom shell profile cannot run because shell execution is unavailable.',
        error: 'Custom shell profile cannot run because shell execution is unavailable.',
        timedOut: false,
        durationMs: 0,
        ok: false
    };
}
