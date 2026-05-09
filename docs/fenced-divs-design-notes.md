# Fenced Divs Design Notes

This is maintainer-facing documentation for fenced div design and implementation
details in Pandoc Extended Markdown. For user-facing syntax documentation, see
`docs/fenced-divs.md`.

This document is intentionally more detailed than the user-facing guide. It
records the design philosophy, supported syntax, current implementation, and
edge cases that future fenced-div changes should keep aligned across Live
Preview, Reading mode, and Pandoc export.

## Design Philosophy

Fenced div support has two layers:

1. Rendering behavior: native Pandoc fenced divs get readable block titles and
   document-local `@id` cross-references in Live Preview, Reading mode, and
   Pandoc export with the bundled Lua filter.
2. Shortcut syntax: non-strict mode accepts additional readable authoring forms
   that normalize to native Pandoc div attributes.

The guiding principle is Markdown's plain-text readability. A fenced div should
remain easy to read and write as source text, while still exporting to standard
Pandoc structures where possible.

## Native Pandoc Behavior

Pandoc supports fenced divs with braced attributes:

```markdown
::: {.classname #id title="titlename"}
Content
:::
```

In native Pandoc, the opening line creates a `Div` with:

- class `classname`
- identifier `id`
- attribute `title="titlename"`

Pandoc does not render the `title` attribute as a visible title line by default.
For common output formats, the visible content is just:

```text
Content
```

Pandoc also does not treat `@id` as a cross-reference to `#id`. A raw `@id`
is Pandoc citation syntax. Without a matching citation processor/bibliography,
it is not a div cross-reference.

Pandoc also supports a single unbraced class token:

```markdown
::: classname
Content
:::
```

This is equivalent to:

```markdown
::: {.classname}
Content
:::
```

Native Pandoc's unbraced shortcut is intentionally limited. These readable forms
are not native Pandoc fenced div shortcuts:

```markdown
::: classname1 classname2
Content
:::
```

```markdown
::: classname {#id}
Content
:::
```

```markdown
::: classname #id
Content
:::
```

Pandoc fenced divs can be nested. Nesting is structural source nesting, but the
numbering behavior added by this plugin is not based on physical nesting; see
"Numbering Model".

## Strict Pandoc Mode

Strict Pandoc mode is intended to keep syntax close to native Pandoc.

In the plugin:

- Live Preview still recognizes native fenced div structure.
- Readable shorthand is disabled.
- Extended `@id` fenced-div reference rendering is disabled.
- Extended visible block-title rendering is suppressed in Live Preview and
  Reading mode.

Important nuance: the shared parser may still compute title metadata for native
forms internally, because the same parser is reused by scanning, suggestions,
and panels. Strict mode should therefore be understood as a rendering/syntax
mode, not as "no internal metadata is computed".

## Extended Rendering Layer

When fenced divs are enabled and strict Pandoc mode is off, the plugin adds
theorem-style rendering to fenced divs.

### Block Titles

A fenced div renders a visible title line when it has either:

- an explicit `title` attribute, or
- at least one non-control class.

Examples:

```markdown
::: {.theorem #thm title="Theorem"}
Content
:::
```

renders a block title:

```text
Theorem
```

```markdown
::: {.warning #warn}
Content
:::
```

has no explicit title, so the first non-control class is humanized and rendered:

```text
Warning
```

If a div has only an id and no title/class:

```markdown
::: {#misc}
Content
:::
```

then the block has no visible title. A reference to `@misc` renders as:

```text
Div
```

### Cross-References

Known fenced div ids are rendered as document-local references:

```markdown
::: {.theorem #thm title="Theorem"}
Content
:::

See @thm.
```

In non-strict mode, `@thm` renders as:

```text
Theorem
```

Unknown citations are preserved for other citation processors:

```markdown
Known @thm and unknown @doe2020.
```

Only `@thm` is replaced if `thm` is a known fenced div id. Unknown citations
remain raw Pandoc citation syntax.

