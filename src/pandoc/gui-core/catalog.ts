import { PandocService } from '../PandocService';
import { parsePandocVersion } from '../pandocPath';
import { runShellCommand, ShellRunner } from '../shellRunner';
import type { PandocCommandOptions } from '../types';
import {
    FALLBACK_OPTIONS,
    FALLBACK_PANDOC_CATALOG
} from './fallbackCatalog';
import { FALLBACK_EXTENSION_DESCRIPTIONS } from './fallbackExtensionDescriptions';
import {
    applyExtensionDescriptions,
    parsePandocExtensionDescriptions,
    parseExtensionListOutput
} from './formatExtensions';
import { postProcessOptionMetadata } from './metadataPostProcessor';
import {
    metadataToOptionSpecs,
    parsePandocOptionsMetadata
} from './optionsMetadata';
import type {
    FormatExtensionSpec,
    OptionValueAlternative,
    OptionSpec,
    OptionValueKind,
    PandocOptionCatalog
} from './types';

export interface PandocCatalogServiceConfig {
    service?: PandocService;
    shellRunner?: ShellRunner;
}

export class PandocCatalogService {
    private readonly service: PandocService;
    private readonly shellRunner: ShellRunner;

    constructor(config: PandocCatalogServiceConfig = {}) {
        this.service = config.service ?? new PandocService();
        this.shellRunner = config.shellRunner ?? runShellCommand;
    }

    async loadCatalog(options: PandocCommandOptions = {}): Promise<PandocOptionCatalog> {
        const runtime = await this.loadRuntimeCatalog(options);
        if (!runtime) {
            return cloneCatalog(FALLBACK_PANDOC_CATALOG);
        }

        return {
            ...runtime,
            source: runtime.options.length > FALLBACK_OPTIONS.length ? 'runtime' : 'hybrid',
            options: mergeOptionSpecs(FALLBACK_OPTIONS, runtime.options)
        };
    }

    private async loadRuntimeCatalog(
        options: PandocCommandOptions
    ): Promise<PandocOptionCatalog | undefined> {
        const versionResult = await this.service.getVersion(options);
        if (!versionResult.available) {
            return undefined;
        }

        const [help, man, inputFormats, outputFormats, markdownExtensionsText, styles] = await Promise.all([
            this.runPandocList(['--help'], options),
            this.runManPandoc(),
            this.runPandocList(['--list-input-formats'], options),
            this.runPandocList(['--list-output-formats'], options),
            this.runPandocList(['--list-extensions=markdown'], options),
            this.runPandocList(['--list-highlight-styles'], options)
        ]);
        const inputFormatList = parseListOutput(inputFormats);
        const outputFormatList = parseListOutput(outputFormats);
        const extensionDescriptions = runtimeExtensionDescriptions(man);
        const markdownExtensions = parseExtensionListOutput(markdownExtensionsText, extensionDescriptions);
        const formatExtensions = applyFormatExtensionDescriptions(await this.loadFormatExtensions(
            Array.from(new Set([...inputFormatList, ...outputFormatList])),
            options
        ), extensionDescriptions);
        if (markdownExtensions.length > 0) {
            formatExtensions.markdown = markdownExtensions;
        }

        const parsedOptions = parseRuntimeOptions(man, help, versionResult.version);

        return {
            version: versionResult.version ?? parsePandocVersion(versionResult.result.stdout),
            source: 'runtime',
            options: postProcessOptionMetadata(enrichOptions(parsedOptions, inputFormats, outputFormats, styles)),
            inputFormats: inputFormatList,
            outputFormats: outputFormatList,
            markdownExtensions: markdownExtensions.map(extension => extension.name),
            extensionDescriptions,
            formatExtensions,
            highlightStyles: parseListOutput(styles)
        };
    }

    private async runPandocList(
        args: string[],
        options: PandocCommandOptions
    ): Promise<string> {
        const result = await this.service.run(args, options);
        return result.ok ? result.stdout : '';
    }

    private async runManPandoc(): Promise<string> {
        const result = await this.shellRunner({ command: 'man pandoc | col -b' });
        return result.ok ? result.stdout : '';
    }

