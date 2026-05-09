# Customizing CSS

Obsidian supports custom CSS snippets from the vault's
`.obsidian/snippets/` folder. This plugin exposes stable classes and CSS
variables so users can customize rendered syntax without changing plugin code.

This page currently documents fenced divs. Future syntax surfaces should add
their customization hooks here instead of scattering user-facing CSS snippets
through feature-specific design notes.

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
