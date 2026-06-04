import {
    PandocProfileEditorModal as ObsidianPandocProfileEditorModal
} from './gui/obsidian/modals/PandocProfileEditorModal';
import type {
    PandocExportPluginLike
} from './gui/obsidian/modals/ExportModal';
import {
    createObsidianPandocOsDependencies
} from './obsidianDependencies';
import type {
    ObsidianPandocOsDependencyConfig
} from './obsidianDependencies';

export class PandocProfileEditorModal extends ObsidianPandocProfileEditorModal {
    constructor(
        plugin: PandocExportPluginLike,
        config: ObsidianPandocOsDependencyConfig = {}
    ) {
        super(plugin, createObsidianPandocOsDependencies(config).gui);
    }
}
