---
variable: brewMethod
type: "'pourover' | 'espresso' | 'cold-brew'"
default: pourover
---
# Brewing methods the bar actually runs

The bar runs exactly three methods and will not improvise a fourth. Each aspect gives that method's
real dose, water temperature and time as the bar runs them — the numbers are the point, so load the
aspect rather than answering from memory of how the method usually goes elsewhere.

This field carries an explicit `variable`, a union `type` and a `default`, which is the combination
no real ported space exercises yet — it is here so those three loader branches have on-disk coverage.
