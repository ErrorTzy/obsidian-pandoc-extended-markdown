export const DEFAULT_PANDOC_EXECUTABLE = 'pandoc';

export function normalizePandocExecutable(pandocPath?: string): string {
    const trimmed = pandocPath?.trim();

    if (!trimmed) {
        return DEFAULT_PANDOC_EXECUTABLE;
    }

    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1);
    }

    return trimmed;
}

export function getPandocVersionLine(stdout: string): string | undefined {
    return stdout
        .split(/\r?\n/)
        .map(line => line.trim())
        .find(line => line.length > 0);
}

export function parsePandocVersion(stdout: string): string | undefined {
    const versionLine = getPandocVersionLine(stdout);
    const match = versionLine?.match(/^pandoc(?:\.exe)?\s+([0-9]+(?:\.[0-9]+){0,3}(?:[-+][^\s]+)?)/i);

    return match?.[1];
}
