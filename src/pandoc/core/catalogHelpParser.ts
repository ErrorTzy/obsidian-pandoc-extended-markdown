import type {
    OptionSpec,
    OptionValueAlternative,
    OptionValueKind
} from './types';

interface HelpOptionToken {
    token: string;
    valuePlaceholder?: string;
    valueSeparator?: 'space' | 'equals';
}

export function parsePandocHelp(text: string): OptionSpec[] {
    return text
        .split(/\r?\n/)
        .flatMap(parseHelpLine);
}

export function normalizeOptionToken(token: string): string {
    return token.trim().replace(/[= ].*$/, '').replace(/\[.*$/, '');
}

function parseHelpLine(line: string): OptionSpec[] {
    if (!line.trimStart().startsWith('-')) return [];
    const tokens = optionTokenMatches(line);
    if (tokens.length === 0) return [];

    return groupHelpTokensByValueSyntax(tokens).map(group => buildSpec(group, ''));
}

function groupHelpTokensByValueSyntax(tokens: HelpOptionToken[]): HelpOptionToken[][] {
    const groups: HelpOptionToken[][] = [];

    for (const token of tokens) {
        const group = groups.find(items => items[0]?.valuePlaceholder === token.valuePlaceholder);
        if (group) {
            group.push(token);
        } else {
            groups.push([token]);
        }
    }

    return groups;
}

function buildSpec(tokens: HelpOptionToken[], description: string): OptionSpec {
    const normalized = tokens.map(token => normalizeOptionToken(token.token));
    const long = normalized.find(token => token.startsWith('--'));
    const key = long ?? normalized[0];
    const aliases = normalized.filter(token => token !== key);
    const valuePlaceholder = tokens[0]?.valuePlaceholder;
    const valueSeparator = tokens[0]?.valueSeparator;
    const valueKind = valuePlaceholder ? inferValueKind(key, `${key}=${valuePlaceholder}`) : 'none';
    const valueAlternatives = inferValueAlternatives(valuePlaceholder);

    return {
        key,
        aliases,
        name: key.replace(/^--?/, ''),
        description,
        valueKind: valueAlternatives?.[0]?.valueKind ?? valueKind,
        valuePlaceholder,
        valueSeparator,
        valueSeparators: valueSeparatorsFromHelpTokens(tokens),
        valueAlternatives,
        values: inferValues(valuePlaceholder ? `${key}=${valuePlaceholder}` : key, valueKind),
        repeatable: inferRepeatable(key),
        mapsTo: inferMapsTo(key)
    };
}

function valueSeparatorsFromHelpTokens(
    tokens: HelpOptionToken[]
): Record<string, 'space' | 'equals'> | undefined {
    const entries = tokens
        .map(token => [normalizeOptionToken(token.token), token.valueSeparator] as const)
        .filter((entry): entry is readonly [string, 'space' | 'equals'] => entry[1] !== undefined);
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function optionTokenMatches(line: string): HelpOptionToken[] {
    return Array.from(line.matchAll(
        /(?:^|\s|,)(-{1,2}[A-Za-z0-9][A-Za-z0-9-]*)(?:(\[[^\]]+\])|([ =])([A-Za-z[][A-Za-z0-9_:|.[\]<>-]*))?/g
    ))
        .map(match => ({
            token: match[1],
            valuePlaceholder: normalizeHelpValueSyntax(match[2] ?? match[4]),
            valueSeparator: helpValueSeparator(match[2], match[3])
        }));
}

function helpValueSeparator(
    optionalSyntax: string | undefined,
    separator: string | undefined
): 'space' | 'equals' | undefined {
    if (!optionalSyntax && !separator) return undefined;
    if (optionalSyntax?.startsWith('[=') || separator === '=') return 'equals';
    return 'space';
}

function inferPlaceholder(text: string): string | undefined {
    const match = text.match(/[= ]([A-Za-z][A-Za-z0-9_:|.[\]<>-]*)/);
    return match?.[1];
}

function normalizeHelpValueSyntax(valueSyntax: string | undefined): string | undefined {
    if (!valueSyntax) return undefined;
    return expandOptionalValueSyntax(valueSyntax.trim()) || undefined;
}

function expandOptionalValueSyntax(valueSyntax: string): string {
    const wholeOptional = valueSyntax.match(/^\[(.*)\]$/);
    if (wholeOptional) {
        return joinValueSyntax('NONE', expandOptionalValueSyntax(wholeOptional[1].replace(/^=/, '')));
    }

    const booleanSyntax = normalizeBooleanSyntax(valueSyntax);
    if (booleanSyntax) return booleanSyntax;

    const optionalSuffix = valueSyntax.match(/^(.+)\[([^\]]+)\]$/);
    if (optionalSuffix) {
        return joinValueSyntax(
            expandOptionalValueSyntax(optionalSuffix[1]),
            expandOptionalValueSyntax(`${optionalSuffix[1]}${optionalSuffix[2]}`)
        );
    }

    return valueSyntax.replace(/^=/, '');
}

function normalizeBooleanSyntax(valueSyntax: string): string | undefined {
    return /^=?\[?true\|false\]?$/.test(valueSyntax) ? 'BOOLEAN' : undefined;
}

function joinValueSyntax(...values: string[]): string {
    return Array.from(new Set(values.filter(Boolean))).join('|');
}

function inferValueKind(key: string, text: string): OptionValueKind {
    const placeholder = inferPlaceholder(text);
    if (!placeholder) return 'none';
    if (placeholder === 'NONE') return 'none';
    if (placeholder === 'BOOLEAN') return 'enum';
    if (/FORMAT/.test(placeholder)) return 'format';
    if (/DIRECTORY|DIRNAME|^DIR$/.test(placeholder)) return 'directory';
    if (/SEARCHPATH/.test(placeholder)) return 'pathList';
    if (placeholder === 'STYLE') return 'enum';
    if (/FILE|SCRIPT|SCRIPTPATH|THEMEPATH/.test(placeholder)) return 'file';
    if (/PATH|URL/.test(placeholder)) return 'path';
    if (/NUMBER|NUMBERS/.test(placeholder)) return 'integer';
    if (/KEY|VALUE|VAL|JSON/.test(placeholder)) return 'keyValue';
    if (placeholder.includes('|')) return 'enum';
    return 'string';
}

function inferValues(text: string, valueKind: OptionValueKind): string[] | undefined {
    if (valueKind !== 'enum') return undefined;
    const placeholder = inferPlaceholder(text);
    if (!placeholder?.includes('|')) return undefined;

    const values = placeholder
        .split('|')
        .map(value => value.trim())
        .filter(value => /^[a-z0-9][a-z0-9_-]*$/i.test(value))
        .filter(value => value.toUpperCase() !== value);

    return values.length > 0 ? Array.from(new Set(values)) : undefined;
}

function inferValueAlternatives(placeholder: string | undefined): OptionValueAlternative[] | undefined {
    if (!placeholder?.includes('|')) return undefined;
    const tokens = placeholder.split('|').map(value => ({
        value,
        placeholder: isPlaceholderToken(value)
    }));
    const alternatives: OptionValueAlternative[] = [];
    const literals = tokens.filter(token => !token.placeholder).map(token => token.value);
    if (literals.length > 0) {
        alternatives.push({
            id: 'ENUM',
            label: 'ENUM',
            valueKind: 'enum',
            values: literals
        });
    }
    for (const token of tokens.filter(token => token.placeholder)) {
        addUniqueAlternative(alternatives, alternativeFromPlaceholder(token.value));
    }
    return alternatives.length > 0 ? alternatives : undefined;
}

function addUniqueAlternative(
    alternatives: OptionValueAlternative[],
    alternative: OptionValueAlternative
): void {
    if (alternatives.some(existing => existing.id === alternative.id)) return;
    alternatives.push(alternative);
}

function isPlaceholderToken(value: string): boolean {
    return /^[A-Z][A-Za-z0-9_.,:=-]*(?:\[.*\])?$/.test(value);
}

function alternativeFromPlaceholder(placeholder: string): OptionValueAlternative {
    if (placeholder === 'NONE') return {
        id: 'none',
        label: 'none',
        valueKind: 'none',
        placeholder
    };
    if (placeholder === 'BOOLEAN') {
        return {
            id: placeholder,
            label: placeholder,
            valueKind: 'enum',
            placeholder,
            values: ['true', 'false']
        };
    }
    const valueKind = inferValueKind('', placeholder);
    if (valueKind === 'file') return pandocTypeAlternative(placeholder, valueKind);
    if (valueKind === 'directory') return pandocTypeAlternative(placeholder, valueKind);
    if (valueKind === 'pathList') return pandocTypeAlternative(placeholder, valueKind);
    if (/^URL$/i.test(placeholder)) return pandocTypeAlternative(placeholder, 'string');
    if (valueKind === 'format') return pandocTypeAlternative(placeholder, valueKind);
    if (valueKind === 'integer') return pandocTypeAlternative(placeholder, valueKind);
    if (valueKind === 'number') return pandocTypeAlternative(placeholder, valueKind);
    if (valueKind === 'keyValue') return pandocTypeAlternative(placeholder, valueKind);
    if (placeholder === 'STYLE') return pandocTypeAlternative(placeholder, 'enum');
    return pandocTypeAlternative(placeholder, 'string');
}

function pandocTypeAlternative(
    placeholder: string,
    valueKind: OptionValueKind,
    label = placeholder
): OptionValueAlternative {
    return {
        id: placeholder,
        label,
        valueKind,
        placeholder
    };
}

function inferMapsTo(key: string): OptionSpec['mapsTo'] {
    if (['--from', '-f', '--read', '-r'].includes(key)) return 'from';
    if (['--to', '-t', '--write', '-w'].includes(key)) return 'to';
    if (['--output', '-o'].includes(key)) return 'output';
    if (['--standalone', '-s'].includes(key)) return 'standalone';
    if (key === '--resource-path') return 'resourcePath';
    if (['--lua-filter', '-L'].includes(key)) return 'luaFilter';
    if (['--metadata', '-M'].includes(key)) return 'metadata';
    if (['--variable', '-V', '--variable-json'].includes(key)) return 'variable';
    return undefined;
}

function inferRepeatable(key: string): boolean {
    return [
        '--metadata',
        '--variable',
        '--variable-json',
        '--filter',
        '--lua-filter',
        '--resource-path',
        '--css',
        '--include-in-header',
        '--include-before-body',
        '--include-after-body',
        '--bibliography',
        '--pdf-engine-opt'
    ].includes(key);
}
