import {
    cloneDefaultProfiles,
    DEFAULT_PANDOC_EXPORT_SETTINGS
} from './defaultProfiles';
import {
    ExportProfile,
    OdtPreviewAddonInstallStatus,
    OdtPreviewAddonSettings,
    PandocExportSettings,
    PandocOutputFolderMode,
    PandocPreviewSettings
} from '../export/types';

const OUTPUT_FOLDER_MODES = new Set<PandocOutputFolderMode>([
    'last',
    'current',
    'vault',
    'custom'
]);

const ODT_ADDON_STATUSES = new Set<OdtPreviewAddonInstallStatus>([
    'not-installed',
    'installed',
    'failed'
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
        showProgress: source.showProgress ?? DEFAULT_PANDOC_EXPORT_SETTINGS.showProgress,
        suggestRuntimeEnvVariables: source.suggestRuntimeEnvVariables ??
            DEFAULT_PANDOC_EXPORT_SETTINGS.suggestRuntimeEnvVariables,
        preview: normalizePreviewSettings(source.preview)
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

function normalizePreviewSettings(settings?: Partial<PandocPreviewSettings>): PandocPreviewSettings {
    const defaults = DEFAULT_PANDOC_EXPORT_SETTINGS.preview;
    return {
        enabled: settings?.enabled ?? defaults.enabled,
        debounceMs: normalizeDebounceMs(settings?.debounceMs ?? defaults.debounceMs),
        odtAddon: normalizeOdtAddonSettings(settings?.odtAddon)
    };
}

function normalizeOdtAddonSettings(settings?: Partial<OdtPreviewAddonSettings>): OdtPreviewAddonSettings {
    const defaults = DEFAULT_PANDOC_EXPORT_SETTINGS.preview.odtAddon;
    const status = settings?.status && ODT_ADDON_STATUSES.has(settings.status) ?
        settings.status :
        defaults.status;

    return {
        enabled: settings?.enabled ?? defaults.enabled,
        status,
        version: settings?.version,
        checksum: settings?.checksum,
        installPath: settings?.installPath,
        lastError: settings?.lastError
    };
}

function normalizeDebounceMs(value: number): number {
    if (!Number.isFinite(value)) return DEFAULT_PANDOC_EXPORT_SETTINGS.preview.debounceMs;
    return Math.max(250, Math.min(5000, Math.round(value)));
}
