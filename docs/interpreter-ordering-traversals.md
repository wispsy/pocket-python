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

LA-203 adds native list reverse iterators, generic reverse iterators for the
adopted text/tuple/binary/buffer layouts, and exact reversed ranges, including
lengths beyond signed 64-bit size. Dictionary/view reversal retains live ordered
mutation checks. Native list/range descriptors use the actual payload even when
subclasses override indexing or length. Native type identities, directories,
bound/unbound advancement and reverse length hints preserve detached owners.

LA-204 composes reversal with lazy pipelines, module callbacks, dynamic source,
cyclic temporary records, live slot replacement and generator cleanup. The
runnable `examples/interpreter_ordering.py` report provides ordinary source for
the offline acceptance. Length/pull callbacks share cancellation, work/depth and
allocation limits; parked collection, close and cancellation release all owners.

LA-205 adopts owned construction hints after iterator acquisition. `list` asks
the original iterable; pinned `tuple` traversal skips hints entirely. `__len__` wins when
present and valid, while TypeError falls back to `__length_hint__`. Hint calls
returning NotImplemented or raising TypeError use the default. Descriptor binding
failures and invalid returned values propagate. Integer subtype payloads are
accepted without invoking their index override; negative and signed-size overflow
checks preserve reference priority. Indexed/reverse iterator hints read their
retained source's current length. Estimates above the fixed sequence-item budget
fail with the shared resource error. Estimates do not allocate a fictitious
capacity; actual retained containers continue to use the common memory ledger.

LA-206 extends the same hint operation to `list.extend`, starred sequence
displays, mixed positional call assembly and starred assignment remainders.
Acquisition finishes before hint lookup. A single starred call argument and
`tuple()` skip hints in the pinned reference; mixed call arguments use the
original iterable, while unpacking asks the remainder iterator after its second
iterator acquisition. The verified optional `call-star` operand `list` preserves
that source distinction. Failures retain prior destination/argument effects and
use existing item and argument limits. The earlier hint refusal observations
are promoted into their original corpora with explicit adoption stages.

LA-207 composes hints with reverse/lazy pipelines, temporary cyclic records,
module and dynamic callbacks, bound owners and descriptor failures. Parked
extension, display, call and unpack operations retain both the original source
and acquired iterator; cancellation, close, nested depth failure and actual hint
allocation failure release partial graphs. Truth consumers continue to skip
hints. Binary constructors and unrelated native hint APIs retain their separate
scope rather than gaining support from this consumer slice.

LA-208 adopts `sorted(iterable, /, *, key=None, reverse=False)` in both profiles.
It first materializes a fresh list, including the original iterable's hint,
then validates sort keywords and converts reverse to Python truth. A supplied
key is called exactly once per item in original input order; empty inputs do
not validate a noncallable key. All keys are retained before any comparison.
Stable binary insertion compares only less-than and converts each result to
truth. Reversing before and after ascending ordering preserves equal-key order
for descending reports. Comparison count/order is an implementation detail;
the finite contract qualifies stable results for consistent ordering relations,
not CPython's internal sorting algorithm or pathological comparator schedules.
Source mutation by callbacks cannot replace the private materialized list.
The shared item/work budgets bound insertion moves and retained key storage.

LA-209 qualifies owned/reflected less-than, subtype priority, rich truth results,
bound key owners, cyclic keys, source mutation, reentrant sorting and original
dynamic failures. No equality callback is substituted for less-than. Parked key,
comparison, comparison-truth and reverse-truth callbacks survive collection or
close/cancel cleanly. Key allocation failure, instruction/work exhaustion,
insertion-move limits and nested sorting use the same resource controller.

LA-210 accepts the composed report from an isolated wheel after offline reload,
including original dynamic callback frames, nine Stop/Restart paths, a waiting
profile update and offline core-source execution with old-cache removal. The
fixed corpus has 205 class cases: 201 semantic/error comparisons and four
explicit subtype/serialization/in-place-sort refusals. Sixty-four cases are
explicitly shared with core-source/1. Node and Chromium run both profiles in
drain, stepped and parked modes: 1,614 observations with zero logical teardown.
The 208 ordering unit checks, 651 adjacent runtime checks, 26 relevant Python
checks, 759 compatibility probes per target and 52 installed offline checks pass
locally. CI review and final-main smoke remain the merge checkpoint.

References: [reverse implementation](https://github.com/python/cpython/blob/v3.14.7/Objects/enumobject.c),
[length hints](https://github.com/python/cpython/blob/v3.14.7/Objects/abstract.c),
[list operations](https://github.com/python/cpython/blob/v3.14.7/Objects/listobject.c).

Run focused checks with `python scripts/run_tests.py focused --feature ordering-traversals`.
General serialization, lazy-type subclasses, async traversal and unrelated #116
APIs retain separate scope owners. These finite observations do not close the
full Python compatibility, library/package or candidate milestones.
