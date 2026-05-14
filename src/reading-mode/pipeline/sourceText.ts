import { ObsidianAppLike } from './types';

export async function readFullSourceText(
    sourcePath?: string,
    suppliedApp?: ObsidianAppLike
): Promise<string | undefined> {
    const app = suppliedApp ?? getObsidianApp();
    const vault = app?.vault;
    const activeFile = app?.workspace?.getActiveFile?.();
    const path = sourcePath ?? activeFile?.path;

    if (!path) {
        return undefined;
    }

    const file = activeFile?.path === path
        ? activeFile
        : vault?.getAbstractFileByPath(path);
    if (!file || typeof vault?.cachedRead !== 'function') {
        return undefined;
    }

    try {
        return await vault.cachedRead(file);
    } catch {
        return undefined;
    }
}

function getObsidianApp(): ObsidianAppLike | undefined {
    const globalWindow = window as Window & {
        app?: ObsidianAppLike;
    };

    return globalWindow.app;
}
