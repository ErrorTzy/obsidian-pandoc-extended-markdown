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
            options: enrichOptions(parsedOptions, inputFormats, outputFormats, styles),
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
        .map(parseHelpLine)
        .filter((spec): spec is OptionSpec => spec !== undefined);
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
            const key = canonicalOptionKey(spec);
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

function parseHelpLine(line: string): OptionSpec | undefined {
    if (!line.trimStart().startsWith('-')) return undefined;
    const tokens = optionTokenMatches(line);
    if (tokens.length === 0) return undefined;

    return buildSpec(tokens, '', line);
}

function buildSpec(tokens: string[], description: string, sourceText: string): OptionSpec {
    const normalized = tokens.map(normalizeOptionToken);
    const long = normalized.find(token => token.startsWith('--'));
    const key = long ?? normalized[0];
    const aliases = normalized.filter(token => token !== key);
    const valueKind = inferValueKind(key, sourceText);
    const valuePlaceholder = inferValuePlaceholder(sourceText, valueKind);
    const valueAlternatives = inferValueAlternatives(key, valuePlaceholder);

    return {
        key,
        aliases,
        name: key.replace(/^--?/, ''),
        description,
        valueKind: valueAlternatives?.[0]?.valueKind ?? valueKind,
        valuePlaceholder,
        valueAlternatives,
        values: inferValues(sourceText, valueKind),
        repeatable: inferRepeatable(key),
        mapsTo: inferMapsTo(key)
    };
}

function optionTokenMatches(line: string): string[] {
    return Array.from(line.matchAll(/(?:^|\s|,)(-{1,2}[A-Za-z0-9][A-Za-z0-9-]*)(?:[ =]([A-Za-z][A-Za-z0-9_:|.[\]<>-]*))?/g))
        .map(match => match[2] ? `${match[1]}=${match[2]}` : match[1]);
}

function normalizeOptionToken(token: string): string {
    return token.trim().replace(/[= ].*$/, '').replace(/\[.*$/, '');
}

function inferPlaceholder(text: string): string | undefined {
    const match = text.match(/[= ]([A-Za-z][A-Za-z0-9_:|.[\]<>-]*)/);
    return match?.[1];
}

function inferValuePlaceholder(
    text: string,
    valueKind: OptionValueKind
): string | undefined {
    if (valueKind === 'none') return undefined;
    return inferPlaceholder(text);
}

function inferValueKind(key: string, text: string): OptionValueKind {
    if (hasOptionalFlagModifier(text)) return 'none';
    const placeholder = inferPlaceholder(text);
    if (!placeholder) return 'none';
    if (/FORMAT/.test(placeholder)) return 'format';
    if (/DIRECTORY|DIRNAME/.test(placeholder)) return 'directory';
    if (/FILE|SCRIPT|SCRIPTPATH|THEMEPATH/.test(placeholder)) return 'file';
    if (/SEARCHPATH/.test(placeholder)) return 'pathList';
    if (/PATH|URL/.test(placeholder)) return 'path';
    if (/NUMBER|NUMBERS/.test(placeholder)) return 'integer';
    if (/KEY|VALUE|VAL|JSON/.test(placeholder)) return 'keyValue';
    if (placeholder.includes('|')) return 'enum';
    return 'string';
}

function hasOptionalFlagModifier(text: string): boolean {
    return /\[(?:=)?true\|false\]/.test(text);
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

function inferValueAlternatives(
    key: string,
    placeholder: string | undefined
): OptionValueAlternative[] | undefined {
    if (!placeholder?.includes('|')) return undefined;
    const tokens = placeholder.split('|').map(value => ({
        value,
        placeholder: /^[A-Z][A-Z0-9_.-]*(?:\[.*\])?$/.test(value)
    }));
    const alternatives: OptionValueAlternative[] = [];
    const literals = tokens.filter(token => !token.placeholder).map(token => token.value);
    if (literals.length > 0 || tokens.some(token => token.value === 'STYLE' && key.includes('highlight'))) {
        alternatives.push({
            id: 'preset',
            label: 'preset',
            valueKind: 'enum',
            placeholder: key.includes('highlight') ? 'STYLE' : undefined,
            values: literals
        });
    }
    for (const token of tokens.filter(token => token.placeholder)) {
        if (token.value === 'STYLE' && key.includes('highlight')) continue;
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
    if (valueKind === 'file') return { id: 'file', label: 'file', valueKind, placeholder };
    if (valueKind === 'directory') return { id: 'directory', label: 'folder', valueKind, placeholder };
    if (valueKind === 'pathList') return { id: 'pathList', label: 'folder', valueKind, placeholder };
    if (/^URL$/i.test(placeholder)) return { id: 'url', label: 'URL', valueKind: 'string', placeholder };
    if (valueKind === 'format') return { id: 'format', label: 'format', valueKind, placeholder };
    if (valueKind === 'integer') return { id: 'integer', label: 'number', valueKind, placeholder };
    if (valueKind === 'number') return { id: 'number', label: 'number', valueKind, placeholder };
    if (valueKind === 'keyValue') return { id: 'keyValue', label: placeholder, valueKind, placeholder };
    return { id: 'custom', label: placeholder, valueKind: 'string', placeholder };
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
    if (spec.name.includes('highlight')) return enrichPresetValues(spec, styles);
    return spec;
}

function enrichPresetValues(spec: OptionSpec, values: string[]): OptionSpec {
    const merged = mergeValues(spec.values, values);
    return {
        ...spec,
        values: merged,
        valueAlternatives: mergeAlternativePresetValues(spec.valueAlternatives, merged)
    };
}

function mergeAlternativePresetValues(
    alternatives: OptionValueAlternative[] | undefined,
    values: string[] | undefined
): OptionValueAlternative[] | undefined {
    if (!alternatives || !values) return alternatives;
    return alternatives.map(alternative => alternative.id === 'preset'
        ? { ...alternative, values: mergeValues(alternative.values, values) }
        : alternative);
}

function mergeValues(...groups: Array<string[] | undefined>): string[] | undefined {
    const values = Array.from(new Set(groups.flatMap(group => group ?? [])));
    return values.length > 0 ? values : undefined;
}

function canonicalOptionKey(spec: OptionSpec): string {
    return optionTokens(spec).find(token => token.startsWith('--')) ?? spec.key;
}

function optionTokens(spec: OptionSpec): string[] {
    return [spec.key, ...spec.aliases].map(normalizeOptionToken);
}

function mergeOptionSpec(base: OptionSpec, incoming: OptionSpec): OptionSpec {
    return {
        ...base,
        aliases: Array.from(new Set([...base.aliases, ...incoming.aliases])),
        description: incoming.description || base.description,
        valueKind: incoming.valueKind ?? base.valueKind,
        valuePlaceholder: incoming.valuePlaceholder ?? base.valuePlaceholder,
        valueAlternatives: mergeValueAlternatives(base.valueAlternatives, incoming.valueAlternatives),
        values: incoming.values ?? base.values,
        repeatable: base.repeatable || incoming.repeatable,
        mapsTo: incoming.mapsTo ?? base.mapsTo
    };
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
