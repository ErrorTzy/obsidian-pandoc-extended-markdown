import type {
    CustomExportProfile,
    ExportProfile
} from '../types';
import { findOptionSpec } from './catalog';
import type {
    OptionSpec,
    PandocOptionCatalog,
    ProfileDraft,
    ProfileOptionRow
} from './types';

export function createProfileDraft(profile: ExportProfile): ProfileDraft {
    if (profile.type === 'custom') {
        return createCustomDraft(profile);
    }

    return {
        id: profile.id,
        name: profile.name,
        type: 'pandoc',
        extension: profile.extension,
        from: '',
        to: '',
        standalone: false,
        resourcePaths: [],
        luaFilters: [],
        metadata: {},
        optionRows: createPandocProfileRows(profile),
        customCommandTemplate: '',
        customShell: false,
        openOutputFile: profile.openOutputFile,
        revealOutputFile: profile.revealOutputFile
    };
}

export function createProfileDrafts(profiles: ExportProfile[]): ProfileDraft[] {
    return profiles.map(createProfileDraft);
}

export function compileProfileDraft(
    draft: ProfileDraft,
    catalog?: PandocOptionCatalog
): ExportProfile {
    if (draft.type === 'custom') {
        return compileCustomDraft(draft);
    }

    const command = readDraftCommandRows(draft.optionRows, catalog);

    return {
        id: draft.id.trim(),
        name: draft.name.trim(),
        type: 'pandoc',
        extension: normalizeExtension(draft.extension),
        from: optionalString(command.from ?? draft.from),
        to: (command.to ?? draft.to).trim(),
        standalone: command.standalone ?? draft.standalone,
        resourcePaths: cleanList([...draft.resourcePaths, ...command.resourcePaths]),
        luaFilters: cleanList([...draft.luaFilters, ...command.luaFilters]),
        metadata: cleanRecord({ ...draft.metadata, ...command.metadata }),
        extraArgs: command.extraArgs,
        openOutputFile: draft.openOutputFile,
        revealOutputFile: draft.revealOutputFile
    };
}

export function compileProfileDrafts(
    drafts: ProfileDraft[],
    catalog?: PandocOptionCatalog
): ExportProfile[] {
    return drafts.map(draft => compileProfileDraft(draft, catalog));
}

export function createEmptyOptionRow(index: number): ProfileOptionRow {
    return {
        id: `option-${Date.now()}-${index}`,
        key: '',
        value: '',
        enabled: true
    };
}

export function createDefaultPandocRows(): ProfileOptionRow[] {
    return [
        createOptionRow('field-from', '-f', 'markdown'),
        createOptionRow('field-to', '-t', 'html'),
        createOptionRow('field-standalone', '-s', '')
    ];
}

export interface DraftCommandRows {
    from?: string;
    to?: string;
    standalone?: boolean;
    resourcePaths: string[];
    luaFilters: string[];
    metadata: Record<string, string>;
    extraArgs: string[];
}

export function readDraftCommandRows(
    rows: ProfileOptionRow[],
    catalog?: PandocOptionCatalog
): DraftCommandRows {
    const result: DraftCommandRows = {
        resourcePaths: [],
        luaFilters: [],
        metadata: {},
        extraArgs: []
    };

    for (const row of rows) {
        if (!row.enabled || !row.key.trim()) continue;
        const spec = catalog ? findOptionSpec(catalog, row.key) : undefined;
        if (!applyMappedRow(result, row, spec)) {
            result.extraArgs.push(...compileOptionRow(row, catalog));
        }
    }

    return result;
}

export function parseKeyValueLines(text: string): Record<string, string> {
    const result: Record<string, string> = {};

    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const index = trimmed.indexOf('=');
        if (index < 1) continue;
        result[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
    }

    return result;
}

export function renderKeyValueLines(record: Record<string, string>): string {
    return Object.entries(record)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
}

function createCustomDraft(profile: CustomExportProfile): ProfileDraft {
    return {
        id: profile.id,
        name: profile.name,
        type: 'custom',
        extension: profile.extension,
        from: '',
        to: '',
        standalone: false,
        resourcePaths: [],
        luaFilters: [],
        metadata: {},
        optionRows: [],
        customCommandTemplate: profile.commandTemplate,
        customShell: profile.shell === true,
        openOutputFile: profile.openOutputFile,
        revealOutputFile: profile.revealOutputFile
    };
}

