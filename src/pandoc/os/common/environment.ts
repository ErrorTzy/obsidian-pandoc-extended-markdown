import type {
    PandocPlatformInfo
} from '../../core';
import {
    LINUX_PANDOC_ENV_DEFAULTS
} from '../linux/environment';
import {
    MAC_PANDOC_ENV_DEFAULTS
} from '../mac/environment';
import {
    WINDOWS_PANDOC_ENV_DEFAULTS
} from '../win/environment';

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
