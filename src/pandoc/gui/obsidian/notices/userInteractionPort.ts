import type {
    PandocChooseFileRequest,
    PandocChooseFolderRequest,
    PandocProgressHandle,
    PandocUserInteractionPort
} from '../../../core';

export interface ObsidianPandocUserInteractionPortConfig {
    createNotice?: (message: string, timeout?: number) => PandocNoticeLike;
    desktop?: PandocDesktopActions;
}

interface PandocNoticeLike {
    hide?: () => void;
    setMessage?: (message: string) => void;
}

export interface PandocDesktopActions {
    chooseFile?(defaultPath?: string): Promise<string | undefined>;
    chooseFolder(defaultPath?: string): Promise<string | undefined>;
    confirmOverwrite(path: string): Promise<string | undefined>;
    openPath(path: string): Promise<void>;
    revealPath(path: string): Promise<void>;
}

export class ObsidianPandocUserInteractionPort implements PandocUserInteractionPort {
    private readonly createNotice: (message: string, timeout?: number) => PandocNoticeLike;
    private readonly desktop?: PandocDesktopActions;

    constructor(config: ObsidianPandocUserInteractionPortConfig = {}) {
        this.createNotice = config.createNotice ?? (() => ({}));
        this.desktop = config.desktop;
    }

    chooseFile(_request: PandocChooseFileRequest): Promise<string | undefined> {
        return this.desktop?.chooseFile?.(_request.defaultPath) ?? Promise.resolve(undefined);
    }

    chooseFolder(request: PandocChooseFolderRequest): Promise<string | undefined> {
        return this.desktop?.chooseFolder(request.defaultPath) ?? Promise.resolve(undefined);
    }

    confirmOverwrite(path: string): Promise<string | undefined> {
        return this.desktop?.confirmOverwrite(path) ?? Promise.resolve(undefined);
    }

    showProgress(message: string): PandocProgressHandle {
        const notice = this.createNotice(message, 0);
        return {
            update: nextMessage => {
                notice.setMessage?.(nextMessage);
            },
            close: () => {
                notice.hide?.();
            }
        };
    }

    showError(message: string): void {
        this.createNotice(message, 8000);
    }

    showSuccess(message: string): void {
        this.createNotice(message);
    }

    openOutput(path: string): Promise<void> {
        return this.desktop?.openPath(path) ?? Promise.resolve();
    }

    revealOutput(path: string): Promise<void> {
        return this.desktop?.revealPath(path) ?? Promise.resolve();
    }
}
