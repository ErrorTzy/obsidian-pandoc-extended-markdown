# Pandoc Export

The plugin includes an optional desktop-only Pandoc export backend. Mobile support and the existing Live Preview/Reading mode renderers do not depend on Pandoc.

Enable **Pandoc export** in the plugin settings, optionally set a Pandoc executable path, then run **Export with pandoc** from the command palette or a file menu. **Export with previous pandoc settings** repeats the last successful profile/folder choice.

Export profiles use argument arrays for built-in Pandoc formats. Advanced custom shell profiles can be added in the profile JSON, but they must use `type: "custom"` and `shell: true`.

## Export Preview

The export modal preview covers every format reported by `pandoc --list-output-formats`. HTML writers, including slide formats and `chunkedhtml`, render through the HTML preview. Text, XML, JSON, TeX, roff, wiki, bibliography, and other markup writers render as text. PDF, DOCX, EPUB, and PPTX render with bundled browser-side JavaScript libraries. ODT uses the optional WebODF add-on when installed and falls back to Pandoc-generated embedded-resource HTML otherwise.

The **Edit pandoc export** command builder separates preset management from command editing. **Preset Options** manages the selected preset, its name, and actions such as save current, reset current, delete current, and restore built-in presets. **Command Options** contains the Pandoc argument rows or custom command fields. The final footer can cancel editor changes or **Save and close** the current preset list as shown; **Save current** persists only the selected preset immediately.

Markdown exports and previews automatically apply the bundled custom-label and
fenced-div filters, even for saved or newly created profiles with no Lua filter
rows. No filter setup is required in the Pandoc module. The Lua files are embedded
into `main.js` at build time and released into the installed plugin folder on
startup, so users do not need to download them separately.

See [Pandoc variables and Lua filters](pandoc-variables-and-filters.md) for the full variable list and filter deployment details.

## Fenced Divs

Use `FencedDivExtendedSyntax.lua` when you want Pandoc output to match plugin fenced-div titles/references and readable shorthand behavior:

```bash
pandoc input.md --lua-filter=lua_filter/FencedDivExtendedSyntax.lua -o output.docx
```

The filter handles:

- readable fenced-div shorthand
- visible generated titles
- `&` placeholder numbering
- known simple `@id` fenced-div references
- preservation of unknown citations

Native Pandoc fenced div syntax works without this filter, but Pandoc will not render `title` as a visible title and will not treat `@id` as a div reference by default.

## Custom Label Lists

In the plugin, enable **Pandoc export**, choose an export profile, and export the
note. For the normal `markdown` input format, the module automatically uses
`CustomLabelReader.lua`, `--preserve-tabs`, and `CustomLabelList.lua`. Markdown
extension flags are retained, and export preview uses the same setup.

For direct Pandoc CLI use:

1. Copy `CustomLabelReader.lua`, `CustomLabelList.lua`, and
   `CustomLabelSupport.lua` from this repository's `lua_filter/` directory or the
   installed plugin's `lua_filter/` directory. Keep all three in the same folder.
2. Select the reader with `-f`, include `--preserve-tabs`, and pass only
   `CustomLabelList.lua` as a Lua filter. For example, with the files in a local
   `lua_filter/` folder:

```bash
pandoc input.md --preserve-tabs -f lua_filter/CustomLabelReader.lua \
    --lua-filter=lua_filter/CustomLabelList.lua -o output.docx
```

The reader preserves exact label whitespace and escaped openings before Markdown
parsing. The filter then converts list items and known references. A marker-only
line with following whitespace is a valid definition, including an empty item or
one followed by continuation content. Soft and hard breaks retain their behavior.

`CustomLabelSupport.lua` loads relative to each script, so commands can run from
any working directory. It is an internal dependency; do not pass it as a separate
Lua filter. Append Markdown extensions to the reader path, for example
`-f lua_filter/CustomLabelReader.lua-smart` to preserve ASCII primes in labels.

Automatic setup applies to `markdown` input with any extension suffix, including
saved profiles whose filter lists are empty. Configured filters are retained,
and the module adds each missing bundled filter once. Explicit custom readers,
other input formats, and custom shell profiles use their configured filters;
configure the CLI options above yourself in a shell profile. Reader overrides in
extra arguments remain under your control.

The source-aware path is verified with local Pandoc 3.10.2. Other Pandoc versions
may be compatible but have not been tested. Direct CLI use must include
`--preserve-tabs`: Pandoc otherwise expands tabs before calling the reader.
The reader expands ordinary tabs outside label syntax at their original columns.

Filter-only CLI invocation remains available, but cannot distinguish normalized
whitespace or escaped openings and can miss whitespace-only marker lines.

## Using Both Filters

If a document uses both fenced-div extensions and custom label lists, pass both filters:

```bash
pandoc input.md --preserve-tabs -f lua_filter/CustomLabelReader.lua \
    --lua-filter=lua_filter/FencedDivExtendedSyntax.lua \
    --lua-filter=lua_filter/CustomLabelList.lua \
    -o output.docx
```

## Matching Plugin-Specific Syntax

Disable `Readable fenced div shorthand` in Obsidian when you want fenced div source that stays closer to native Pandoc Markdown. Native fenced div rendering, generated titles/references, and custom label lists are controlled by their own settings.

Custom label lists are plugin-specific, so export documents containing `{::LABEL}` with `CustomLabelReader.lua`, `--preserve-tabs`, and `CustomLabelList.lua`.

## Literal Ampersands In Fenced Div Titles

For numbered fenced-div titles, `&` is a placeholder. Use `.no-num` or `.unnumbered` when all ampersands should stay literal:

```markdown
::: {.warning #warn .no-num title="AT&T Warning"}
Content
:::
```

When exporting native braced attributes and you need a literal ampersand inside a numbered title, write `\\&` in Markdown source so one backslash survives Pandoc parsing:

```markdown
::: {.case #escaped title="AT\\&T-&.&"}
Content
:::
```
