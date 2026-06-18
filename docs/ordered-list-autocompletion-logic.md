# Structural List Autocompletion Logic

This document defines the expected behavior for list autocompletion and marker
cycling. It is intentionally test-oriented: the goal is to make nested ordered
lists, hybrid marker kinds, chunk-local depth preferences, selection movement,
and return-to-parent behavior unambiguous before the implementation is
refactored.

Although the setting is named ordered-list marker cycling, the editor behavior
must operate on structural item-list levels as a whole. Ordered, unordered, hash,
example, and custom-label markers can be adjacent depths in the same list chunk,
and Tab, Shift+Tab, and Enter must resolve the target depth's marker type
consistently.

Definition-list markers `:` and `~` are intentionally excluded. They describe
definitions for a preceding term rather than peer list items, so owner movement,
depth inference, and empty-item return behavior would be ambiguous.

## Supported Marker Types

The ordered-list cycling feature supports these ten marker styles, in the
configured order:

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

The configured order controls which ordered style is selected when resolving an
ordered depth that has no explicit marker type in the current list chunk. The
default order is the list above.

Unordered markers are `-`, `+`, and `*`. They are standard Markdown markers, not
ordered styles, and are never inserted into the ordered-style cycle. They can
still participate in chunk-local depth preferences.

Hash markers are `#.`. Hash markers participate in structural depth inference as
their own marker type and behave like unordered markers for autocompletion: they
repeat as `#.` at the same depth, return to parent depth from empty nested items,
and never participate in ordered renumbering. They are not part of the unordered
marker cycle.

Example-list markers are `(@)` and `(@label)`. Structural marker inference stores
only the fact that a depth uses an example-list marker; it does not store or copy
the source label. Newly inserted example-list markers use `(@)` and place the
cursor between `@` and `)` when the inserted item is otherwise empty.

Custom-label markers are `{::}` and `{::label}` or `{::expression}` forms.
Structural marker inference stores only the custom-label marker type; it does not
store or copy the source label, placeholder, or expression. Newly inserted
custom-label markers use `{::}` and place the cursor between `::` and `}` when
the inserted item is otherwise empty.

Hash, example-list, and custom-label markers are enabled only when their
corresponding syntax feature is enabled. When a feature is disabled, its marker
text is treated as plain text by structural list autocompletion and must not
create owners or depth-map overrides.

## Terms

- List chunk: a contiguous group of list-item lines and their indented
  continuation lines. A blank line ends the chunk and clears style, ordinal, and
  depth-map context.
- List item owner: the nearest list-item line that contains the cursor, or, when
  the cursor is on direct continuation text, the list item that owns that
  continuation.
- Direct continuation line: a nonblank non-list line indented deeper than its
  owner and appearing before the owner's first nested child list item. Direct
  continuation text is part of the owner item.
- Nested child item: a list-item line below an owner at a deeper parsed depth. A
  nested child item is its own owner.
- Current depth: the parsed list depth of the owner. Root list items are depth
  `1`; a child of a depth `n` item is depth `n + 1`.
- Target depth: the parsed depth after Tab, Shift+Tab, or empty-item Enter.
- Explicit child block: the immediately following deeper nonblank block that
  belongs to the owner, stopping at a blank line. If that block contains direct
  continuations followed by a nested child list, the nested child list supplies
  the explicit child marker type.
- Marker type: one of an ordered style such as `lower-alpha-period`, an
  unordered marker such as `-`, hash, example-list, or custom-label.
- Editable placeholder marker: an unlabeled example marker `(@)` or empty
  custom-label marker `{::}` with the cursor inside the marker's editable region.
  For example, `(@|)` and `{::|}` are editable placeholders; `(@) |` and
  `{::} |` are ordinary list items at cursor position after the marker.
- Ordinal: the numeric value represented by an ordered marker. For example,
  `b.`, `B)`, `ii.`, and `2.` all have ordinal `2`.
- Depth map: the chunk-local function from parsed list depth to marker type.
- Bridge decimal item: a `decimal-period` ordered-list item nested under a
  plugin-owned fancy ordered list. This is intentional and should behave as a
  normal child ordered list while preserving a return path to the fancy parent
  style when that style is the target depth's marker type.

## Core Model

List editing is owner-based, not raw-line-based.

- With no selection, Tab and Shift+Tab operate on the current owner.
- When the cursor is on direct continuation text, Tab and Shift+Tab operate on
  the owner of that continuation, not on the continuation line alone.
