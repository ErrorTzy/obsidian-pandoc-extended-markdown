# Ordered List Autocompletion Logic

This document defines the expected behavior for list autocompletion and marker
cycling. It is intentionally test-oriented: the goal is to make nested ordered
lists, hybrid ordered/unordered lists, temporary cycle overrides, and return-to-
parent behavior unambiguous before the implementation is refactored.

Although the setting is named ordered-list marker cycling, the editor behavior must
operate on standard Markdown list levels as a whole. Ordered and unordered markers
can be adjacent levels in the same list chunk, and Tab, Shift+Tab, and Enter must
resolve the target level's marker type consistently.

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

The configured order controls which ordered style is selected when creating a new
ordered child level and no same-indent, parent-level, or list-chunk override context
exists. The default order is the list above.

Unordered markers are `-`, `+`, and `*`. They are standard Markdown markers, not
ordered styles, and are never inserted into the ordered-style cycle. They can still
participate in local parent-child marker relationships inside one list chunk.

## Terms

- Current item: the list item containing the cursor.
- Current level: the indentation level of the current item.
- Target level: the indentation level after Tab, Shift+Tab, or empty-item Enter.
- Parent item: the nearest preceding list item at a shallower indentation level
  within the same list chunk.
- Parent level: the indentation level of the parent item.
- Target-level context: list items at the target indentation in the same list chunk
  and parent subtree.
- List chunk: a contiguous group of list lines and their indented continuation
  lines. A blank line ends the chunk and clears all style, ordinal, and temporary
  cycle-override context.
- Marker type: either an ordered style such as `lower-alpha-period` or an unordered
  marker such as `-`.
- Local cycle override: a marker-type relationship inferred from existing adjacent
  list levels in the current list chunk, such as `lower-alpha-period -> -`.
- Bridge decimal item: a `decimal-period` ordered-list item nested under a plugin-
  owned fancy ordered list. This is intentional and should behave as a normal child
  ordered list while preserving a return path to the fancy parent style.

## Marker Resolution

Marker resolution chooses the marker type for the target level. Ordinal resolution
chooses the number, letter, or Roman numeral for ordered markers.

When moving or returning an item to a target level, resolve the target marker type
in this order:

1. If the target level already has a previous list item in the same list chunk and
   parent subtree, use that item's marker type.
2. If the target level is a parent level, use the parent level's marker type even
   when the current item has a different type. This applies equally to Enter on an
   empty nested item and Shift+Tab.
3. If creating a first child level under a parent item, check for a local cycle
   override in the same list chunk. If an earlier adjacent child level under the
   same parent marker type used a marker type, reuse that child marker type.
4. If no list-chunk override exists and the new child is ordered, use the next
   configured ordered style after the parent ordered style.
5. If no list-chunk override exists and the new child is unordered, use the
   configured unordered marker order for the target depth.
6. If no parent context exists, step from the current ordered style in the movement
   direction:
   - Tab uses the next configured ordered style.
   - Shift+Tab uses the previous configured ordered style.

If ordered-list marker cycling is disabled, ordered items preserve their current
ordered style when no target-level marker type forces a conversion. Disabling
ordered cycling must not prevent a nested item from returning to an unordered parent
or an unordered item from returning to an ordered parent.

### Local Cycle Overrides

Local cycle overrides are inferred from the current list chunk, not from global
settings and not from other chunks in the document.

For every adjacent parent-child list relationship in a chunk, remember:

- the parent level's marker type,
- the child level's marker type,
- the parent indent and child indent relationship.

When Tab creates the first child under a later sibling in the same chunk, this
relationship overrides the default configured next style.

Example:

```markdown
a. xxx
b. xxx
    - xxx
    - xxx
c. xxx
d. |
```

Pressing Tab should produce:

```markdown
a. xxx
b. xxx
    - xxx
    - xxx
c. xxx
    - |
```

The new child marker is `-`, not `i.`, because the current chunk has already
established `lower-alpha-period -> -` as the child marker relationship. The new
child starts a fresh child sequence under `c.` even though the marker type is reused.

The override is chunk-local. A blank line clears it:

```markdown
a. xxx
b. xxx
    - xxx
    - xxx
c. xxx

Another list

a. xxx
b. |
```

Pressing Tab at the final `b.` should produce:

```markdown
a. xxx
b. xxx
    - xxx
    - xxx
c. xxx

Another list

a. xxx
    i. |
```

