import { expect } from '@wdio/globals';
import { execFileSync } from 'child_process';
import {
    mkdir,
    readFile,
    rm,
    writeFile
} from 'fs/promises';
import { join, resolve } from 'path';

import {
    ExportProfile,
    normalizePandocExportSettings,
    PandocExportManager
} from '../../../src/pandoc';

const repoRoot = process.cwd();
const fixtureDir = resolve('tests/e2e/fixtures/pandoc-export');
const workDir = resolve('tests/e2e/.tmp/pandoc-export-conversion');
const sourcePath = 'tests/e2e/.tmp/pandoc-export-conversion/pandoc-export-conversion.md';
const outputDir = resolve(workDir, 'out');
const outputFilePath = resolve(outputDir, 'pandoc-export-conversion.html');
const inputFixturePath = resolve(fixtureDir, 'extended-syntax.md');
const expectedFixturePath = resolve(fixtureDir, 'extended-syntax.html');
const profileId = 'e2e-html-fragment';

describe('Pandoc export conversion', () => {
    after(async () => {
        await rm(workDir, { recursive: true, force: true });
    });

    it('matches the checked-in HTML fixture byte-for-byte', async function () {
        const pandocPath = getPandocPath();
        if (!pandocPath) {
            this.skip();
        }

        await rm(workDir, { recursive: true, force: true });
        await mkdir(workDir, { recursive: true });
        await writeFile(resolve(repoRoot, sourcePath), await readFile(inputFixturePath, 'utf8'));

        const manager = new PandocExportManager({
            app: createApp(),
            manifest: { id: 'pandoc-extended-markdown', dir: '.' } as any,
            settings: normalizePandocExportSettings({
                enabled: true,
                pandocPath,
                profiles: [createHtmlFixtureProfile()],
                showOverwriteConfirmation: false,
                openOutputFile: false,
                revealOutputFile: false
            })
        });

        const result = await manager.exportFile({
            currentFilePath: sourcePath,
            currentFileName: 'pandoc-export-conversion.md',
            currentFileBaseName: 'pandoc-export-conversion',
            outputFolder: outputDir,
            profileId
        });

        expect(result.ok).toBe(true);
        const actual = await readFile(outputFilePath, 'utf8');
        const expected = await readFile(expectedFixturePath, 'utf8');
        expect(actual).toBe(expected);
    });
});

function getPandocPath(): string | undefined {
    try {
        const pandocPath = execFileSync('which', ['pandoc'], { encoding: 'utf8' }).trim();
        execFileSync(pandocPath, ['--version'], { stdio: 'ignore' });
        return pandocPath;
    } catch {
        return undefined;
    }
}

function createApp() {
    return {
        vault: {
            adapter: {
                getBasePath: () => repoRoot,
                getFullPath: (path: string) => join(repoRoot, path)
            },
            config: {
                attachmentFolderPath: '/'
            }
        },
        metadataCache: {
            getCache: () => null,
            getFirstLinkpathDest: () => null
        }
    } as any;
}

function createHtmlFixtureProfile(): ExportProfile {
    return {
        id: profileId,
        name: 'E2E HTML fragment',
        type: 'pandoc',
        from: [
            'markdown',
            '+fancy_lists',
            '+definition_lists',
            '+fenced_divs',
            '+superscript',
            '+subscript',
            '+wikilinks_title_after_pipe'
        ].join(''),
        to: 'html',
        extension: '.html',
        standalone: false,
        luaFilters: [
            '${luaFilterDir}/FencedDivExtendedSyntax.lua',
            '${luaFilterDir}/CustomLabelList.lua'
        ],
        resourcePaths: ['${currentDir}', '${vaultDir}']
    };
}
