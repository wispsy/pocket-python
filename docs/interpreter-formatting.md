# Bounded repr and str protocols

INT-REPR-01 adopts the next C3 protocol contract. The reference matrix in
`tests/fixtures/interpreter/formatting.json` pins CPython 3.14.7. Reference-only
success does not execute or certify the independent engine. INT-REPR-02 implements
the 58 adopted source cases and nine explicit future refusals. INT-REPR-03
delivers offline-console acceptance. The class console now has 38 source comparisons,
13 acceptance groups and nine Stop/Restart cycles. Its
[payload evidence](measurements/2026-10-22-formatting.json) records the complete
application and unchanged historical resource baselines.

## Exact surface

The adopted R1 stage adds repr(x) for None, bool, arbitrary integers, strings and
user instances with an adopted __repr__ slot. repr takes exactly one positional
argument. Primitive repr is available in core-source/1 and classes-source/1;
class source and custom slots still require the explicit class profile.

str() returns an empty string. str(x) retains the current None/bool/int/string/
exception-message forms and adds user __str__ dispatch. Existing strings and
strings returned by an adopted hook retain their identity. This stage adopts
zero or one positional argument, without encoding/errors or object= keyword
forms. Invalid call signatures raise Python TypeError. Deferred signature forms
earn no compatibility credit.

print retains its positional-only interface and default space/newline behavior,
adding these instance string conversions. Arguments are evaluated once, left to
right, before print begins converting them. A caller can retain a builtin in a
variable or pass it through an adopted callback; formatting must use the same
operation path in each case.

Default address-bearing object/class/function/module
displays, exception repr, __format__/format, format specifications, f-strings,
t-strings, ascii and byte decoding remain explicit future work in INT-TEXT-01.
An instance with no adopted representation must fail UNSUPPORTED rather than
receive an invented default display. Primitive value support does not imply its
full display API. Direct attribute access to a missing root object method retains
the current profile boundary.

## Slot selection and validation

Implicit repr selects __repr__ through the instance type's current C3 MRO.
Implicit str selects __str__, falling back to __repr__ only when the type has no
str slot. Instance fields affect explicit attribute access, while implicit
formatting bypasses them. Replacement/deletion affects later operations; a
retained bound method keeps its original callable.

Use the existing descriptor rules for functions, retained methods, static/class
methods, properties, custom __get__ and callable slot objects. Bind once and then
invoke once through ordinary VM frames. A present None or non-callable slot
raises TypeError. A failing __str__ binding propagates, including AttributeError, and must not
fall back to __repr__. Repr has a distinct optional-lookup rule: binding
AttributeError selects the default object display, which this slice explicitly
defers with UNSUPPORTED. Other repr binding errors, callback-body exceptions and
invalid results propagate. This rule also applies when str selected repr because
the str slot was absent. The optional truth-binding recovery rule remains separate.

An implicit hook must return an actual adopted Python string. A None, bool,
integer, container or user instance result raises TypeError; do not stringify or
recursively reinterpret it. Explicit obj.__str__()/obj.__repr__() remains an
ordinary call and returns its raw result without this protocol validation.
Errors keep the original caller source and any entered Python callback frames.
Nested repr/str, active exceptions, return/finally and constructor behavior use
the common unwinder.

## String representation

Quote selection and escaping follow the pinned reference: prefer single quotes,
use double quotes when that avoids escaping a single quote, escape the selected
quote and backslash, and use the reference control-character/hex escapes. Preserve
printable Unicode code points, including astral characters and combining marks.
Escape nonprintable/unassigned/private/surrogate/separator code points according
to the pinned Unicode 16.0.0 printability classification. Do not rely on a host
JavaScript engine's potentially different Unicode database.

Commit reproducible generated classification data, its generator and the Unicode
notice in the engine's complete asset closure. Bound each output append and charge
classification/escaping work. The existing 65,536-code-point string limit still
applies to the expanded representation, with a hard budget error before an
unbounded host allocation. Unicode classification changes require an explicit
version decision and new evidence.

## Print sequencing and output ownership

CPython writes an earlier argument and the separator before invoking a later
argument's __str__. Preserve this ordering when a binding/body itself prints or
raises. For example, a hook that prints "inner" and returns "outer" makes
`print("start", instance, "end")` produce `start inner\nouter end\n`.
A failing hook leaves the earlier prefix visible and adds no trailing newline;
the caller's exception handler can continue output from that point.

Keep the existing primitive-only print path and its single output write. Before
entering a user formatting callback, flush the already converted prefix and its
separator, then retain the original arguments and next position in a bounded
owned continuation. Resume with the validated returned string and convert the
remaining arguments in order. Do not hold an unaccounted text buffer across a
pause. Output writes retain their existing logical external leases and aggregate
output limit; extra segments on the new callback path have their own explicit
lease costs. This does not promise CPython file-write granularity or file objects.

