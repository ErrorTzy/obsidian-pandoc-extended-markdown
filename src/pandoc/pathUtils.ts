export function dirname(filePath: string): string {
    const normalized = trimTrailingSeparators(filePath);
    const index = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));

    return index > 0 ? normalized.slice(0, index) : '';
}

export function basename(filePath: string): string {
    const normalized = trimTrailingSeparators(filePath);
    const index = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));

    return index >= 0 ? normalized.slice(index + 1) : normalized;
}

export function extname(filePath: string): string {
    const name = basename(filePath);
    const index = name.lastIndexOf('.');

    return index > 0 ? name.slice(index) : '';
}

export function removeExtension(fileName: string): string {
    const extension = extname(fileName);

    return extension ? fileName.slice(0, -extension.length) : fileName;
}

export function joinPath(...parts: string[]): string {
    const filtered = parts.filter(part => part.length > 0);
    if (filtered.length === 0) {
        return '';
    }

    return filtered
        .map((part, index) => index === 0 ? trimRight(part) : trimBoth(part))
        .join('/');
}

function trimTrailingSeparators(filePath: string): string {
    return filePath.replace(/[\\/]+$/, '');
}

function trimRight(value: string): string {
    return value.replace(/[\\/]+$/, '');
}

function trimBoth(value: string): string {
    return value.replace(/^[\\/]+|[\\/]+$/g, '');
}
