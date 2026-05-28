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
        from: profile.from ?? '',
        to: profile.to,
        standalone: profile.standalone ?? false,
        resourcePaths: [...(profile.resourcePaths ?? [])],
        luaFilters: [...(profile.luaFilters ?? [])],
        metadata: { ...(profile.metadata ?? {}) },
        optionRows: parseExtraArgs(profile.extraArgs ?? []),
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

    return {
        id: draft.id.trim(),
        name: draft.name.trim(),
        type: 'pandoc',
        extension: normalizeExtension(draft.extension),
        from: optionalString(draft.from),
        to: draft.to.trim(),
        standalone: draft.standalone,
        resourcePaths: cleanList(draft.resourcePaths),
        luaFilters: cleanList(draft.luaFilters),
        metadata: cleanRecord(draft.metadata),
        extraArgs: compileOptionRows(draft.optionRows, catalog),
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

function compileOptionRows(
    rows: ProfileOptionRow[],
    catalog?: PandocOptionCatalog
): string[] {
    const args: string[] = [];

    for (const row of rows) {
        if (!row.enabled || !row.key.trim()) continue;
        args.push(...compileOptionRow(row, catalog));
    }

    return args;
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

function splitEqualsOption(token: string): { key: string; value?: string } {
    const index = token.indexOf('=');
    if (index < 0 || !token.startsWith('-')) return { key: token };
    return {
        key: token.slice(0, index),
        value: token.slice(index + 1)
    };
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