## Execution and resource rules

Use owned unary/format phases and exhaustive immutable completion roots on the
existing Execution machine. Primitive formatting stays synchronous; user code
enters ordinary frames without a nested evaluator, recursive drain or Promise
per primitive operation. Pending print arguments, receiver, descriptor/callable,
outer operands and returned strings stay rooted until the new owner is installed.
Retain before release, including exception and allocation-failure paths.

Instruction pauses must match draining for stdout, side effects, exceptions and
teardown. Closing a paused operation abandons pending output/conversions without
running Python cleanup, as for existing hard cancellation. Retain bounded Python
frame/implicit-dispatch depth, work, memory and total-output accounting; native
wrapper unwrapping remains work-bounded without consuming Python-frame depth.
Cover recursive hooks, descriptor/builtin redirect cycles, real callback OOM,
work/output limits, cancellation and zero logical bytes/objects/roots/frames/
external owners after close. Existing composed baselines must stay unchanged for
programs that do not use the new formatting surface.

Additive admission keeps bytecode 4/core-source/1 and bytecode 5/classes-source/1;
the engine fingerprint identifies the changed implementation. Refresh engine and
library/application locks and retain exact-revision source and browser reports.
The independent engine remains outside released Python distributions until its
release gate. The parent class milestone stays open for indexing, iteration and
equality/hash, with async applications and the later Wasm backend separate.

References: [repr/str data model](https://docs.python.org/3.14/reference/datamodel.html#object.__repr__),
[repr()](https://docs.python.org/3.14/builtins/functions.html#repr),
[str()](https://docs.python.org/3.14/builtins/functions.html#func-str), and
[implicit lookup](https://docs.python.org/3.14/reference/datamodel.html#special-method-lookup), and
[pinned CPython repr slot](https://github.com/python/cpython/blob/v3.14.7/Objects/typeobject.c).
The live documentation may describe a later maintenance version; executable
expectations remain pinned to 3.14.7.

## Float representations

LA-190 adopts binary64 `repr`, `str` and positional `print` in both source
profiles, including native descriptors and compatible float subclasses. Finite
values select the shortest decimal that round trips, then the closest decimal
and even ties, using exact integer ratios. Python fixed/scientific thresholds,
exponent padding, `.0`, signed zero, `inf` and `nan` spellings are explicit.
This is independent of JavaScript number display. The bounded conversion charges
work before exact arithmetic and creates an owned string through the usual value
limits. Existing profile and bytecode versions retain their meaning.

The pinned corpus includes exponent boundaries and adjacent floats, subnormal and
maximum finite values, deterministic binary64 samples and explicit native calls.
Format specifications, complex displays and the remaining text families keep
their separate #127/#184 boundaries.

## Recursive container representations

LA-191 adds native list, tuple and dict `repr`, `str` and positional `print`,
including compatible native subclasses. Nested values call their Python `repr`
slots on the owned execution machine. Shared aliases display independently;
active recursive lists, tuples and dictionaries use `[...]`, `(...)` and `{...}`.
Traversal reads live list lengths and dictionary positions; each dictionary
key/value pair is retained before its key callback. Existing mutation APIs keep
their own admission boundaries.

Representation state lives in immutable continuations with exhaustive roots for
the receiver, captured item, key text and an arena-owned list of rendered pieces.
The recursion guard follows active continuations and frames, so exceptions,
collection, interruption and close naturally release it. Text, item, work and
depth limits remain bounded. Primitive-only printing retains its original path.
Callback-bearing property-name diagnostics now use the same container renderer;
their original assertions and source frames are retained in the adopted cases.
Set/view/range, complex and default address-bearing displays remain separate.

LA-192 composes report records, retained callback fields, generator cleanup,
registry modules and dynamic source. The runnable `examples/interpreter_display.py`
is accepted through an installed offline console. The dedicated ordinary-display
browser check covers fresh source, original dynamic frames, Stop/Restart during
list and dictionary key callbacks, waiting updates and a core-profile offline
reload. Node/Chromium differential checks retain drain, stepped and parked
execution, including zero logical teardown. These observations do not adopt
format specifications, f/t-strings, additional libraries or DOM capabilities.

LA-192A keeps the legacy bytecode-3 display boundary; expanded float/container
display belongs to source bytecode 4/5. It also reconciles three earlier syntax
cases whose qualified metadata tuples can now be displayed, retaining their
original assertions and adding full native-field/argument observations. The
independent prior-compound metadata boundary remains explicit at field access.