function createPandocProfileRows(profile: Extract<ExportProfile, { type: 'pandoc' }>): ProfileOptionRow[] {
    return [
        createOptionRow('field-from', '-f', profile.from ?? ''),
        createOptionRow('field-to', '-t', profile.to),
        createOptionRow('field-standalone', '-s', profile.standalone === false ? 'false' : ''),
        ...(profile.resourcePaths ?? []).map((value, index) =>
            createOptionRow(`resource-path-${index}`, '--resource-path', value)),
        ...(profile.luaFilters ?? []).map((value, index) =>
            createOptionRow(`lua-filter-${index}`, '-L', value)),
        ...Object.entries(profile.metadata ?? {}).map(([key, value], index) =>
            createOptionRow(`metadata-${index}`, '-M', `${key}=${value}`)),
        ...parseExtraArgs(profile.extraArgs ?? [])
    ];
}

function createOptionRow(id: string, key: string, value: string): ProfileOptionRow {
    return {
        id,
        key,
        value,
        enabled: true
    };
}

function compileCustomDraft(draft: ProfileDraft): CustomExportProfile {
    return {
        id: draft.id.trim(),
        name: draft.name.trim(),
        type: 'custom',
        extension: normalizeExtension(draft.extension),
        commandTemplate: draft.customCommandTemplate,
        shell: draft.customShell ? true : undefined,
        openOutputFile: draft.openOutputFile,
        revealOutputFile: draft.revealOutputFile
    };
}

function parseExtraArgs(args: string[]): ProfileOptionRow[] {
    const rows: ProfileOptionRow[] = [];

    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        const split = splitEqualsOption(token);
        const next = args[index + 1];
        const hasSeparateValue = token.startsWith('-') && next && !next.startsWith('-');
        rows.push({
            id: `option-${index}`,
            key: split.key,
            value: split.value ?? (hasSeparateValue ? next : ''),
            enabled: true
        });
        if (hasSeparateValue && split.value === undefined) index += 1;
    }

    return rows;
}

function compileOptionRow(
    row: ProfileOptionRow,
    catalog?: PandocOptionCatalog
): string[] {
    const spec = catalog ? findOptionSpec(catalog, row.key) : undefined;
    const key = normalizeRowKey(row.key, spec);
    const value = row.value.trim();

    if (spec?.valueKind === 'none') return [key];
    if (spec?.valueKind === 'boolean') return compileBooleanOption(key, value);
    if (!value) return [key];
    return [key, value];
}

function compileBooleanOption(key: string, value: string): string[] {
    if (!value || value === 'true') return [key];
    if (value === 'false') return [`${key}=false`];
    return [key, value];
}

function normalizeRowKey(key: string, spec?: OptionSpec): string {
    const trimmed = key.trim();
    if (spec) return spec.key;
    return splitEqualsOption(trimmed).key;
}

function applyMappedRow(
    result: DraftCommandRows,
    row: ProfileOptionRow,
    spec?: OptionSpec
): boolean {
    if (!spec) return false;
    const value = row.value.trim();

    if (spec.mapsTo === 'from') {
        result.from = value;
        return true;
    }
    if (spec.mapsTo === 'to') {
        result.to = value;
        return true;
    }
    if (spec.mapsTo === 'standalone') {
        result.standalone = value !== 'false';
        return true;
    }
    if (spec.mapsTo === 'resourcePath') {
        if (value) result.resourcePaths.push(value);
        return true;
    }
    if (spec.mapsTo === 'luaFilter') {
        if (value) result.luaFilters.push(value);
        return true;
    }
    if (spec.mapsTo === 'metadata') {
        Object.assign(result.metadata, parseSingleKeyValue(value));
        return true;
    }

    return false;
}

function splitEqualsOption(token: string): { key: string; value?: string } {
    const index = token.indexOf('=');
    if (index < 0 || !token.startsWith('-')) return { key: token };
    return {
        key: token.slice(0, index),
        value: token.slice(index + 1)
    };
}

function parseSingleKeyValue(text: string): Record<string, string> {
    const index = text.indexOf('=');
    if (index < 1) return {};
    return { [text.slice(0, index).trim()]: text.slice(index + 1).trim() };
}

function cleanList(values: string[]): string[] | undefined {
    const cleaned = values.map(value => value.trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : undefined;
}

function cleanRecord(record: Record<string, string>): Record<string, string> | undefined {
    const cleaned: Record<string, string> = {};
    for (const [key, value] of Object.entries(record)) {
        if (key.trim() && value.trim()) cleaned[key.trim()] = value.trim();
    }
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

function optionalString(value: string): string | undefined {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeExtension(extension: string): string {
    const trimmed = extension.trim();
    if (!trimmed) return '';
    return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
}
