# Iterable aggregation

Track A #600 adopts finite consumer APIs under #116. The independent engine uses
the existing source profiles, bytecode 4/5 and shared execution/resource limits;
the engine fingerprint identifies the expanded builtin namespace. CPython
3.14.7 is the pinned reference.

## Minimum and maximum

LA-193 adopts `min(iterable, *, key=None, default=...)`, the corresponding `max`
form, and their multiple positional argument forms with keyword-only `key`.
`default` is valid only for a single iterable. Missing arguments, unknown keywords
and incompatible forms fail before iteration. An empty iterable returns the exact
default object or raises `ValueError`; it does not call `key`.

Each item is acquired once, then its key is computed once. `key=None` uses the
item itself. Later keys compare strictly against the retained best key, using
`<` for minimum and `>` for maximum. Equal keys preserve the first item identity.
Non-boolean comparison results use Python truth conversion. Key, comparison and
truth errors propagate; only exhaustion from the iterator's next operation ends
selection. No eager list conversion or length hint is needed.

Primitive cases are shared by both source profiles. Classes-source/1 adds owned
iteration, callable keys, reflected comparisons and truth callbacks. Immutable
continuations root the iterator, callable, default, candidate, best item and keys
through parked execution and collection. Instruction/work/depth/memory limits,
cancellation and close use the existing controller. Output and side effects that
occur before failure are retained. Supported value/comparison families retain
their individual contracts; this does not admit new syntax or async iterables.

`tests/fixtures/interpreter/aggregations.json` records source observations. The
shared manifest runs both profiles in Node and Chromium through drain, stepped
and parked drivers. Lifecycle tests exercise suspended callbacks, forced
collection, interruption and zero logical teardown.

## Sum

LA-194 adopts `sum(iterable, /, start=0)`. Signature validation precedes iterator
acquisition; acquisition precedes rejecting string/bytes/bytearray starts. Empty
generic inputs return the exact start object. Addition uses ordinary `+`, with
owned reflected slots where required, and never mutates a list start through
in-place addition. Iterator exhaustion ends the fold; addition errors, including
`StopIteration`, propagate.

The pinned 64-bit reference's numeric phases are explicit. Small exact integers
accumulate within signed 64-bit bounds, then transition through ordinary addition.
Exact float and complex totals use Neumaier compensation with Python's operation
order, non-finite recovery and signed-zero behavior. Real and imaginary components
have separate compensation. Exact/subclass transitions follow the reference:
integer payloads bypass conversion callbacks in numeric phases; generic arithmetic
does not silently re-enter a prior optimized phase. Complex phases likewise consume
admitted real payloads without unrelated conversion hooks.

Immutable sum continuations retain the iterator and generic accumulator. Their
bounded binary64 metadata carries no Python-object edges. Numeric conversion,
allocation, addition callbacks and iterator work share the activation's budgets.
The corpus includes cancellation-prone magnitudes, subtypes, overflow/non-finite
values, empty identities, callback order/errors and deterministic numeric samples.
This adopts the sum API over existing value families; complex representation,
new codecs, general libraries and other numeric methods keep their own owners.

References: [builtin interfaces](https://docs.python.org/3.14/builtins/functions.html),
[pinned accumulation phases](https://github.com/python/cpython/blob/v3.14.7/Python/bltinmodule.c).
