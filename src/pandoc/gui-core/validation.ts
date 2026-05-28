import { findOptionSpec } from './catalog';
import { readDraftCommandRows } from './profileDraft';
import { getExportTemplateVariableNames } from '../template';
import type {
    OptionSpec,
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
    catalog: PandocOptionCatalog
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    validateRequiredFields(draft, issues);
    if (draft.type === 'pandoc') {
        const command = readDraftCommandRows(draft.optionRows, catalog);
        validateFormat('from', command.from ?? draft.from, catalog.inputFormats, issues, false);
        validateFormat('to', command.to ?? draft.to, catalog.outputFormats, issues, true);
        validateRequiredRows(draft.optionRows, catalog, issues);
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
        if (!row.enabled) continue;
        if (row.role === 'input') {
            validateInputRow(row, issues);
            continue;
        }
        if (!row.key.trim()) continue;
        const spec = findOptionSpec(catalog, row.key);
        if (!spec) {
            addWarning(issues, `Unknown Pandoc option "${row.key}".`, 'optionRows', row.id);
            continue;
        }
        validateRowValue(row, spec, issues);
        validateDuplicate(row, spec, singletonKeys, issues);
    }
}

function validateInputRow(row: ProfileOptionRow, issues: ValidationIssue[]): void {
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
    }, issues, row.id);
}

function validateRowValue(
    row: ProfileOptionRow,
    spec: OptionSpec,
    issues: ValidationIssue[]
): void {
    const value = row.value.trim();
    if (spec.mapsTo === 'from' && !value) return;
    if (spec.valueKind !== 'none' && !value) {
        addError(issues, `${spec.key} requires a value.`, 'optionRows', row.id);
    }
    if (value && ['integer', 'number'].includes(spec.valueKind)) {
        validateNumberValue(value, spec, issues, row.id);
    }
    if (value && spec.valueKind === 'enum' && spec.values?.length && !spec.values.includes(value)) {
        addWarning(issues, `"${value}" is not a known value for ${spec.key}.`, 'optionRows', row.id);
    }
    if (value && isPathKind(spec)) {
        validatePathTemplateValue(value, spec, issues, row.id);
    }
}

function validatePathTemplateValue(
    value: string,
    spec: OptionSpec,
    issues: ValidationIssue[],
    rowId: string
): void {
    const unknownVariables = getExportTemplateVariableNames(value)
        .filter(name => !KNOWN_TEMPLATE_VARIABLES.has(name));

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
