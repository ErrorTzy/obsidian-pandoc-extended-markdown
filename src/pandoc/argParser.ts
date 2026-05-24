export function splitCommandLineArgs(input: string): string[] {
    const args: string[] = [];
    let current = '';
    let quote: '"' | "'" | undefined;
    let escaping = false;

    for (const char of input) {
        if (escaping) {
            current += char;
            escaping = false;
            continue;
        }

        if (char === '\\') {
            escaping = true;
            continue;
        }

        if ((char === '"' || char === "'") && (!quote || quote === char)) {
            quote = quote ? undefined : char;
            continue;
        }

        if (!quote && /\s/.test(char)) {
            pushArg(args, current);
            current = '';
            continue;
        }

        current += char;
    }

    if (escaping) {
        current += '\\';
    }
    pushArg(args, current);

    return args;
}

function pushArg(args: string[], value: string): void {
    if (value.length > 0) {
        args.push(value);
    }
}
