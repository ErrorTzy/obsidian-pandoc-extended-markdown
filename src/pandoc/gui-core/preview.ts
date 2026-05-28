import { buildPandocProfileArgs } from '../profileArgs';
import { renderExportTemplate } from '../template';
import type { ExportVariables } from '../types';
import { compileProfileDraft } from './profileDraft';
import type {
    CommandPreview,
    PandocOptionCatalog,
    ProfileDraft
} from './types';

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
    attachmentFolderPath: '${attachmentFolderPath}',
    embedDirs: '${embedDirs}',
    fromFormat: 'markdown',
    metadata: {}
};

export function buildProfileDraftPreview(
    draft: ProfileDraft,
    catalog?: PandocOptionCatalog,
    variables: ExportVariables = PREVIEW_VARIABLES
): CommandPreview {
    const profile = compileProfileDraft(draft, catalog);
    const tokens = profile.type === 'pandoc' ?
        [getPandocCommand(), ...buildPandocProfileArgs({
            profile,
            variables
        })] :
        [renderExportTemplate(profile.commandTemplate, variables)];

    return {
        tokens,
        display: tokens.map(quoteToken).join(' ')
    };
}

export function quoteToken(token: string): string {
    if (token.length === 0) return '""';
    if (getPlatform() === 'win32') return quoteWindowsToken(token);
    if (!/[\s"'\\$`]/.test(token)) return token;
    return `'${token.replace(/'/g, `'\\''`)}'`;
}

function quoteWindowsToken(token: string): string {
    if (!/[\s"&|<>^;]/.test(token)) return token;
    return `"${token.replace(/"/g, '\\"')}"`;
}

function getPandocCommand(): string {
    return getPlatform() === 'win32' ? 'pandoc.exe' : 'pandoc';
}

function getPlatform(): string {
    const processLike = globalThis as typeof globalThis & {
        process?: { platform?: string };
    };

    return processLike.process?.platform ?? '';
}
