import { importDesktopModule } from './nodeModule';

export interface PandocDesktopAdapter {
    chooseFolder(defaultPath?: string): Promise<string | undefined>;
    confirmOverwrite(path: string): Promise<string | undefined>;
    openPath(path: string): Promise<void>;
    revealPath(path: string): Promise<void>;
}

type ElectronModule = typeof import('electron');

export class ElectronPandocDesktopAdapter implements PandocDesktopAdapter {
    async chooseFile(defaultPath?: string): Promise<string | undefined> {
        const electron = await importElectron();
        const result = await electron.remote.dialog.showOpenDialog({
            defaultPath,
            properties: ['openFile']
        });

        return result.canceled ? undefined : result.filePaths[0];
    }

    async chooseFolder(defaultPath?: string): Promise<string | undefined> {
        const electron = await importElectron();
        const result = await electron.remote.dialog.showOpenDialog({
            defaultPath,
            properties: ['createDirectory', 'openDirectory']
        });

        return result.canceled ? undefined : result.filePaths[0];
    }

    async confirmOverwrite(path: string): Promise<string | undefined> {
        const electron = await importElectron();
        const result = await electron.remote.dialog.showSaveDialog({
            defaultPath: path,
            properties: ['showOverwriteConfirmation', 'createDirectory']
        });

        return result.canceled ? undefined : result.filePath;
    }

    async openPath(path: string): Promise<void> {
        const electron = await importElectron();
        await electron.remote.shell.openPath(path);
    }

    async revealPath(path: string): Promise<void> {
        const electron = await importElectron();
        electron.remote.shell.showItemInFolder(path);
    }
}

async function importElectron(): Promise<ElectronModule> {
    return importDesktopModule<ElectronModule>('electron');
}
