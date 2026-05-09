# Fenced Divs

Fenced div support has two layers:

- Native Pandoc fenced div syntax.
- Plugin rendering and readable shorthand syntax, enabled when strict Pandoc mode is off.

Use strict Pandoc mode when you want Obsidian rendering to stay close to native Pandoc behavior. Use non-strict mode when you want visible theorem-style titles, generated numbering, readable shorthand, and document-local `@id` references while editing.

## Native Pandoc Syntax

Pandoc accepts braced attributes:

```markdown
::: {.theorem #compact title="Theorem"}
Every compact metric space is complete.
:::
```

Pandoc creates a `Div` with class `theorem`, identifier `compact`, and attribute `title="Theorem"`. Native Pandoc does not render the `title` attribute as visible text and does not treat `@compact` as a div cross-reference.

Pandoc also accepts one unbraced class token:

```markdown
::: theorem
Content
:::
```

That is equivalent to:

```markdown
::: {.theorem}
Content
:::
```

Native Pandoc does not support multi-token shortcuts such as `::: theorem lemma`, `::: theorem #id`, or `::: theorem {#id}`.

## Plugin Rendering

When fenced divs are enabled and strict Pandoc mode is off, Live Preview and Reading mode render visible block titles and known local references:

```markdown
::: {.theorem #compact title="Theorem"}
Every compact metric space is complete.
:::

See @compact.
```

The block title and the `@compact` reference both render as `Theorem`.

Unknown citations are preserved for other citation processors:

```markdown
Known @compact and unknown @doe2020.
```

Only `@compact` is replaced if `compact` is a known fenced div id.

## Title Rules

A fenced div gets a visible title when it has an explicit `title` attribute or at least one relevant class.

```markdown
::: {.logic-block #premise}
Content
:::
```

Without an explicit title, the first non-control class is humanized. Here, `logic-block` renders as `Logic Block`.

Rules:

- Explicit `title="..."` wins.
- Without `title`, the first non-control class becomes the title.
- Control classes such as `.no-num` and `.unnumbered` do not become titles.
- Placeholder-only classes such as `&` and `&.&` do not become titles.
- An id-only div such as `::: {#misc}` has no visible title; `@misc` renders as `Div`.

## Numbering

Numbering is opt-in. Put `&` in the title template where the generated number should appear.

```markdown
::: {.proposition #prop:a title="Proposition &"}
A proposition.
:::

::: {.logic-block #prem:a title="Premise &"}
A premise.
:::

See @prop:a and @prem:a.
```

These render as `Proposition 1` and `Premise 1`.

Only the first unescaped placeholder group is replaced. A group is `&`, `&.&`, `&.&.&`, and so on. The number of `&` tokens controls counter depth.

```markdown
::: {.case #c1 title="Case &"}
Top-level case.
:::

::: {.case #c1a title="Case &.&"}
Nested case.
:::

::: {.note #n1 title="& Note"}
Front-numbered note.
:::
```

These render as `Case 1`, `Case 1.1`, and `1 Note`.

Numbering is grouped by title stem, not by physical nesting. A `Case &.&` block uses the current shallower `Case &` counter even if the blocks are not physically nested.

## Literal Ampersands

Use `.no-num` or `.unnumbered` when ampersands should stay literal:

```markdown
::: {.warning #warn .no-num title="AT&T Warning"}
Literal ampersand, no numbering.
:::
```

To keep a literal ampersand inside a numbered title, escape it at the title-template layer. In native braced attributes, Pandoc consumes one source backslash before the Lua filter sees it, so write `\\&` when exporting with Pandoc:

```markdown
::: {.case #escaped title="AT\\&T-&.&"}
Content
:::
```

This renders and references as `AT&T-1.1`.

## Readable Shorthand

When strict Pandoc mode is off, the plugin accepts readable token shorthand:

```markdown
::: theorem important #compact title="Theorem &"
Content
:::
```

The plugin treats that like:

```markdown
::: {.theorem .important #compact title="Theorem &"}
Content
:::
```

Supported tokens include:

- `#id`
- bare classes
- `key=value` attributes
- quoted values such as `title="hello world"`

If no explicit title is present, the first relevant class supplies the title.

### Placeholder Shorthand

When numbering placeholders are separate tokens, the title template is synthesized from the semantic class plus the placeholder:

```markdown
::: Case & #c1
Top-level case.
:::

::: Case &.& #c1a
Nested case.
:::

::: & Note #n1
Front-numbered note.
:::
```

These behave like title templates `Case &`, `Case &.&`, and `& Note`.

Prefer separated placeholder tokens so CSS can still target the semantic class. `::: Case_&.&` also renders as `Case 1.1`, but its class is literally `Case_&.&`.

### Titles With Spaces

For titles with spaces, put title text outside braced attributes. The attribute block may come before or after the title text:

```markdown
::: title with space {.case #a1}
Content
:::

::: {.case #b1} title with space until linebreak
Content
:::
```

Both forms are interpreted as title shorthand in non-strict mode.

This plugin-specific special case is also supported:

```markdown
::: title="titlename"
Content
:::
```

Native Pandoc treats that as one literal class token. The plugin and bundled Lua filter treat it as readable title shorthand.

## Boundaries And Nesting

Fenced div openers follow Pandoc-style block boundaries. An opener is accepted at the start of a document, after a blank line, after a heading, after a thematic break, after a supported single-line HTML block, after another fenced-div boundary, or inside an already-open fenced div when the previous line allows a block start.

This is paragraph text, not a fenced div:

```markdown
Paragraph before.
::: {.note #invalid}
Still paragraph text.
:::
```

Add a blank line to start a fenced div:

```markdown
Paragraph before.

::: {.note #valid}
This is a fenced div.
:::
```

Fenced divs can be nested. Adjacent fenced divs do not require a blank line between the closing fence and the next opener.

## Strict Pandoc Mode

Strict Pandoc mode disables:

- readable shorthand
- visible plugin-generated fenced-div titles
- fenced-div `@id` reference rendering

Native fenced div structure is still recognized where needed by scanners, suggestions, and panels, but the rendered view stays closer to native Pandoc output.

## Pandoc Export

For Pandoc export with plugin-like fenced-div behavior, apply:

```bash
pandoc input.md --lua-filter=lua_filter/FencedDivExtendedSyntax.lua -o output.docx
```

The filter normalizes readable shorthand, inserts generated titles, replaces known simple `@id` citations, preserves unknown citations, and follows the same `\\&` source-escaping rule for native braced attributes.

More implementation detail is available in [fenced-divs design notes](fenced-divs-design-notes.md).
