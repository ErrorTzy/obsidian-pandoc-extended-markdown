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

export type OptionValueAlternativeId = string;

export interface OptionValueAlternative {
    id: OptionValueAlternativeId;
    label: string;
    valueKind: OptionValueKind;
    placeholder?: string;
    values?: string[];
}

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
    descriptionBlocks?: PandocDescriptionBlock[];
    groupId?: number;
    signature?: string;
    sectionId?: string;
    valueKind: OptionValueKind;
    valuePlaceholder?: string;
    valueSeparator?: 'space' | 'equals';
    valueSeparators?: Record<string, 'space' | 'equals'>;
    valueAlternatives?: OptionValueAlternative[];
    values?: string[];
    repeatable?: boolean;
    mapsTo?: OptionField;
}

export type PandocDescriptionBlockType = 'paragraph' | 'bullet';

export interface PandocDescriptionBlock {
    type: PandocDescriptionBlockType;
    text: string;
}

export interface PandocValueType {
    id: OptionValueKind;
    name: string;
}

export interface PandocOptionsMetadata {
    schemaVersion: 1;
    pandocVersion?: string;
    sourceCommand: string;
    normalizedOptionsText: string;
    valueTypes: PandocValueType[];
    sections: PandocOptionSection[];
    optionGroups: PandocOptionGroup[];
    optionNames: PandocOptionName[];
}

export interface PandocOptionSection {
    id: string;
    title: string;
    order: number;
    descriptionBlocks?: PandocDescriptionBlock[];
}

export interface PandocOptionGroup {
    id: number;
    sectionId: string;
    order: number;
    signature: string;
    descriptionBlocks: PandocDescriptionBlock[];
    valueTypeId: OptionValueKind;
    valuePlaceholder?: string;
    valueAlternatives?: OptionValueAlternative[];
    valueTokens?: PandocValueToken[];
    repeatable: boolean;
    mapsTo?: OptionField;
}

export interface PandocOptionName {
    name: string;
    groupId: number;
    order: number;
    valueSyntax?: string;
}

export interface PandocValueToken {
    value: string;
    kind: 'literal' | 'placeholder';
}

export interface PandocOptionCatalog {
    version?: string;
    source: 'runtime' | 'fallback' | 'hybrid';
    options: OptionSpec[];
    inputFormats: string[];
    outputFormats: string[];
    markdownExtensions: string[];
    extensionDescriptions: Record<string, string>;
    formatExtensions: Record<string, FormatExtensionSpec[]>;
    highlightStyles: string[];
}

export interface FormatExtensionSpec {
    name: string;
    defaultEnabled: boolean;
    description?: string;
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
