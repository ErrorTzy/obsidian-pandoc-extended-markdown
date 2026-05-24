type NodeRequire = (moduleName: string) => unknown;
type DesktopModuleName = 'child_process' | 'electron' | 'fs';

interface NodeRequireHost {
    require?: NodeRequire;
    window?: {
        require?: NodeRequire;
    };
}

export async function importDesktopModule<T>(moduleName: DesktopModuleName): Promise<T> {
    const requireFn = getNodeRequire();
    if (requireFn) {
        return requireFn(moduleName) as T;
    }

    return importDesktopModuleFallback<T>(moduleName);
}

function getNodeRequire(): NodeRequire | undefined {
    const host = globalThis as typeof globalThis & NodeRequireHost;

    return host.require ?? host.window?.require;
}

function importDesktopModuleFallback<T>(moduleName: DesktopModuleName): Promise<T> {
    switch (moduleName) {
        case 'child_process':
            // eslint-disable-next-line import/no-nodejs-modules -- Optional desktop-only Pandoc execution.
            return import('child_process') as Promise<T>;
        case 'electron':
            return import('electron') as Promise<T>;
        case 'fs':
            // eslint-disable-next-line import/no-nodejs-modules -- Optional desktop-only export filesystem access.
            return import('fs') as Promise<T>;
    }
}
