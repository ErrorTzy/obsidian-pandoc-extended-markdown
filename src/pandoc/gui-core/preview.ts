import { buildPandocProfileArgs } from '../profileArgs';
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
    catalog?: PandocOptionCatalog
): CommandPreview {
    const profile = compileProfileDraft(draft, catalog);
    const tokens = profile.type === 'pandoc' ?
        ['pandoc', ...buildPandocProfileArgs({ profile, variables: PREVIEW_VARIABLES })] :
        [profile.commandTemplate];

    return {
        tokens,
        display: tokens.map(quoteToken).join(' ')
    };
}

export function quoteToken(token: string): string {
    if (token.length === 0) return '""';
    if (!/[\s"'\\]/.test(token)) return token;
    return `"${token.replace(/(["\\$`])/g, '\\$1')}"`;
}
