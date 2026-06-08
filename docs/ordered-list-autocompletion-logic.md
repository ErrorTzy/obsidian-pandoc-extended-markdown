# Ordered List Autocompletion Logic

This document defines the expected behavior for ordered-list autocompletion before
the implementation is refactored. It is intentionally test-oriented: the goal is to
make the vulnerable cases visible, especially nested cycling, bridge decimal lists,
and continuation after returning to a parent level.

## Supported Ordered Styles

The ordered-list cycling feature supports these ten marker styles, in the configured
order:

1. `decimal-period`: `1.`
2. `lower-alpha-period`: `a.`
3. `lower-roman-period`: `i.`
4. `upper-alpha-period`: `A.`
5. `upper-roman-period`: `I.`
6. `decimal-one-paren`: `1)`
7. `lower-alpha-one-paren`: `a)`
8. `lower-roman-one-paren`: `i)`
9. `upper-alpha-one-paren`: `A)`
10. `upper-roman-one-paren`: `I)`

The configured order controls which style is selected when creating a new child
level and no same-indent context already exists. The default order is the list above.

## Terms

- Current item: the ordered-list item containing the cursor.
- Current level: the indentation level of the current item.
- Target level: the indentation level after a Tab, Shift+Tab, or empty-item Enter.
- Parent item: the nearest preceding ordered-list item at a shallower indentation
  level within the same list block.
- Sibling context: ordered-list items at the target level in the same parent subtree.
- Bridge decimal item: a `decimal-period` ordered-list item nested under a
  plugin-owned fancy ordered list. This is intentional and should behave as a normal
  child ordered list while preserving a return path to the fancy parent style.
- List block: a contiguous group of list lines and their indented continuation
  lines. A blank line ends the context for style and ordinal continuation.

## Style Resolution

When moving an item to a new indentation level, style resolution follows this order:

1. If ordered-list marker cycling is disabled, preserve the current marker style.
2. If the target level has ordered-list siblings in the same parent subtree, use the
   target level's existing style.
3. Otherwise, if the target level has a parent item, use the next style after the
   parent's style in the configured ordered-list cycle.
4. Otherwise, step from the current style in the movement direction:
   - Tab uses the next configured style.
   - Shift+Tab uses the previous configured style.

`decimal-period` remains valid in two roles:

- Native decimal list item at a top-level native decimal list or under another native
  decimal list.
- Bridge decimal item when nested under a plugin-owned fancy ordered-list parent.

Bridge decimal items must not be treated as an instruction to remove the marker when
returning to a parent level. They should resolve through the same target-level style
and ordinal rules as every other ordered style.

## Ordinal Resolution

Style resolution chooses the marker style. Ordinal resolution chooses the marker
number, letter, or Roman numeral within that style.

When creating or moving to a target level:

1. If there is a previous ordered-list item at the target level in the same list
   block and parent subtree, continue from that previous item's ordinal.
2. Otherwise, start at ordinal `1` for the target style.
3. Continuing the current level with Enter always increments from the current item.
4. Returning to a parent level from an empty child item continues the previous parent
   level, rather than starting a new sequence.

Examples:

```markdown
a. xxx
b. xxx
    1. xxx
    2. |
```

Because `2.` is empty, pressing Enter should return to the parent level and create:

```markdown
a. xxx
b. xxx
    1. xxx
c. |
```

The parent marker is `c.`, not `a.`, because the parent level already contains
`a.` and `b.` in the same list block.

By contrast, pressing Enter at the end of a non-empty child item continues the child
level:

```markdown
a. xxx
b. xxx
    1. xxx
    2. child|
```

should create:

```markdown
a. xxx
b. xxx
    1. xxx
    2. child
    3. |
```

Starting a new child level with Tab is scoped to the current parent item, not to
earlier child lists under previous parents:

```markdown
1. xxx
2. xxx
    a. xxx
    b. xxx
3. xxx
4. |
```

When the current edit creates the first child item under `4.`, typing Enter should
create:

