import {
    createPandocExportRequestFromFile,
    PandocExportManager as ObsidianPandocExportManager
} from './gui/obsidian/export/PandocExportManager';
import type {
    PandocExportManagerConfig as ObsidianPandocExportManagerConfig
} from './gui/obsidian/export/PandocExportManager';
import {
    createObsidianPandocOsDependencies
} from './obsidianDependencies';
import type {
    ObsidianPandocOsDependencyConfig
} from './obsidianDependencies';

export interface PandocExportManagerConfig
    extends Omit<ObsidianPandocExportManagerConfig, 'platformEnvDefaults' | 'runtimeEnv' | 'system' | 'user'>,
    ObsidianPandocOsDependencyConfig {
}

export class PandocExportManager extends ObsidianPandocExportManager {
    constructor(config: PandocExportManagerConfig) {
        const dependencies = createObsidianPandocOsDependencies(config);
        super({
            ...config,
            platformEnvDefaults: dependencies.platformEnvDefaults,
            runtimeEnv: dependencies.runtimeEnv,
            system: dependencies.system,
            user: dependencies.user
        });
    }
}

export {
    createPandocExportRequestFromFile
};
