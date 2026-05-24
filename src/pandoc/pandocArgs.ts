import { PandocConvertRequest } from './types';

export function buildPandocConvertArgs(request: PandocConvertRequest): string[] {
    const args: string[] = [];

    if (request.inputPath) {
        args.push(request.inputPath);
    }

    if (request.from) {
        args.push('-f', request.from);
    }

    args.push('-t', request.to);

    if (request.outputPath) {
        args.push('-o', request.outputPath);
    }

    if (request.standalone) {
        args.push('--standalone');
    }

    appendRepeatedPathOption(args, '--resource-path', request.resourcePaths);
    appendRepeatedPathOption(args, '--lua-filter', request.luaFilters);
    appendMetadataArgs(args, request.metadata);

    return [...args, ...(request.extraArgs ?? [])];
}

function appendRepeatedPathOption(
    args: string[],
    option: string,
    paths?: string[]
): void {
    for (const value of paths ?? []) {
        if (value.length > 0) {
            args.push(option, value);
        }
    }
}

function appendMetadataArgs(args: string[], metadata?: Record<string, string>): void {
    for (const [key, value] of Object.entries(metadata ?? {})) {
        args.push('--metadata', `${key}=${value}`);
    }
}
