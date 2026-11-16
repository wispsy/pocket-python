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

Reference: [pinned builtin implementation](https://github.com/python/cpython/blob/v3.14.7/Python/bltinmodule.c).
