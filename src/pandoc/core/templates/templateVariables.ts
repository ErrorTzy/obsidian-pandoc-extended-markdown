import type { ExportVariables } from '../export/types';

export interface TemplateVariableContextOptions {
    includeRuntimeEnv?: boolean;
    runtimeEnv?: Record<string, string | undefined>;
}

export interface TemplateVariableContext {
    variables: ExportVariables & Record<string, unknown>;
    builtInNames: string[];
    runtimeEnvNames: string[];
}

export const TEMPLATE_VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function buildTemplateVariableContext(
    variables: ExportVariables,
    options: TemplateVariableContextOptions = {}
): TemplateVariableContext {
    const builtInNames = validVariableNames(variables);
    const builtInNameSet = new Set(builtInNames);
    const runtimeEnv = options.includeRuntimeEnv ?
        normalizeRuntimeEnv(options.runtimeEnv) :
        {};
    const runtimeEnvNames = validVariableNames(runtimeEnv)
        .filter(name => !builtInNameSet.has(name))
        .sort((a, b) => a.localeCompare(b));

    return {
        variables: {
            ...runtimeEnv,
            ...variables
        },
        builtInNames,
        runtimeEnvNames
    };
}

function normalizeRuntimeEnv(env?: Record<string, string | undefined>): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(env ?? {})) {
        if (value !== undefined) {
            result[key] = value;
        }
    }
    if (!result.HOME && result.USERPROFILE) {
        result.HOME = result.USERPROFILE;
    }

    return result;
}

function validVariableNames(variables: Record<string, unknown>): string[] {
    return Object.keys(variables)
        .filter(name => TEMPLATE_VARIABLE_NAME.test(name))
        .filter(name => variables[name] !== undefined && variables[name] !== null);
}
