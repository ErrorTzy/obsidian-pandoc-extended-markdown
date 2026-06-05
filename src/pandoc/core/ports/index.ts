import type {
    ExportProfile,
    PandocExportResult,
    PandocExportSettings,
    PandocRunRequest,
    PandocRunResult
} from '../export/types';
import type {
    PandocOptionCatalog,
    ProfileDraft,
    ProfileOptionRow
} from '../types';

export type PandocProcessRequest = PandocRunRequest;

export interface PandocShellRequest {
    command: string;
    cwd?: string;
    env?: Record<string, string>;
    timeoutMs?: number;
}

export interface PandocPlatformInfo {
    os: 'linux' | 'mac' | 'windows' | 'unknown';
    arch?: string;
    isDesktop: boolean;
}

export interface PandocSystemPort {
    runProcess(request: PandocProcessRequest): Promise<PandocRunResult>;
    runShell?(request: PandocShellRequest): Promise<PandocRunResult>;
    exists(path: string): Promise<boolean>;
    ensureDir(path: string): Promise<void>;
    readText(path: string): Promise<string>;
    readBinary(path: string): Promise<Uint8Array>;
    writeFile(path: string, data: Uint8Array | string): Promise<void>;
    removeFile(path: string): Promise<void>;
    makeTempPath(extension: string): Promise<string>;
    platform(): PandocPlatformInfo;
    pathDelimiter(): string;
    hash?(data: Uint8Array | string): Promise<string>;
    download?(url: string): Promise<Uint8Array>;
}

export interface PandocCurrentFile {
    path: string;
    name: string;
    basename: string;
}

export interface PandocEmbed {
    sourcePath: string;
    targetPath: string;
}

export interface PandocWorkspacePort {
    vaultPath(): Promise<string>;
    pluginPath(): Promise<string>;
    currentFile(): Promise<PandocCurrentFile | undefined>;
    readFrontmatter(filePath: string): Promise<Record<string, unknown>>;
    resolveEmbeds(filePath: string): Promise<PandocEmbed[]>;
    attachmentFolder(filePath: string): Promise<string>;
    loadSettings(): Promise<PandocExportSettings>;
    saveSettings(settings: PandocExportSettings): Promise<void>;
}

export interface PandocChooseFileRequest {
    defaultPath?: string;
    extensions?: string[];
}

export interface PandocChooseFolderRequest {
    defaultPath?: string;
}

export interface PandocProgressHandle {
    update(message: string): void;
    close(): void;
}

export interface PandocUserInteractionPort {
    chooseFile(request: PandocChooseFileRequest): Promise<string | undefined>;
    chooseFolder(request: PandocChooseFolderRequest): Promise<string | undefined>;
    confirmOverwrite(path: string): Promise<string | undefined>;
    showProgress(message: string): PandocProgressHandle;
    showError(message: string): void;
    showSuccess(message: string): void;
    openOutput(path: string): Promise<void>;
    revealOutput(path: string): Promise<void>;
}

export interface PandocOutputTarget {
    folder?: string;
    fileName?: string;
    overwrite?: boolean;
}

export type PandocProfileDraft = ProfileDraft;
export type PandocOptionRowPatch = Partial<Omit<ProfileOptionRow, 'id'>>;

export interface PandocPreviewPageSize {
    widthPx: number;
    heightPx: number;
    marginsPx?: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
    headerHeightPx?: number;
    footerHeightPx?: number;
}

export type PandocPreviewArtifactKind =
    'html' |
    'text' |
    'pdf' |
    'docx' |
    'epub' |
    'pptx' |
    'odt-addon' |
    'unsupported';

export interface PandocPreviewArtifact {
    kind: PandocPreviewArtifactKind;
    formatId?: string;
    rendererId?: string;
    label: string;
    filePath: string;
    sourcePath?: string;
    addonInstallPath?: string;
    addonVersion?: string;
    pageSize?: PandocPreviewPageSize;
    metadata?: Record<string, unknown>;
}

export interface PandocPreviewPlan {
    artifact?: PandocPreviewArtifact;
    profile?: ExportProfile;
    error?: string;
}

export interface PandocPreviewRendererPort {
    render(request: {
        artifact: PandocPreviewArtifact;
        readText: (path: string) => Promise<string>;
        readBinary: (path: string) => Promise<Uint8Array>;
    }): Promise<void>;
}

export interface PandocExportController {
    loadCatalog(): Promise<PandocOptionCatalog>;
    selectProfile(profileId: string): Promise<PandocProfileDraft>;
    editOptionRow(rowId: string, patch: PandocOptionRowPatch): Promise<PandocProfileDraft>;
    setOutputTarget(target: PandocOutputTarget): Promise<void>;
    refreshPreview(): Promise<PandocPreviewPlan>;
    export(): Promise<PandocExportResult>;
    cancel(): Promise<void>;
}
