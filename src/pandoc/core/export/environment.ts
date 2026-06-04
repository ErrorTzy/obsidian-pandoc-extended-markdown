import { renderExportTemplate } from '../templates/template';
import { buildTemplateVariableContext } from '../templates/templateVariables';
import { ExportVariables } from './types';

const DEFAULT_ENV: Record<string, string> = {
    HOME: '${HOME}',
    PATH: '${PATH}',
    TEXINPUTS: '${pluginDir}/textemplate/:'
};

export function buildPandocEnv(
    userEnv: Record<string, string> | undefined,
    variables: ExportVariables,
    platformEnv: Record<string, string> = {}
): Record<string, string> {
    const templateVariables = buildTemplateVariableContext(variables, {
        includeRuntimeEnv: true
    }).variables;
    const merged = {
        ...DEFAULT_ENV,
        ...platformEnv,
        ...(userEnv ?? {})
    };

    return Object.fromEntries(
        Object.entries(merged).map(([key, value]) => [
            key,
            renderExportTemplate(value, templateVariables)
        ])
    );
}
