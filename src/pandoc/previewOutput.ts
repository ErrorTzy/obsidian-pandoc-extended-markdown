const OUTPUT_OPTIONS = new Set(['-o', '--output']);

export function overridePandocOutputArgs(args: string[], outputPath: string): string[] {
    const result: string[] = [];

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (OUTPUT_OPTIONS.has(arg)) {
            index += 1;
            continue;
        }
        if (arg.startsWith('--output=')) {
            continue;
        }
        if (arg.startsWith('-o') && arg.length > 2 && !arg.startsWith('--')) {
            continue;
        }

        result.push(arg);
    }

    return [...result, '-o', outputPath];
}