The second list has no local `lower-alpha-period -> -` relationship, so it falls
back to the configured ordered cycle and creates `i.`.

Local overrides apply to marker type only. Ordered ordinals remain scoped to the
target parent subtree.

```markdown
1. xxx
2. xxx
    a. xxx
    b. xxx
3. xxx
4. |
```

Pressing Tab should produce:

```markdown
1. xxx
2. xxx
    a. xxx
    b. xxx
3. xxx
    a. |
```

The child marker type `lower-alpha-period` is reused, but the ordinal starts at
`a.` under the current parent. It must not continue as `c.` from the earlier parent
subtree.

## Ordinal Resolution

Ordinal resolution applies only after the resolved target marker type is ordered.

When creating or moving to a target level:

1. If there is a previous ordered-list item at the target level in the same list
   chunk and parent subtree, continue from that previous item's ordinal.
2. Otherwise, start at ordinal `1` for the resolved target style.
3. Enter on a non-empty ordered item at the same level increments from the current
   item.
4. Returning to an ordered parent level from an empty child item continues the
   previous parent-level ordinal rather than starting a new sequence.

Example:

```markdown
a. xxx
b. xxx
    1. xxx
    2. |
```

Pressing Enter should produce:

```markdown
a. xxx
b. xxx
    1. xxx
c. |
```

The parent marker is `c.`, not `a.`, because the parent level already contains
`a.` and `b.` in the same list chunk.

By contrast, pressing Enter at the end of a non-empty child item continues the child
level:

```markdown
a. xxx
b. xxx
    1. xxx
    2. child|
```

should produce:

```markdown
a. xxx
b. xxx
    1. xxx
    2. child
    3. |
```

## Tab Behavior

Tab is handled only when the cursor is immediately after the current list marker and
its following spaces, or inside an otherwise empty list item. It indents the current
item and its nested subtree by one level.

Expected behavior:

- The moved item uses the resolved target marker type.
- If the target level already has sibling context under the same parent, the moved
  item continues that sibling sequence.
- If the target level has no sibling context but the current list chunk has a local
  parent-child marker relationship, the moved item uses that marker type and starts
  a fresh sequence under the current parent.
- If no target-level or local override context exists, a new ordered child uses the
  next configured ordered style after the parent ordered style.
- Nested descendants move with the current item and keep their relative structure,
  with marker types recalculated for their new target levels.
- If auto-renumbering is enabled and a non-empty item with descendants is moved,
  descendants are renumbered immediately within the moved subtree. If auto-
  renumbering is disabled, marker type changes still apply, but automatic ordinal
  repair is skipped.

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
`decimal-period`. Because this decimal item is under a fancy ordered parent, it is
a bridge decimal item.

## Shift+Tab Behavior

Shift+Tab moves the current item and its nested subtree one level shallower.

Expected behavior:

- The moved item uses the resolved target marker type.
- Shift+Tab must behave like empty-item Enter when the current item is empty: it
  returns to the nearest parent list level and uses the parent level's marker type.
- Returning to an ordered parent level continues the ordered parent sequence.
- Returning to an unordered parent level preserves that parent level's unordered
  marker.
- If no target-level context exists, an ordered target starts at ordinal `1`.
- Bridge decimal items outdent back to the parent fancy style when that is the
  target-level context.
- Shift+Tab from a non-empty child item keeps the child content on the returned
  parent item; for example, `2. child` can become `c. child`.

Ordered child to ordered parent:

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

Unordered child to ordered parent:

```markdown
a. xxx
b. xxx
    - xxx
    - |
```

Pressing Shift+Tab should produce:

```markdown
a. xxx
b. xxx
    - xxx
c. |
```

The returned marker is `c.`, not `-`, because the target parent level is ordered.
Shift+Tab and Enter on the empty unordered child must produce the same parent-level
result.

## Enter Behavior

Enter has three standard list paths.

For a non-empty ordered-list item:

- Insert a new item at the same level.
- Preserve the current ordered style.
- Increment the current item ordinal by one.

For a non-empty unordered-list item:

- Insert a new item at the same level.
- Preserve the current unordered marker exactly.

For an empty nested item:

- Return to the nearest parent list level.
- Use the parent level's marker type.
- If returning to an ordered parent level, continue the parent-level ordinal when
  previous parent items exist.
- If returning to an unordered parent level, preserve the parent unordered marker.
- Remove the empty child marker from the old child level.

For an empty top-level item:

- Remove the marker and leave a plain empty line.

