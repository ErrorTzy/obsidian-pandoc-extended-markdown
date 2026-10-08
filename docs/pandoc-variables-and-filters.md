# Pandoc Variables And Lua Filters

The Pandoc export backend is optional and desktop-only. It lives under `src/pandoc/`, is disabled by default, and does not participate in Live Preview or Reading mode rendering.

## Template Variables

Export profiles, environment overrides, resource paths, Lua filter paths, metadata values, and advanced custom shell commands use simple `${name}` replacement. Unknown variables are preserved literally. JavaScript expressions are not evaluated.

The command builder and environment value editor suggest built-in export variables first. Runtime environment variable suggestions are disabled by default because their values may contain sensitive information. Open **Advanced Pandoc settings** and enable **Suggest runtime environment variables** to include current environment variables after the built-in export variables. The template syntax remains `${NAME}` on every operating system because the plugin resolves these placeholders before passing arguments or environment overrides to Pandoc.

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

## Process Environment Overrides

Open **Advanced Pandoc settings** to edit global Pandoc process environment overrides. The **Pandoc process environment** table stores one variable per row with separate **Variable** and **Value** fields. Variable names must use conventional environment variable syntax such as `TEXINPUTS` or `PATH`; blank rows are ignored, duplicate names are rejected, and an empty value is allowed when a variable name is present.

Values preserve the text you type and support the same `${name}` template variables as export profiles. For example, `TEXINPUTS` can use `${pluginDir}/textemplate/:`.

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

Definitions start a paragraph line with `{::LABEL}` followed by whitespace. The
filter scans definitions in document order inside fenced divs, quotes, native
lists, definition bodies, table cells, and footnotes before resolving references.
Repeated placeholder names share their number; references never allocate numbers.
Forward references therefore work, while a reference containing any unknown
placeholder remains literal even if it could match a manually numbered label.

Text before the first marker remains ordinary paragraph content. Non-marker
lines after a marker continue that item until the next marker or the paragraph
boundary, preserving inline formatting and soft/hard breaks. Adjacent custom
items form native definition lists for HTML/LaTeX and other non-Word writers;
DOCX, ODT, and RTF use a bold label followed by a tab and the preserved body.
Definitions without following whitespace are rejected and keep their content.
Compound labels such as `1.1` are literal labels; indentation alone does not
create a hierarchy of custom items.

Reference expressions follow the plugin's grammar: after removing known
placeholder groups, the remainder may contain one initial ASCII letter and
whitespace, digits, arithmetic operators (`+ - * /`), commas, parentheses, and
ASCII primes. Thus `{::P(#a),(#b)}` can resolve without that exact label being
defined, while `{::UNDEFINED+(#a)}` cannot. Other references must match a defined
label's exact base after removing trailing ASCII primes; `Theorem1` does not
match `Theorem10'''`. Syntax spanning `Str`/`Space` nodes supports long names and
adjacent text. Breaks, code, math, and rich inline nodes delimit syntax runs;
references inside emphasis or links are processed within those nodes. Pandoc
smart typography is applied before filters; use `markdown-smart` to retain
literal ASCII primes in labels when invoking Pandoc directly.

## Profile Notes

Pandoc profiles are represented as argument arrays and executed without shell-string construction. Advanced custom shell profiles are available only when explicitly configured with `type: "custom"` and `shell: true`.

Default profiles include Markdown, Markdown Hugo, HTML, TextBundle, Typst, PDF, DOCX, ODT, RTF, EPUB, LaTeX, MediaWiki, reStructuredText, Textile, OPML, Bibliography, and PPTX.