    private async loadFormatExtensions(
        formats: string[],
        options: PandocCommandOptions
    ): Promise<Record<string, FormatExtensionSpec[]>> {
        const entries = await Promise.all(formats.map(async format => {
            const output = await this.runPandocList([`--list-extensions=${format}`], options);
            return [format, parseExtensionListOutput(output)] as const;
        }));

        return Object.fromEntries(entries.filter(([, extensions]) => extensions.length > 0));
    }
}

export function parsePandocHelp(text: string): OptionSpec[] {
    return text
        .split(/\r?\n/)
        .flatMap(parseHelpLine);
}

export function parsePandocManPage(text: string): OptionSpec[] {
    return metadataToOptionSpecs(parsePandocOptionsMetadata(text));
}

export function parseListOutput(text: string): string[] {
    return Array.from(new Set(text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .filter(line => !line.startsWith('pandoc '))));
}

export function mergeOptionSpecs(...groups: OptionSpec[][]): OptionSpec[] {
    const merged = new Map<string, OptionSpec>();

    for (const group of groups) {
        for (const spec of group) {
            const key = matchingMergeKey(merged, spec) ?? canonicalOptionKey(spec);
            const current = merged.get(key);
            merged.set(key, current ? mergeOptionSpec(current, spec) : { ...spec });
        }
    }

    return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function findOptionSpec(
    catalog: PandocOptionCatalog,
    key: string
): OptionSpec | undefined {
    const normalized = normalizeOptionToken(key);
    return catalog.options.find(spec => optionTokens(spec).includes(normalized));
}

interface HelpOptionToken {
    token: string;
    valuePlaceholder?: string;
    valueSeparator?: 'space' | 'equals';
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

function normalizeOptionToken(token: string): string {
    return token.trim().replace(/[= ].*$/, '').replace(/\[.*$/, '');
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

function enrichOptions(
    options: OptionSpec[],
    inputFormatsText: string,
    outputFormatsText: string,
    highlightStylesText: string
): OptionSpec[] {
    const inputFormats = parseListOutput(inputFormatsText);
    const outputFormats = parseListOutput(outputFormatsText);
    const styles = parseListOutput(highlightStylesText);

    return options.map(spec => enrichOption(spec, inputFormats, outputFormats, styles));
}

function enrichOption(
    spec: OptionSpec,
    inputFormats: string[],
    outputFormats: string[],
    styles: string[]
): OptionSpec {
    if (spec.mapsTo === 'from') return { ...spec, values: inputFormats };
    if (spec.mapsTo === 'to') return { ...spec, values: outputFormats };
    if (spec.name.includes('highlight')) return enrichHighlightStyleValues(spec, styles);
    return spec;
}

function enrichHighlightStyleValues(spec: OptionSpec, values: string[]): OptionSpec {
    return {
        ...spec,
        valueAlternatives: mergeAlternativeStyleValues(spec.valueAlternatives, values)
    };
}

function mergeAlternativeStyleValues(
    alternatives: OptionValueAlternative[] | undefined,
    values: string[] | undefined
): OptionValueAlternative[] | undefined {
    if (!alternatives || !values) return alternatives;
    return alternatives.map(alternative => alternative.id === 'STYLE'
        ? { ...alternative, values: mergeValues(alternative.values, values) }
        : alternative);
}

function mergeValues(...groups: Array<string[] | undefined>): string[] | undefined {
    const values = Array.from(new Set(groups.flatMap(group => group ?? [])));
    return values.length > 0 ? values : undefined;
}

function matchingMergeKey(
    merged: Map<string, OptionSpec>,
    spec: OptionSpec
): string | undefined {
    const placeholder = normalizedValuePlaceholder(spec);
    const tokens = optionTokens(spec);

    for (const [key, existing] of merged) {
        if (normalizedValuePlaceholder(existing) !== placeholder) continue;
        if (optionTokens(existing).some(token => tokens.includes(token))) return key;
    }

    return undefined;
}

function canonicalOptionKey(spec: OptionSpec): string {
    const token = optionTokens(spec).find(item => item.startsWith('--')) ?? normalizeOptionToken(spec.key);
    return `${token} ${normalizedValuePlaceholder(spec)}`;
}

function optionTokens(spec: OptionSpec): string[] {
    return [spec.key, ...spec.aliases].map(normalizeOptionToken);
}

function rawOptionTokens(spec: OptionSpec): string[] {
    return [spec.key, ...spec.aliases];
}

function normalizedValuePlaceholder(spec: Pick<OptionSpec, 'valuePlaceholder'>): string {
    return spec.valuePlaceholder?.trim() ?? '';
}

function mergeOptionSpec(base: OptionSpec, incoming: OptionSpec): OptionSpec {
    const tokens = Array.from(new Set([...rawOptionTokens(base), ...rawOptionTokens(incoming)]));

    return {
        ...base,
        aliases: tokens.filter(token => normalizeOptionToken(token) !== normalizeOptionToken(base.key)),
        description: incoming.description || base.description,
        valueKind: incoming.valueKind ?? base.valueKind,
        valuePlaceholder: incoming.valuePlaceholder ?? base.valuePlaceholder,
        valueSeparator: incoming.valueSeparator ?? base.valueSeparator,
        valueSeparators: mergeValueSeparators(base.valueSeparators, incoming.valueSeparators),
        valueAlternatives: mergeValueAlternatives(base.valueAlternatives, incoming.valueAlternatives),
        values: incoming.values ?? base.values,
        repeatable: base.repeatable || incoming.repeatable,
        mapsTo: incoming.mapsTo ?? base.mapsTo
    };
}

function mergeValueSeparators(
    base: OptionSpec['valueSeparators'],
    incoming: OptionSpec['valueSeparators']
): OptionSpec['valueSeparators'] {
    if (!base) return incoming;
    if (!incoming) return base;
    return { ...base, ...incoming };
}

function mergeValueAlternatives(
    base: OptionValueAlternative[] | undefined,
    incoming: OptionValueAlternative[] | undefined
): OptionValueAlternative[] | undefined {
    if (!base) return incoming;
    if (!incoming) return base;
    const merged = base.map(alternative => ({ ...alternative }));
    for (const alternative of incoming) {
        const existing = merged.find(item => item.id === alternative.id);
        if (!existing) {
            merged.push({ ...alternative });
            continue;
        }
        existing.values = mergeValues(existing.values, alternative.values);
        existing.placeholder = alternative.placeholder ?? existing.placeholder;
    }
    return merged;
}

function cloneCatalog(catalog: PandocOptionCatalog): PandocOptionCatalog {
    return {
        ...catalog,
        options: catalog.options.map(option => ({ ...option })),
        inputFormats: [...catalog.inputFormats],
        outputFormats: [...catalog.outputFormats],
        markdownExtensions: [...catalog.markdownExtensions],
        extensionDescriptions: { ...catalog.extensionDescriptions },
        formatExtensions: Object.fromEntries(Object.entries(catalog.formatExtensions)
            .map(([format, extensions]) => [format, extensions.map(extension => ({ ...extension }))])),
        highlightStyles: [...catalog.highlightStyles]
    };
}

function runtimeExtensionDescriptions(manPage: string): Record<string, string> {
    const runtime = parsePandocExtensionDescriptions(manPage);
    const descriptions = {
        ...FALLBACK_EXTENSION_DESCRIPTIONS,
        ...runtime
    };
    if (descriptions.wikilinks_title_after_pipe && !descriptions.wikilinks_title_before_pipe) {
        descriptions.wikilinks_title_before_pipe = descriptions.wikilinks_title_after_pipe;
    }
    return descriptions;
}

function applyFormatExtensionDescriptions(
    catalog: Record<string, FormatExtensionSpec[]>,
    descriptions: Record<string, string>
): Record<string, FormatExtensionSpec[]> {
    return Object.fromEntries(Object.entries(catalog)
        .map(([format, extensions]) => [
            format,
            applyExtensionDescriptions(extensions, descriptions)
        ]));
}

function parseRuntimeOptions(
    man: string,
    help: string,
    version?: string
): OptionSpec[] {
    const manOptions = man.trim()
        ? metadataToOptionSpecs(parsePandocOptionsMetadata(man, version))
        : [];
    return manOptions.length > 0 ? manOptions : parsePandocHelp(help);
}
