import { joinPath } from '../../core';
import { importDesktopModule } from './nodeModule';

type OsModule = typeof import('os');

export interface PandocPreviewTempPathRequest {
    extension: string;
    runId: number;
    tempDir?: string;
    timestamp?: number;
}

export async function createPandocPreviewTempPath(
    request: PandocPreviewTempPathRequest
): Promise<string> {
    const dir = request.tempDir ?? await getDefaultPandocPreviewTempDir();
    const timestamp = request.timestamp ?? Date.now();

    return joinPath(dir, `pandoc-preview-${timestamp}-${request.runId}${request.extension}`);
}

export async function getDefaultPandocPreviewTempDir(): Promise<string> {
    const os = await importOs();
    return joinPath(os.tmpdir(), 'obsidian-pandoc-extended-markdown');
}

async function importOs(): Promise<OsModule> {
    return importDesktopModule<OsModule>('os');
}
