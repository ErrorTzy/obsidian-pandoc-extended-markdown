import {
    ExportVariables,
    PandocExportProfile
} from './types';
import {
    renderExportTemplate,
    renderExportTemplates
} from './template';

export interface BuildProfileArgsRequest {
    profile: PandocExportProfile;
    variables: ExportVariables;
    extraArgs?: string[];
}

export function buildPandocProfileArgs(request: BuildProfileArgsRequest): string[] {
    const { profile, variables } = request;
    const args = [
        variables.currentPath,
        '-f',
        renderExportTemplate(profile.from ?? variables.fromFormat, variables),
        '-t',
        renderExportTemplate(profile.to, variables)
    ];

    appendOutputArgs(args, profile, variables);

    if (profile.standalone) {
        args.push('--standalone');
    }

    appendRepeatedArgs(args, '--resource-path', profile.resourcePaths, variables);
    appendRepeatedArgs(args, '--lua-filter', profile.luaFilters, variables);
    appendMetadataArgs(args, profile.metadata, variables);

    return [
        ...args,
        ...renderExportTemplates(profile.extraArgs, variables),
        ...(request.extraArgs ?? [])
    ];
}

function appendOutputArgs(
    args: string[],
    profile: PandocExportProfile,
    variables: ExportVariables
): void {
    const profileHasOutput = (profile.extraArgs ?? [])
        .some(arg => arg === '-o' || arg === '--output' || arg.startsWith('--output='));

    if (!profileHasOutput) {
        args.push('-o', variables.outputPath);
    }
}

function appendRepeatedArgs(
    args: string[],
    option: string,
    values: string[] | undefined,
    variables: ExportVariables
): void {
    for (const value of renderExportTemplates(values, variables)) {
        if (value.length > 0) {
            args.push(option, value);
        }
    }
}

function appendMetadataArgs(
    args: string[],
    metadata: Record<string, string> | undefined,
    variables: ExportVariables
): void {
    for (const [key, value] of Object.entries(metadata ?? {})) {
        args.push('--metadata', `${key}=${renderExportTemplate(value, variables)}`);
    }
}
