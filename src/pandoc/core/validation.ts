import { findOptionSpec } from './catalog';
import { readDraftCommandRows } from './profileDraft';
import { getExportTemplateVariableNames } from './templates/template';
import type {
    OptionField,
    OptionSpec,
    OptionValueAlternative,
    PandocOptionCatalog,
    ProfileDraft,
    ProfileOptionRow,
    ValidationIssue
} from './types';

const KNOWN_TEMPLATE_VARIABLES = new Set([
    'vaultDir',
    'pluginDir',
    'luaFilterDir',
    'currentPath',
    'currentDir',
    'currentFileName',
    'currentFileFullName',
    'outputPath',
    'outputDir',
    'outputFileName',
    'outputFileFullName',
    'outputExtension',
    'attachmentFolderPath',
    'embedDirs',
    'fromFormat',
    'metadata'
]);

export function validateProfileDraft(
    draft: ProfileDraft,
    catalog: PandocOptionCatalog,
    knownTemplateVariables: Iterable<string> = KNOWN_TEMPLATE_VARIABLES
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const knownTemplateVariableSet = new Set(knownTemplateVariables);

    validateRequiredFields(draft, issues);
    if (draft.type === 'pandoc') {
        const command = readDraftCommandRows(draft.optionRows, catalog);
        validateFormat('from', command.from ?? draft.from, catalog.inputFormats, issues, false, knownTemplateVariableSet);
        validateFormat('to', command.to ?? draft.to, catalog.outputFormats, issues, true, knownTemplateVariableSet);
        validateRequiredRows(draft.optionRows, catalog, issues);
        validateRows(draft.optionRows, catalog, issues, knownTemplateVariableSet);
    }

    return issues;
}

export function hasValidationErrors(issues: ValidationIssue[]): boolean {
    return issues.some(issue => issue.severity === 'error');
}

