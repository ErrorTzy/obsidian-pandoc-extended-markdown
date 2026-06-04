import type {
    App,
    PluginManifest
} from 'obsidian';
import { normalizePath } from 'obsidian';

import customLabelListFilter from '../../../../../lua_filter/CustomLabelList.lua';
import fencedDivExtendedSyntaxFilter from '../../../../../lua_filter/FencedDivExtendedSyntax.lua';

interface ResourcePlugin {
    app: App;
    manifest: PluginManifest;
}

const LUA_FILTER_RESOURCES = [
    ['CustomLabelList.lua', customLabelListFilter],
    ['FencedDivExtendedSyntax.lua', fencedDivExtendedSyntaxFilter]
] as const;

export async function releaseBundledPandocLuaFilters(plugin: ResourcePlugin): Promise<void> {
    const pluginDir = getPluginDir(plugin);
    if (!pluginDir) {
        return;
    }

    const filterDir = normalizePath(`${pluginDir}/lua_filter`);
    const adapter = plugin.app.vault.adapter;
    await ensureDirectory(plugin.app, filterDir);

    for (const [fileName, content] of LUA_FILTER_RESOURCES) {
        await adapter.write(normalizePath(`${filterDir}/${fileName}`), content);
    }
}

function getPluginDir(plugin: ResourcePlugin): string {
    if (plugin.manifest.dir) {
        return normalizePath(plugin.manifest.dir);
    }

    const vault = plugin.app.vault as typeof plugin.app.vault & {
        configDir?: string;
    };
    if (!vault.configDir) {
        return '';
    }

    return normalizePath(`${vault.configDir}/plugins/${plugin.manifest.id}`);
}

async function ensureDirectory(app: App, path: string): Promise<void> {
    if (await app.vault.adapter.exists(path)) {
        return;
    }

    await app.vault.adapter.mkdir(path);
}
