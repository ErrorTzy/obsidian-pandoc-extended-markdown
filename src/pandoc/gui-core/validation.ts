import { findOptionSpec } from './catalog';
import { readDraftCommandRows } from './profileDraft';
import type {
    OptionSpec,
    PandocOptionCatalog,
    ProfileDraft,
    ProfileOptionRow,
    ValidationIssue
} from './types';

const TEMPLATE_PATTERN = /\$\{[^}]+}/;

export function validateProfileDraft(
    draft: ProfileDraft,
    catalog: PandocOptionCatalog
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    validateRequiredFields(draft, issues);
    if (draft.type === 'pandoc') {
        const command = readDraftCommandRows(draft.optionRows, catalog);
        validateFormat('from', command.from ?? draft.from, catalog.inputFormats, issues, false);
        validateFormat('to', command.to ?? draft.to, catalog.outputFormats, issues, true);
        validateRows(draft.optionRows, catalog, issues);
    }

    return issues;
}

export function hasValidationErrors(issues: ValidationIssue[]): boolean {
    return issues.some(issue => issue.severity === 'error');
}

function validateRequiredFields(draft: ProfileDraft, issues: ValidationIssue[]): void {
    if (!draft.id.trim()) addError(issues, 'Profile id is required.', 'id');
    if (!draft.name.trim()) addError(issues, 'Profile name is required.', 'name');
    if (!draft.extension.trim()) addError(issues, 'Output extension is required.', 'extension');
    if (draft.type === 'custom' && !draft.customCommandTemplate.trim()) {
        addError(issues, 'Custom command template is required.', 'customCommandTemplate');
    }
}

function validateFormat(
    field: string,
    value: string,
    formats: string[],
    issues: ValidationIssue[],
    required: boolean
): void {
    const trimmed = value.trim();
    if (!trimmed && !required) return;
    if (!trimmed) {
        addError(issues, `${field} format is required.`, field);
        return;
    }
    if (formats.length > 0 && !formats.includes(stripExtensions(trimmed))) {
        addWarning(issues, `"${trimmed}" is not in the installed Pandoc ${field} format list.`, field);
    }
}

function validateRows(
    rows: ProfileOptionRow[],
    catalog: PandocOptionCatalog,
    issues: ValidationIssue[]
): void {
    const singletonKeys = new Set<string>();

    for (const row of rows) {
        if (!row.enabled || !row.key.trim()) continue;
        const spec = findOptionSpec(catalog, row.key);
        if (!spec) {
            addWarning(issues, `Unknown Pandoc option "${row.key}".`, 'optionRows', row.id);
            continue;
        }
        validateRowValue(row, spec, issues);
        validateDuplicate(row, spec, singletonKeys, issues);
    }
}

function validateRowValue(
    row: ProfileOptionRow,
    spec: OptionSpec,
    issues: ValidationIssue[]
): void {
    const value = row.value.trim();
    if (spec.mapsTo === 'from' && !value) return;
    if (spec.valueKind !== 'none' && spec.valueKind !== 'boolean' && !value) {
        addError(issues, `${spec.key} requires a value.`, 'optionRows', row.id);
    }
    if (value && ['integer', 'number'].includes(spec.valueKind)) {
        validateNumberValue(value, spec, issues, row.id);
    }
    if (value && spec.valueKind === 'enum' && spec.values?.length && !spec.values.includes(value)) {
        addWarning(issues, `"${value}" is not a known value for ${spec.key}.`, 'optionRows', row.id);
    }
    if (value && isPathKind(spec) && TEMPLATE_PATTERN.test(value)) {
        addWarning(issues, `${spec.key} contains a template path and cannot be checked now.`, 'optionRows', row.id);
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
    issues: ValidationIssue[]
): void {
    if (spec.repeatable) return;
    if (singletonKeys.has(spec.key)) {
        addWarning(issues, `${spec.key} is usually used only once.`, 'optionRows', row.id);
    }
    singletonKeys.add(spec.key);
}

function stripExtensions(format: string): string {
    return format.split(/[+-]/)[0];
}

function isPathKind(spec: OptionSpec): boolean {
    return ['file', 'directory', 'path', 'pathList'].includes(spec.valueKind);
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
