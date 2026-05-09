# Pandoc Export

The Obsidian plugin changes Live Preview and Reading mode. It does not automatically change output from the `pandoc` command.

For plugin-specific syntax, use the bundled Lua filters in `lua_filter/`.

## Fenced Divs

Use `FencedDivExtendedSyntax.lua` when you want Pandoc output to match non-strict plugin fenced-div behavior:

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

## Strict Pandoc Mode

Strict Pandoc mode in Obsidian is useful when you want source that stays closer to native Pandoc Markdown. It disables plugin-specific fenced-div shorthand and fenced-div reference rendering in Obsidian.

Custom label lists are still plugin-specific even when strict Pandoc mode is enabled, so export documents containing `{::LABEL}` with `CustomLabelList.lua`.

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
