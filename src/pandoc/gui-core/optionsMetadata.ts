import type {
    OptionValueAlternative,
    OptionField,
    OptionSpec,
    OptionValueKind,
    PandocDescriptionBlock,
    PandocOptionGroup,
    PandocOptionName,
    PandocOptionSection,
    PandocOptionsMetadata,
    PandocValueToken
} from './types';

const OPTION_NAME_PATTERN = /^(-{1,2}[A-Za-z0-9][A-Za-z0-9-]*)(.*)$/;
const OPTION_LINE_PATTERN = /^\s{5,}-/;
const SECTION_LINE_PATTERN = /^\s{3}\S/;

export function parsePandocOptionsMetadata(
    text: string,
    pandocVersion?: string
): PandocOptionsMetadata {
    const lines = extractOptionsSection(text).split(/\r?\n/);
    const sections: PandocOptionSection[] = [];
    const optionGroups: PandocOptionGroup[] = [];
    const optionNames: PandocOptionName[] = [];
    let currentSection = ensureSection(sections, 'options', 'Options');
    let groupId = 1;

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (line.trim() === 'OPTIONS') continue;
        if (isSectionHeading(line)) {
            currentSection = ensureSection(sections, slugify(line.trim()), line.trim());
            continue;
        }

        const forms = parseSignatureForms(line);
        if (!forms) {
            const sectionDescriptionLines: string[] = [];
            let cursor = index;
            while (cursor < lines.length && !isNextOptionBoundary(lines[cursor])) {
                sectionDescriptionLines.push(lines[cursor]);
                cursor += 1;
            }
            currentSection.descriptionBlocks?.push(...parseDescriptionBlocks(sectionDescriptionLines));
            index = cursor - 1;
            continue;
        }

        const descriptionLines: string[] = [];
        let cursor = index + 1;
        while (cursor < lines.length && !isNextOptionBoundary(lines[cursor])) {
            descriptionLines.push(lines[cursor]);
            cursor += 1;
        }

        const group = createOptionGroup(
            groupId,
            currentSection.id,
            optionGroups.length,
            line.trim(),
            forms,
            parseDescriptionBlocks(descriptionLines)
        );
        optionGroups.push(group);
        optionNames.push(...forms.map((form, formIndex) => ({
            name: form.name,
            groupId,
            order: formIndex,
            valueSyntax: form.valueSyntax
        })));

        groupId += 1;
        index = cursor - 1;
    }

    const metadata: PandocOptionsMetadata = {
        schemaVersion: 1,
        pandocVersion,
        sourceCommand: 'man pandoc | col -b',
        normalizedOptionsText: '',
        valueTypes: valueTypes(),
        sections,
        optionGroups,
        optionNames
    };
    metadata.normalizedOptionsText = rebuildPandocOptionsText(metadata);
    return metadata;
}

export function metadataToOptionSpecs(metadata: PandocOptionsMetadata): OptionSpec[] {
    return metadata.optionGroups
        .slice()
        .sort((a, b) => a.order - b.order)
        .flatMap(group => optionSpecsFromGroup(group, metadata.optionNames));
}

export function rebuildPandocOptionsText(metadata: PandocOptionsMetadata): string {
    const sections = metadata.sections.slice().sort((a, b) => a.order - b.order);
    const groups = metadata.optionGroups.slice().sort((a, b) => a.order - b.order);
    const chunks = ['OPTIONS'];

    for (const section of sections) {
        const sectionGroups = groups.filter(group => group.sectionId === section.id);
        if (sectionGroups.length === 0) continue;
        chunks.push(section.title);
        chunks.push(...(section.descriptionBlocks ?? []).map(formatDescriptionBlock));
        for (const group of sectionGroups) {
            chunks.push(group.signature);
            chunks.push(...group.descriptionBlocks.map(formatDescriptionBlock));
        }
    }

    return chunks.filter(chunk => chunk.length > 0).join('\n');
}

export function optionDescriptionText(blocks: PandocDescriptionBlock[]): string {
    return blocks.map(formatDescriptionBlock).join('\n\n');
}

interface OptionForm {
    name: string;
    valueSyntax?: string;
}

function extractOptionsSection(text: string): string {
    const lines = text.split(/\r?\n/);
    const start = lines.findIndex(line => line.trim() === 'OPTIONS');
    const end = lines.findIndex((line, index) => index > start && line.trim() === 'EXIT CODES');
    if (start < 0) return text;
    return lines.slice(start, end > start ? end : undefined).join('\n');
}

function ensureSection(
    sections: PandocOptionSection[],
    id: string,
    title: string
): PandocOptionSection {
    const existing = sections.find(section => section.id === id);
    if (existing) return existing;
    const section = { id, title, order: sections.length, descriptionBlocks: [] };
    sections.push(section);
    return section;
}

