(@a) Example list

{::P(#a)} Custom label list

---

## Test cases with (@a) reference:

### In headings: (@a) --> Should NOT render

### In plain text:
crossref in plain text (@a) --> Should render as (1)

### In italic:
*crossref in italic style (@a)* --> Should render as (1)

### In bold:
**crossref in bold style (@a)** --> Should render as (1)

### In unordered list:
- crossref in unordered list (@a) --> Should render as (1)

### In ordered list:
1. crossref in ordered list (@a) --> Should render as (1)

### In fancy list:
A. crossref in fancy list (@a) --> Should render as (1)

### In example list (unlabeled):
(@) crossref in example list (@a) --> Should render as (2) for the list, (1) for the reference

### In hash list:
#. crossref in hash list (@a) --> Should render with correct hash number, (1) for the reference

### In custom label list:
{::P(#b)} crossref in custom label list (@a) --> Should render as P2 for the list, (1) for the reference

### In footnote:
Text with footnote[^1]

[^1]: crossref in footnote (@a) --> Should render as (1)