# Generated syntax exception metadata

Track A #600 continues the native exception contract under #124. CPython
3.14.7 is the independently executed semantic oracle. Dynamic compilation
remains in `classes-source/1`; core admission is unchanged.

LA-64 publishes native `SyntaxError` fields for missing expressions at a
statement's newline or end of input. This includes incomplete assignments,
conditions and binary expressions through `compile`, `exec` and `eval`.
The original compiler diagnostic and byte-based host span remain available to
the host. Native `msg`, character-based offsets, source text and end ranges
follow the qualified Python diagnostic instead.

`args` contains the native message and six-item location tuple. Fields remain
independent of later argument replacement, and argument snapshots survive
field replacement. Native `_metadata` contains the qualified parser's source
tuple. Exact and subtype string filenames retain their original identity;
byte filenames decode to strings. Source and line endings are normalized by
the existing compiler. `single` and `eval` retain their EOF offset/text behavior.

LA-66A retains an independent `_metadata` field-read boundary after a completed
compound statement. CPython's second diagnostic pass records statement state
that this parser has not adopted. Native message/location fields and argument
snapshots remain readable; replacing the native metadata field clears that
field's boundary normally. Lexical errors retain their separately qualified
zero-statement metadata.

The [source corpus](../tests/fixtures/interpreter/syntax-errors.json) runs through
Node and Chromium draining, stepping and parked execution. Tests also collect
cyclic filename/error graphs between instructions and check cancellation,
close and shared allocation limits. The former incomplete-`if` field refusal
in the general exception corpus is adopted by this slice.

LA-65 adds unmatched/mismatched and unclosed delimiters, ordinary/raw/bytes
unterminated strings and triple-quoted strings. The last unmatched opener,
cross-line delimiter wording, Unicode offsets, physical versus implicit
newlines and complete parser source metadata have independent reference cases.
Lexical payloads require the parser to accept a minimally repaired input.
This conservative check leaves earlier syntax errors and unqualified repairs
behind the existing field-read boundary. It consumes the same compilation
work budget and does not execute the repaired input.

Other generated diagnostics retain their native field-read boundary until
their exact messages and locations are qualified. This includes indentation,
control-flow and broader parser/binder errors at this checkpoint.
Native-key sparse probing (#759), groups/except*, traceback objects, note
export, wider formatting and library/package/candidate gates keep their owners.
Finite corpus observations do not measure overall Python completion.

LA-66 composes these payloads with registry modules, nested compilation, causes,
notes and suspended generator cleanup. The runnable
[generated-syntax example](../examples/interpreter_generated_syntax.py) preserves
source fields after replacing arguments. Installed offline acceptance checks
fresh source and original dynamic frames, stops a retained-payload loop and
generator cleanup, restarts with fresh state and applies a reduced-profile
update that retains the core dynamic-compilation boundary.

Primary references: the pinned [diagnostic payload](https://github.com/python/cpython/blob/v3.14.7/Parser/pegen_errors.c), [parser metadata](https://github.com/python/cpython/blob/v3.14.7/Parser/pegen.c) and [statement registration](https://github.com/python/cpython/blob/v3.14.7/Parser/action_helpers.c).

LA-67 adds qualified unexpected indentation, missing suites for adopted statement headers, inconsistent tabs/spaces and unmatched dedentation. Native IndentationError/TabError ancestry, descriptors, args independence and EOF/text/end-position differences in exec and single modes have source comparisons. Indentation repairs share the lexical validation gate, preserving earlier-error and unsupported-repair boundaries. Prior compound-statement metadata keeps its independent LA-66A boundary.

LA-68 qualifies out-of-scope return, break and continue after full parsing and binding. Later grammar failures and earlier binding failures therefore retain their proper priority. Native ranges cover the complete statement, with absent text/metadata. These compiler diagnostics preserve the pinned UTF-8 byte columns, including Unicode before/inside a return; they differ from parser diagnostics that convert to character offsets. Ambiguous single-mode compound EOF diagnostics and unqualified binder fields retain explicit boundaries. Syntax-only repair validation lets lexical errors precede a later control-flow error.

LA-69 composes indentation/control-flow errors with module factories, causes/notes, retained filename/error cycles and generator cleanup. The fixed 213-case generated-syntax corpus records 197 supported semantic/error comparisons and 16 explicit native-field refusals; no divergences or untested cases are credited as supported. It is separate from the 2,443-case ordinary exception corpus (2,388 supported, 55 refused) and its 7 host/crash/cache qualifications. Dynamic source remains in classes-source/1. Library/package certification, A2, #124 and the independent candidate/release gates remain open.

A suspended flags-index conversion can release the caller's filename binding before compilation fails. Parked collection/cancellation/close checks keep the original filename subtype and its child graph rooted throughout that conversion, then independently through the native error fields.

LA-70 adopts global/nonlocal declaration diagnostics, including parameter conflicts,
use or assignment before a declaration, conflicting declarations, module-level
nonlocal and missing enclosing bindings. Binding errors retain a single message
argument; their independent native location fields use UTF-8 byte columns, absent
source text and absent parser metadata. Conflict locations select the first
declaration. Full grammar validation precedes binding, which precedes control-flow
validation. Store targets do not count as name reads during scope analysis.

LA-71 adds duplicate function/lambda arguments across positional-only,
positional, keyword-only and variadic groups. Full parsing precedes the
symbol-table check; parameter group order, normalized identifiers and private
name mangling select the message and offending parameter. These diagnostics
share the one-argument binding layout and independent native byte-column range.

LA-72 composes binding payloads with module factories, dynamic exec/eval,
causes/notes, cyclic filename graphs and suspended generator cleanup. Collection,
cancellation/close and shared allocation checks cover fields after argument
replacement. Installed offline acceptance checks fresh source, original dynamic
frames, retained-field and cleanup Stop/Restart paths and reduced-profile updates.

LA-73 adds missing-colon diagnostics at complete adopted compound headers:
conditions, loops, function/class definitions and try/except/else/finally clauses.
Physical newlines, comments, Unicode and implicit single-mode EOF retain their
separate native ranges and source text. Grammar failures take priority over
duplicate parameters and scope declarations. Earlier completed compound
statements keep the independent parser metadata boundary; non-newline header
failures and unadopted grammar retain their existing field boundaries.