function isSectionHeading(line: string): boolean {
    return SECTION_LINE_PATTERN.test(line) && !OPTION_LINE_PATTERN.test(line);
}

function isNextOptionBoundary(line: string): boolean {
    return isSectionHeading(line) || parseSignatureForms(line) !== undefined;
}

function parseSignatureForms(line: string): OptionForm[] | undefined {
    if (!OPTION_LINE_PATTERN.test(line)) return undefined;
    const parts = splitSignature(line.trim());
    if (parts.length === 0) return undefined;
    const forms = parts.map(parseSignatureForm);
    if (forms.some(form => form === undefined)) return undefined;
    return forms as OptionForm[];
}

function splitSignature(signature: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    for (let index = 0; index < signature.length; index += 1) {
        const char = signature[index];
        if (char === '[') depth += 1;
        if (char === ']') depth = Math.max(0, depth - 1);
        if (char === ',' && depth === 0) {
            parts.push(signature.slice(start, index).trim());
            start = index + 1;
        }
    }
    parts.push(signature.slice(start).trim());
    return parts.filter(Boolean);
}

function parseSignatureForm(part: string): OptionForm | undefined {
    const match = part.match(OPTION_NAME_PATTERN);
    if (!match) return undefined;
    const rest = match[2];
    if (!rest) return { name: match[1] };
    if (!/^(?:\s|=|\[)/.test(rest)) return undefined;
    if (/^\s+or\s+/i.test(rest)) return undefined;
    if (/\s/.test(rest.trim())) return undefined;
    return {
        name: match[1],
        valueSyntax: rest.trim()
    };
}

function createOptionGroup(
    id: number,
    sectionId: string,
    order: number,
    signature: string,
    forms: OptionForm[],
    descriptionBlocks: PandocDescriptionBlock[]
): PandocOptionGroup {
    const valuePlaceholder = inferGroupPlaceholder(forms);
    const valueTokens = valuePlaceholder ? parseValueTokens(valuePlaceholder) : undefined;
    const valueAlternatives = inferValueAlternatives(valuePlaceholder, valueTokens);
    const valueTypeId = primaryValueKind(forms[0].name, valuePlaceholder, valueAlternatives);

    return {
        id,
        sectionId,
        order,
        signature,
        descriptionBlocks,
        valueTypeId,
        valuePlaceholder,
        valueAlternatives,
        valueTokens,
        repeatable: inferRepeatable(forms.map(form => form.name)),
        mapsTo: inferMapsTo(forms.map(form => form.name))
    };
}

function inferGroupPlaceholder(forms: OptionForm[]): string | undefined {
    for (const form of forms) {
        const placeholder = normalizeValueSyntax(form.valueSyntax);
        if (placeholder) return placeholder;
    }
    return undefined;
}

function normalizeValueSyntax(valueSyntax: string | undefined): string | undefined {
    if (!valueSyntax) return undefined;
    if (/^\[=?true\|false\]$/.test(valueSyntax) || /^=\[true\|false\]$/.test(valueSyntax)) {
        return undefined;
    }
    return valueSyntax.replace(/^=/, '').trim() || undefined;
}

function parseDescriptionBlocks(lines: string[]): PandocDescriptionBlock[] {
    const blocks: PandocDescriptionBlock[] = [];
    let current: PandocDescriptionBlock | undefined;

    for (const line of lines) {
        const trimmed = normalizeDescriptionLine(line);
        if (!trimmed) {
            current = undefined;
            continue;
        }

        const bullet = trimmed.match(/^•\s*(.*)$/);
        if (bullet) {
            current = { type: 'bullet', text: bullet[1] };
            blocks.push(current);
            continue;
        }

        if (!current) {
            current = { type: 'paragraph', text: trimmed };
            blocks.push(current);
        } else {
            current.text = normalizeDescriptionLine(`${current.text} ${trimmed}`);
        }
    }

    return blocks;
}

function normalizeDescriptionLine(line: string): string {
    return line
        .trim()
        .replace(/[\u00ad\u2010]\s+/g, '')
        .replace(/\s+/g, ' ');
}

function formatDescriptionBlock(block: PandocDescriptionBlock): string {
    return block.type === 'bullet' ? `• ${block.text}` : block.text;
}

function optionSpecsFromGroup(group: PandocOptionGroup, names: PandocOptionName[]): OptionSpec[] {
    const orderedNames = names
        .filter(name => name.groupId === group.id)
        .sort((a, b) => a.order - b.order);
    const buckets = groupNamesByValueSyntax(orderedNames);

    if (buckets.length === 0) {
        return [optionSpecFromNames(group, [])];
    }

    return buckets.map(bucket => optionSpecFromNames(group, bucket.names, bucket.valuePlaceholder));
}

interface OptionNameBucket {
    key: string;
    valuePlaceholder?: string;
    names: PandocOptionName[];
}

function groupNamesByValueSyntax(names: PandocOptionName[]): OptionNameBucket[] {
    const buckets: OptionNameBucket[] = [];

    for (const name of names) {
        const valuePlaceholder = normalizeValueSyntax(name.valueSyntax);
        const key = valuePlaceholder ?? '';
        let bucket = buckets.find(item => item.key === key);
        if (!bucket) {
            bucket = { key, valuePlaceholder, names: [] };
            buckets.push(bucket);
        }
        bucket.names.push(name);
    }

    return buckets;
}

function optionSpecFromNames(
    group: PandocOptionGroup,
    names: PandocOptionName[],
    valuePlaceholder = group.valuePlaceholder
): OptionSpec {
    const orderedNames = names.map(name => name.name);
    const key = orderedNames[0] ?? group.signature;
    const longName = orderedNames.find(name => name.startsWith('--'));
    const valueTokens = valuePlaceholder ? parseValueTokens(valuePlaceholder) : undefined;
    const valueAlternatives = inferValueAlternatives(valuePlaceholder, valueTokens);

    return {
        key,
        aliases: orderedNames.slice(1),
        name: (longName ?? key).replace(/^--?/, ''),
        description: optionDescriptionText(group.descriptionBlocks),
        descriptionBlocks: group.descriptionBlocks,
        groupId: group.id,
        signature: group.signature,
        sectionId: group.sectionId,
        valueKind: primaryValueKind(key, valuePlaceholder, valueAlternatives) ?? group.valueTypeId,
        valuePlaceholder,
        valueAlternatives,
        values: valuesFromTokens(valueTokens),
        repeatable: group.repeatable,
        mapsTo: group.mapsTo
    };
}

function valuesFromTokens(tokens: PandocValueToken[] | undefined): string[] | undefined {
    const values = tokens
        ?.filter(token => token.kind === 'literal')
        .map(token => token.value);
    return values && values.length > 0 ? values : undefined;
}

function parseValueTokens(placeholder: string): PandocValueToken[] | undefined {
    if (!placeholder.includes('|')) return undefined;
    return placeholder.split('|').map(value => ({
        value,
        kind: isPlaceholderToken(value) ? 'placeholder' : 'literal'
    }));
}

function isPlaceholderToken(value: string): boolean {
    return /^[A-Z][A-Za-z0-9_.-]*(?:\[.*\])?$/.test(value);
}

function inferValueAlternatives(
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

function addUniqueAlternative(
    alternatives: OptionValueAlternative[],
    alternative: OptionValueAlternative
): void {
    if (alternatives.some(existing => existing.id === alternative.id)) return;
    alternatives.push(alternative);
}

function alternativeFromPlaceholder(placeholder: string): OptionValueAlternative {
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
): OptionValueAlternative {
    return {
        id: placeholder,
        label: placeholder,
        valueKind,
        placeholder
    };
}

function primaryValueKind(
    key: string,
    placeholder: string | undefined,
    alternatives: OptionValueAlternative[] | undefined
): OptionValueKind {
    return alternatives?.[0]?.valueKind ?? inferValueKind(key, placeholder);
}

function inferValueKind(key: string, placeholder: string | undefined): OptionValueKind {
    if (!placeholder) return 'none';
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

function inferMapsTo(keys: string[]): OptionField | undefined {
    if (hasAny(keys, ['--from', '-f', '--read', '-r'])) return 'from';
    if (hasAny(keys, ['--to', '-t', '--write', '-w'])) return 'to';
    if (hasAny(keys, ['--output', '-o'])) return 'output';
    if (hasAny(keys, ['--standalone', '-s'])) return 'standalone';
    if (hasAny(keys, ['--resource-path'])) return 'resourcePath';
    if (hasAny(keys, ['--lua-filter', '-L'])) return 'luaFilter';
    if (hasAny(keys, ['--metadata', '-M'])) return 'metadata';
    if (hasAny(keys, ['--variable', '-V', '--variable-json'])) return 'variable';
    return undefined;
}

function inferRepeatable(keys: string[]): boolean {
    return hasAny(keys, [
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
        '--pdf-engine-opt',
        '--request-header',
        '--syntax-definition',
        '--epub-embed-font'
    ]);
}

function hasAny(keys: string[], candidates: string[]): boolean {
    return candidates.some(candidate => keys.includes(candidate));
}

function valueTypes(): Array<{ id: OptionValueKind; name: string }> {
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

function slugify(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'options';
}
