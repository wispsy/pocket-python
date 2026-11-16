# Sequence construction and traversal

This finite slice of INT-SEQ-01 uses CPython 3.14.7 as its semantic oracle.
The synthetic `sequences.json` corpus separates reference observations from
independent source execution. A reference-only report earns no engine support.
Core-source/1 and classes-source/1 retain bytecode versions 4 and 5, respectively.

## Adopted slices

| Stage | API and boundary |
| --- | --- |
| Q1 | `range(stop)`, `range(start, stop[, step])`, positional-only integer/index arguments; start/stop/step attributes, truth, signed-64-bit len, integer indexing, slicing, equality and iteration. Construction and slicing retain integer parameters rather than materializing elements. Class index callbacks use the owned machine. |
| Q2 | `list()` / `tuple()` and one positional adopted primitive iterable: str, list, tuple, dict keys, range or its primitive iterator. Lists are fresh shallow containers; tuple(existing_tuple) preserves identity. Unicode iteration uses code points. |
| Q3 | List/tuple construction from adopted class iterables/indexed fallback; `all(iterable, /)` / `any(iterable, /)` over adopted iterables, with short-circuit truth callbacks. Argument, iterator acquisition, next and truth errors retain distinct boundaries. |
| LA-205/LA-206 | Owned list construction/extension and expanded sequence consumers execute length/hint protocols after acquisition. Pinned tuple and single-star call traversal skip hints. |

The original Q1–Q3 checkpoint contained 54 class observations and 40 explicitly
shared core cases. LA-205 promotes its retained hint observation to execution.
The [ordering/traversal contract](interpreter-ordering-traversals.md) owns the
expanded hint, reverse and sorting corpus with parked lifecycle acceptance.
Profile selection never credits omitted cases.

## Values and resource rules

Range arithmetic uses arbitrary integers within the existing digit budget.
Huge logical ranges do not allocate their elements. `len` raises OverflowError
above the adopted signed-64-bit maximum while truth, indexing and bounded slices
can still succeed. Range methods, hashing, repr and broader reflection remain
explicitly outside this slice. Non-integral membership uses the existing owned
iteration/equality path when required, rather than rounding a Python value.

Constructed lists/tuples keep the existing 1024-item limit and retain every
partial result while callbacks are paused. Range/consumer work polls cancellation
and charges logical work; these quotas do not measure host RSS. Failed allocation,
callback errors, early exit and repeated close must release all logical owners.
Existing composed execution resource observations remain unchanged.

## Continuing INT-SEQ-01 work

Later finite deliveries add [min/max/sum](interpreter-aggregations.md) and
[map/filter/enumerate/zip](interpreter-traversals.md), including owned callbacks
and Python 3.14 strict-length checks. The [practical-container contract](interpreter-practical-containers.md)
also adopts owned iterable list extension and selected methods. Dictionary
construction/update, in-place list sorting, broader text/container methods,
binary construction hints and structural dictionary mutation during equality
retain separate gates. [Reversed, hints and sorted](interpreter-ordering-traversals.md)
now have their own finite delivery. These slices do not close #116.

References: [range and sequence types](https://docs.python.org/3.14/builtins/stdtypes.html#ranges),
[all/any signatures](https://docs.python.org/3.14/builtins/functions.html#all),
and [length hints](https://docs.python.org/3.14/reference/datamodel.html#object.__length_hint__).

Run reference validation with:

```sh
python runtime/check_classes.py --reference-only --corpus tests/fixtures/interpreter/sequences.json
```

Owned consumers retain their iterator and partial result in closed operation records.
Only advancement exhaustion ends consumption: StopIteration from acquisition or
truth callbacks propagates. Short circuit releases prior elements. Truth
consumers skip hints; list construction follows its owned hint contract.

The source console accepts newly entered sequence programs after offline reload,
checks source errors and prefix preservation, interrupts pending index/iterator/
truth callbacks, and retains primitive sequence APIs after a class-to-core update.
[Payload evidence](measurements/2026-10-23-sequences.json) records exact fixture
bytes and engine identity; it makes no mobile-device or host-memory promise.
