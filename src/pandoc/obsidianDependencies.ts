import {
    CommonPandocSystemPort,
    ElectronPandocDesktopAdapter,
    getPandocPlatformEnvDefaults,
    getPandocRuntimeEnv,
    NodePandocExportFileSystem,
    PandocService,
    createPandocPreviewTempPath,
    runShellCommand,
    type PandocDesktopAdapter,
    type PandocExportFileSystem,
    type ShellRunner
} from './os/common';
import {
    ObsidianPandocUserInteractionPort
} from './gui/obsidian/notices/userInteractionPort';
import type {
    PandocSystemPort
} from './core';
import type {
    PandocExportWorkflowUserPort
} from './core';
import type {
    ObsidianPandocGuiDependencies
} from './gui/obsidian/dependencies';

export interface ObsidianPandocOsDependencyConfig {
    desktop?: PandocDesktopAdapter;
    fileSystem?: PandocExportFileSystem;
    service?: PandocService;
    shellRunner?: ShellRunner;
    system?: PandocSystemPort;
    runtimeEnv?: Record<string, string>;
}

export interface ObsidianPandocOsDependencies {
    desktop: PandocDesktopAdapter;
    fileSystem: PandocExportFileSystem;
    gui: ObsidianPandocGuiDependencies;
    platformEnvDefaults: Record<string, string>;
    runtimeEnv: Record<string, string>;
    system: PandocSystemPort;
    user: PandocExportWorkflowUserPort;
}

export function createObsidianPandocOsDependencies(
    config: ObsidianPandocOsDependencyConfig = {}
): ObsidianPandocOsDependencies {
    const desktop = config.desktop ?? new ElectronPandocDesktopAdapter();
    const fileSystem = config.fileSystem ?? new NodePandocExportFileSystem();
    const service = config.service ?? new PandocService();
    const system = config.system ?? new CommonPandocSystemPort({
        service,
        fileSystem,
        shellRunner: config.shellRunner ?? runShellCommand
    });
    const userPort = new ObsidianPandocUserInteractionPort({ desktop });

    const platformEnvDefaults = getPandocPlatformEnvDefaults(system.platform());
    const runtimeEnv = config.runtimeEnv ?? getPandocRuntimeEnv();
    const user: PandocExportWorkflowUserPort = {
        confirmOverwrite: path => userPort.confirmOverwrite(path),
        openOutput: path => userPort.openOutput(path),
        revealOutput: path => userPort.revealOutput(path)
    };
    const gui: ObsidianPandocGuiDependencies = {
        catalogProcess: service,
        catalogShellRunner: config.shellRunner ?? runShellCommand,
        exportSystem: system,
        exportUser: user,
        installOdtPreviewAddon: async request => {
            const { installOdtPreviewAddon } = await import('./gui/obsidian/workspace/odtPreviewAddon');
            return installOdtPreviewAddon({
                ...request,
                fileSystem,
                hash: data => system.hash?.(data) ?? Promise.resolve('')
            });
        },
        makePreviewTempPath: (extension, runId) => createPandocPreviewTempPath({
            extension,
            runId
        }),
        pathBrowser: desktop,
        platformEnvDefaults,
        runtimeEnv,
        removeOdtPreviewAddon: async settings => {
            const { removeOdtPreviewAddon } = await import('./gui/obsidian/workspace/odtPreviewAddon');
            return removeOdtPreviewAddon(settings, fileSystem);
        }
    };

    return {
        desktop,
        fileSystem,
        gui,
        platformEnvDefaults,
        runtimeEnv,
        system,
        user
    };
}
