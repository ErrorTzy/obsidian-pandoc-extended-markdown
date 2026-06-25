const DASH_RUN_PATTERN = /-{2,}/g;

export interface SmartDashMatch {
    start: number;
    end: number;
    rawText: string;
    renderedText: string;
}

export function findSmartDashMatches(text: string): SmartDashMatch[] {
    const matches: SmartDashMatch[] = [];
    let match: RegExpExecArray | null;

    DASH_RUN_PATTERN.lastIndex = 0;
    while ((match = DASH_RUN_PATTERN.exec(text)) !== null) {
        if (isEscaped(text, match.index)) {
            continue;
        }

        matches.push({
            start: match.index,
            end: match.index + match[0].length,
            rawText: match[0],
            renderedText: renderPandocDashRun(match[0])
        });
    }

    return matches;
}

export function renderPandocDashRun(dashRun: string): string {
    let remaining = dashRun.length;
    let rendered = '';

    while (remaining >= 3) {
        rendered += '\u2014';
        remaining -= 3;
    }

    if (remaining === 2) {
        rendered += '\u2013';
    } else if (remaining === 1) {
        rendered += '-';
    }

    return rendered;
}

export function isEscaped(text: string, index: number): boolean {
    let slashCount = 0;
    for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor--) {
        slashCount++;
    }
    return slashCount % 2 === 1;
}
