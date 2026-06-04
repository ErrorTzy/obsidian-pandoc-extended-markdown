import { importDesktopModule } from './nodeModule';

type CryptoModule = typeof import('crypto');

export async function sha256Hex(data: Uint8Array | string): Promise<string> {
    const crypto = await importCrypto();
    return crypto.createHash('sha256').update(data).digest('hex');
}

async function importCrypto(): Promise<CryptoModule> {
    return importDesktopModule<CryptoModule>('crypto');
}
