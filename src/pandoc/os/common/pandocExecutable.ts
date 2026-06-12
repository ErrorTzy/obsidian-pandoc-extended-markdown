import {
    DEFAULT_PANDOC_EXECUTABLE,
    normalizePandocExecutable
} from '../../core';
import {
    resolveWindowsPandocExecutable,
    type WindowsPandocWhereRunner
} from '../win/pandocExecutable';

type ProcessLike = {
    platform?: string;
};

export interface PandocExecutableResolverOptions {
    platform?: string;
    windowsWhereRunner?: WindowsPandocWhereRunner;
}

export async function resolvePandocExecutable(
    pandocPath?: string,
    options: PandocExecutableResolverOptions = {}
): Promise<string> {
    const executable = normalizePandocExecutable(pandocPath);

    if (executable !== DEFAULT_PANDOC_EXECUTABLE) {
        return executable;
    }

    if (platform(options) === 'win32') {
        return await resolveWindowsPandocExecutable({
            runWherePandoc: options.windowsWhereRunner
        }) ?? executable;
    }

    return executable;
}

function platform(options: PandocExecutableResolverOptions): string | undefined {
    return options.platform ?? processLike().platform;
}

function processLike(): ProcessLike {
    return (globalThis as typeof globalThis & { process?: ProcessLike }).process ?? {};
}