- When the cursor is on a nested child list item, that child item is the owner.
- The owner moves with its direct continuation lines.
- Nested child list items do not move with the owner unless they are also touched
  by the selection.
- A blank line stops all owner, explicit-child, and depth-map lookup.

This means unselected Tab no longer indents an entire subtree. To move a subtree,
select the owners in that subtree and press Tab or Shift+Tab.

Example:

```markdown
1. xxx
2. xxx|
    - xxx
```

Pressing Tab should produce:

```markdown
1. xxx
    - xxx|
    - xxx
```

The existing child list stays at the same indentation and becomes a sibling after
the moved item.

Direct continuation lines move with their owner:

```markdown
1. parent
2. current|
    continuation
    - child
```

Pressing Tab should produce:

```markdown
1. parent
    - current|
        continuation
    - child
```

The continuation line belongs to `2. current`, so it moves. The nested `- child`
item is its own owner, so it stays unless selected.

## Chunk Depth Map

Marker type inference is depth-based. For each list chunk, build a parsed list
tree and infer a depth map:

- Root list items are depth `1`.
- A list item whose nearest shallower list parent is depth `n` is depth `n + 1`.
- Depth is based on parsed list relationships, not on raw `indentColumns / 4`.
- The depth map stores marker type only. It does not store ordinal values.
- Parent marker type is not part of the override key; chunk and depth are the
  relevant scope.

When resolving a marker type for a target depth:

1. If the operation has an explicit child or parent target, that explicit target
   wins.
2. Otherwise, use the nearest previous item at the target depth in the same
   chunk.
3. If no previous item at that depth exists, use the nearest following item at
   the target depth in the same chunk.
4. If no item at that depth exists, use the default configured cycle resumed
   from the deepest explicit depth override in the chunk.
5. If the chunk has no usable override, use the configured default mapping for
   the target depth.

Conflicts are resolved by cursor position. Previous target-depth items have
priority over later items; among later items, the closest following item wins.

Example:

```markdown
1. xxx
    - xxx
2. xxx
    a. xxx
3. xxx
4. |
```

Pressing Tab should produce:

```markdown
1. xxx
    - xxx
2. xxx
    a. xxx
3. xxx
    a. |
```

The latest previous depth-2 type is `a.`, so depth 2 resolves to
`lower-alpha-period`.

Depth specificity matters:

```markdown
1. xxx
    - xxx
        1. xxx
            a. xxx
2. xxx
3. |
```

Pressing Tab on `3.` should produce `- `, not `a.`, because the `a.` item is a
depth-4 override and is irrelevant to depth 2.

If there is no previous target-depth item, look below the cursor:

```markdown
1. xxx
2. |
3. xxx
    - xxx
4. xxx
    * xxx
```

Pressing Tab on `2.` should produce `- ` because the closest following depth-2
item is `- xxx`.

When resolving a depth deeper than any explicit override, resume the default
cycle from the deepest explicit override. For example, if a chunk explicitly uses
depths 1 through 4 and depth 4 is `1.`, then depth 5 follows the configured
ordered cycle from `decimal-period`, so the default depth-5 ordered style is
`lower-alpha-period`.

Marker-kind fallback is family-preserving. Ordered fallback and unordered
fallback are separate policies; neither can silently choose the other family
only because a target depth is currently empty.

- An explicit child or parent target can switch marker kind.
- A nearest previous or following item at the target depth can switch marker
  kind; that item is a chunk-local implicit override for the target depth.
- If no explicit target or target-depth override exists, an ordered owner falls
  back through the configured ordered style cycle.
- If no explicit target or target-depth override exists, an unordered owner
  falls back through the configured unordered marker cycle. With the default
  unordered order, pressing Tab on `-`, `+`, and `*` produces child markers
  `+`, `*`, and `-` respectively.
- If unordered marker cycling is disabled, an unordered owner with no explicit
  target or target-depth override preserves its current unordered marker instead
  of falling into the ordered cycle.
- Hash, example-list, and custom-label owners with no explicit target or
  target-depth override preserve their own marker kind. Hash inserts `#.`,
  example-list inserts `(@)`, and custom-label inserts `{::}`.

This keeps list-family changes intentional. For example, an ordered item can
move into an unordered child level when an existing unordered child level is
present, and an unordered item can move into an ordered child level when an
existing ordered child level is present. Without such a target-depth override,
unordered Tab cycling must remain within `-`, `+`, and `*`.

