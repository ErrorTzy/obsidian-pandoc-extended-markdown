import { extname } from '../utils/pathUtils';

export interface PandocPreviewRun {
    id: number;
    outputPath: string;
}

export interface PandocPreviewSessionPort {
    makeTempPath(extension: string, runId: number): Promise<string>;
    removeFile(path: string): Promise<void>;
}

export class PandocPreviewSession {
    private readonly port: PandocPreviewSessionPort;
    private readonly tempFiles = new Set<string>();
    private runId = 0;

    constructor(port: PandocPreviewSessionPort) {
        this.port = port;
    }

    async beginRun(extension: string): Promise<PandocPreviewRun> {
        this.runId += 1;
        const run = {
            id: this.runId,
            outputPath: await this.createTrackedTempPath(extension, this.runId)
        };

        return run;
    }

    isCurrentRun(run: PandocPreviewRun): boolean {
        return run.id === this.runId;
    }

    async removeIfStale(run: PandocPreviewRun): Promise<boolean> {
        if (this.isCurrentRun(run)) {
            return false;
        }

        await this.removeTempFile(run.outputPath);
        return true;
    }

    createTempFile(run: PandocPreviewRun, extension: string): Promise<string> {
        return this.createTrackedTempPath(extension, run.id);
    }

    async cleanup(): Promise<void> {
        this.runId += 1;
        const paths = Array.from(this.tempFiles);
        this.tempFiles.clear();

        await Promise.all(paths.map(path => this.port.removeFile(path)));
    }

    private async createTrackedTempPath(extension: string, runId: number): Promise<string> {
        const path = await this.port.makeTempPath(normalizePreviewExtension(extension), runId);
        this.tempFiles.add(path);

        return path;
    }

    private async removeTempFile(path: string): Promise<void> {
        this.tempFiles.delete(path);
        await this.port.removeFile(path);
    }
}

export function normalizePreviewExtension(extension: string): string {
    const existing = extname(extension);
    const value = existing || extension;
    if (!value) return '.html';
    return value.startsWith('.') ? value : `.${value}`;
}
