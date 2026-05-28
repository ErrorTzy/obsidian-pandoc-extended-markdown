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
}

export function parseExtensionListOutput(text: string): FormatExtensionSpec[] {
    return text
        .split(/\r?\n/)
        .map(line => line.trim())
        .map(parseExtensionLine)
        .filter((extension): extension is FormatExtensionSpec => extension !== undefined);
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
            editable
        };
    });

    for (const modifier of parsed.modifiers) {
        if (known.has(modifier.name)) continue;
        choices.push({
            name: modifier.name,
            state: 'incompatible',
            checked: modifier.operator === '+',
            editable: false
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

function parseExtensionLine(line: string): FormatExtensionSpec | undefined {
    const match = line.match(/^([+-])(.+)$/);
    if (!match) return undefined;

    return {
        name: match[2],
        defaultEnabled: match[1] === '+'
    };
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
