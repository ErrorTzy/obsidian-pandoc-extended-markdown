import { dirname } from '../../core';
import { importDesktopModule } from './nodeModule';

type FsModule = typeof import('fs');

export interface PandocExportFileSystem {
    exists(path: string): Promise<boolean>;
    ensureDir(path: string): Promise<void>;
    readText?(path: string): Promise<string>;
    readBinary?(path: string): Promise<Uint8Array>;
    writeFile?(path: string, data: Uint8Array | string): Promise<void>;
    removeFile?(path: string): Promise<void>;
    removeDir?(path: string): Promise<void>;
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

    async readText(path: string): Promise<string> {
        const fs = await importFs();
        return fs.readFileSync(path, 'utf8');
    }

    async readBinary(path: string): Promise<Uint8Array> {
        const fs = await importFs();
        return new Uint8Array(fs.readFileSync(path));
    }

    async writeFile(path: string, data: Uint8Array | string): Promise<void> {
        const fs = await importFs();
        await this.ensureDir(path);
        fs.writeFileSync(path, data);
    }

    async removeFile(path: string): Promise<void> {
        const fs = await importFs();
        if (fs.existsSync(path)) {
            const stat = fs.statSync(path);
            if (stat.isDirectory()) {
                fs.rmSync(path, { recursive: true, force: true });
            } else {
                fs.unlinkSync(path);
            }
        }
    }

    async removeDir(path: string): Promise<void> {
        const fs = await importFs();
        if (fs.existsSync(path)) {
            fs.rmSync(path, { recursive: true, force: true });
        }
    }
}

async function importFs(): Promise<FsModule> {
    return importDesktopModule<FsModule>('fs');
}
