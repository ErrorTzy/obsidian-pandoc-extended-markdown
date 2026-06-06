export interface PandocRunRequest {
    executable: string;
    args: string[];
    cwd?: string;
    env?: Record<string, string>;
    input?: string;
    timeoutMs?: number;
}

export interface PandocRunResult {
    executable: string;
    args: string[];
    cwd?: string;
    exitCode: number | null;
    signal: string | null;
    stdout: string;
    stderr: string;
    error?: string;
    timedOut: boolean;
    durationMs: number;
    ok: boolean;
}

export type PandocProcessRunner = (
    request: PandocRunRequest
) => Promise<PandocRunResult>;

export interface PandocServiceConfig {
    pandocPath?: string;
    env?: Record<string, string>;
    timeoutMs?: number;
    runner?: PandocProcessRunner;
}

export interface PandocCommandOptions {
    pandocPath?: string;
    cwd?: string;
    env?: Record<string, string>;
    timeoutMs?: number;
}

export interface PandocVersionInfo {
    available: boolean;
    version?: string;
    rawVersionLine?: string;
    result: PandocRunResult;
}

export interface PandocConvertRequest extends PandocCommandOptions {
    input?: string;
    inputPath?: string;
    from?: string;
    to: string;
    outputPath?: string;
    standalone?: boolean;
    resourcePaths?: string[];
    luaFilters?: string[];
    metadata?: Record<string, string>;
    extraArgs?: string[];
}

export type PandocOutputFolderMode = 'last' | 'current' | 'vault' | 'custom';

export interface PandocExportSettings {
    enabled: boolean;
    pandocPath: string;
    defaultOutputFolderMode: PandocOutputFolderMode;
    customOutputFolder: string;
    env: Record<string, string>;
    profiles: ExportProfile[];
    lastExportProfileId?: string;
    lastOutputFolder?: string;
    showOverwriteConfirmation: boolean;
    openOutputFile: boolean;
    revealOutputFile: boolean;
    suggestRuntimeEnvVariables: boolean;
    preview: PandocPreviewSettings;
}

export type OdtPreviewAddonInstallStatus = 'not-installed' | 'installed' | 'failed';

export interface OdtPreviewAddonSettings {
    enabled: boolean;
    status: OdtPreviewAddonInstallStatus;
    version?: string;
    checksum?: string;
    installPath?: string;
    lastError?: string;
}

export interface PandocPreviewSettings {
    enabled: boolean;
    debounceMs: number;
    odtAddon: OdtPreviewAddonSettings;
}

export interface ExportVariables extends Record<string, unknown> {
    vaultDir: string;
    pluginDir: string;
    luaFilterDir: string;
    currentPath: string;
    currentDir: string;
    currentFileName: string;
    currentFileFullName: string;
    outputPath: string;
    outputDir: string;
    outputFileName: string;
    outputFileFullName: string;
    outputExtension?: string;
    attachmentFolderPath: string;
    embedDirs: string;
    fromFormat: string;
    metadata?: Record<string, unknown>;
}

export interface BaseExportProfile {
    id: string;
    name: string;
    extension: string;
    type: 'pandoc' | 'custom';
    openOutputFile?: boolean;
    revealOutputFile?: boolean;
}

export interface PandocExportProfile extends BaseExportProfile {
    type: 'pandoc';
    inputPath?: string;
    to: string;
    from?: string;
    outputPath?: string;
    standalone?: boolean;
    resourcePaths?: string[];
    luaFilters?: string[];
    metadata?: Record<string, string>;
    extraArgs?: string[];
}

export interface CustomExportProfile extends BaseExportProfile {
    type: 'custom';
    commandTemplate: string;
    shell?: true;
}

export type ExportProfile = PandocExportProfile | CustomExportProfile;

export interface PandocExportRequest {
    currentFilePath: string;
    currentFileName: string;
    currentFileBaseName: string;
    outputFolder?: string;
    outputFileName?: string;
    profileId?: string;
    overwrite?: boolean;
    extraArgs?: string[];
    options?: Record<string, unknown>;
}

export interface PandocExportResult {
    ok: boolean;
    outputPath?: string;
    profile?: ExportProfile;
    result?: PandocRunResult;
    error?: string;
}
