import type {
    PandocDescriptionBlock,
    OptionField,
    OptionSpec,
    OptionValueKind,
    PandocOptionGroup,
    PandocOptionName,
    PandocOptionSection,
    PandocOptionsMetadata
} from './types';
import {
    formatDescriptionBlock,
    optionDescriptionText,
    parseDescriptionBlocks
} from './optionsMetadataDescriptions';
import {
    inferValueAlternatives,
    parseValueTokens,
    primaryValueKind,
    valueTypes,
    valuesFromTokens
} from './optionsMetadataValues';

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
    return expandOptionalValueSyntax(valueSyntax.replace(/^=/, '').trim()) || undefined;
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

    return valueSyntax;
}

function normalizeBooleanSyntax(valueSyntax: string): string | undefined {
    return /^=?\[?true\|false\]?$/.test(valueSyntax) ? 'BOOLEAN' : undefined;
}

function joinValueSyntax(...values: string[]): string {
    return Array.from(new Set(values.filter(Boolean))).join('|');
}

function optionSpecsFromGroup(group: PandocOptionGroup, names: PandocOptionName[]): OptionSpec[] {
    const orderedNames = names
        .filter(name => name.groupId === group.id)
        .sort((a, b) => a.order - b.order);
    const buckets = groupNamesByValueSyntax(orderedNames);

    if (buckets.length === 0) {
        return [optionSpecFromNames(group, [], group.valuePlaceholder)];
    }

    return buckets.map(bucket =>
        optionSpecFromNames(group, bucket.names, bucket.valuePlaceholder, bucket.valueSeparator));
}

interface OptionNameBucket {
    key: string;
    valuePlaceholder?: string;
    valueSeparator?: 'space' | 'equals';
    names: PandocOptionName[];
}

function groupNamesByValueSyntax(names: PandocOptionName[]): OptionNameBucket[] {
    const buckets: OptionNameBucket[] = [];

    for (const name of names) {
        const valuePlaceholder = normalizeValueSyntax(name.valueSyntax);
        const key = valuePlaceholder ?? '';
        let bucket = buckets.find(item => item.key === key);
        if (!bucket) {
            bucket = {
                key,
                valuePlaceholder,
                valueSeparator: valueSeparatorFromSyntax(name.valueSyntax),
                names: []
            };
            buckets.push(bucket);
        }
        bucket.names.push(name);
    }

    return buckets;
}

function optionSpecFromNames(
    group: PandocOptionGroup,
    names: PandocOptionName[],
    valuePlaceholder: string | undefined,
    valueSeparator?: 'space' | 'equals'
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
        valueSeparator,
        valueSeparators: valueSeparatorsFromNames(names),
        valueAlternatives,
        values: valuesFromTokens(valueTokens),
        repeatable: group.repeatable,
        mapsTo: group.mapsTo
    };
}

function valueSeparatorFromSyntax(valueSyntax: string | undefined): 'space' | 'equals' | undefined {
    if (!valueSyntax) return undefined;
    return valueSyntax.startsWith('=') || valueSyntax.startsWith('[=') ? 'equals' : 'space';
}

function valueSeparatorsFromNames(
    names: PandocOptionName[]
): Record<string, 'space' | 'equals'> | undefined {
    const entries = names
        .map(name => [name.name, valueSeparatorFromSyntax(name.valueSyntax)] as const)
        .filter((entry): entry is readonly [string, 'space' | 'equals'] => entry[1] !== undefined);
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
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

function slugify(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'options';
}