## Ordinal Resolution

Ordinal resolution applies only after the marker type has been resolved as an
ordered style.

Renumbering and marker type inference are separate features. Disabling
`autoRenumberLists` must not disable marker type inference.

When `autoRenumberLists` is enabled:

- A newly inserted ordered item before existing ordered siblings starts at the
  correct ordinal for its position.
- Existing ordered siblings after the inserted or moved item are renumbered when
  the command changes their sequence.
- A moved ordered item uses the ordinal implied by its target sibling group.

When `autoRenumberLists` is disabled:

- The command must not rewrite any existing ordered sibling ordinals.
- A moved ordered item preserves its current ordinal value when possible, even if
  its ordered style changes.
- Preserving an ordinal means preserving the numeric value and formatting that
  value in the target ordered style. For example, decimal ordinal `27` becomes
  `aa.` in lower-alpha style, and upper-alpha `D.` becomes `4.` in decimal style.
- Inserted or moved items can create duplicate ordered markers, such as
  `a.`, `a.`, `b.`.

The depth map stores only marker type. For example and custom-label markers, it
stores only the marker kind, not the source label or expression. Ordinals are
resolved separately from local sibling context and `autoRenumberLists`.

Example with renumbering enabled:

```markdown
1. parent|
    a. child
    b. child
```

Pressing Enter should produce:

```markdown
1. parent
    a. |
    b. child
    c. child
```

With `autoRenumberLists` disabled, the same edit should produce:

```markdown
1. parent
    a. |
    a. child
    b. child
```

## Enter Behavior

Enter has four structural paths.

For a list item with an immediately following deeper nonblank block in the same
chunk:

- Treat Enter as splitting the owner item before its child/continuation block.
- Use the exact indentation of the following deeper line. Do not normalize it to
  four spaces.
- If the cursor is in the middle of the owner line, text after the cursor becomes
  plain continuation text at that child indentation.
- If the cursor is at the end of the owner line and the explicit child block
  contains a nested list item, insert a new child list item before that child
  list using the child list's explicit marker type.
- If the cursor is at the end of the owner line and the explicit child block is
  only continuation text, insert a blank continuation line before it.
- A blank line between the owner and the deeper block disables this path.

Example with an explicit unordered child:

```markdown
1. xxx|
    - xxx
```

Pressing Enter should produce:

```markdown
1. xxx
    - |
    - xxx
```

Example with continuation text:

```markdown
1. xxx|
    continuation
```

Pressing Enter should produce:

```markdown
1. xxx
    |
    continuation
```

Example splitting parent text:

```markdown
1. ab|cd
    - child
```

Pressing Enter should produce:

```markdown
1. ab
    cd
    - child
```

For a direct continuation line:

- Enter splits the continuation line at the cursor.
- The new line keeps the same indentation.
- Enter does not create a new list item from continuation text.

Example:

```markdown
1. parent
    cont|inuation
    - child
```

Pressing Enter should produce:

```markdown
1. parent
    cont
    |inuation
    - child
```

For a non-empty list item with no immediately following deeper nonblank block:

- Insert a new item at the same depth.
- Preserve the current unordered marker exactly for unordered items.
- Preserve hash marker type by inserting `#.`.
- Preserve example-list marker type by inserting `(@)` and placing the cursor
  between `@` and `)`.
- Preserve custom-label marker type by inserting `{::}` and placing the cursor
  between `::` and `}`.
- Preserve the current ordered style for ordered items.
- Increment the ordered ordinal when `autoRenumberLists` is enabled.
- Preserve the current ordered ordinal value when `autoRenumberLists` is
  disabled.
- A labeled example item such as `(@example)` with no content is still a real
  list item; pressing Enter after the marker continues the example-list depth.
- A custom-label item such as `{::Label}` or `{::P(#first)}` with no content is
  still a real list item; pressing Enter after the marker continues the
  custom-label depth.

For an empty nested item:

- Return to the nearest parent depth.
- Use the parent depth's marker type from the explicit parent target.
- If the target is ordered, resolve the ordinal according to
  `autoRenumberLists`.
- If the target is unordered, preserve the parent depth's unordered marker.
- If the target is hash, insert `#.`.
- If the target is example-list, insert `(@)` and place the cursor between `@`
  and `)`.
- If the target is custom-label, insert `{::}` and place the cursor between `::`
  and `}`.
