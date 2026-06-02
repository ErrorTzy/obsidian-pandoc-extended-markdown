import { requestUrl } from 'obsidian';
import { unzipSync } from 'fflate';

import type { PandocExportFileSystem } from './fileSystem';
import { NodePandocExportFileSystem } from './fileSystem';
import { importDesktopModule } from './nodeModule';
import { basename, joinPath } from './pathUtils';
import type { OdtPreviewAddonSettings } from './types';

export const WEBODF_ADDON_VERSION = '0.5.9';
export const WEBODF_ADDON_URL = 'https://webodf.org/download/webodf.js-0.5.9.zip';
export const WEBODF_ADDON_SHA256 = '115d5994f23b6d1503559c7f4e982555ad3f3b6a52383ac8a311d536cb9ad6ca';

export interface OdtPreviewAddonInstallRequest {
    installDir: string;
    fileSystem?: PandocExportFileSystem;
    download?: (url: string) => Promise<Uint8Array>;
    url?: string;
    version?: string;
    expectedSha256?: string;
}

export async function installOdtPreviewAddon(
    request: OdtPreviewAddonInstallRequest
): Promise<OdtPreviewAddonSettings> {
    const fileSystem = request.fileSystem ?? new NodePandocExportFileSystem();
    const version = request.version ?? WEBODF_ADDON_VERSION;
    const expectedSha256 = request.expectedSha256 ?? WEBODF_ADDON_SHA256;
    const url = request.url ?? WEBODF_ADDON_URL;
    const installPath = joinPath(request.installDir, `webodf-${version}`);

    try {
        const archive = await (request.download ?? downloadBytes)(url);
        const checksum = await sha256(archive);
        if (checksum !== expectedSha256) {
            throw new Error('Downloaded WebODF archive checksum did not match.');
        }

        await fileSystem.removeDir?.(installPath);
        await extractZip(archive, installPath, fileSystem);

        return {
            enabled: true,
            status: 'installed',
            version,
            checksum,
            installPath
        };
    } catch (error) {
        return {
            enabled: false,
            status: 'failed',
            version,
            checksum: expectedSha256,
            installPath,
            lastError: error instanceof Error ? error.message : String(error)
        };
    }
}

export async function removeOdtPreviewAddon(
    settings: OdtPreviewAddonSettings,
    fileSystem: PandocExportFileSystem = new NodePandocExportFileSystem()
): Promise<OdtPreviewAddonSettings> {
    if (settings.installPath) {
        await fileSystem.removeDir?.(settings.installPath);
    }

    return {
        enabled: false,
        status: 'not-installed'
    };
}

async function downloadBytes(url: string): Promise<Uint8Array> {
    const response = await requestUrl({ url });
    if (response.status < 200 || response.status >= 300) {
        throw new Error(`Download failed with status ${response.status}.`);
    }
    return new Uint8Array(response.arrayBuffer);
}

async function extractZip(
    archive: Uint8Array,
    installPath: string,
    fileSystem: PandocExportFileSystem
): Promise<void> {
    const files = unzipSync(archive);

    for (const [entryPath, content] of Object.entries(files)) {
        if (entryPath.endsWith('/')) continue;
        const safePath = safeArchivePath(entryPath);
        if (!safePath) continue;

        const outputPath = joinPath(installPath, safePath);
        await fileSystem.ensureDir(outputPath);
        await fileSystem.writeFile?.(outputPath, content);
    }
}

function safeArchivePath(path: string): string | undefined {
    const parts = path
        .split(/[\\/]/)
        .map(part => basename(part.trim()))
        .filter(part => part.length > 0 && part !== '.' && part !== '..');

    return parts.length > 0 ? parts.join('/') : undefined;
}

async function sha256(data: Uint8Array): Promise<string> {
    const crypto = await importDesktopModule<typeof import('crypto')>('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
}
