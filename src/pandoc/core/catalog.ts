import { parsePandocVersion } from './args/pandocPath';
import type {
    PandocCommandOptions,
    PandocRunResult,
    PandocVersionInfo
} from './export/types';
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
import {
    normalizeOptionToken,
    parsePandocHelp
} from './catalogHelpParser';
import { postProcessOptionMetadata } from './metadataPostProcessor';
import {
    metadataToOptionSpecs,
    parsePandocOptionsMetadata
} from './optionsMetadata';
import type {
    FormatExtensionSpec,
    OptionValueAlternative,
    OptionSpec,
    PandocOptionCatalog
} from './types';

export {
    parsePandocHelp
} from './catalogHelpParser';

export interface PandocCatalogProcess {
    run(args: string[], options?: PandocCommandOptions): Promise<PandocRunResult>;
    getVersion(options?: PandocCommandOptions): Promise<PandocVersionInfo>;
}

export type PandocCatalogShellRunner = (
    request: { command: string }
) => Promise<PandocRunResult>;

export interface PandocCatalogServiceConfig {
    service?: PandocCatalogProcess;
    shellRunner?: PandocCatalogShellRunner;
}

export class PandocCatalogService {
    private readonly service?: PandocCatalogProcess;
    private readonly shellRunner?: PandocCatalogShellRunner;

    constructor(config: PandocCatalogServiceConfig = {}) {
        this.service = config.service;
        this.shellRunner = config.shellRunner;
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
        if (!this.service) {
            return undefined;
        }

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
        if (!this.shellRunner) {
            return '';
        }

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