Bridge decimal items follow the nested empty-item rule. They should return to the
parent fancy style and continue the parent sequence when parent context exists.

## Hybrid Nested Lists

Hybrid lists are standard list chunks where adjacent levels use different marker
types, such as ordered parent to unordered child, unordered parent to ordered child,
or unordered child to unordered grandchild with a different source marker.

The core rule is:

> Tab creates or moves to a child level; Enter on an empty item and Shift+Tab return
> to the nearest parent level. The target level's marker type wins.

Unordered list items are not part of the ordered marker cycle:

- Enter on a non-empty unordered item inserts a new unordered item at the same
  indentation and preserves the exact unordered marker from that level.
- Enter on an empty nested unordered item returns to the nearest parent list level.
- Shift+Tab on an empty nested unordered item returns to the nearest parent list
  level and must produce the same marker type and ordinal as Enter would.
- When returning to an unordered parent level, the new item preserves that parent
  level's unordered marker.
- When returning to an ordered parent level, the new item resolves the ordered style
  and ordinal using the normal target-level rules.
- Ordered grandchildren nested under unordered items still use ordered continuation
  at their own level. If an ordered grandchild item is empty, Enter returns one
  level to the unordered parent, not all the way to the ordered root.

Example: unordered child under ordered parent continues as unordered:

```markdown
a. xxx
b. xxx
    - xxx|
```

Pressing Enter should produce:

```markdown
a. xxx
b. xxx
    - xxx
    - |
```

Example: ordered grandchild returns to unordered parent:

```markdown
a. xxx
b. xxx
    - xxx
    - xxx
        i. xxx
        ii. xxx
        iii. |
```

Pressing Enter should produce:

```markdown
a. xxx
b. xxx
    - xxx
    - xxx
        i. xxx
        ii. xxx
    - |
```

The returned marker is `-`, not `c.`, because the nearest parent list level is the
unordered child level.

Example: unordered grandchild must render as a list item:

```markdown
a. xxx
b. xxx
    - xxx
        * xxx
```

The `* xxx` line is a nested unordered list item. Live Preview must render the `*`
as a list marker with the expected unordered marker classes and indentation. It
must not display `*` as plain text.

The same hybrid rules apply when the root level itself is unordered. For root
markers `-`, `+`, and `*`, ordered child and grandchild levels should still cycle
through the configured ordered marker order, while empty ordered descendants return
to the nearest unordered parent marker.

## E2E Test Guidelines

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

Hybrid E2E coverage should be added as explicit cases, not only as a shared helper:

- Ordered parent with unordered child: Enter on a non-empty unordered child creates
  another unordered child with the same marker.
- Ordered parent with empty unordered child: Enter returns to the ordered parent
  style and continues the ordered parent ordinal.
- Ordered parent with empty unordered child: Shift+Tab returns to the ordered
  parent style and continues the ordered parent ordinal. This must match the Enter
  result exactly.
- Ordered parent with unordered child and unordered grandchild: `* xxx` nested under
  `- xxx` renders as an unordered list item in Live Preview, not plain text.
- Ordered parent with unordered child and ordered grandchild: Enter on an empty
  ordered grandchild returns only to the unordered child level.
- Ordered parent with unordered child and ordered grandchild: Shift+Tab on an empty
  ordered grandchild returns only to the unordered child level.
- Unordered root groups for `-`, `+`, and `*`: each should run the standardized
  hybrid workflow, with ordered descendants cycling through the configured ordered
  marker order and empty ordered descendants returning to the nearest unordered
  parent marker.

Local cycle override E2E coverage should include:

- Same chunk override: after `lower-alpha-period -> -` appears earlier in the same
  chunk, Tab on a later `lower-alpha-period` sibling creates `- ` instead of the
  default `lower-roman-period`.
- Same chunk override with ordinal isolation: after an earlier ordered child
  sequence exists under one parent, Tab under a later sibling reuses the child style
  but starts at ordinal `1`.
- Chunk boundary reset: after a blank line and non-list text, Tab on a new
  `lower-alpha-period` list falls back to the configured ordered cycle and creates
  `i.`, not `-`.
- Override depth specificity: an override for parent depth 0 to child depth 1 must
  not force the marker for child depth 1 to grandchild depth 2 unless that adjacent
  relationship also exists in the same chunk.

The same assertions should pass for all ten ordered root marker styles where the
case is about ordered-style cycling. Any divergence for `decimal-period` should be
intentional native/bridge behavior, not a special case that drops markers or
restarts numbering.
