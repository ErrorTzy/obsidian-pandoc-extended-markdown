# Customizing CSS

Obsidian supports custom CSS snippets from the vault's
`.obsidian/snippets/` folder. This plugin exposes stable classes and CSS
variables so users can customize rendered syntax without changing plugin code.

## Fenced Divs

Fenced divs can be styled in both Live Preview and Reading mode. The
recommended pattern is to group the Live Preview hook with the Reading mode
hook for each semantic class.

For a block like:

```markdown
::: {.theorem .transparent #thm}
Content
:::
```

Live Preview exposes line classes such as `cm-pem-fenced-div-theorem` and
`cm-pem-fenced-div-transparent`. Reading mode exposes block classes such as
`pem-fenced-div-theorem`, `pem-fenced-div-transparent`, and the original source
classes `theorem` and `transparent`.

For stable cross-mode snippets, prefer the prefixed hooks:

- Live Preview: `cm-pem-fenced-div-theorem`
- Reading mode: `pem-fenced-div-theorem`

Class hook names are normalized to lowercase, and characters outside `a-z`,
`0-9`, `_`, and `-` become `-`.

### Variables

Fenced divs support these CSS variables:

- `--pem-fenced-div-accent`: left rule color
- `--pem-fenced-div-bg`: block background
- `--pem-fenced-div-inner-bg`: nested block background and nested rails
- `--pem-fenced-div-nest-indent`: nested block indent
- `--pem-fenced-div-rail-width`: left rule width
- `--pem-fenced-div-border-color`: full-frame border color
- `--pem-fenced-div-border-style`: full-frame border style
- `--pem-fenced-div-border-width`: full-frame border width
- `--pem-fenced-div-border-radius`: full-frame border corner radius

### Example Snippet

Save this as an Obsidian CSS snippet, for example
`.obsidian/snippets/pem-fenced-divs.css`, then enable it in
Settings -> Appearance -> CSS snippets.

```css
.markdown-source-view.mod-cm6 .cm-pem-fenced-div-theorem,
.markdown-preview-view .pem-fenced-div.pem-fenced-div-theorem {
    --pem-fenced-div-accent: #16a34a;
}

.markdown-source-view.mod-cm6 .cm-pem-fenced-div-axiom,
.markdown-preview-view .pem-fenced-div.pem-fenced-div-axiom {
    --pem-fenced-div-accent: #111111;
}

.markdown-source-view.mod-cm6 .cm-pem-fenced-div-framed,
.markdown-preview-view .pem-fenced-div.pem-fenced-div-framed {
    --pem-fenced-div-border-color: #d97706;
    --pem-fenced-div-border-radius: 4px;
    --pem-fenced-div-border-width: 1px;
}

.markdown-source-view.mod-cm6 .cm-pem-fenced-div-transparent,
.markdown-preview-view .pem-fenced-div.pem-fenced-div-transparent {
    --pem-fenced-div-bg: transparent;
    --pem-fenced-div-inner-bg: transparent;
}
```

With that snippet, all of these forms are styleable:

```markdown
::: {.theorem #thm}
Green left rule.
:::

::: axiom #ax
Black left rule.
:::

::: {.theorem .transparent #plain}
Green left rule with transparent background.
:::

::: {.axiom .framed #boxed}
Black left rule with a full border.
:::
```

### CSS Boundary

CSS snippets are intended for visual styling: colors, backgrounds, rail width,
spacing, borders, and border radius.

Layout changes that move content between structural parts of the block are not
a stable CSS-only customization target. For example, rendering the title on the
same visual line as the first content paragraph needs first-class rendering
support because Live Preview uses CodeMirror line widgets while Reading mode
uses a normal preview DOM block.

## Definition Lists

Definition lists can be styled in both Live Preview and Reading mode.

For a block like:

```markdown
Term
: Definition text
```

Reading mode exposes semantic HTML with stable classes:

- List: `pem-definition-list`
- Term: `pem-definition-term`
- Definition: `pem-list-definition-desc`

Live Preview is line-based, so it exposes line hooks instead of a wrapping
`dl` element:

- Term line: `cm-pem-definition-term`
- Definition line: `cm-pem-definition-paragraph`
- Generated definition marker: `pem-list-marker`

### Variables

Definition lists support these CSS variables:

- `--pem-definition-list-bg`: list or Live Preview line background
- `--pem-definition-list-border-color`: list or Live Preview line border color
- `--pem-definition-list-border-style`: list or Live Preview line border style
- `--pem-definition-list-border-width`: list or Live Preview line border width
- `--pem-definition-list-border-radius`: list or Live Preview line corner radius
- `--pem-definition-list-padding`: Reading mode list padding
- `--pem-definition-term-color`: term text color
- `--pem-definition-term-font-size`: term font size
- `--pem-definition-term-font-style`: term font style
- `--pem-definition-term-font-weight`: term font weight
- `--pem-definition-term-text-decoration`: term underline/decoration
- `--pem-definition-term-align`: term text alignment
- `--pem-definition-desc-color`: definition text color
- `--pem-definition-desc-font-size`: definition font size
- `--pem-definition-desc-font-style`: definition font style
- `--pem-definition-desc-font-weight`: definition font weight
- `--pem-definition-desc-text-decoration`: definition underline/decoration
- `--pem-definition-desc-align`: definition text alignment
- `--pem-definition-desc-indent`: Reading mode definition marker/text indent
- `--pem-definition-desc-marker-color`: generated marker color
- `--pem-definition-desc-marker-content`: Reading mode generated marker content

### Example Snippet

Save this as an Obsidian CSS snippet, for example
`.obsidian/snippets/pem-definition-lists.css`, then enable it in
Settings -> Appearance -> CSS snippets.

```css
.markdown-preview-view .pem-definition-list,
.markdown-source-view.mod-cm6 .cm-pem-definition-term,
.markdown-source-view.mod-cm6 .cm-pem-definition-paragraph {
    --pem-definition-list-bg: #f8fbff;
    --pem-definition-list-border-color: #94a3b8;
    --pem-definition-list-border-radius: 4px;
    --pem-definition-list-border-width: 1px;
    --pem-definition-term-color: #7f1d1d;
    --pem-definition-term-font-size: 1.05em;
    --pem-definition-term-font-style: italic;
    --pem-definition-term-font-weight: 700;
    --pem-definition-term-text-decoration: underline;
    --pem-definition-term-align: left;
    --pem-definition-desc-color: #0f4c81;
    --pem-definition-desc-font-size: 0.95em;
    --pem-definition-desc-font-style: normal;
    --pem-definition-desc-font-weight: 500;
    --pem-definition-desc-text-decoration: none;
    --pem-definition-desc-align: left;
    --pem-definition-desc-marker-color: #7c3aed;
}

.markdown-preview-view .pem-definition-list {
    --pem-definition-list-padding: 0.75em 1em;
}
```

With that snippet, Reading mode gets a bordered `dl` block. Live Preview applies
the same visual variables to each rendered definition-list line because
CodeMirror does not expose one wrapper element around the source lines.
