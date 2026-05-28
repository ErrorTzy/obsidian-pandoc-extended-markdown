import { PandocService } from '../PandocService';
import { parsePandocVersion } from '../pandocPath';
import { runShellCommand, ShellRunner } from '../shellRunner';
import type { PandocCommandOptions } from '../types';
import {
    FALLBACK_OPTIONS,
    FALLBACK_PANDOC_CATALOG
} from './fallbackCatalog';
import type {
    OptionSpec,
    OptionValueKind,
    PandocOptionCatalog
} from './types';

const OPTION_NAME_PATTERN = '-{1,2}[A-Za-z0-9][A-Za-z0-9-]*';
const OPTION_VALUE_PATTERN = '[A-Za-z][A-Za-z0-9_:|.[\\]<>-]*';
const OPTION_MODIFIER_PATTERN = '(?:\\[[^\\]]+\\]|=\\[[^\\]]+\\])';
const OPTION_FORM_PATTERN =
    `${OPTION_NAME_PATTERN}(?:[ =]${OPTION_VALUE_PATTERN})?(?:${OPTION_MODIFIER_PATTERN})?`;
const MAN_OPTION_SIGNATURE_PATTERN = new RegExp(
    `^${OPTION_FORM_PATTERN}(?:,\\s*${OPTION_FORM_PATTERN})*$`
);

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

        const [help, man, inputFormats, outputFormats, extensions, styles] = await Promise.all([
            this.runPandocList(['--help'], options),
            this.runManPandoc(),
            this.runPandocList(['--list-input-formats'], options),
            this.runPandocList(['--list-output-formats'], options),
            this.runPandocList(['--list-extensions=markdown'], options),
            this.runPandocList(['--list-highlight-styles'], options)
        ]);

        const parsedOptions = mergeOptionSpecs(
            parsePandocHelp(help),
            parsePandocManPage(man)
        );

        return {
            version: versionResult.version ?? parsePandocVersion(versionResult.result.stdout),
            source: 'runtime',
            options: enrichOptions(parsedOptions, inputFormats, outputFormats, styles),
            inputFormats: parseListOutput(inputFormats),
            outputFormats: parseListOutput(outputFormats),
            markdownExtensions: parseListOutput(extensions).map(stripExtensionMarker),
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
}

export function parsePandocHelp(text: string): OptionSpec[] {
    return text
        .split(/\r?\n/)
        .map(parseHelpLine)
        .filter((spec): spec is OptionSpec => spec !== undefined);
}

export function parsePandocManPage(text: string): OptionSpec[] {
    const lines = text.split(/\r?\n/);
    const specs: OptionSpec[] = [];

    for (let index = 0; index < lines.length; index += 1) {
        const parsed = parseManOptionLine(lines[index]);
        if (!parsed) continue;
        specs.push({
            ...parsed,
            description: collectDescription(lines, index + 1)
        });
    }

    return specs;
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

function parseManOptionLine(line: string): OptionSpec | undefined {
    if (!/^\s{5,}-/.test(line)) return undefined;
    if (!MAN_OPTION_SIGNATURE_PATTERN.test(line.trim())) return undefined;

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

    return {
        key,
        aliases,
        name: key.replace(/^--?/, ''),
        description,
        valueKind,
        valuePlaceholder: inferValuePlaceholder(sourceText, valueKind),
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

function collectDescription(lines: string[], startIndex: number): string {
    const chunks: string[] = [];

    for (let index = startIndex; index < lines.length; index += 1) {
        const line = lines[index];
        if (/^\s{5,}-/.test(line)) break;
        if (line.trim().length === 0 && chunks.length > 0) break;
        if (line.trim().length > 0) chunks.push(line.trim());
    }

    return chunks.join(' ').replace(/\s+/g, ' ');
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
    if (spec.name.includes('highlight')) return { ...spec, values: mergeValues(spec.values, styles) };
    return spec;
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
        values: incoming.values ?? base.values,
        repeatable: base.repeatable || incoming.repeatable,
        mapsTo: incoming.mapsTo ?? base.mapsTo
    };
}

function stripExtensionMarker(value: string): string {
    return value.replace(/^[+-]/, '');
}

function cloneCatalog(catalog: PandocOptionCatalog): PandocOptionCatalog {
    return {
        ...catalog,
        options: catalog.options.map(option => ({ ...option })),
        inputFormats: [...catalog.inputFormats],
        outputFormats: [...catalog.outputFormats],
        markdownExtensions: [...catalog.markdownExtensions],
        highlightStyles: [...catalog.highlightStyles]
    };
}
