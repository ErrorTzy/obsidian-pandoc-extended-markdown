import type {
    PandocPlatformInfo
} from '../../core';

const LINUX_PANDOC_ENV_DEFAULTS: Record<string, string> = {};

const MAC_PANDOC_ENV_DEFAULTS: Record<string, string> = {
    PATH: '/opt/homebrew/bin:/usr/local/bin:/Library/TeX/texbin:${PATH}'
};

const WINDOWS_PANDOC_ENV_DEFAULTS: Record<string, string> = {
    TEXINPUTS: '${pluginDir}/textemplate/;'
};

export function getPandocPlatformEnvDefaults(
    platform: Pick<PandocPlatformInfo, 'os'>
): Record<string, string> {
    if (platform.os === 'windows') {
        return WINDOWS_PANDOC_ENV_DEFAULTS;
    }
    if (platform.os === 'mac') {
        return MAC_PANDOC_ENV_DEFAULTS;
    }
    if (platform.os === 'linux') {
        return LINUX_PANDOC_ENV_DEFAULTS;
    }

    return {};
}

export function getPandocRuntimeEnv(): Record<string, string> {
    const processLike = globalThis as typeof globalThis & {
        process?: { env?: Record<string, string | undefined> };
    };

    return normalizeRuntimeEnv(processLike.process?.env);
}

function normalizeRuntimeEnv(env?: Record<string, string | undefined>): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(env ?? {})) {
        if (value !== undefined) {
            result[key] = value;
        }
    }
    if (!result.HOME && result.USERPROFILE) {
        result.HOME = result.USERPROFILE;
    }

    return result;
}
