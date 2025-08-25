# Popover Test File

## Example Lists with References

(@first) This is the first example with some content to display in popover.

(@second) This is the second example with even more content that should appear when hovering.

(@third) This is the third example that contains **bold text** and *italic text* for testing.

### References to Examples

Here we reference the first example: (@first)

And here's a reference to the second: (@second)

Multiple references in one line: (@first) and (@third)

## Custom Label Lists with References

{::LABEL1} This is a custom label list item with content.

{::LABEL2} Another custom label with **formatted** content.

{::P(#a)} Custom label with placeholder that will be numbered.

### References to Custom Labels

Reference to LABEL1: {::LABEL1}

Reference with placeholder: {::P(#a)}

## Mixed Content for Testing

(@math) Example with math: $x^2 + y^2 = z^2$

Reference to math example: (@math) should show the formula in popover.

{::FORMULA} Custom label with formula: $\int_0^1 x dx = \frac{1}{2}$

Reference to formula: {::FORMULA}