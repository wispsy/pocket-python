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
