# Pandoc Variables And Lua Filters

The Pandoc export backend is optional and desktop-only. It lives under `src/pandoc/`, is disabled by default, and does not participate in Live Preview or Reading mode rendering.

## Template Variables

Export profiles, environment overrides, resource paths, Lua filter paths, metadata values, and advanced custom shell commands use simple `${name}` replacement. Unknown variables are preserved literally. JavaScript expressions are not evaluated.

The command builder suggests built-in export variables first. Runtime environment variable suggestions are disabled by default because their values may contain sensitive information. Enable **Suggest runtime environment variables** in Pandoc export settings to include current environment variables after the built-in export variables. The template syntax remains `${NAME}` on every operating system because the plugin resolves these placeholders before passing arguments or environment overrides to Pandoc.

| Variable | Meaning |
| --- | --- |
| `vaultDir` | Absolute path to the current vault. |
| `pluginDir` | Absolute path to the installed plugin directory. |
| `luaFilterDir` | Absolute path to the plugin's `lua_filter` directory. |
| `currentPath` | Absolute path to the source note being exported. |
| `currentDir` | Absolute directory containing the source note. |
| `currentFileName` | Source note basename without extension. |
| `currentFileFullName` | Source note filename with extension. |
| `outputPath` | Absolute path to the requested export output. |
| `outputDir` | Absolute directory containing the requested output. |
| `outputFileName` | Output basename without extension. |
| `outputFileFullName` | Output filename with extension. |
| `attachmentFolderPath` | Absolute attachment folder path from Obsidian vault settings. Relative attachment folders resolve from the current note directory. |
| `embedDirs` | Platform-delimited list of directories for embedded files found in Obsidian metadata. |
| `fromFormat` | Default Pandoc input format. Uses `markdown+wikilinks_title_after_pipe` unless the vault is configured for Markdown links. |
| `metadata` | Frontmatter metadata object from Obsidian's metadata cache. |

## Built-In Paths

Default export profiles use:

```text
--resource-path ${currentDir}
--resource-path ${attachmentFolderPath}
--resource-path ${vaultDir}
--resource-path ${embedDirs}
--lua-filter ${luaFilterDir}/FencedDivExtendedSyntax.lua
--lua-filter ${luaFilterDir}/CustomLabelList.lua
```

`embedDirs` may be empty. Empty rendered template values are skipped for repeated path options.

## Bundled Lua Filters

The repository keeps source filters in `lua_filter/`:

- `FencedDivExtendedSyntax.lua`
- `CustomLabelList.lua`

The build config loads `.lua` files as text and embeds them into `main.js`. On plugin load, `releaseBundledPandocLuaFilters()` writes them into:

```text
<pluginDir>/lua_filter/FencedDivExtendedSyntax.lua
<pluginDir>/lua_filter/CustomLabelList.lua
```

This keeps the normal Obsidian release assets simple while still ensuring installed users have the filters required by the default export profiles.

## Filter Responsibilities

`FencedDivExtendedSyntax.lua` provides export behavior for plugin-specific fenced-div titles, references, and readable shorthand:

- readable shorthand normalization
- visible generated titles
- `&` placeholder numbering
- known simple `@id` references
- preservation of unknown citations

`CustomLabelList.lua` handles plugin-specific custom labels:

- `{::LABEL}` definitions
- `{::LABEL}` references
- placeholder numbering such as `{::P(#a)}`

## Profile Notes

Pandoc profiles are represented as argument arrays and executed without shell-string construction. Advanced custom shell profiles are available only when explicitly configured with `type: "custom"` and `shell: true`.

Default profiles include Markdown, Markdown Hugo, HTML, TextBundle, Typst, PDF, DOCX, ODT, RTF, EPUB, LaTeX, MediaWiki, reStructuredText, Textile, OPML, Bibliography, and PPTX.
