import type {
    FormatExtensionSpec,
    PandocOptionCatalog
} from './types';

export type FormatExtensionState = 'included' | 'compatible' | 'enabled' | 'incompatible';

export interface ParsedPandocFormat {
    baseFormat: string;
    modifiers: FormatExtensionModifier[];
}

export interface FormatExtensionModifier {
    operator: '+' | '-';
    name: string;
}

export interface FormatExtensionChoice {
    name: string;
    state: FormatExtensionState;
    checked: boolean;
    editable: boolean;
    description?: string;
}

export function parseExtensionListOutput(
    text: string,
    descriptions: Record<string, string> = {}
): FormatExtensionSpec[] {
    return text
        .split(/\r?\n/)
        .map(line => line.trim())
        .map(line => parseExtensionLine(line, descriptions))
        .filter((extension): extension is FormatExtensionSpec => extension !== undefined);
}

export function parsePandocExtensionDescriptions(text: string): Record<string, string> {
    const lines = text.split(/\r?\n/);
    const descriptions: Record<string, string> = {};

    for (let index = 0; index < lines.length; index += 1) {
        const names = parseExtensionHeading(lines[index]);
        if (!names) continue;
        const description = collectExtensionDescription(lines, index + 1);
        for (const name of names) {
            descriptions[name] = description;
        }
    }

    return descriptions;
}

export function applyExtensionDescriptions(
    extensions: FormatExtensionSpec[],
    descriptions: Record<string, string>
): FormatExtensionSpec[] {
    return extensions.map(extension => ({
        ...extension,
        description: descriptions[extension.name] ?? extension.description
    }));
}

export function parsePandocFormatValue(value: string): ParsedPandocFormat {
    const trimmed = value.trim();
    const firstModifier = trimmed.search(/[+-]/);
    if (firstModifier < 0) {
        return {
            baseFormat: trimmed,
            modifiers: []
        };
    }

    return {
        baseFormat: trimmed.slice(0, firstModifier),
        modifiers: parseFormatModifiers(trimmed.slice(firstModifier))
    };
}

export function buildPandocFormatValue(baseFormat: string, enabledExtensions: string[]): string {
    return `${baseFormat}${enabledExtensions.map(extension => `+${extension}`).join('')}`;
}

export function getFormatExtensionChoices(
    catalog: PandocOptionCatalog,
    formatValue: string
): FormatExtensionChoice[] {
    const parsed = parsePandocFormatValue(formatValue);
    const specs = catalog.formatExtensions[parsed.baseFormat] ?? [];
    const modifierMap = new Map(parsed.modifiers.map(modifier => [modifier.name, modifier.operator]));
    const known = new Set(specs.map(spec => spec.name));
    const choices = specs.map(spec => {
        const operator = modifierMap.get(spec.name);
        const enabled = operator === '+' || (operator !== '-' && spec.defaultEnabled);
        const editable = !spec.defaultEnabled;

        return {
            name: spec.name,
            state: extensionState(spec, operator),
            checked: enabled,
            editable,
            description: spec.description ?? catalog.extensionDescriptions[spec.name]
        };
    });

    for (const modifier of parsed.modifiers) {
        if (known.has(modifier.name)) continue;
        choices.push({
            name: modifier.name,
            state: 'incompatible',
            checked: modifier.operator === '+',
            editable: false,
            description: catalog.extensionDescriptions[modifier.name]
        });
    }

    return choices.sort((a, b) => stateOrder(a.state) - stateOrder(b.state) || a.name.localeCompare(b.name));
}

export function selectedCompatibleExtensions(
    catalog: PandocOptionCatalog,
    formatValue: string
): string[] {
    return getFormatExtensionChoices(catalog, formatValue)
        .filter(choice => choice.editable && choice.checked)
        .map(choice => choice.name);
}

export function stripFormatExtensions(format: string): string {
    return parsePandocFormatValue(format).baseFormat;
}

