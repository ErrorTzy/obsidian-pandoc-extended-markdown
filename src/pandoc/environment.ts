import { renderExportTemplate } from './template';
import { buildTemplateVariableContext } from './templateVariables';
import { ExportVariables } from './types';

const DEFAULT_ENV: Record<string, string> = {
    HOME: '${HOME}',
    PATH: '${PATH}',
    TEXINPUTS: '${pluginDir}/textemplate/:'
};

const WINDOWS_ENV: Record<string, string> = {
    PATH: '${HOME}\\AppData\\Local\\Pandoc;${PATH}',
    TEXINPUTS: '${pluginDir}/textemplate/;'
};

const MACOS_ENV: Record<string, string> = {
    PATH: '/opt/homebrew/bin:/usr/local/bin:/Library/TeX/texbin:${PATH}'
};

export function buildPandocEnv(
    userEnv: Record<string, string> | undefined,
    variables: ExportVariables
): Record<string, string> {
    const templateVariables = buildTemplateVariableContext(variables, {
        includeRuntimeEnv: true
    }).variables;
    const merged = {
        ...DEFAULT_ENV,
        ...getPlatformDefaults(),
        ...(userEnv ?? {})
    };

    return Object.fromEntries(
        Object.entries(merged).map(([key, value]) => [
            key,
            renderExportTemplate(value, templateVariables)
        ])
    );
}

function getPlatformDefaults(): Record<string, string> {
    const platform = getPlatform();
    if (platform === 'win32') {
        return WINDOWS_ENV;
    }
    if (platform === 'darwin') {
        return MACOS_ENV;
    }

    return {};
}

function getPlatform(): string {
    const processLike = globalThis as typeof globalThis & {
        process?: { platform?: string };
    };

    return processLike.process?.platform ?? '';
}
