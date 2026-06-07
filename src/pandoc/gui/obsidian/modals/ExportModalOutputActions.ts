import {
    renderOutputActionOptions
} from './ExportModalRenderers';
import type {
    PandocCoreExportController
} from '../../../core';
import type {
    PandocExportPluginLike
} from './ExportModal';

export function renderExportModalOutputActions(
    container: HTMLElement,
    plugin: PandocExportPluginLike,
    controller: PandocCoreExportController
): void {
    const settings = plugin.settings.pandocExport;
    if (!settings) return;

    renderOutputActionOptions(container, { settings }, {
        onShowOverwriteConfirmationChange: value => {
            settings.showOverwriteConfirmation = value;
            void controller.setOutputTarget({ overwrite: !value });
            void plugin.saveSettings();
        },
        onOpenOutputFileChange: value => {
            settings.openOutputFile = value;
            void plugin.saveSettings();
        },
        onRevealOutputFileChange: value => {
            settings.revealOutputFile = value;
            void plugin.saveSettings();
        }
    });
}