export function validateProfileDraftNames(drafts: ProfileDraft[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const seen = new Set<string>();

    for (const draft of drafts) {
        const name = draft.name.trim();
        if (!name) {
            addError(issues, 'Preset name is required.', 'name');
            continue;
        }
        const normalized = name.toLowerCase();
        if (seen.has(normalized)) {
            addError(issues, `Preset name "${name}" is already used.`, 'name');
        }
        seen.add(normalized);
    }

    return issues;
}

function validateRequiredFields(draft: ProfileDraft, issues: ValidationIssue[]): void {
    if (!draft.name.trim()) addError(issues, 'Preset name is required.', 'name');
    if (!draft.extension.trim()) addError(issues, 'Output extension is required.', 'extension');
    if (draft.type === 'custom' && !draft.customCommandTemplate.trim()) {
        addError(issues, 'Custom command template is required.', 'customCommandTemplate');
    }
}

function validateRequiredRows(
    rows: ProfileOptionRow[],
    catalog: PandocOptionCatalog,
    issues: ValidationIssue[]
): void {
    if (!rows.some(row => row.enabled && row.role === 'input')) {
        addError(issues, 'Input file row is required.', 'optionRows');
    }

    const presentFields = new Set<string>();
    for (const row of rows) {
        if (!row.enabled || row.role === 'input') continue;
        const spec = findOptionSpec(catalog, row.key);
        if (spec?.mapsTo) presentFields.add(spec.mapsTo);
    }

    if (!presentFields.has('from')) addError(issues, '-f input format row is required.', 'optionRows');
    if (!presentFields.has('to')) addError(issues, '-t output format row is required.', 'optionRows');
    if (!presentFields.has('output')) addError(issues, '-o output file row is required.', 'optionRows');
}

function validateFormat(
    field: string,
    value: string,
    formats: string[],
    issues: ValidationIssue[],
    required: boolean,
    knownTemplateVariables: Set<string>
): void {
    const trimmed = value.trim();
    if (!trimmed && !required) return;
    if (!trimmed) {
        addError(issues, `${field} format is required.`, field);
        return;
    }
    if (hasTemplateVariable(trimmed)) {
        validateKnownTemplateVariables(trimmed, field, issues, knownTemplateVariables);
        return;
    }
    if (formats.length > 0 && !formats.includes(stripExtensions(trimmed))) {
        addWarning(issues, `"${trimmed}" is not in the installed Pandoc ${field} format list.`, field);
    }
}

function validateRows(
    rows: ProfileOptionRow[],
    catalog: PandocOptionCatalog,
    issues: ValidationIssue[],
    knownTemplateVariables: Set<string>
): void {
    const singletonKeys = new Set<string>();
    const coreFields = new Set<OptionField>();

    for (const row of rows) {
        if (!row.enabled) continue;
        if (row.role === 'input') {
            validateInputRow(row, issues, knownTemplateVariables);
            continue;
        }
        if (!row.key.trim()) continue;
        const spec = findOptionSpec(catalog, row.key);
        if (!spec) {
            addWarning(issues, `Unknown Pandoc option "${row.key}".`, 'optionRows', row.id);
            continue;
        }
        validateRowValue(row, spec, issues, knownTemplateVariables);
        validateDuplicate(row, spec, singletonKeys, coreFields, issues);
    }
}

function validateInputRow(
    row: ProfileOptionRow,
    issues: ValidationIssue[],
    knownTemplateVariables: Set<string>
): void {
    const value = row.value.trim();
    if (!value) {
        addError(issues, 'input file requires a value.', 'optionRows', row.id);
        return;
    }

    validatePathTemplateValue(value, {
        key: 'input file',
        aliases: [],
        name: 'input file',
        description: '',
        valueKind: 'file'
    }, issues, row.id, knownTemplateVariables);
}

function validateRowValue(
    row: ProfileOptionRow,
    spec: OptionSpec,
    issues: ValidationIssue[],
    knownTemplateVariables: Set<string>
): void {
    const value = row.value.trim();
    if (spec.mapsTo === 'from' && !value) return;
    if (spec.valueKind !== 'none' && !value) {
        addError(issues, `${spec.key} requires a value.`, 'optionRows', row.id);
    }
    if (value && ['integer', 'number'].includes(spec.valueKind)) {
        validateNumberValue(value, spec, issues, row.id);
    }
    if (value && shouldValidateEnumValue(value, spec)) {
        addWarning(issues, `"${value}" is not a known value for ${spec.key}.`, 'optionRows', row.id);
    }
    if (value && isPathValue(value, spec)) {
        validatePathTemplateValue(value, spec, issues, row.id, knownTemplateVariables);
    }
}

function validatePathTemplateValue(
    value: string,
    spec: OptionSpec,
    issues: ValidationIssue[],
    rowId: string,
    knownTemplateVariables: Set<string> = KNOWN_TEMPLATE_VARIABLES
): void {
    const unknownVariables = getExportTemplateVariableNames(value)
        .filter(name => !knownTemplateVariables.has(name));

    if (unknownVariables.length > 0) {
        addWarning(
            issues,
            `${spec.key} contains unresolved template variable(s): ${unknownVariables.join(', ')}.`,
            'optionRows',
            rowId
        );
    }
}

function validateNumberValue(
    value: string,
    spec: OptionSpec,
    issues: ValidationIssue[],
    rowId: string
): void {
    const valid = spec.valueKind === 'integer' ?
        /^-?\d+$/.test(value) :
        /^-?\d+(\.\d+)?$/.test(value);

    if (!valid) {
        addError(issues, `${spec.key} requires a ${spec.valueKind} value.`, 'optionRows', rowId);
    }
}

function validateDuplicate(
    row: ProfileOptionRow,
    spec: OptionSpec,
    singletonKeys: Set<string>,
    coreFields: Set<OptionField>,
    issues: ValidationIssue[]
): void {
    if (spec.mapsTo && ['from', 'to', 'output'].includes(spec.mapsTo)) {
        validateCoreDuplicate(row, spec, coreFields, issues);
        return;
    }
    if (spec.repeatable) return;
    if (singletonKeys.has(spec.key)) {
        addWarning(issues, `${spec.key} is usually used only once.`, 'optionRows', row.id);
    }
    singletonKeys.add(spec.key);
}

function validateCoreDuplicate(
    row: ProfileOptionRow,
    spec: OptionSpec,
    coreFields: Set<OptionField>,
    issues: ValidationIssue[]
): void {
    const field = spec.mapsTo;
    if (!field) return;
    if (coreFields.has(field)) {
        addWarning(
            issues,
            `${coreFieldLabel(field)} is set more than once; Pandoc accepts this and the later value wins.`,
            'optionRows',
            row.id
        );
    }
    coreFields.add(field);
}

function coreFieldLabel(field: OptionField): string {
    if (field === 'from') return 'Input format (-f/--from)';
    if (field === 'to') return 'Output format (-t/--to)';
    if (field === 'output') return 'Output file (-o/--output)';
    return field;
}

function stripExtensions(format: string): string {
    return format.split(/[+-]/)[0];
}

function hasTemplateVariable(value: string): boolean {
    return getExportTemplateVariableNames(value).length > 0;
}

function validateKnownTemplateVariables(
    value: string,
    field: string,
    issues: ValidationIssue[],
    knownTemplateVariables: Set<string>
): void {
    const unknownVariables = getExportTemplateVariableNames(value)
        .filter(name => !knownTemplateVariables.has(name));

    if (unknownVariables.length > 0) {
        addWarning(
            issues,
            `${field} format contains unresolved template variable(s): ${unknownVariables.join(', ')}.`,
            field
        );
    }
}

function isPathKind(spec: OptionSpec): boolean {
    return ['file', 'directory', 'path', 'pathList'].includes(spec.valueKind);
}

function shouldValidateEnumValue(value: string, spec: OptionSpec): boolean {
    const alternative = selectedAlternative(value, spec);
    if (alternative) {
        const values = alternative.values;
        if (alternative.valueKind !== 'enum' || !values?.length) return false;
        return !values.includes(value);
    }
    return spec.valueKind === 'enum' && Boolean(spec.values?.length) && !spec.values?.includes(value);
}

function isPathValue(value: string, spec: OptionSpec): boolean {
    const alternative = selectedAlternative(value, spec);
    if (alternative) return isPathAlternative(alternative);
    return isPathKind(spec);
}

function selectedAlternative(
    value: string,
    spec: OptionSpec
): OptionValueAlternative | undefined {
    const alternatives = spec.valueAlternatives;
    if (!alternatives || alternatives.length <= 1) return undefined;
    if (!value) return alternatives.find(alternative => alternative.valueKind === 'none');
    const valueAlternative = alternatives.find(alternative => alternative.values?.includes(value));
    if (valueAlternative) return valueAlternative;
    if (looksLikeUrlValue(value)) {
        const url = alternatives.find(alternative => alternative.id === 'URL');
        if (url) return url;
    }
    if (looksLikePathValue(value)) {
        const path = alternatives.find(isPathAlternative);
        if (path) return path;
    }
    return alternatives.find(alternative => alternative.valueKind !== 'none' && !isPathAlternative(alternative)) ??
        alternatives.find(isPathAlternative);
}

function isPathAlternative(alternative: OptionValueAlternative): boolean {
    return ['file', 'directory', 'path', 'pathList'].includes(alternative.valueKind);
}

function looksLikePathValue(value: string): boolean {
    return /[\\/]/.test(value) || value.includes('.') || value.includes('${');
}

function looksLikeUrlValue(value: string): boolean {
    return /^[a-z][a-z0-9+.-]*:/i.test(value);
}

function addError(
    issues: ValidationIssue[],
    message: string,
    field?: string,
    rowId?: string
): void {
    issues.push({ severity: 'error', message, field, rowId });
}

function addWarning(
    issues: ValidationIssue[],
    message: string,
    field?: string,
    rowId?: string
): void {
    issues.push({ severity: 'warning', message, field, rowId });
}
