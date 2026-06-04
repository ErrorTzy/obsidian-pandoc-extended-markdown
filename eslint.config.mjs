import { fileURLToPath } from 'node:url';
import tsparser from '@typescript-eslint/parser';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import obsidianmd from 'eslint-plugin-obsidianmd';

const tsconfigRootDir = fileURLToPath(new URL('.', import.meta.url));
const recommendedConfigs = obsidianmd.configs.recommended.filter((config) => {
    const ruleNames = Object.keys(config.rules ?? {});
    const hasObsidianRules = ruleNames.some((ruleName) => ruleName.startsWith('obsidianmd/'));

    return config.files || !hasObsidianRules;
});

export default defineConfig([
    {
        ignores: [
            'main.js',
            'jest.config.js',
            'esbuild.config.mjs',
            'wdio.conf.mts',
            'tests/**',
            'lua_filter/**/*.spec.ts',
            '__mocks__/**',
        ],
    },
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
    },
    ...recommendedConfigs,
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                project: './tsconfig.json',
                tsconfigRootDir,
            },
        },
        rules: {
            'obsidianmd/prefer-active-doc': 'off',
        },
    },
    {
        files: ['src/pandoc/core/**/*.ts'],
        rules: {
            'no-restricted-globals': ['error', {
                name: 'process',
                message: 'Pandoc core must receive runtime environment through injected ports.'
            }, {
                name: 'window',
                message: 'Pandoc core must not depend on browser globals.'
            }, {
                name: 'document',
                message: 'Pandoc core must not depend on DOM globals.'
            }],
            'no-restricted-imports': ['error', {
                paths: [
                    'obsidian',
                    'electron',
                    'fs',
                    'path',
                    'os',
                    'child_process',
                    'crypto',
                    'http',
                    'https',
                ],
                patterns: [
                    'node:*',
                    '../gui/*',
                    '../../gui/*',
                    '../os/*',
                    '../../os/*',
                    '../desktopAdapter',
                    '../fileSystem',
                    '../shellRunner',
                    '../nodeModule',
                    '../argParser',
                    '../defaultProfiles',
                    '../environment',
                    '../outputExtension',
                    '../pandocArgs',
                    '../pandocPath',
                    '../pathUtils',
                    '../previewOutput',
                    '../profileArgs',
                    '../settings',
                    '../template',
                    '../templateVariables',
                    '../variables',
                    '../../argParser',
                    '../../defaultProfiles',
                    '../../environment',
                    '../../outputExtension',
                    '../../pandocArgs',
                    '../../pandocPath',
                    '../../pathUtils',
                    '../../previewOutput',
                    '../../profileArgs',
                    '../../settings',
                    '../../template',
                    '../../templateVariables',
                    '../../types',
                    '../../variables',
                ],
            }],
            'no-restricted-syntax': ['error', {
                selector: "MemberExpression[object.name='globalThis'][property.name=/^(process|window|document)$/]",
                message: 'Pandoc core must receive host runtime access through injected ports.'
            }, {
                selector: "TSTypeReference > Identifier[name=/^(Document|HTMLElement|HTMLButtonElement|HTMLDivElement|Node|Window)$/]",
                message: 'Pandoc core must not use DOM types.'
            }],
        },
    },
    {
        files: ['src/pandoc/gui/**/*.ts'],
        rules: {
            'no-restricted-imports': ['error', {
                paths: [
                    'electron',
                    'fs',
                    'path',
                    'os',
                    'child_process',
                    'crypto',
                    'http',
                    'https',
                ],
                patterns: [
                    'node:*',
                    '../os/*',
                    '../../os/*',
                    '../../../os/*',
                    '**/os/*',
                ],
            }],
        },
    },
    {
        files: ['src/pandoc/os/**/*.ts'],
        rules: {
            'no-restricted-imports': ['error', {
                paths: [
                    'obsidian',
                ],
                patterns: [
                    '../../gui/*',
                    '../gui/*',
                    '**/gui/*',
                ],
            }],
        },
    },
]);
