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

## Composed acceptance

LA-195 combines selection and totals with recursive record displays, temporary
bound keys, retained closures, generic accumulator objects, live list mutation,
generator cleanup, imports and dynamic source. The example
`examples/interpreter_aggregations.py` is ordinary executable Python. The corpus
has 139 cases, including 101 explicitly shared with core-source/1; each profile
runs through Node and Chromium drain, stepped and parked execution. Counts refer
to this finite API corpus and do not measure complete Python compatibility.

`scripts/ordinary_browser_smoke.py --aggregations` runs the report and composed
cases after an offline reload, preserves original dynamic key frames and stops
inside owned key, comparison and addition callbacks. Each fresh Restart runs a
new aggregation program. A waiting service-worker update retains the old profile
until reload, then verifies core-profile aggregation offline and removes the old
cache. `--require-installed` checks an isolated installed distribution.

```sh
python scripts/run_tests.py focused --feature aggregations
python scripts/run_tests.py browser-conformance --feature aggregations
python scripts/ordinary_browser_smoke.py --aggregations
```

Track B application/UI/host contracts, DOM authority, unadopted consumers and
library/package/release gates remain separate. This batch does not change them.

References: [builtin interfaces](https://docs.python.org/3.14/builtins/functions.html),
[pinned accumulation phases](https://github.com/python/cpython/blob/v3.14.7/Python/bltinmodule.c).
