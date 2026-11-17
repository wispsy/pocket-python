# Lazy iterable traversal

Track A #600 extends the finite sequence APIs under #116. Pinned CPython 3.14.7
defines the reference behavior. Both source profiles admit the explicitly shared
primitive/function cases; classes-source/1 adds owned iterable and callable slots.

LA-196 adopts `map(function, iterable, /, *iterables, strict=False)`. Construction
converts `strict` to truth before checking positional arity, then acquires every
iterator in argument order. It does not pull values or validate the callable.
Each advancement pulls one item from each iterator in order, then calls the
retained function once. Ordinary mode stops at the first exhausted source;
strict mode checks equal exhaustion and reports the first shorter/longer source,
including the reference's additional end probes. Partial pulls remain consumed.
Callback errors and callback `StopIteration` propagate independently of strict
source checks. A later advancement retries the sources, without a synthetic sticky
exhaustion flag. Source iterators retain their own exhaustion behavior.

The owned lazy value retains its iterator tuple and callable. Immutable operation
records retain partial arguments while acquisition, source pulls, strict truth and
callbacks suspend. Collection, close, cancellation, work/depth limits and actual
allocation failures use the existing execution controller. Every source request
must finish with zero logical resources. General length hints, serialization,
new lazy-type subclass layouts, async traversal and other #116 APIs remain separate.

`tests/fixtures/interpreter/traversals.json` records source/reference observations;
the shared manifest runs Node and Chromium with drain, stepped and parked drivers.
Native namespaces preserve type identity, directories and bound/unbound iterator
slots without admitting unrelated native methods.

```sh
python scripts/run_tests.py focused --feature traversals
python scripts/run_tests.py browser-conformance --feature traversals
```

LA-197 adopts `filter(function, iterable, /)`. Construction validates the signature
then acquires the iterator. Each advancement pulls candidates lazily, calls the
predicate and converts its result to Python truth until a match is found. `None`
and the native `bool` predicate test the original candidate directly. Matching
items preserve identity. Predicate/truth failures consume only the candidate
already pulled; later calls resume with the following item. Temporary predicate
owners, candidate objects and nested callback graphs remain rooted while parked.
Unbounded rejection scans share work and cancellation limits.

Reference: [pinned builtin implementation](https://github.com/python/cpython/blob/v3.14.7/Python/bltinmodule.c).

LA-198 composes lazy pipelines with generators, temporary bound methods,
closures, imports, dynamic source and iterable aggregation. The runnable
`examples/interpreter_traversals.py` report runs as ordinary Python and through
the independent engine. `scripts/ordinary_browser_smoke.py --traversals` accepts
new source after offline reload, preserves original dynamic callback frames,
stops suspended map/filter/truth/acquisition callbacks and restarts fresh. A
waiting service-worker update keeps the original profile until reload, then
checks the core-source pipeline offline and removes the old cache. Add
`--require-installed` to verify an isolated wheel installation.

LA-199 adopts `enumerate(iterable, start=0)`, including keyword order and the
pinned reference's signature diagnostics. Integer-index conversion runs before
iterator acquisition. Counts use exact integers across signed-64-bit boundaries;
integer subtype starts use their payload, while owned index callbacks suspend on
the shared machine. Each successful source pull reads and advances the current
counter, preserving reentrant calls and the original item. Source errors leave
the counter unchanged. Returned tuples are independent and preserve their values
through subsequent advancement. The counter and source graph are explicit memory
edges; the same limits and teardown rules apply.

Reference: [pinned enumerate phases](https://github.com/python/cpython/blob/v3.14.7/Objects/enumobject.c).

LA-200 adopts `zip(*iterables, strict=False)`. Empty zip yields no tuples. Each
nonempty advancement pulls sources from left to right and returns a fresh retained
tuple, preserving item identity. Repeated source arguments share one iterator's
state. Ordinary exhaustion stops immediately; strict exhaustion uses the same
ordered mismatch probes as map. A later advancement retries from the first source
after partial pulls, errors or mismatch reports. Iterators, strict conversion and
partially gathered tuple elements remain owned through suspension and collection.

LA-201 composes indexed/paired reports with lazy pipelines, temporary owners,
module callbacks, original dynamic frames, generator cleanup and cyclic records.
The installed offline checks additionally interrupt enumerate index conversion,
zip source pulls and strict truth conversion, then run a fresh report after
Restart. The core-profile update verifies all four APIs after offline reload.
Namespace ownership keeps generic aliases under #125 and serialization under
#126; listing those entries does not adopt their invocation or lazy subclasses.

The finite corpus contains 196 cases: 188 supported semantic/error observations
and eight explicit subtype/serialization refusals. Of those, 141 are explicitly
shared with core-source/1. Both profiles run on Node and Chromium with drain,
stepped and parked drivers, totaling 2,022 observations. These counts describe
this API slice, not overall Python completion. Lifecycle checks also cover native
rejection scans under bounded memory, nested lazy depth limits, actual callback
allocation failure, cancellation and zero logical teardown.
