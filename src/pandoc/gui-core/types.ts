import type { ExportProfile, PandocExportProfile } from '../types';

export type OptionValueKind =
    | 'none'
    | 'string'
    | 'integer'
    | 'number'
    | 'enum'
    | 'format'
    | 'file'
    | 'directory'
    | 'path'
    | 'pathList'
    | 'keyValue';

export type OptionField =
    | 'from'
    | 'to'
    | 'output'
    | 'standalone'
    | 'resourcePath'
    | 'luaFilter'
    | 'metadata'
    | 'variable'
    | 'extraArg';

export interface OptionSpec {
    key: string;
    aliases: string[];
    name: string;
    description: string;
    valueKind: OptionValueKind;
    valuePlaceholder?: string;
    values?: string[];
    repeatable?: boolean;
    mapsTo?: OptionField;
}

export interface PandocOptionCatalog {
    version?: string;
    source: 'runtime' | 'fallback' | 'hybrid';
    options: OptionSpec[];
    inputFormats: string[];
    outputFormats: string[];
    markdownExtensions: string[];
    formatExtensions: Record<string, FormatExtensionSpec[]>;
    highlightStyles: string[];
}

export interface FormatExtensionSpec {
    name: string;
    defaultEnabled: boolean;
}

export interface ProfileOptionRow {
    id: string;
    key: string;
    value: string;
    enabled: boolean;
    role?: 'input';
}

export interface ProfileDraft {
    id: string;
    name: string;
    type: ExportProfile['type'];
    extension: string;
    from: string;
    to: string;
    standalone: boolean;
    resourcePaths: string[];
    luaFilters: string[];
    metadata: Record<string, string>;
    optionRows: ProfileOptionRow[];
    customCommandTemplate: string;
    customShell: boolean;
    openOutputFile?: boolean;
    revealOutputFile?: boolean;
}

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
    severity: ValidationSeverity;
    message: string;
    field?: string;
    rowId?: string;
}

export interface CommandPreview {
    tokens: string[];
    display: string;
}

export type EditablePandocProfile = Extract<ExportProfile, { type: 'pandoc' }>;

export function isPandocDraft(draft: ProfileDraft): draft is ProfileDraft & {
    type: PandocExportProfile['type'];
} {
    return draft.type === 'pandoc';
}
