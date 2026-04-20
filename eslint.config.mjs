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
]);