- Remove the empty child marker from the old child depth.

For an empty top-level item:

- Remove the marker and leave a plain empty line.

For example-list and custom-label items, the empty-item path applies only to
editable placeholder markers with the cursor inside the editable region. `(@|)`
and `{::|}` can remove or return the item. `(@) |`, `(@label) |`, `{::} |`, and
`{::Label} |` continue their current depth instead.

Bridge decimal items follow the nested empty-item rule. They should return to the
parent fancy style and continue or preserve ordinal values according to
`autoRenumberLists`.

## Tab Behavior

Tab is handled when the cursor or selection touches a list item owner or that
owner's direct continuation text. It moves touched owners one depth deeper.

With no selection:

- Resolve the current owner from the cursor position.
- Move that owner and its direct continuation lines one depth deeper.
- Do not move nested child list items unless they are selected.
- If the owner has an explicit child list below it, use that child list's marker
  type for the moved owner.
- If the owner has direct continuation lines followed by an explicit child list,
  the child list still supplies the explicit child marker type.
- If there is no explicit child list, resolve the target marker type from the
  chunk depth map.
- If the target depth resolves to hash, example-list, or custom-label, that
  marker type wins over ordered-style fallback.
- If moving into an explicit child block, use that child block's exact
  indentation.
- If no explicit target indentation exists, add the configured indentation unit,
  currently four spaces.
- When a non-empty item is moved into an example-list or custom-label target
  depth, preserve the content-relative cursor position. Cursor placement inside
  `(@)` or `{::}` is reserved for newly inserted empty markers.

Tab can be pressed anywhere inside the owner line or its direct continuation
text. These positions are structurally equivalent:

```markdown
1. xxx|
1. x|xx
1. |xxx
1. xxxxxx|
```

The cursor should remain at the corresponding content offset after the move.

Example:

```markdown
1. xxx
2. xxx|
    - xxx
```

Pressing Tab should produce:

```markdown
1. xxx
    - xxx|
    - xxx
```

The moved line matches the explicit child list type `-`.

Example with explicit ordered children and renumbering enabled:

```markdown
1. parent
2. current|
    a. child
    b. child
```

Pressing Tab should produce:

```markdown
1. parent
    a. current|
    b. child
    c. child
```

With `autoRenumberLists` disabled, the moved item keeps ordinal `2` formatted in
the target style:

```markdown
1. parent
    b. current|
    a. child
    b. child
```

## Shift+Tab Behavior

Shift+Tab is handled when the cursor or selection touches a list item owner or
that owner's direct continuation text. It moves touched owners one depth
shallower.

With no selection:

- Resolve the current owner from the cursor position.
- Move that owner and its direct continuation lines one depth shallower.
- Do not move nested child list items unless they are selected.
- Resolve the target marker type from the explicit parent target when one exists.
- Otherwise resolve the target marker type from the chunk depth map.
- If moving out to an explicit parent or sibling depth, use that target depth's
  exact indentation from the nearest target-depth item.
- If no explicit target indentation exists, remove one configured indentation
  unit, currently four spaces.
- Shift+Tab from an empty nested item should produce the same marker type and
  ordinal result as Enter from that empty nested item.

Example:

```markdown
1. ordered
- unordered
    a. child|
```

Pressing Shift+Tab should produce:

```markdown
1. ordered
- unordered
- child|
```

The target depth is depth 1, and the nearest depth-1 marker type at the edit
position is `-`.

## Selection Behavior

Selection movement is owner-based, not raw-line-based.

- Collect every unique list item owner touched by the selection.
- A continuation line selection touches its owner.
- A nested list-item line selection touches that nested item as a separate owner.
- Move each touched owner exactly once.
- Direct continuation lines move only as part of their owner.
- If both a parent owner and child owner are touched, both shift one depth level
  and preserve their relative parent/child relationship.
- Unselected child or sibling owners keep their existing indentation and marker
  type unless an enabled renumbering pass changes their ordered ordinal.

Example:

```markdown
1. xxx
2. xxx
    x[xx
    - x]xx
    - xxx
```

Pressing Tab should produce:

```markdown
1. xxx
    - xxx
        xxx
        + xxx
    - xxx
```

The selection touches owner `2. xxx` through its continuation line and touches the
first nested `- xxx` owner directly. Both touched owners move once. The unselected
second `- xxx` stays put.

For selected owners, resolve each moved owner's marker type by its target depth
using explicit target context first and the chunk depth map second. Then renumber
affected ordered sibling groups only when `autoRenumberLists` is enabled.

