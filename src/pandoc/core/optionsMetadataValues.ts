import type {
    OptionValueAlternative,
    OptionValueKind,
    PandocValueToken
} from './types';

export function valueTypes(): Array<{ id: OptionValueKind; name: string }> {
    return [
        { id: 'none', name: 'Flag' },
        { id: 'string', name: 'String' },
        { id: 'integer', name: 'Integer' },
        { id: 'number', name: 'Number' },
        { id: 'enum', name: 'Enum' },
        { id: 'format', name: 'Format' },
        { id: 'file', name: 'File' },
        { id: 'directory', name: 'Directory' },
        { id: 'path', name: 'Path' },
        { id: 'pathList', name: 'Path list' },
        { id: 'keyValue', name: 'Key/value' }
    ];
}

export function valuesFromTokens(tokens: PandocValueToken[] | undefined): string[] | undefined {
    const values = tokens
        ?.filter(token => token.kind === 'literal')
        .map(token => token.value);
    return values && values.length > 0 ? values : undefined;
}

export function parseValueTokens(placeholder: string): PandocValueToken[] | undefined {
    if (!placeholder.includes('|')) return undefined;
    return placeholder.split('|').map(value => ({
        value,
        kind: isPlaceholderToken(value) ? 'placeholder' : 'literal'
    }));
}

export function inferValueAlternatives(
    placeholder: string | undefined,
    tokens: PandocValueToken[] | undefined
): OptionValueAlternative[] | undefined {
    if (!placeholder || !tokens) return undefined;
    const alternatives: OptionValueAlternative[] = [];
    const literalValues = tokens
        .filter(token => token.kind === 'literal')
        .map(token => token.value);
    if (literalValues.length > 0) {
        alternatives.push({
            id: 'ENUM',
            label: 'ENUM',
            valueKind: 'enum',
            values: literalValues
        });
    }
    for (const token of tokens.filter(token => token.kind === 'placeholder')) {
        addUniqueAlternative(alternatives, alternativeFromPlaceholder(token.value));
    }
    return alternatives.length > 0 ? alternatives : undefined;
}

export function primaryValueKind(
    key: string,
    placeholder: string | undefined,
    alternatives: OptionValueAlternative[] | undefined
): OptionValueKind {
    return alternatives?.[0]?.valueKind ?? inferValueKind(key, placeholder);
}

export function inferValueKind(key: string, placeholder: string | undefined): OptionValueKind {
    if (!placeholder) return 'none';
    if (placeholder === 'NONE') return 'none';
    if (placeholder === 'BOOLEAN') return 'enum';
    if (/FORMAT/.test(placeholder)) return 'format';
    if (/DIRECTORY|DIRNAME|^DIR$/.test(placeholder)) return 'directory';
    if (/SEARCHPATH/.test(placeholder)) return 'pathList';
    if (placeholder === 'STYLE') return 'enum';
    if (/FILE|SCRIPT|SCRIPTPATH|THEMEPATH/.test(placeholder)) return 'file';
    if (/PATH|URL|DIR/.test(placeholder)) return 'path';
    if (/NUMBER/.test(placeholder)) return 'integer';
    if (/KEY|VALUE|VAL|JSON/.test(placeholder)) return 'keyValue';
    if (placeholder.includes('|')) return 'enum';
    if (key.includes('dpi')) return 'number';
    return 'string';
}

function isPlaceholderToken(value: string): boolean {
    return /^[A-Z][A-Za-z0-9_.,:=-]*(?:\[.*\])?$/.test(value);
}

function addUniqueAlternative(
    alternatives: OptionValueAlternative[],
    alternative: OptionValueAlternative
): void {
    if (alternatives.some(existing => existing.id === alternative.id)) return;
    alternatives.push(alternative);
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
    if (/^URL$/i.test(placeholder)) {
        return pandocTypeAlternative(placeholder, 'string');
    }
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
