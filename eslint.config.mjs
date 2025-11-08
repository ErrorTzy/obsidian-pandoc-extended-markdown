import { fileURLToPath } from "node:url";
import globals from "globals";
import obsidianmd from "eslint-plugin-obsidianmd";

const tsconfigRootDir = fileURLToPath(new URL(".", import.meta.url));

const normalizedRecommendedConfigs = [];

for (const config of obsidianmd.configs.recommended) {
  if (Array.isArray(config)) {
    normalizedRecommendedConfigs.push(...config);
    continue;
  }

  const { extends: extendsConfigs, ...rest } = config ?? {};

  if (extendsConfigs) {
    for (const extended of extendsConfigs) {
      if (Array.isArray(extended)) {
        normalizedRecommendedConfigs.push(...extended);
      } else if (extended) {
        normalizedRecommendedConfigs.push(extended);
      }
    }
  }

  normalizedRecommendedConfigs.push(rest);
}

const TS_PROJECT_CONFIG = {
  files: ["**/*.ts", "**/*.tsx"],
  languageOptions: {
    parserOptions: {
      project: "./tsconfig.json",
      tsconfigRootDir,
    },
  },
};

export default [
  {
    ignores: ["main.js", "tests/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  ...normalizedRecommendedConfigs,
  TS_PROJECT_CONFIG,
];
