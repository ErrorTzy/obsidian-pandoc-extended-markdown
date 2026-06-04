import {
    PandocPreviewManager as ObsidianPandocPreviewManager
} from './gui/obsidian/previewManager';
import type {
    PandocPreviewManagerConfig as ObsidianPandocPreviewManagerConfig,
    PandocPreviewRefreshRequest
} from './gui/obsidian/previewManager';
import {
    CommonPandocSystemPort,
    createPandocPreviewTempPath,
    NodePandocExportFileSystem
} from './os/common';
import type {
    PandocExportFileSystem
} from './os/common';

export interface PandocPreviewManagerConfig
    extends Omit<ObsidianPandocPreviewManagerConfig, 'makeTempPath' | 'system'> {
    fileSystem?: PandocExportFileSystem;
    tempDir?: string;
}

export class PandocPreviewManager extends ObsidianPandocPreviewManager {
    constructor(config: PandocPreviewManagerConfig) {
        const fileSystem = config.fileSystem ?? new NodePandocExportFileSystem();
        super({
            ...config,
            makeTempPath: (extension, runId) => createPandocPreviewTempPath({
                extension,
                runId,
                tempDir: config.tempDir
            }),
            system: new CommonPandocSystemPort({ fileSystem })
        });
    }
}

export type {
    PandocPreviewRefreshRequest
};
