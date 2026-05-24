import {
    cloneDefaultProfiles,
    DEFAULT_PANDOC_EXPORT_SETTINGS
} from './defaultProfiles';
import {
    ExportProfile,
    PandocExportSettings,
    PandocOutputFolderMode
} from './types';

const OUTPUT_FOLDER_MODES = new Set<PandocOutputFolderMode>([
    'last',
    'current',
    'vault',
    'custom'
]);

export function normalizePandocExportSettings(
    settings?: Partial<PandocExportSettings>
): PandocExportSettings {
    const source = settings ?? {};
    const profiles = normalizeProfiles(source.profiles);

    return {
        enabled: source.enabled ?? DEFAULT_PANDOC_EXPORT_SETTINGS.enabled,
        pandocPath: source.pandocPath ?? DEFAULT_PANDOC_EXPORT_SETTINGS.pandocPath,
        defaultOutputFolderMode: normalizeFolderMode(source.defaultOutputFolderMode),
        customOutputFolder: source.customOutputFolder ?? '',
        env: { ...(source.env ?? {}) },
        profiles,
        lastExportProfileId: source.lastExportProfileId,
        lastOutputFolder: source.lastOutputFolder,
        showOverwriteConfirmation: source.showOverwriteConfirmation ??
            DEFAULT_PANDOC_EXPORT_SETTINGS.showOverwriteConfirmation,
        openOutputFile: source.openOutputFile ?? DEFAULT_PANDOC_EXPORT_SETTINGS.openOutputFile,
        revealOutputFile: source.revealOutputFile ?? DEFAULT_PANDOC_EXPORT_SETTINGS.revealOutputFile,
        showProgress: source.showProgress ?? DEFAULT_PANDOC_EXPORT_SETTINGS.showProgress
    };
}

function normalizeFolderMode(mode?: PandocOutputFolderMode): PandocOutputFolderMode {
    if (mode && OUTPUT_FOLDER_MODES.has(mode)) {
        return mode;
    }

    return DEFAULT_PANDOC_EXPORT_SETTINGS.defaultOutputFolderMode;
}

function normalizeProfiles(profiles?: ExportProfile[]): ExportProfile[] {
    const defaults = cloneDefaultProfiles();
    const merged = new Map<string, ExportProfile>();

    for (const profile of profiles ?? []) {
        if (isValidProfile(profile)) {
            merged.set(profile.id, { ...profile });
        }
    }

    for (const profile of defaults) {
        merged.set(profile.id, { ...profile, ...(merged.get(profile.id) ?? {}) });
    }

    return Array.from(merged.values());
}

function isValidProfile(profile: ExportProfile | undefined): profile is ExportProfile {
    return Boolean(profile?.id && profile.name && profile.extension && profile.type);
}