## Hybrid Structural Lists

Hybrid structural lists are list chunks where adjacent depths use different
marker types, such as ordered parent to unordered child, unordered parent to
example-list child, hash parent to ordered child, or custom-label child to
unordered grandchild.

The core rule is:

> Tab and Shift+Tab move touched owners by one parsed depth; Enter splits or
> continues the owner according to the immediate following block; the target
> depth's marker type wins.

Unordered, hash, example-list, and custom-label list items are not part of the
ordered marker cycle:

- Enter on a non-empty unordered item with no following deeper block inserts a new
  unordered item at the same depth and preserves the exact unordered marker from
  that depth.
- Enter on a non-empty hash item with no following deeper block inserts another
  `#.` item at the same depth.
- Enter on a non-empty example-list item with no following deeper block inserts
  `(@)` at the same depth and places the cursor inside the marker.
- Enter on a non-empty custom-label item with no following deeper block inserts
  `{::}` at the same depth and places the cursor inside the marker.
- Enter on an empty nested unordered item returns to the nearest parent depth.
- Enter on an empty nested hash item returns to the nearest parent depth.
- Enter on an editable nested example-list or custom-label placeholder returns to
  the nearest parent depth.
- Shift+Tab on an empty nested unordered item returns to the nearest parent depth
  and must produce the same marker type and ordinal as Enter would.
- Shift+Tab on an empty nested hash, example-list, or custom-label item follows
  the same return-to-parent rule.
- When returning to an unordered parent depth, the new item preserves that parent
  depth's unordered marker.
- When returning to a hash parent depth, the new item uses `#.`.
- When returning to an example-list parent depth, the new item uses `(@)` and
  places the cursor inside the marker.
- When returning to a custom-label parent depth, the new item uses `{::}` and
  places the cursor inside the marker.
- When returning to an ordered parent depth, the new item resolves the ordered
  style through explicit parent/depth-map rules and resolves ordinal values
  according to `autoRenumberLists`.
- Hash, example-list, and custom-label markers do not participate in unordered
  marker cycling. Only `-`, `+`, and `*` cycle as unordered markers.
- Ordered grandchildren nested under unordered items still use ordered
  continuation at their own depth. If an ordered grandchild item is empty, Enter
  returns one depth to the unordered parent, not all the way to the ordered root.
  The same rule applies under hash, example-list, and custom-label parents.

If there is no explicit child block and no existing target-depth override, Tab
preserves the marker family of the current owner. Hash, example-list, and
custom-label owners repeat their marker kind instead of falling into the ordered
cycle:

```markdown
#. parent
#. child|
```

Pressing Tab should produce:

```markdown
#. parent
    #. child|
```

An existing target-depth override can still switch a hash child to another
marker kind; the owner marker only controls fallback when no target-depth marker
kind exists.

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

The returned marker is `-`, not `c.`, because the nearest parent depth is the
unordered child depth.

Example: unordered grandchild must render as a list item:

```markdown
a. xxx
b. xxx
    - xxx
        * xxx
```

The `* xxx` line is a nested unordered list item. Live Preview must render the
`*` as a list marker with the expected unordered marker classes and indentation.
It must not display `*` as plain text.

The same hybrid rules apply when the root depth itself is unordered. For root
markers `-`, `+`, and `*`, Tab without an explicit child block or existing
target-depth override stays in the configured unordered marker cycle. Ordered
child and grandchild depths still use ordered continuation after an ordered
target-depth override exists, while empty ordered descendants return to the
nearest unordered parent marker.

## E2E Test Guidelines

The E2E suite should cover all ten ordered styles as the root style. Each root
style should run a standardized nested editing workflow:

1. Start with two root items in the tested style.
2. Press Enter at the end of the second root item with no following deeper block
   to continue the root depth.
3. Press Tab from the empty third root item to create a new child depth.
4. Type child content.
5. Press Enter at the end of the child item to continue the child depth.
6. Press Enter from the empty second child item to return to the root depth.
7. Verify the returned root item continues or preserves the root ordinal according
   to `autoRenumberLists`.
8. Repeat the nested workflow with Shift+Tab directly from a non-empty child item.

For every root style, assertions should verify:

- Tab creates the configured next child style when no explicit child/depth-map
  override exists, wrapping from `upper-roman-one-paren` to bridge
  `decimal-period`.
