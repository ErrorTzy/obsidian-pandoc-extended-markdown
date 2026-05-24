import { dirname } from './pathUtils';
import { importDesktopModule } from './nodeModule';

type FsModule = typeof import('fs');

export interface PandocExportFileSystem {
    exists(path: string): Promise<boolean>;
    ensureDir(path: string): Promise<void>;
}

export class NodePandocExportFileSystem implements PandocExportFileSystem {
    async exists(path: string): Promise<boolean> {
        const fs = await importFs();
        return fs.existsSync(path);
    }

    async ensureDir(path: string): Promise<void> {
        const fs = await importFs();
        const dir = dirname(path);

        if (dir.length > 0 && !fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}

async function importFs(): Promise<FsModule> {
    return importDesktopModule<FsModule>('fs');
}