The Live Preview and Reading mode reference regex treats trailing `.`, `!`, and
`?` as punctuation when resolving labels. For example, `@thm.` can resolve
`thm` while leaving the period outside the reference.

The Lua filter replaces only simple single citations with no prefix/suffix. It
does not replace multi-citations or citations with affixes.

## Title Synthesis

If no explicit title is provided, the plugin synthesizes a title from classes.

The first non-control class is humanized:

```markdown
::: {.logic-block #prem}
Content
:::
```

renders/references as:

```text
Logic Block
```

Humanization currently:

- replaces `_`, `:`, and `-` with spaces
- replaces non-placeholder dots with spaces
- preserves dots inside numbering placeholder groups such as `&.&`
- collapses repeated whitespace
- capitalizes word starts

Control classes do not become titles:

- `no-num`
- `unnumbered`
- placeholder-only classes such as `&` or `&.&`

## Readable Shorthand: Token Form

Non-strict mode accepts this plugin-specific shorthand:

```markdown
::: classname1 classname2 #id title="xxx"
Content
:::
```

It is interpreted like:

```markdown
::: {.classname1 .classname2 #id title="xxx"}
Content
:::
```

Supported token types:

- `#id`
- bare class tokens
- `key=value`
- quoted values such as `title="hello world"`
- repeated ids, where the last id wins

Bare class tokens cannot contain whitespace, `#`, `=`, `{`, `}`, or `,`.

Examples:

```markdown
::: Theorem #thm data=1
Content
:::
```

normalizes conceptually to:

```markdown
::: {.Theorem #thm data=1 title="Theorem"}
Content
:::
```

```markdown
::: Theorem compact #thm title="Main theorem"
Content
:::
```

normalizes conceptually to:

```markdown
::: {.Theorem .compact #thm title="Main theorem"}
Content
:::
```

If no explicit `title` is present, a title is synthesized from classes.

Important current behavior: when multiple class tokens are present and no
placeholder is involved, only the first class becomes the synthesized title.

```markdown
::: Theorem compact #thm
Content
:::
```

renders/references as:

```text
Theorem
```

not:

```text
Theorem Compact
```

## Readable Shorthand: Title Text With Braced Attributes

Non-strict mode also accepts a readable title outside the braced attribute set.
The title text runs until the line break.

Title after attributes:

```markdown
::: {.classname1 .classname2 #id} title with spaces
Content
:::
```

is interpreted like:

```markdown
::: {.classname1 .classname2 #id title="title with spaces"}
Content
:::
```

Title before attributes:

```markdown
::: title with spaces {.classname1 .classname2 #id}
Content
:::
```

is also interpreted like:

```markdown
::: {.classname1 .classname2 #id title="title with spaces"}
Content
:::
```

The braced part may be empty:

```markdown
::: {} title with spaces
Content
:::
```

```markdown
::: title with spaces {}
Content
:::
```

These forms are plugin-specific. They are only recognized when there is
whitespace after the opening fence and strict Pandoc mode is off.

## Special Case: `title="titlename"`

This source is visually tempting:

```markdown
::: title="titlename"
Content
:::
```

Native Pandoc treats it as an unbraced class named literally
`title="titlename"`, not as a title attribute.

The current plugin/Lua behavior intentionally treats this as a title-only
readable shorthand in non-strict mode. It renders as:

```text
titlename
```

This is one of the most confusing areas and should be documented carefully. It
is readable and useful, but it is not native Pandoc behavior.

## Numbering Model

Numbering is opt-in. A title is numbered only when the title template contains
an unescaped `&`.

```markdown
::: {.theorem #thm title="Theorem &"}
Content
:::

See @thm.
```

renders/references as:

```text
Theorem 1
```

Titles without `&` are not numbered:

```markdown
::: {.theorem #thm title="Theorem"}
Content
:::
```

renders/references as:

```text
Theorem
```

### Placeholder Groups

Only the first unescaped placeholder group is replaced.

A placeholder group is:

- `&`
- or `&` followed by zero or more `.&` pairs

Examples:

```markdown
title="Case &"
title="Case &.&"
title="Case &.&.&"
```

