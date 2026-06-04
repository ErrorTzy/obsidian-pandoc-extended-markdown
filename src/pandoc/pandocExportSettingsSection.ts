import {
    renderPandocExportSettingsSection as renderObsidianPandocExportSettingsSection
} from './gui/obsidian/settings/pandocExportSettingsSection';
import type {
    PandocExportSettingsPlugin
} from './gui/obsidian/settings/pandocExportSettingsSection';
import {
    createObsidianPandocOsDependencies
} from './obsidianDependencies';
import type {
    ObsidianPandocOsDependencyConfig
} from './obsidianDependencies';

export function renderPandocExportSettingsSection(
    plugin: PandocExportSettingsPlugin,
    containerEl: HTMLElement,
    config: ObsidianPandocOsDependencyConfig = {}
): void {
    renderObsidianPandocExportSettingsSection(
        plugin,
        containerEl,
        createObsidianPandocOsDependencies(config).gui
    );
}

export type {
    PandocExportSettingsPlugin
};