- A newly created ordered child depth starts at ordinal `1` when
  `autoRenumberLists` is enabled.
- A newly created or moved ordered item preserves its existing ordinal value when
  `autoRenumberLists` is disabled, while still changing marker style when marker
  type inference requires it.
- Enter on a non-empty child item with no following deeper block continues the
  child depth.
- Enter on an empty child item returns to the root depth.
- Shift+Tab from a child item returns to the root depth.
- Shift+Tab from a non-empty child item preserves the item content on the returned
  root item.
- Unselected Tab moves only the owner plus direct continuation lines, not the
  owner's nested list-item descendants.
- Selecting multiple owners moves each touched owner exactly once.
- Ordered ordinals are repaired only when `autoRenumberLists` is enabled.
- Decimal-period child markers under fancy root markers are treated as bridge
  items and return to the correct fancy parent style.

Hybrid E2E coverage should be added as explicit cases, not only as a shared
helper:

- Ordered parent with unordered child: Enter on a non-empty unordered child
  creates another unordered child with the same marker when there is no following
  deeper block.
- Ordered parent with empty unordered child: Enter returns to the ordered parent
  style and resolves the parent ordinal according to `autoRenumberLists`.
- Ordered parent with empty unordered child: Shift+Tab returns to the ordered
  parent style and resolves the parent ordinal according to `autoRenumberLists`.
  This must match the Enter result exactly.
- Ordered parent with unordered child and unordered grandchild: `* xxx` nested
  under `- xxx` renders as an unordered list item in Live Preview, not plain text.
- Ordered parent with unordered child and ordered grandchild: Enter on an empty
  ordered grandchild returns only to the unordered child depth.
- Ordered parent with unordered child and ordered grandchild: Shift+Tab on an
  empty ordered grandchild returns only to the unordered child depth.
- Unordered root groups for `-`, `+`, and `*`: each should run the standardized
  hybrid workflow, with ordered descendants using depth-map inference and empty
  ordered descendants returning to the nearest unordered parent marker.
- Hash roots and hash child depths: same-depth Enter repeats `#.`, Tab/Shift+Tab
  honor explicit hash target-depth overrides, empty nested hash items return to
  the parent marker type, and missing child-depth evidence falls back to the
  ordered default.
- Example-list roots and example-list child depths: same-depth Enter inserts
  `(@)` with the cursor inside the marker, Tab/Shift+Tab honor explicit
  example-list target-depth overrides without copying labels, editable empty
  nested placeholders return to the parent marker type, and disabled
  `enableExampleLists` treats `(@...)` as plain text.
- Custom-label roots and custom-label child depths: same-depth Enter inserts
  `{::}` with the cursor inside the marker, Tab/Shift+Tab honor explicit
  custom-label target-depth overrides without copying labels or expressions,
  editable empty nested placeholders return to the parent marker type, and
  disabled custom-label support treats `{::...}` as plain text.
- Mixed target-depth conflicts involving ordered, unordered, hash, example-list,
  and custom-label markers should use the existing precedence unchanged:
  explicit child/parent target, nearest previous target-depth item, nearest
  following target-depth item, then ordered default fallback.

Depth-map E2E coverage should include:

- Previous target-depth override wins over later target-depth context.
- If no previous target-depth override exists, closest following target-depth item
  wins.
- Different chunks are isolated by blank lines.
- Different depths are independent; a depth-4 `a.` must not force depth 2 to use
  `a.`.
- Parent marker type is not part of the override key; depth wins within the chunk.
- Fallback for deeper missing depths resumes from the deepest explicit depth
  override.
- Ordered style inference ignores ordinal evidence; ordinals are resolved
  separately.

Enter split E2E coverage should include:

- Enter at the end of a parent line before an unordered child inserts a new child
  item before the existing child.
- Enter at the end of a parent line before an ordered child inserts a new child
  item and renumbers following ordered children only when `autoRenumberLists` is
  enabled.
- Enter at the end of a parent line before continuation text inserts a blank
  continuation line.
- Enter in the middle of a parent line before a child block moves trailing text to
  a continuation line.
- Enter on direct continuation text splits continuation text without creating a
  list item.
- A blank line between the parent and deeper block disables split-before-child
  behavior.

The same assertions should pass for all ten ordered root marker styles where the
case is about ordered-style cycling. Any divergence for `decimal-period` should be
intentional native/bridge behavior, not a special case that drops markers or
restarts numbering.