The number of `&` tokens in the first group determines counter depth:

- `&` uses depth 1
- `&.&` uses depth 2
- `&.&.&` uses depth 3

Only the first group is replaced:

```markdown
title="&-&"
```

renders like:

```text
1-&
```

The second `&` is left literal.

### Counter Families

Counters are grouped by title stem. The stem is the title with the first
placeholder group removed, then normalized.

These share the `Case` counter family:

```markdown
::: {.case title="Case &"}
:::

::: {.case title="Case &.&"}
:::

::: {.case title="Case &"}
:::
```

They render as:

```text
Case 1
Case 1.1
Case 2
```

Deeper counters use the current shallower counter. If a deeper counter appears
before any shallower counter, missing shallower parts default to `1`.

Numbering is based on counter family and placeholder depth, not on physical
fenced-div nesting.

### Front Numbering

The placeholder may appear at the front:

```markdown
::: {.note #n1 title="& Note"}
Content
:::
```

renders/references as:

```text
1 Note
```

### Escaped Ampersands

Escape a literal ampersand in the title template with `\&` at the metadata
layer. In Markdown source, however, Pandoc consumes Markdown backslash escapes
before the Lua filter sees attribute values. To preserve `\&` inside a native
braced attribute or quoted readable-shorthand key-value, write the backslash
itself as `\\`.

```markdown
::: {.case #escaped title="AT\\&T-&.&"}
Content
:::
```

This is parsed as the title template `AT\&T-&.&` and renders/references as:

```text
AT&T-1.1
```

A single source backslash is not enough in native braced attributes:

```markdown
::: {.case #single title="AT\&T-&.&"}
Content
:::
```

Pandoc consumes the backslash, so the plugin/Pandoc-export behavior sees the
title template `AT&T-&.&`. The first `&` in `AT&T` becomes the first placeholder
group, so this renders/references as:

```text
AT1T-&.&
```

Without any escape:

```markdown
::: {.case #bad title="AT&T-&.&"}
Content
:::
```

the first `&` in `AT&T` is the first unescaped placeholder group, so current
numbering behavior treats it as the numbering location.

Important implementation contract: Live Preview, Reading mode, and Pandoc
export now follow the same rule for native braced attributes. Use this in source
Markdown when you want the second placeholder group to drive numbering:

```markdown
title="AT\\&T-&.&"
```

The same practical rule applies to quoted `title=...` values in readable
shorthand when the document will be exported through Pandoc. A Lua filter cannot
recover a single `\&` after Pandoc has consumed it, because the filter receives
the already-parsed AST rather than the raw source text.

### Disabling Numbering

Use `.no-num` to disable numbering for a block:

```markdown
::: {.warning #warn .no-num title="AT&T Warning"}
Content
:::
```

This renders/references as:

```text
AT&T Warning
```

The Pandoc-style `unnumbered` control class also disables numbering in the
current implementation:

```markdown
::: {.case #literal .unnumbered title="Case &"}
Content
:::
```

This renders/references as:

```text
Case &
```

## Numbering in Readable Shorthand

Readable shorthand can synthesize title templates from classes and placeholder
tokens.

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

These are treated like title templates:

```text
Case &
Case &.&
& Note
```

and render/references as:

```text
Case 1
Case 1.1
1 Note
```

The original class tokens are preserved:

```markdown
::: Case & #c1
```

has classes:

```text
Case
&
```

The placeholder-only class `&` is a control/title-synthesis token and is not the
primary CSS class. The semantic class remains `Case`.

This form is preferred over embedding the placeholder in the semantic class:

```markdown
::: Case_&.& #c1a
Content
:::
```

`Case_&.&` works and renders as `Case 1.1`, but the class is literally
`Case_&.&`, which is less useful for styling than a separate `Case` class.

Important current behavior: when both a placeholder-only token and a
placeholder-containing title token are present, only the first
placeholder-containing title part drives synthesis. For example:

```markdown
::: & Case_& #id
Content
:::
```

currently renders as:

```text
1 Case &
```

because the synthesized title is `& Case &`.

## Native and Extended Syntax Accepted by Current Parser

The current TypeScript parser accepts:

```markdown
::: {.note}
:::
```

```markdown
:::{.note}
:::
```

```markdown
::: Warning
:::
```

```markdown
:::: Warning
::::
```

```markdown
::: {}
:::
```

```markdown
::: {#id}
:::
```

```markdown
::: {key=value}
:::
```

```markdown
::: {.note #first #second}
:::
```

where `second` is the effective id.

It also accepts trailing visual colons on opening lines:

```markdown
::: {.note} ::::::
Content
:::
```

```markdown
::: Warning ::::::
Content
:::
```

Closing fences must be unindented runs of at least three colons with only
optional trailing whitespace:

```markdown
:::
```

```markdown
::::   
```

Indented closings are not accepted by the current plugin parser.

## Pandoc Dash Shorthand

The current TypeScript parser supports Pandoc dash shorthand:

```markdown
::: {-}
Content
:::
```

This maps to the `unnumbered` class.

Multiple dashes produce repeated `unnumbered` classes:

```markdown
::: {--}
Content
:::
```

Dash-prefixed key-value shorthand is also parsed:

```markdown
::: {-key=value}
Content
:::
```

This maps to:

```text
class: unnumbered
key: value
```

Because `unnumbered` is a numbering escape class, these forms disable fenced-div
auto-numbering in the current implementation.

## Block Boundary Behavior

Live Preview, the scanner/extractor, Reading mode, and Pandoc export with the
Lua filter should respect Pandoc-style block boundaries.

An opening fence is accepted:

- at the start of a document
- after a blank line
- after an ATX heading
- after a thematic break
- after a recognized single-line HTML block
- immediately after another fenced div boundary
- inside an already-open fenced div when the previous line allows a block start

An opening fence is not accepted immediately after paragraph-like text:

```markdown
Paragraph before.
::: {.note #invalid}
This is treated as paragraph text.
:::
```

A blank line makes it valid:

```markdown
Paragraph before.

::: {.note #valid}
This is a fenced div.
:::
```

Production Reading mode uses the original section source to recover block
boundary information that is missing from the rendered DOM. This is important
because Obsidian preview paragraphs do not reliably preserve whether a blank
line existed before a candidate fence. With section source available, Reading
mode should match Live Preview/scanning for paragraph-adjacent openings.

The Lua filter also checks block boundaries before converting readable shorthand
that Pandoc parsed as paragraph text. A readable shorthand opener immediately
after paragraph-like text is left as ordinary paragraph content; a readable
shorthand opener after a blank line can be normalized into a native Pandoc
`Div`.

Implementation caveat: low-level test/helper calls to the Reading mode fenced
div parser that do not provide source text cannot fully reconstruct source
blank-line boundaries from DOM nodes alone.

## Code Block Behavior

Live Preview/scanning skip fenced div detection inside Markdown code fences and
known code regions.

Example:

````markdown
```
::: {.note #not-real}
:::
```