function parseExtensionLine(
    line: string,
    descriptions: Record<string, string>
): FormatExtensionSpec | undefined {
    const match = line.match(/^([+-])(.+)$/);
    if (!match) return undefined;

    const name = match[2];
    return {
        name,
        defaultEnabled: match[1] === '+',
        description: descriptions[name]
    };
}

function parseExtensionHeading(line: string): string[] | undefined {
    const match = line.trim().match(/^Extension:\s+(.+?)(?:\s+±)?$/);
    if (!match) return undefined;

    return match[1]
        .split(',')
        .map(name => name.trim().replace(/\s+\([^)]*\)$/, ''))
        .filter(name => name.length > 0);
}

function collectExtensionDescription(lines: string[], startIndex: number): string {
    const chunks: string[] = [];
    let pendingContinuation = false;
    let inContinuation = false;
    let remainingContinuations = 0;

    for (let index = startIndex; index < lines.length; index += 1) {
        const line = lines[index];
        if (parseExtensionHeading(line)) break;
        if (isPandocManSectionHeading(line, chunks.length > 0)) break;
        if (isExtensionDescriptionStopLine(line.trim())) break;
        if (line.trim().length === 0) {
            if (chunks.length === 0) continue;
            if (shouldStopExtensionDescription(chunks, inContinuation, remainingContinuations)) break;
            if (inContinuation) {
                inContinuation = false;
                remainingContinuations -= 1;
            } else if (remainingContinuations === 0) {
                remainingContinuations = continuationBlockCount(chunks.join(' '));
            }
            pendingContinuation = remainingContinuations > 0;
            continue;
        }
        if (pendingContinuation) {
            inContinuation = true;
            pendingContinuation = false;
        }
        if (line.trim().length > 0) chunks.push(line.trim());
    }

    return normalizeExtensionDescription(chunks.join(' '));
}

function shouldStopExtensionDescription(
    chunks: string[],
    inContinuation: boolean,
    remainingContinuations: number
): boolean {
    if (chunks.length === 0) return false;
    return (inContinuation && remainingContinuations <= 1) ||
        (!inContinuation && remainingContinuations === 0 && continuationBlockCount(chunks.join(' ')) === 0);
}

function continuationBlockCount(description: string): number {
    const trimmed = description.trim();
    if (!trimmed) return 0;
    if (/^If the file begins with a title block$/.test(trimmed)) return 2;
    if (!/[.!?)]$/.test(trimmed)) return 1;
    if (/(?:like|as follows|for example,?|syntax:|example:|this:)$/i.test(trimmed)) return 1;
    return 0;
}

function isPandocManSectionHeading(line: string, hasDescription: boolean): boolean {
    return hasDescription && /^\s{3}\S/.test(line) && !/^\s{5,}/.test(line);
}

function isExtensionDescriptionStopLine(line: string): boolean {
    return line === 'This extension can be enabled/disabled for the following formats:' ||
        /^(input formats|output formats|enabled by default in)$/i.test(line);
}

function normalizeExtensionDescription(description: string): string {
    return description.replace(/\s+/g, ' ').trim();
}

function parseFormatModifiers(text: string): FormatExtensionModifier[] {
    const modifiers: FormatExtensionModifier[] = [];
    const pattern = /([+-])([^+-]+)/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
        const name = match[2].trim();
        if (!name) continue;
        modifiers.push({
            operator: match[1] as '+' | '-',
            name
        });
    }

    return modifiers;
}

function extensionState(
    spec: FormatExtensionSpec,
    operator: '+' | '-' | undefined
): FormatExtensionState {
    if (spec.defaultEnabled) return 'included';
    if (operator === '+') return 'enabled';
    return 'compatible';
}

function stateOrder(state: FormatExtensionState): number {
    if (state === 'compatible' || state === 'enabled') return 0;
    if (state === 'included') return 1;
    return 2;
}
