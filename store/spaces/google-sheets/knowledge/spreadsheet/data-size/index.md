---
type: "string"
variable: "dataSize"
default: "small"
label: "Data Size"
fieldType: "select"
required: true
renderAs: "field"
description: "Approximate number of rows/columns in the sheet"
---

Indicates the scale of data in the sheet. Affects which formula approaches are recommended — volatile array functions can be slow on large datasets, while simple lookups work fine on small ones.
