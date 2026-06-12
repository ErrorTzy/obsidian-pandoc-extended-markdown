import { importDesktopModule } from '../common/nodeModule';

type ChildProcessModule = typeof import('child_process');

export type WindowsPandocWhereRunner = () => Promise<string | undefined>;

export interface WindowsPandocExecutableResolverOptions {
    runWherePandoc?: WindowsPandocWhereRunner;
}

export async function resolveWindowsPandocExecutable(
    options: WindowsPandocExecutableResolverOptions = {}
): Promise<string | undefined> {
    return (options.runWherePandoc ?? findPandocWithWhere)();
}

async function findPandocWithWhere(): Promise<string | undefined> {
    const childProcess = await importChildProcess();

    return new Promise(resolve => {
        childProcess.execFile('where.exe', ['pandoc'], {
            windowsHide: true
        }, (error, stdout) => {
            if (error) {
                resolve(undefined);
                return;
            }

            resolve(firstOutputLine(stdout));
        });
    });
}

async function importChildProcess(): Promise<ChildProcessModule> {
    return importDesktopModule<ChildProcessModule>('child_process');
}

function firstOutputLine(stdout: string): string | undefined {
    return stdout
        .split(/\r?\n/)
        .map(line => line.trim())
        .find(line => line.length > 0);
}
