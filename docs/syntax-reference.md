# Syntax Reference

Pandoc Extended Markdown renders supported Pandoc-style syntax in Live Preview and Reading mode. Source mode stays unchanged.

Supported syntax families are enabled by default. Custom label lists are a core plugin extension and need the bundled Lua filter for matching Pandoc export.

## Superscript And Subscript

```markdown
2^10^
H~2~O
P~a\ cat~
```

- `^text^` renders as superscript.
- `~text~` renders as subscript.
- Escape spaces inside the expression with `\ `.
- Inline code, footnotes, and LaTeX math are avoided where possible so the plugin does not rewrite unrelated syntax.

## Fancy Lists

```markdown
A.  Uppercase alpha
B.  Next item

a) Lowercase alpha
b) Next item

i. Lowercase Roman
ii. Next item

#. Auto-numbered
#. Auto-numbered
```

Supported ordered markers include:

- Decimal: `1.`, `1)`
- Lowercase letters: `a.`, `a)`
- Uppercase letters: `A.`, `A)`
- Lowercase Roman numerals: `i.`, `i)`
- Uppercase Roman numerals: `I.`, `I)`
- Hash auto-numbering: `#.`

List editing helpers:

- Press Enter after a supported list item to continue the list.
- Press Tab or Shift+Tab at the start of a list item to indent or outdent.
- Ordered marker cycling can choose marker styles by nesting depth.
- Auto-renumbering can update affected list items when inserting in the middle of a list.

Pandoc list lenient spacing is enabled by default and allows list enhancements to render with looser spacing. Disable it to require blank lines around list blocks and at least two spaces after uppercase period markers such as `A.  Item` before list enhancements render.

## Unordered Lists

```markdown
- Dash marker
    + Plus marker
        * Asterisk marker
```

The plugin can cycle unordered markers by nesting depth. By default, the order is `-`, `+`, `*`, then repeats.

When distinct marker rendering is enabled:

- `-` keeps Obsidian's default filled-circle style.
- `+` renders as a square.
- `*` renders as a hollow circle.

## Example Lists

```markdown
(@intro) This introduces the concept.
(@) This example does not need a label.
(@final) This concludes the examples.

See examples (@intro) and (@final).
```

Example lists are numbered in document order. References to named examples render as their generated numbers. Labels may contain letters, numbers, underscores, and hyphens.

## Definition Lists

```markdown
Markdown
:   A lightweight markup language.

Obsidian
:   A local-first knowledge base.
:   Can have multiple definitions.

Plugin
~   Alternative definition marker.
```

Definition lists support `:` and `~` markers. Continuation content can be indented. Definition content can include common inline Markdown such as emphasis, strong text, math, and supported references.

The command palette includes commands to toggle explicit bold or underline markup on definition terms.

## Fenced Divs

```markdown
::: {.theorem #compact title="Theorem &"}
Every compact metric space is complete.
:::

See @compact.
```

Fenced divs support native Pandoc attributes, optional plugin rendering for visible titles and generated numbering, optional readable shorthand, and document-local `@id` references.

Fenced div CSS can be customized in Obsidian snippets with cross-mode hooks such as `cm-pem-fenced-div-theorem` for Live Preview and `pem-fenced-div-theorem` for Reading mode. See [Customizing CSS](customizing-css.md) for snippet examples.

See [Fenced divs](fenced-divs.md) for the full guide.

## Custom Label Lists

Custom label lists are a plugin-specific core extension. They are enabled by default and can be disabled with the `Custom label lists` setting.

```markdown
{::P} All humans are mortal.
{::Q} Socrates is human.
{::R} Therefore, Socrates is mortal.

From {::P} and {::Q}, infer {::R}.
```

They render as custom labels such as `(P)`, `(Q)`, and `(R)`, and references resolve to the processed labels.

### Placeholder Numbering

```markdown
{::P(#first)} First premise
{::P(#second)} Second premise
{::P(#first)'} Variant of the first premise

From {::P(#first)} and {::P(#second)}, derive the result.
```

Each unique placeholder receives a document-local number. Reusing the same placeholder reuses the same number.

Pure placeholder expressions are also supported:

```markdown
{::(#premise)} A premise
{::(#conclusion)} A conclusion
{::(#premise)+(#conclusion)} Combined expression
```

## Footnotes In The Panel

Obsidian already handles standard Markdown footnotes:

```markdown
This has a note.[^a]

[^a]: Footnote text.
```

The plugin does not replace Obsidian's footnote renderer. It extracts footnote definitions for the list panel so they can be browsed alongside examples, definitions, and fenced divs.

## Commands

The plugin adds these commands:

- `Check pandoc formatting`: reports Pandoc spacing issues in the active document.
- `Format document to pandoc standard`: adds blank lines around lists/headings and fixes uppercase letter list spacing.
- `Toggle definition list bold style`: toggles explicit `**Term**` markup on definition terms.
- `Toggle definition list underline style`: toggles explicit `<span class="underline">Term</span>` markup on definition terms.
- `Open list panel`: opens the sidebar panel.

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| Pandoc list lenient spacing | On | Allows list enhancements to render with looser spacing. Turn it off to require Pandoc-compatible list spacing. |
| Readable fenced div shorthand | On | Enables plugin-specific readable fenced div opener forms in addition to native Pandoc attributes. |
| Hash auto-number lists | On | Enables `#.` rendering and continuation. |
| Fancy lists | On | Enables alphabetic and Roman numeral lists. |
| Example lists | On | Enables `(@label)` examples and references. |
| Definition lists | On | Enables Pandoc definition lists. |
| Fenced divs | On | Enables fenced div rendering and scanning. |
| Distinct unordered list markers | On | Gives `+` and `*` separate rendered marker styles. |
| Superscript | On | Enables `^text^`. |
| Subscript | On | Enables `~text~`. |
| Custom label lists | On | Enables plugin-specific `{::LABEL}` lists and references. |
| Auto-renumber lists | On | Renumbers affected ordered/fancy list items after insertion. |
| Cycle unordered list markers | On | Chooses `-`, `+`, or `*` by depth on indent/outdent. |
| Cycle ordered list markers | On | Chooses ordered marker styles by depth on indent/outdent. |
| List panel | On | Enables the sidebar panel and ribbon icon. |
