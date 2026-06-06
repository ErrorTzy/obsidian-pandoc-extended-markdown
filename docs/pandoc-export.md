# Pandoc Export

The plugin includes an optional desktop-only Pandoc export backend. Mobile support and the existing Live Preview/Reading mode renderers do not depend on Pandoc.

Enable **Pandoc export** in the plugin settings, optionally set a Pandoc executable path, then run **Export with pandoc** from the command palette or a file menu. **Export with previous pandoc settings** repeats the last successful profile/folder choice.

Export profiles use argument arrays for built-in Pandoc formats. Advanced custom shell profiles can be added in the profile JSON, but they must use `type: "custom"` and `shell: true`.

## Export Preview

The export modal preview covers every format reported by `pandoc --list-output-formats`. HTML writers, including slide formats and `chunkedhtml`, render through the HTML preview. Text, XML, JSON, TeX, roff, wiki, bibliography, and other markup writers render as text. PDF, DOCX, EPUB, and PPTX render with bundled browser-side JavaScript libraries. ODT uses the optional WebODF add-on when installed and falls back to Pandoc-generated embedded-resource HTML otherwise.

The **Edit pandoc export** command builder separates preset management from command editing. **Preset Options** manages the selected preset, its name, and actions such as save current, reset current, delete current, and restore built-in presets. **Command Options** contains the Pandoc argument rows or custom command fields. The final footer can cancel editor changes or **Save and close** the current preset list as shown; **Save current** persists only the selected preset immediately.

For plugin-specific syntax, use the bundled Lua filters in `lua_filter/`. The filters are embedded into `main.js` at build time and released into the installed plugin folder on startup, so users do not need to download them separately.

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

Custom label lists are plugin-specific. Use `CustomLabelList.lua` when exporting notes that contain `{::LABEL}` syntax:

```bash
pandoc input.md --lua-filter=lua_filter/CustomLabelList.lua -o output.docx
```

The filter converts custom label list items and references into output that matches the plugin's rendered labels.

## Using Both Filters

If a document uses both fenced-div extensions and custom label lists, pass both filters:

```bash
pandoc input.md \
    --lua-filter=lua_filter/FencedDivExtendedSyntax.lua \
    --lua-filter=lua_filter/CustomLabelList.lua \
    -o output.docx
```

## Matching Plugin-Specific Syntax

Disable `Readable fenced div shorthand` in Obsidian when you want fenced div source that stays closer to native Pandoc Markdown. Native fenced div rendering, generated titles/references, and custom label lists are controlled by their own settings.

Custom label lists are plugin-specific, so export documents containing `{::LABEL}` with `CustomLabelList.lua`.

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
