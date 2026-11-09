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
Lexical payloads require the compiler to accept a minimally repaired input.
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
