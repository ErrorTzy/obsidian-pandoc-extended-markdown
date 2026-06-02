import { importDesktopModule } from './nodeModule';
import { extname, joinPath } from './pathUtils';
import {
    renderPreviewFile,
    selectPreviewRenderer,
    type PandocPreviewRenderer
} from './previewRenderers';
import type { PandocExportManager } from './PandocExportManager';
import type { PandocExportFileSystem } from './fileSystem';
import { NodePandocExportFileSystem } from './fileSystem';
import type {
    PandocExportRequest,
    PandocExportResult,
    PandocExportSettings
} from './types';

export interface PandocPreviewManagerConfig {
    exportManager: Pick<PandocExportManager, 'previewFile' | 'convertPreviewFile'>;
    settings: PandocExportSettings;
    fileSystem?: PandocExportFileSystem;
    tempDir?: string;
    renderFile?: typeof renderPreviewFile;
}

export interface PandocPreviewRefreshRequest {
    request: PandocExportRequest;
    to: string;
    extension: string;
    container: HTMLElement;
}

export class PandocPreviewManager {
    private readonly config: PandocPreviewManagerConfig;
    private readonly fileSystem: PandocExportFileSystem;
    private readonly tempFiles = new Set<string>();
    private runId = 0;

    constructor(config: PandocPreviewManagerConfig) {
        this.config = config;
        this.fileSystem = config.fileSystem ?? new NodePandocExportFileSystem();
    }

    async refresh(request: PandocPreviewRefreshRequest): Promise<PandocExportResult | undefined> {
        const runId = this.nextRunId();
        const renderer = selectPreviewRenderer(
            request.to,
            request.extension,
            this.config.settings.preview.odtAddon
        );
        const outputPath = await this.createTempPath(request.extension, runId);
        this.trackTempFile(outputPath);

        const result = await this.config.exportManager.previewFile(request.request, outputPath);
        if (!this.isCurrentRun(runId)) {
            await this.removeTempFile(outputPath);
            return undefined;
        }
        if (!result.ok || !result.outputPath) {
            return result;
        }

        return this.renderResult(request.container, result.outputPath, renderer, runId, result);
    }

    async cleanup(): Promise<void> {
        this.runId += 1;
        const paths = Array.from(this.tempFiles);
        this.tempFiles.clear();

        await Promise.all(paths.map(async path => {
            await this.fileSystem.removeFile?.(path);
        }));
    }

    private async renderResult(
        container: HTMLElement,
        outputPath: string,
        renderer: PandocPreviewRenderer,
        runId: number,
        result: PandocExportResult
    ): Promise<PandocExportResult | undefined> {
        const renderPath = renderer.kind === 'odt-pandoc-fallback' ?
            await this.renderOdtFallback(outputPath, runId) :
            outputPath;
        const renderKind = renderer.kind === 'odt-pandoc-fallback' ?
            { kind: 'html' as const, label: 'ODT fallback preview' } :
            renderer;

        if (!this.isCurrentRun(runId)) return undefined;
        await (this.config.renderFile ?? renderPreviewFile)({
            container,
            filePath: renderPath,
            renderer: renderKind,
            readText: path => this.readText(path),
            readBinary: path => this.readBinary(path)
        });

        return result;
    }

    private async renderOdtFallback(outputPath: string, runId: number): Promise<string> {
        const fallbackPath = await this.createTempPath('.html', runId);
        this.trackTempFile(fallbackPath);
        const result = await this.config.exportManager.convertPreviewFile(
            outputPath,
            fallbackPath,
            'html',
            undefined
        );
        if (!result.ok) {
            throw new Error(result.error ?? 'ODT fallback preview failed.');
        }

        return fallbackPath;
    }

    private nextRunId(): number {
        this.runId += 1;
        return this.runId;
    }

    private isCurrentRun(runId: number): boolean {
        return runId === this.runId;
    }

    private trackTempFile(path: string): void {
        this.tempFiles.add(path);
    }

    private async removeTempFile(path: string): Promise<void> {
        this.tempFiles.delete(path);
        await this.fileSystem.removeFile?.(path);
    }

    private async readText(path: string): Promise<string> {
        if (!this.fileSystem.readText) {
            throw new Error('Preview file reading is unavailable.');
        }

        return this.fileSystem.readText(path);
    }

    private async readBinary(path: string): Promise<Uint8Array> {
        if (!this.fileSystem.readBinary) {
            throw new Error('Preview binary reading is unavailable.');
        }

        return this.fileSystem.readBinary(path);
    }

    private async createTempPath(extension: string, runId: number): Promise<string> {
        const dir = this.config.tempDir ?? await getDefaultPreviewTempDir();
        const normalizedExtension = normalizeExtension(extension);
        return joinPath(dir, `pandoc-preview-${Date.now()}-${runId}${normalizedExtension}`);
    }
}

async function getDefaultPreviewTempDir(): Promise<string> {
    const os = await importDesktopModule<typeof import('os')>('os');
    return joinPath(os.tmpdir(), 'obsidian-pandoc-extended-markdown');
}

function normalizeExtension(extension: string): string {
    const existing = extname(extension);
    const value = existing || extension;
    if (!value) return '.html';
    return value.startsWith('.') ? value : `.${value}`;
}
