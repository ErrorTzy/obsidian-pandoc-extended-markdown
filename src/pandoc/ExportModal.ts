import type { TFile } from 'obsidian';

import {
    PandocExportModal as ObsidianPandocExportModal
} from './gui/obsidian/modals/ExportModal';
import type {
    PandocExportPluginLike
} from './gui/obsidian/modals/ExportModal';
import {
    createObsidianPandocOsDependencies
} from './obsidianDependencies';
import type {
    ObsidianPandocOsDependencyConfig
} from './obsidianDependencies';

export class PandocExportModal extends ObsidianPandocExportModal {
    constructor(
        plugin: PandocExportPluginLike,
        currentFile: TFile,
        config: ObsidianPandocOsDependencyConfig = {}
    ) {
        super(plugin, currentFile, createObsidianPandocOsDependencies(config).gui);
    }
}

export type {
    PandocExportPluginLike
};
