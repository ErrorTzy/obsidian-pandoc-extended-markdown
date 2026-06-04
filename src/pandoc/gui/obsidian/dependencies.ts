import type {
    PandocExportWorkflowUserPort,
    PandocSystemPort
} from '../../core';
import type {
    PandocCatalogProcess,
    PandocCatalogShellRunner
} from '../../core/catalog';
import type {
    OdtPreviewAddonSettings
} from '../../core';
import type {
    OdtPreviewAddonInstallRequest
} from './workspace/odtPreviewAddon';
import type {
    PandocPathBrowser
} from './modals/PandocPathBrowse';

export interface ObsidianPandocGuiDependencies {
    catalogProcess?: PandocCatalogProcess;
    catalogShellRunner?: PandocCatalogShellRunner;
    exportSystem: PandocSystemPort;
    exportUser: PandocExportWorkflowUserPort;
    installOdtPreviewAddon(
        request: Omit<OdtPreviewAddonInstallRequest, 'fileSystem' | 'hash'>
    ): Promise<OdtPreviewAddonSettings>;
    makePreviewTempPath(extension: string, runId: number): Promise<string>;
    pathBrowser?: PandocPathBrowser;
    platformEnvDefaults?: Record<string, string>;
    removeOdtPreviewAddon(settings: OdtPreviewAddonSettings): Promise<OdtPreviewAddonSettings>;
    runtimeEnv?: Record<string, string>;
}

export type OptionalObsidianPandocGuiDependencies = Partial<ObsidianPandocGuiDependencies>;
