import { buildPandocProfileArgs } from './args/profileArgs';
import { renderExportTemplate } from './templates/template';
import type { ExportVariables } from './export/types';
import { compileProfileDraft } from './profileDraft';
import type {
    CommandPreview,
    PandocOptionCatalog,
    ProfileDraft
} from './types';

export type PandocCommandPreviewPlatform = 'posix' | 'windows';

const PREVIEW_VARIABLES: ExportVariables = {
    vaultDir: '${vaultDir}',
    pluginDir: '${pluginDir}',
    luaFilterDir: '${luaFilterDir}',
    currentPath: '${currentPath}',
    currentDir: '${currentDir}',
    currentFileName: '${currentFileName}',
    currentFileFullName: '${currentFileFullName}',
    outputPath: '${outputPath}',
    outputDir: '${outputDir}',
    outputFileName: '${outputFileName}',
    outputFileFullName: '${outputFileFullName}',
    outputExtension: '${outputExtension}',
    attachmentFolderPath: '${attachmentFolderPath}',
    embedDirs: '${embedDirs}',
    fromFormat: 'markdown',
    metadata: {}
};

export function buildProfileDraftPreview(
    draft: ProfileDraft,
    catalog?: PandocOptionCatalog,
    variables: ExportVariables = PREVIEW_VARIABLES,
    platform: PandocCommandPreviewPlatform = 'posix'
): CommandPreview {
    const profile = compileProfileDraft(draft, catalog);
    const tokens = profile.type === 'pandoc' ?
        [getPandocCommand(platform), ...buildPandocProfileArgs({
            profile,
            variables
        })] :
        [renderExportTemplate(profile.commandTemplate, variables)];

    return {
        tokens,
        display: tokens.map(token => quoteTokenForPlatform(token, platform)).join(' ')
    };
}

export function quoteToken(token: string): string {
    return quoteTokenForPlatform(token, 'posix');
}

export function quoteTokenForPlatform(
    token: string,
    platform: PandocCommandPreviewPlatform = 'posix'
): string {
    if (token.length === 0) return '""';
    if (platform === 'windows') return quoteWindowsToken(token);
    if (!/[\s"'\\$`]/.test(token)) return token;
    return `'${token.replace(/'/g, `'\\''`)}'`;
}

function quoteWindowsToken(token: string): string {
    if (!/[\s"&|<>^;]/.test(token)) return token;
    return `"${token.replace(/"/g, '\\"')}"`;
}

function getPandocCommand(platform: PandocCommandPreviewPlatform): string {
    return platform === 'windows' ? 'pandoc.exe' : 'pandoc';
}
