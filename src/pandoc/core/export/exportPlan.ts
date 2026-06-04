import { dirname, joinPath } from '../utils/pathUtils';
import type {
    ExportProfile,
    PandocExportRequest,
    PandocExportSettings,
    PandocRunResult
} from './types';

export interface ResolveDefaultOutputFolderRequest {
    settings: PandocExportSettings;
    currentFilePath: string;
    vaultDir: string;
    fullCurrentPath?: string;
}

export function selectExportProfile(
    settings: PandocExportSettings,
    profileId?: string
): ExportProfile | undefined {
    const id = profileId ?? settings.lastExportProfileId;
    return settings.profiles.find(profile => profile.id === id) ?? settings.profiles[0];
}

export function resolveExportOutputPath(
    request: PandocExportRequest,
    profile: ExportProfile,
    defaultOutputFolder: string
): string {
    const outputFolder = request.outputFolder ?? defaultOutputFolder;
    const outputFileName = request.outputFileName ||
        `${request.currentFileBaseName}${profile.extension}`;

    return joinPath(outputFolder, outputFileName);
}

export function resolveDefaultOutputFolder(request: ResolveDefaultOutputFolderRequest): string {
    const { settings } = request;
    if (settings.defaultOutputFolderMode === 'custom' && settings.customOutputFolder) {
        return settings.customOutputFolder;
    }
    if (settings.defaultOutputFolderMode === 'last' && settings.lastOutputFolder) {
        return settings.lastOutputFolder;
    }
    if (settings.defaultOutputFolderMode === 'vault') {
        return request.vaultDir;
    }

    return dirname(request.fullCurrentPath ?? request.currentFilePath);
}

export function createCustomShellDisabledResult(commandTemplate: string): PandocRunResult {
    return {
        executable: commandTemplate,
        args: [],
        exitCode: 1,
        signal: null,
        stdout: '',
        stderr: 'Custom shell profile is not explicitly enabled.',
        error: 'Custom shell profile is not explicitly enabled.',
        timedOut: false,
        durationMs: 0,
        ok: false
    };
}
