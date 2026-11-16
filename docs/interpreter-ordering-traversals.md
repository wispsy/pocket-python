# Reverse traversal, length hints and stable sorting

Track A #600 extends #116 using CPython 3.14.7 as the semantic reference.
`tests/fixtures/interpreter/ordering-traversals.json` records each adopted slice;
the shared runner covers both explicit source profiles where admitted, on Node
and Chromium with draining, stepping and parked collection.

LA-202 adopts the positional `reversed(sequence, /)` protocol in classes-source/1.
Type-level `__reversed__` takes precedence over indexed fallback; its return value
is passed through without iterator validation. Binding failures propagate and
`None` disables reversal. Fallback requires indexed access and captures the
initial length. Each pull uses the current item slot and its captured index;
recursive pulls preserve the reference's outer index update. Every failed pull
releases the source and permanently exhausts the iterator; IndexError and
StopIteration become normal exhaustion, while other errors propagate once.
Temporary sequences and pending descriptors use the common owned machine.

References: [reverse implementation](https://github.com/python/cpython/blob/v3.14.7/Objects/enumobject.c),
[length hints](https://github.com/python/cpython/blob/v3.14.7/Objects/abstract.c),
[list operations](https://github.com/python/cpython/blob/v3.14.7/Objects/listobject.c).

Run focused checks with `python scripts/run_tests.py focused --feature ordering-traversals`.
General serialization, lazy-type subclasses, async traversal and unrelated #116
APIs retain separate scope owners. These finite observations do not close the
full Python compatibility, library/package or candidate milestones.
