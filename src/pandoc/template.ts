import { ExportVariables } from './types';

const TEMPLATE_VARIABLE = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

export function getExportTemplateVariableNames(template: string): string[] {
    const variables: string[] = [];
    let match: RegExpExecArray | null;

    TEMPLATE_VARIABLE.lastIndex = 0;
    while ((match = TEMPLATE_VARIABLE.exec(template)) !== null) {
        variables.push(match[1]);
    }

    return variables;
}

export function renderExportTemplate(
    template: string,
    variables: Partial<ExportVariables> & Record<string, unknown>
): string {
    return template.replace(TEMPLATE_VARIABLE, (match, name: string) => {
        const value = variables[name];
        if (value === undefined || value === null) {
            return match;
        }

        return stringifyTemplateValue(value);
    });
}

export function renderExportTemplates(
    values: string[] | undefined,
    variables: ExportVariables
): string[] {
    return (values ?? [])
        .map(value => renderExportTemplate(value, variables))
        .filter(value => value.length > 0);
}

function stringifyTemplateValue(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return value.toString();
    }

    return JSON.stringify(value);
}
