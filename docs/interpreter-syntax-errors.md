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

Primary references: the pinned [grammar](https://github.com/python/cpython/blob/v3.14.7/Grammar/python.gram), [diagnostic payload](https://github.com/python/cpython/blob/v3.14.7/Parser/pegen_errors.c), [parser metadata](https://github.com/python/cpython/blob/v3.14.7/Parser/pegen.c) and [statement registration](https://github.com/python/cpython/blob/v3.14.7/Parser/action_helpers.c).

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

LA-74 adopts qualified assignment, deletion and augmented-target diagnostics for
literal/call/operator/comparison/conditional/lambda/display/comprehension
expressions, plus tuple/list augmented targets. Ordinary, chained and loop
assignment contexts retain their different wording. Parenthesized expression
ranges and comprehension closing delimiters follow the parser reference; offsets
use characters rather than the binder's byte columns. A source-only repair must
parse successfully before fields are published and consumes the caller's compile
budget. It is never executed. Nested assignment targets, failed repairs and
prior-compound parser metadata keep their explicit boundaries.

LA-75 composes missing-colon and invalid-target failures with modules, nested
dynamic source, causes/notes, retained filename graphs and suspended cleanup.
Argument snapshots, native fields and parser metadata retain their independent
identity/mutation behavior. The example and installed offline console include
fresh source, original dynamic frames, Stop/Restart and reduced-profile updates.

LA-75A preserves declaration order when selecting missing nonlocal bindings,
including later reads of other declared names. Invalid operands inside starred
targets retain the nested-target field boundary instead of inheriting an
ordinary assignment hint.

LA-76 qualifies invalid operands nested inside list/tuple assignment targets,
including starred operands and loop targets. Nested operands use the plain
assignment message without the outer assignment's equality hint. Character
ranges select the invalid expression independently of surrounding grouping;
native fields and argument snapshots retain their existing independence.
The source-only repair must still parse successfully, so multiple invalid
operands and later grammar failures retain their field boundary. Earlier
compound statements keep the independent parser metadata boundary.

LA-77 distinguishes parser deletion of starred targets from compiler rejection
of a lone starred target or multiple stars at the same unpacking level. Parser
errors retain source text and character columns; compiler errors have absent
text/metadata and UTF-8 byte columns. Full parsing and binding precede the
compiler checks, and the first target/control-flow error retains source order.
Valid starred operands continue through the ordinary unpacking implementation.

LA-78 composes nested/starred diagnostics with modules, nested dynamic source,
causes/notes, argument replacement, retained filename cycles and suspended
cleanup. Parked collection, cancellation/close and shared allocation limits
cover both parser and compiler layouts. The runnable example and installed
offline acceptance include the new fields, original dynamic frames, retained
target and cleanup Stop/Restart paths, and reduced-profile updates.

LA-79 adds required positional parameters following defaults, including across
the positional-only separator, and defaults on variadic positional/keyword
parameters. Functions and lambdas share the qualified parser messages,
character ranges and source fields. These grammar errors precede duplicate-name
binding errors and invalid function bodies. Malformed parameter tails,
annotations and earlier compound metadata retain their independent boundaries.

LA-80 adds repeated/misordered positional-only and keyword-only separators,
missing names after a bare star, and parameters after a variadic keyword
parameter. Function and lambda diagnostics retain their distinct bare-star
locations. Qualified multiline parameter diagnostics also preserve whether
the tokenizer's source line includes its physical newline. UTF-8 identifiers,
exec/eval/single modes and grammar-before-binding priority have independent
reference cases. Malformed separator tails and annotations remain bounded.

The diagnostic observations use the pinned
[parameter grammar](https://github.com/python/cpython/blob/v3.14.7/Grammar/python.gram)
and [target compiler](https://github.com/python/cpython/blob/v3.14.7/Python/codegen.c)
as primary references, with separately executed source programs as the oracle.

LA-81 composes signature diagnostics with module factories, nested exec/eval,
chaining and notes, retained filename cycles and suspended cleanup. Native
fields remain owned after replacing arguments and releasing the caller's
filename binding during flags conversion. Collection, cancellation/close,
shared limits and original dynamic frames cover those graphs. The example
and installed offline console exercise new source, retained-field and cleanup
Stop/Restart paths, plus the existing reduced-profile boundary.

At LA-81, the fixed generated-syntax corpus contains 2,743 cases: 2,525 supported
semantic/error comparisons and 218 explicit native-field refusals, with no scored
divergences or untested cases. The separate ordinary exception corpus retains
2,443 cases (2,388 supported / 55 refused) and seven host/crash/cache qualifications.
These finite observations do not measure overall Python compatibility. #600/A2,
#124, #759, groups/except*, traceback objects/mutation, note export, library/package
qualification and candidate/release gates remain open.

LA-82 qualifies positional arguments following explicit keywords or keyword
unpacking, and iterable unpacking following keyword unpacking. Parser locations
use character columns: positional-order failures select the closing call token,
while iterable-order failures begin at the preceding comma and cover the
contiguous starred arguments. Multiline source text and exec/eval/single modes
have independent reference observations. Malformed argument tails, interacting
positional/unpacking failures and generator call grammar retain their separate
native-field boundaries at this checkpoint.

LA-83 adds unparenthesized generator call arguments with a trailing comma or
other arguments, and lone starred generator elements. Native ranges end at
the last iterable/filter expression, independently of grouping delimiters.
Multiline calls preserve the tokenizer's source-line newline behavior and the
pinned parser's conversion of both offsets against the starting error line. Full
comprehension parsing precedes these diagnostics; malformed clauses and
keyword-valued generator calls retain their separate field boundaries. Valid
sole generator arguments keep their existing execution behavior.

LA-84 composes call grammar payloads with registry modules, nested exec/eval,
causes/notes, independent argument snapshots, cyclic filename owners and
suspended flags conversion/cleanup. Parked collection, cancellation/close and
shared allocation limits cover the retained fields. The example and installed
offline console exercise fresh source, original dynamic frames, Stop/Restart
and the reduced-profile update.

LA-85 defers repeated explicit call keywords until full parsing and binding
finish. Normalized names select the earliest original keyword with a repeated
name, then its first repeat. The independent native location uses UTF-8 byte
columns, two arguments and absent text/parser metadata. Nested calls validate
their own keyword lists before their operands; function decorators/defaults,
class bodies/bases and generator versus inlined comprehension ordering have
separate reference cases. Earlier compiler errors retain their priority, and
ordinary keyword unpacking continues through its existing runtime checks.

LA-86 qualifies multiple simple statements on separate physical lines in
`single` mode. The native range selects the first statement's terminating
newline, including an actual trailing comment, and parser metadata is absent.
This failure precedes later grammar/binding/compiler errors. Empty and
comment-only inputs expose their zero-offset parser layout. Semicolon-separated
statements, trailing blank/comment lines and exec/eval retain their ordinary
behavior. Compound interactive input, later tokenizer failures and unterminated
whitespace-only indentation retain independent field boundaries.

LA-87 composes repeated-keyword and interactive-input diagnostics through
modules, nested exec, causes/notes, retained filename cycles and suspended
flags conversion/cleanup. Native fields survive argument replacement and
retain their original dynamic frames. Expression-order cases cover conditional
tests, assignment values and loop iterables before their targets. Parked
collection, cancellation/close, shared limits and installed offline
Stop/Restart/reduced-profile acceptance exercise both layouts.

LA-88 qualifies positional arguments mixed with later iterable/mapping
unpacking. The first invalid argument group selects the diagnostic message;
a mapping followed by an inadmissible star in the second group selects that
star before parsing its operand. Otherwise the closing call token selects the
range. Unicode/multiline source and all three compile modes retain parser
character offsets. Earlier completed compound metadata keeps its independent
field-read boundary.

LA-89 qualifies generator clauses after explicit keyword or mapping arguments.
The keyword form selects the name and equals sign with the native comparison/
assignment-expression hint; mapping arguments select the `for` token with the
generic syntax message. Complete adopted clauses, Unicode and multiline text
have independent observations. Malformed clauses retain their field boundary,
and valid parenthesized generator keyword values keep their execution behavior.

LA-90 composes both call slices through registry modules, nested dynamic source,
causes/notes, independent argument snapshots and cyclic filename owners.
Suspended flags conversion and generator cleanup retain those fields through
parked collection, cancellation and close. Shared allocation limits, original
dynamic frames and installed offline Stop/Restart cover the same payloads.

LA-91 shares the adopted argument-list parser between calls and class headers.
Class positional/keyword and iterable/mapping ordering, generator parentheses
and keyword-generator failures retain their exact messages and character
ranges. Sole generator bases require parentheses; class header diagnostics
precede body grammar failures. Multiline unpacking converts its end column
against the starting source line, including Unicode. Valid expanded bases,
metaclass keywords, parenthesized generator bases and named-expression bases
have separate controls; class keyword and shared parser budgets remain bounded.

LA-92 qualifies repeated normalized class keywords after full parsing and
binding. Decorators and the class body compile before the class keyword list;
that list validates before base and keyword-value expressions. Native fields
use UTF-8 byte columns, two arguments and absent source text/parser metadata.
Earlier binding/control failures retain their priority. Incomplete inline
compound input in `single` mode keeps its native field-read boundary; newline-
terminated input has independent compiler comparisons.

LA-93 composes the class header/parser and repeated-keyword/compiler layouts
through registry modules, nested exec, chaining/notes and independent argument
snapshots. Cyclic filename owners and suspended flags conversion/cleanup survive
parked collection, cancellation/close and shared allocation limits. The runnable
example and installed offline console retain original dynamic frames, fresh
Stop/Restart behavior and the reduced-profile dynamic-compilation boundary.

LA-94 qualifies missing except/finally blocks and unparenthesized multiple
handler types with an alias. Parser ranges retain physical/implicit EOF,
comment and Unicode distinctions, including multiline starting-line end-column
conversion. Parenthesized handler tuples remain valid. Earlier completed
compound statements keep the independent parser metadata boundary.

LA-95 defers non-final bare handlers until complete parsing and binding. Try
bodies and else suites compile before handlers; a bare-handler diagnostic
precedes its own body and later handlers. Native fields use the entire handler's
UTF-8 byte range, two arguments and absent source text/parser metadata.
Unterminated interactive compound input keeps its independent field boundary.

LA-96 composes try parser/compiler payloads through modules, nested exec,
chaining/notes and independent fields/argument snapshots. Cyclic filenames and
suspended conversion/cleanup retain their owned graphs through parked
collection, cancellation/close and shared limits. The runnable example and
installed offline console cover original dynamic frames and Stop/Restart.

LA-97 qualifies unparenthesized from-import trailing commas and reversed
import/from statements. Relative/dotted modules, aliases, comments, Unicode
and explicit line continuation retain their parser source ranges. Interactive
implicit EOF has its own offsets. Valid parenthesized imports keep ordinary
compilation; malformed tails and earlier compound metadata remain bounded.

LA-98 qualifies invalid import aliases across adopted expression families.
Target labels and character ranges retain grouping, comprehension closing
delimiters and multiline/Unicode distinctions. Native fields require a
successfully parsed source-only alias replacement, charged to the caller's
compilation budget. Multiple invalid aliases, failed repairs and unadopted
expressions keep their field boundaries.

LA-99 composes import grammar and alias payloads through modules, nested dynamic
source, chaining/notes and independent fields/arguments. Parked collection,
cancellation/close and shared limits cover cyclic filenames and suspended
conversion/cleanup. The example and installed offline console exercise original
dynamic frames, retained-field/cleanup Stop/Restart and reduced-profile updates.

LA-99A preserves empty tuple grouping. Empty tuple handlers with aliases compile
and skip nonmatching exceptions normally; redundant grouping around an empty
tuple import alias keeps the innermost tuple's native range. This prevents a
host failure while constructing a handler diagnostic.

LA-100 qualifies multiple and trailing-comma elements in list/set comprehensions.
Adopted clauses are parsed before the specialized message is selected. Grouping,
starred operands, character ranges and multiline first-line conversion follow the
pinned grammar; malformed clauses and prior-compound metadata retain boundaries.

LA-101 qualifies starred list/set/generator comprehension elements and mapping
unpacking in dict comprehensions. Iterable errors retain the complete starred
operand range; dictionary errors select the double-star token. Adopted clauses
must parse before fields are published. Invalid operands/tails remain bounded.

LA-102 composes comprehension payloads through modules, nested exec, chained
errors and notes. Independent argument snapshots, cyclic filename owners and
suspended flags/cleanup retain their fields through parked collection,
cancellation/close and shared limits. Offline acceptance includes original
dynamic frames and retained-field/cleanup Stop/Restart paths.

LA-103 qualifies missing colons after subsequent dictionary keys and missing
expressions after colons. Missing-key locations select the final character of
the key with a zero native end offset; missing values select the colon token.
Grouping, multiline/Unicode text and parser modes retain independent cases.
Malformed/unadopted keys and prior-compound metadata keep their boundaries.

LA-104 qualifies starred dictionary values whose adopted operand reaches a
comma or closing brace. The range starts at the star and reaches the separator,
including intervening spaces and physical lines. Failed operands and boolean,
conditional or comprehension tails retain explicit native-field refusals.

LA-105 composes dictionary payloads through modules, nested exec, chained errors
and notes. Native fields and argument snapshots survive cyclic owners,
suspended flags/cleanup, parked collection and cancellation/close. The example
and offline console preserve original dynamic frames and Stop/Restart behavior.

LA-105A retains native expression ranges independently of execution spans.
Nested comprehension delimiters and operand grouping contribute to the new
comprehension-element and missing-dictionary-key diagnostics without changing
the host locations used by valid execution.

LA-106 qualifies missing `in` after adopted comprehension targets in list, set,
dictionary and generator forms, including call and class-header contexts.
The diagnostic precedes target validation and selects the next token with
character offsets and physical source-line newlines. Ungrouped starred targets,
unadopted operands and prior-compound metadata keep explicit field boundaries.

LA-107 qualifies absent iterable/filter operands at comma and closing-delimiter
boundaries, plus comma tails in list/set/dictionary and parenthesized generator
comprehensions. Native fields select the unexpected token and preserve physical
source-line newlines. Keyword-valued and unparenthesized class generators keep
their incomplete-clause field boundary, including nested clause failures.

LA-108 composes both clause layouts through modules, nested exec, chaining/notes
and independent fields/arguments. Cyclic filename owners and suspended flags or
cleanup survive parked collection, cancellation/close and shared limits. The
example and installed offline console retain original frames and Stop/Restart.

LA-108A preserves incomplete-clause field boundaries inside already invalid
multiple-element, starred and dictionary-unpacking comprehensions. Nested clause
failures share their surrounding diagnostic context, retaining the pinned
parser priority instead of exposing a later operand location.

LA-109 qualifies mixed dictionary/set displays at the offending star,
double-star or colon token. Malformed following operands retain the earlier
display error; Unicode, multiline text and all three modes have independent
observations. Surrounding unqualified comprehension contexts keep their field
boundary instead of exposing a later nested display location.

LA-110 qualifies dictionary entry lists followed by comprehension clauses.
Multiple pairs, unpacking entries and a trailing entry comma select the `for`
token before parsing the malformed clause. Grouped values, Unicode, multiline
text and all compile modes retain independent reference observations.
Unadopted entries and unqualified outer comprehensions keep field boundaries.

LA-111 composes both display layouts through modules, nested exec, chaining/notes
and independent fields/arguments. Cyclic filename owners, suspended conversion
and cleanup survive parked collection, cancellation/close and shared limits.
The runnable example and installed offline console retain original dynamic
frames, retained-field/cleanup Stop/Restart paths and reduced-profile updates.

LA-112 qualifies missing `in` separators after adopted for-statement targets.
Unexpected tokens, implicit/physical newlines, comments and Unicode preserve
parser fields. Target validation retains priority; malformed targets and prior
compound metadata keep their independent boundaries.

LA-113 qualifies absent for iterable and if/elif/while conditions at an explicit
colon. Target errors retain precedence. Earlier compound statements keep the
independent parser-metadata boundary while native fields remain available.

LA-114 composes both compound-header diagnostics through modules, nested exec,
chaining/notes and independent fields/arguments. Cyclic filename owners and
suspended conversion/cleanup retain fields through collection, cancellation,
shared limits and installed offline Stop/Restart acceptance.

LA-115 qualifies missing conditional-expression else clauses after adopted
body/test expressions. Native ranges retain grouping, comprehension delimiters,
Unicode and multiline first-line end-column conversion. Malformed tests and
unqualified surrounding comprehensions retain explicit field boundaries.

LA-116 qualifies absent conditional alternatives at commas, closing delimiters
and newlines. Physical/implicit EOF, comments and Unicode retain native
locations. Keyword/colon/semicolon alternatives, malformed operands and
unqualified surrounding comprehension contexts keep explicit field boundaries.

LA-112A preserves boolean and conditional for-target continuations as
explicit native-field boundaries. The reference can select an earlier expression
range, so the missing-in separator diagnostic is not published for these tails.

LA-117 composes both conditional diagnostics through modules, nested exec,
chaining/notes and independent fields/arguments. Cyclic filenames and suspended
conversion/cleanup survive collection, cancellation/close and shared limits.
The example and installed offline console cover original frames, retained-field
and cleanup Stop/Restart paths and reduced-profile updates.

LA-118 qualifies absent compound-header operands at reserved keywords,
commas, semicolons and newlines. Adopted if/elif/while headers and for iterables
preserve native token ranges, Unicode and compile-mode newline behavior.
Malformed operands, target priority and prior-compound metadata retain their
independent field boundaries.

LA-120 composes header-start and conditional-test payloads through modules,
nested exec, chaining/notes and independent fields/arguments. Cyclic filenames,
suspended conversion and cleanup survive parked collection and interruption.
The example and installed offline console cover retained fields, cleanup and
Stop/Restart paths.

LA-119 qualifies missing conditional tests at adopted keywords, delimiters and
newlines. Native fields retain Unicode columns, multiline text and all compile
modes. Malformed tests, unparenthesized lambdas and unqualified comprehension
filters keep explicit boundaries.

The current fixed generated-syntax corpus contains 3,173 cases: 2,947 supported
semantic/error comparisons and 226 explicit native-field refusals. The ordinary
exception corpus retains its separate 2,443 cases and seven host/crash/cache
qualifications. Finite observations do not measure overall Python completion;
#124, #600/A2, #759 and library/package/candidate/release gates remain open.
