import {
    installOdtPreviewAddon as installObsidianOdtPreviewAddon,
    removeOdtPreviewAddon as removeObsidianOdtPreviewAddon,
    WEBODF_ADDON_SHA256,
    WEBODF_ADDON_URL,
    WEBODF_ADDON_VERSION
} from './gui/obsidian/workspace/odtPreviewAddon';
import type {
    OdtPreviewAddonFileSystem,
    OdtPreviewAddonInstallRequest as ObsidianOdtPreviewAddonInstallRequest
} from './gui/obsidian/workspace/odtPreviewAddon';
import {
    NodePandocExportFileSystem,
    sha256Hex
} from './os/common';
import type {
    OdtPreviewAddonSettings
} from './core';

export interface OdtPreviewAddonInstallRequest
    extends Omit<ObsidianOdtPreviewAddonInstallRequest, 'fileSystem' | 'hash'> {
    fileSystem?: OdtPreviewAddonFileSystem;
}

export function installOdtPreviewAddon(
    request: OdtPreviewAddonInstallRequest
): Promise<OdtPreviewAddonSettings> {
    return installObsidianOdtPreviewAddon({
        ...request,
        fileSystem: request.fileSystem ?? new NodePandocExportFileSystem(),
        hash: sha256Hex
    });
}

export function removeOdtPreviewAddon(
    settings: OdtPreviewAddonSettings,
    fileSystem: Pick<OdtPreviewAddonFileSystem, 'removeDir'> = new NodePandocExportFileSystem()
): Promise<OdtPreviewAddonSettings> {
    return removeObsidianOdtPreviewAddon(settings, fileSystem);
}

export {
    WEBODF_ADDON_SHA256,
    WEBODF_ADDON_URL,
    WEBODF_ADDON_VERSION
};
