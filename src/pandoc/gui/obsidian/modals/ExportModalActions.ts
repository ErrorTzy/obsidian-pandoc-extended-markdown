import {
    createModalExportManager
} from './ExportModalContext';
import type {
    ObsidianPandocGuiDependencies
} from '../dependencies';
import {
    type ExportProfile,
    type PandocControllerPreviewRequest,
    type PandocCoreExportController,
    type PandocExportSettings,
    type PandocPreviewArtifactKind,
    type PandocPreviewPlan,
    selectPreviewRendererPlan
} from '../../../core';
import { PandocPreviewManager } from '../previewManager';
import type { PandocExportPluginLike } from './ExportModal';

interface ExportModalActionsConfig {
    plugin: PandocExportPluginLike;
    dependencies: ObsidianPandocGuiDependencies;
    getController(): PandocCoreExportController | undefined;
    getPreviewBodyEl(): HTMLElement | undefined;
    getProfile(): ExportProfile;
    setPreviewStatus(text: string): void;
    setPreviewMessage(text: string): void;
    close(): void;
}

export class PandocExportModalActions {
    private readonly config: ExportModalActionsConfig;
    private previewManager?: PandocPreviewManager;
    private refreshTimer?: number;
    private previewInFlight = false;
    private previewQueued = false;

    constructor(config: ExportModalActionsConfig) {
        this.config = config;
    }

    cleanup(): Promise<void> | undefined {
        window.clearTimeout(this.refreshTimer);
        return this.previewManager?.cleanup();
    }

    refreshPreviewDebounced(delay = this.previewDelayMs()): void {
        window.clearTimeout(this.refreshTimer);
        this.refreshTimer = window.setTimeout(() => {
            void this.refreshPreview();
        }, delay);
    }

    async refreshPreview(): Promise<void> {
        const container = this.config.getPreviewBodyEl();
        const controller = this.config.getController();
        if (!container || !controller) return;

        if (this.previewInFlight) {
            this.previewQueued = true;
            this.config.setPreviewStatus('Preview pending');
            return;
        }
        this.config.setPreviewStatus('Refreshing...');
        container.empty();
        container.createEl('p', {
            cls: 'pem-pandoc-preview-message',
            text: 'Rendering preview...'
        });

        this.previewInFlight = true;
        try {
            const result = await controller.refreshPreview();
            if (!result.artifact && !result.error) {
                this.config.setPreviewStatus('Preview pending');
                return;
            }

            this.config.setPreviewStatus(result.error ?
                this.statusForPreviewError(result.error) :
                'Preview ready'
            );
            if (result.error) {
                this.config.setPreviewMessage(result.error);
            }
        } catch (error) {
            this.config.setPreviewStatus('Preview failed');
            this.config.setPreviewMessage(error instanceof Error ? error.message : String(error));
        } finally {
            this.previewInFlight = false;
            if (this.previewQueued) {
                this.previewQueued = false;
                this.refreshPreviewDebounced(0);
            }
        }
    }

    async export(): Promise<void> {
        const controller = this.config.getController();
        if (!controller) return;

        const result = await controller.export();
        if (result.ok) {
            this.config.close();
        }
    }

    async renderPreview(request: PandocControllerPreviewRequest): Promise<PandocPreviewPlan> {
        const container = this.config.getPreviewBodyEl();
        if (!container) {
            return { error: 'Pandoc preview container is not ready.' };
        }

        const result = await this.getPreviewManager().refresh({ ...request, container });
        if (!result) return {};
        if (!result.ok || !result.outputPath) {
            return {
                profile: result.profile,
                error: result.error ?? 'Pandoc preview failed.'
            };
        }

        const renderer = selectPreviewRendererPlan(
            request.to,
            request.extension,
            this.settings().preview.odtAddon
        );
        return {
            profile: result.profile,
            artifact: {
                kind: artifactKind(renderer.kind),
                label: renderer.label,
                filePath: result.outputPath
            }
        };
    }

    private getPreviewManager(): PandocPreviewManager {
        if (!this.previewManager) {
            this.previewManager = new PandocPreviewManager({
                exportManager: {
                    previewFile: (request, outputPath) =>
                        createModalExportManager(
                            this.config.plugin,
                            this.config.getProfile(),
                            false,
                            this.config.dependencies
                        )
                            .previewFile(request, outputPath),
                    convertPreviewFile: (inputPath, outputPath, to, cwd) =>
                        createModalExportManager(
                            this.config.plugin,
                            this.config.getProfile(),
                            false,
                            this.config.dependencies
                        )
                            .convertPreviewFile(inputPath, outputPath, to, cwd)
                },
                settings: this.settings(),
                makeTempPath: (extension, runId) =>
                    this.config.dependencies.makePreviewTempPath(extension, runId),
                system: this.config.dependencies.exportSystem
            });
        }

        return this.previewManager;
    }

    private previewDelayMs(): number {
        return this.settings().preview.debounceMs;
    }

    private statusForPreviewError(error: string): string {
        if (error.startsWith('Enable Pandoc preview')) return 'Preview disabled';
        if (error.startsWith('Preview is available')) return 'Preview unavailable';
        if (error.startsWith('Fix command errors')) return 'Preview blocked';

        return 'Preview failed';
    }

    private settings(): PandocExportSettings {
        return this.config.plugin.settings.pandocExport!;
    }
}

function artifactKind(kind: string): PandocPreviewArtifactKind {
    return kind === 'odt-pandoc-fallback' ? 'paged-html' : kind as PandocPreviewArtifactKind;
}