::: {.note #real}
Content
:::
````

Only `real` should be indexed as a fenced div label.

Reading mode also avoids processing elements inside `pre` and `code`.

## Nesting

Fenced divs can be nested:

```markdown
::: {.outer #outer title="Outer"}
Outer content.

::: {.inner #inner title="Inner"}
Inner content.
:::

:::
```

Live Preview and extraction maintain a stack of open fenced divs. Nested content
is included in outer content for hover/panel previews.

Adjacent fenced divs do not require a blank line between them:

```markdown
::: {.a #a}
A
:::
::: {.b #b}
B
:::
```

## Duplicate Labels

If multiple fenced divs use the same id, the first scanned label wins for
cross-reference metadata.

Within a single opener, repeated ids use the last id:

```markdown
::: {.note #first #second}
Content
:::
```

The effective id is `second`.

## UI Surfaces That Must Stay Aligned

Fenced div behavior is currently spread across these surfaces:

- Live Preview block rendering
- Live Preview inline `@id` rendering
- Reading mode block rendering
- Reading mode inline `@id` rendering
- reference autocomplete
- Fenced Divs panel extraction
- Pandoc export through `lua_filter/FencedDivExtendedSyntax.lua`

The shared TypeScript parser and metadata utilities are used by most plugin
surfaces:

- `src/live-preview/pipeline/structural/fencedDiv/parser.ts`
- `src/shared/utils/fencedDivReferenceMetadata.ts`
- `src/shared/extractors/fencedDivExtractor.ts`
- `src/live-preview/scanners/fencedDivScanner.ts`

The Lua filter reimplements the behavior separately for Pandoc export:

- `lua_filter/FencedDivExtendedSyntax.lua`

Any future syntax change should update both the TypeScript implementation and
the Lua implementation, plus tests for both.

## Lua Filter Behavior

The Lua filter provides export behavior analogous to non-strict plugin mode:

- normalizes readable shorthand into native Pandoc `Div` nodes
- inserts generated title blocks
- replaces known simple `@id` citations with reference text
- preserves unknown citations
- respects Pandoc-style block boundaries for readable shorthand normalization
- adds restrained default styling for HTML
- wraps LaTeX output in a left-rule `tcolorbox`
- assigns custom styles for DOCX/ODT titles and divs

Important current nuance: the Lua filter walks Pandoc AST `Div` nodes generally.
It is not source-origin-aware; it does not know whether a `Div` came from fenced
div source syntax, raw HTML conversion, or another Pandoc transformation.

Another important nuance: Lua filters run after Pandoc parses Markdown. For
native braced attributes, `title="AT\&T-&.&"` and `title="AT&T-&.&"` both arrive
at the Lua filter as `AT&T-&.&`. The filter cannot infer that the source used a
single backslash. To preserve a literal ampersand escape in exported output,
write `title="AT\\&T-&.&"` in source Markdown.

## Current Problems and Documentation Hazards

1. The public docs currently mix native Pandoc behavior, plugin rendering
   behavior, and plugin shorthand behavior. These need to be separated.
2. `::: title="titlename"` is highly confusing because native Pandoc sees a
   class token, while this plugin treats it as a readable title shorthand in
   non-strict mode.
3. "Class present means a title renders" is too broad. Control classes and
   placeholder-only classes are excluded.
4. Numbering is not tied to visual nesting. The docs should say "manual depth"
   or "counter depth", not imply automatic nested numbering.
5. Any unescaped `&` starts numbering. Literal ampersands such as `AT&T` must be
   escaped or `.no-num`/`.unnumbered` must be used. In source Markdown
   attributes, preserving that escape requires `\\&`, because Pandoc consumes a
   single `\&` before the Lua filter runs.
6. Only the first placeholder group is replaced. Additional unescaped `&`
   characters remain literal.
7. The readable shorthand title-synthesis algorithm uses only selected class
   tokens, not every class token. This is useful but non-obvious.
8. Strict mode disables readable shorthand and extended reference/title
   rendering, but internal scanners may still compute metadata for native
   fenced divs.
9. Reading mode relies on source section text to match Live Preview/scanner
   block-boundary behavior. DOM-only helper calls cannot fully reconstruct
   source blank-line boundaries.
10. The Lua filter is aligned with the core behavior through tests, but it is a
    separate implementation and can drift if future changes update only
    TypeScript.

## Suggested Documentation Structure

The final README section should probably use this order:

1. Native Pandoc fenced divs: what Pandoc accepts and what Pandoc does not
   render by itself.
2. Plugin rendering layer: visible titles and `@id` cross-references.
3. Titles: explicit `title`, synthesized class titles, id-only `Div`.
4. Numbering: `&`, `&.&`, escaping, `.no-num`, and manual depth.
5. Readable shorthand: token form and title-with-braces form.
6. Strict Pandoc mode: what is disabled and why.
7. Pandoc export: use `lua_filter/FencedDivExtendedSyntax.lua` for matching
   output.
8. Short warning box for non-native plugin syntax.
