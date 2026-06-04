import {
    registerPandocExportCommands as registerObsidianPandocExportCommands
} from './gui/obsidian/commands/registerPandocCommands';
import type {
    PandocCommandPlugin
} from './gui/obsidian/commands/registerPandocCommands';
import {
    createObsidianPandocOsDependencies
} from './obsidianDependencies';
import type {
    ObsidianPandocOsDependencyConfig
} from './obsidianDependencies';

export function registerPandocExportCommands(
    plugin: PandocCommandPlugin,
    config: ObsidianPandocOsDependencyConfig = {}
): void {
    registerObsidianPandocExportCommands(
        plugin,
        createObsidianPandocOsDependencies(config).gui
    );
}

export type {
    PandocCommandPlugin
};