```markdown
1. xxx
2. xxx
    a. xxx
    b. xxx
3. xxx
4. xxx
    a. |
```

The child marker is `a.`, not `c.`, because the `a.` and `b.` child list belongs to
the previous root item `2.`, not to the current root item `4.`.

## Tab Behavior

Tab is handled only when the cursor is immediately after the current list marker and
its following spaces. It indents the current item and its nested subtree by one level.

Expected behavior:

- The moved item uses the target level's resolved style.
- If the target level already has sibling context, the moved item continues that
  sibling sequence.
- If the target level has no sibling context, the moved item starts at ordinal `1`
  in the style after the parent style.
- Nested descendants move with the current item and keep their relative structure,
  with marker styles recalculated for their new target levels.
- If auto-renumbering is enabled and a non-empty item with descendants is moved,
  descendants are renumbered immediately within the moved subtree. If
  auto-renumbering is disabled, marker style changes still apply, but automatic
  ordinal repair is skipped.

Example:

```markdown
I) xxx
II) |
```

Pressing Tab should produce a bridge decimal child:

```markdown
I) xxx
    1. |
```

`upper-roman-one-paren` is the last default style, so the next child style wraps to
`decimal-period`. Because this decimal item is under a fancy ordered parent, it is a
bridge decimal item.

## Shift+Tab Behavior

Shift+Tab moves the current item and its nested subtree one level shallower.

Expected behavior:

- The moved item uses the target level's resolved style.
- If the target level has previous items in the same list block and parent subtree,
  the moved item continues that sequence.
- If no target-level context exists, the moved item starts at ordinal `1`.
- Bridge decimal items outdent back to the parent fancy style when that is the
  target-level context.
- Shift+Tab from a non-empty child item keeps the child content on the returned
  parent item; for example, `2. child` can become `c. child`.

Example:

```markdown
a. xxx
b. xxx
    1. xxx
    2. |
```

Pressing Shift+Tab should produce:

```markdown
a. xxx
b. xxx
    1. xxx
c. |
```

The target level already has lower-alpha-period context, so the moved item becomes
`c.`. It must not become an empty line and must not restart as `a.`.

## Enter Behavior

Enter has two ordered-list paths.

For a non-empty ordered-list item:

- Insert a new item at the same level.
- Preserve the current style.
- Increment the current item ordinal by one.

For an empty ordered-list item:

- If the item is nested, return to the parent level.
- Resolve the parent-level style from the target level's context.
- Continue the parent-level ordinal if the parent level already has previous items.
- If the item is top-level, remove the marker and leave a plain empty line.

Bridge decimal items follow the nested empty-item rule. They should return to the
parent fancy style and continue the parent sequence when parent context exists.

## E2E Test Matrix

The E2E suite should cover all ten ordered styles as the root style. Each root style
should run the same nested editing workflow:

1. Start with two root items in the tested style.
2. Press Enter at the end of the second root item to continue the root level.
3. Press Tab from the empty third root item to create a new child level.
4. Type child content.
5. Press Enter at the end of the child item to continue the child level.
6. Press Enter from the empty second child item to return to the root level.
7. Verify the returned root item continues the root sequence instead of restarting.
8. Repeat the nested workflow with Shift+Tab directly from a non-empty child item.

For every root style, assertions should verify:

- Tab creates the configured next child style, wrapping from
  `upper-roman-one-paren` to bridge `decimal-period`.
- A newly created child level starts at ordinal `1`.
- Enter on a non-empty child item continues the child level.
- Enter on an empty child item returns to the root level and continues the root
  sequence.
- Shift+Tab from a child item returns to the root level and continues the root
  sequence.
- Shift+Tab from a non-empty child item preserves the item content on the returned
  root item.
- Moving a non-empty item with descendants renumbers the moved subtree immediately
  when auto-renumbering is enabled.
- Decimal-period child markers under fancy root markers are treated as bridge items
  and return to the correct fancy parent style.

The same assertions should pass for all ten root marker styles. Any divergence for
`decimal-period` should be intentional native/bridge behavior, not a special case
that drops markers or restarts numbering.
