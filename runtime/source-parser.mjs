import {tokenize, SourceError, SOURCE_LIMITS, syntaxDiagnostic} from "./source-tokens.mjs";

export const PARSER_LIMITS = Object.freeze({nodes: 8192, depth: 64, decorators: 16});
const BINARY = new Map([["+", "add"], ["-", "subtract"], ["*", "multiply"], ["/", "divide"], ["//", "floor-divide"], ["%", "modulo"],
  ["**", "power"], ["@", "matmul"], ["&", "bit-and"], ["|", "bit-or"], ["^", "bit-xor"], ["<<", "left-shift"], [">>", "right-shift"]]);
const COMPARISONS = new Map([["==", "equal"], ["!=", "not-equal"], ["<", "less"], ["<=", "less-equal"], [">", "greater"], [">=", "greater-equal"], ["is", "is"], ["in", "contains"]]);
const AUGMENT = new Set(["+=", "-=", "*=", "/=", "//=", "%=", "**=", "@=", "&=", "|=", "^=", "<<=", ">>="]);

export function freezeSourceTree(root) {
  const pending = [root], seen = new Set();
  for (let index = 0; index < pending.length; index++) {
    const value = pending[index];
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value); for (const child of Object.values(value)) pending.push(child); Object.freeze(value);
  }
  return root;
}

class Parser {
  constructor(source, options) {
    this.lexed = tokenize(source, options); this.options = options;
    this.languageProfile = options.languageProfile ?? "core-source/1";
    if (!["core-source/1", "classes-source/1"].includes(this.languageProfile))
      throw new SourceError("UNSUPPORTED", "Unknown source language profile.", {filename: this.lexed.filename, phase: "parse"});
    this.classes = this.languageProfile === "classes-source/1";
    this.tokens = this.lexed.tokens; this.filename = this.lexed.filename; this.index = 0;
    this.previous = this.tokens[0]; this.work = this.lexed.stats.work; this.nodes = 0; this.depth = 0;
    this.functionDepth = 0; this.loopDepth = 0; this.heights = new WeakMap();
    this.refusal = null; this.typeExpression = false; this.grouped = new WeakSet();
    this.nativeRanges = new WeakMap(); this.groupRanges = new WeakMap();
    this.completedCompound = false;
    this.controlError = null;
    this.keywordErrors = [];
    this.handlerErrors = [];
    this.maxNodes = options.maxNodes ?? PARSER_LIMITS.nodes;
    this.maxDepth = options.maxParseDepth ?? PARSER_LIMITS.depth;
    for (const [value, cap] of [[this.maxNodes, PARSER_LIMITS.nodes], [this.maxDepth, PARSER_LIMITS.depth]])
      if (!Number.isSafeInteger(value) || value < 1 || value > cap) throw new TypeError("Invalid parser limit.");
  }
  fail(message, token = this.peek(), code = "SYNTAX", name, syntax) {
    throw new SourceError(code, message, {filename: this.filename, span: token.span, phase: "parse", name, syntax});
  }
  diagnostic(message, span, options = {}) {
    const syntax = syntaxDiagnostic(this.lexed.source, this.filename, message, span, {newline: !this.options.mode || this.options.mode === "exec", ...options});
    syntax.metadata = this.lexed.source + ((!this.options.mode || this.options.mode === "exec") && !this.lexed.source.endsWith("\n") ? "\n" : "");
    syntax.metadataQualified = !this.completedCompound;
    return syntax;
  }
  unsupported(message, token) { this.fail(message, token, "UNSUPPORTED"); }
  defer(message, node) { this.refusal ??= {message, node}; return node; }
  charge() {
    this.options.onWork?.(1);
    if (++this.work > (this.options.maxWork ?? SOURCE_LIMITS.work)) this.fail("Source work budget exceeded.", this.peek(), "COMPILE_BUDGET");
    if (this.options.shouldCancel?.()) this.fail("Compilation cancelled.", this.peek(), "CANCELLED");
  }
  guard(body) {
    this.charge();
    if (++this.depth > this.maxDepth) this.fail("Source nesting budget exceeded.", this.peek(), "COMPILE_BUDGET");
    try { return body(); } finally { this.depth--; }
  }
  node(kind, start, fields = {}, end = this.previous) {
    this.charge();
    if (++this.nodes > this.maxNodes) this.fail("Source node budget exceeded.", start, "COMPILE_BUDGET");
    let height = 1;
    const scan = value => {
      if (!value || typeof value !== "object" || value.type) return;
      if (this.heights.has(value)) height = Math.max(height, this.heights.get(value) + 1);
      else if (Array.isArray(value)) value.forEach(scan);
      else Object.values(value).forEach(scan);
    };
    Object.values(fields).forEach(scan);
    if (height > this.maxDepth) this.fail("Source tree depth budget exceeded.", start, "COMPILE_BUDGET");
    const result = {kind, span: [start.span[0], start.span[1], end.span[2], end.span[3]], ...fields};
    const first = this.groupRanges.get(start) ?? this.nativeRanges.get(start) ?? start.span;
    const last = this.groupRanges.get(end) ?? this.nativeRanges.get(end) ?? end.span;
    this.nativeRanges.set(result, [first[0], first[1], last[2], last[3]]);
    this.heights.set(result, height); return result;
  }
  closeComprehension(value) {
    const span = this.nativeRanges.get(value);
    this.nativeRanges.set(value, [span[0], span[1], this.previous.span[2], this.previous.span[3]]);
    return value;
  }
  peek(ahead = 0) { return this.tokens[Math.min(this.index + ahead, this.tokens.length - 1)]; }
  at(value) { const t = this.peek(); return ["op", "keyword"].includes(t.kind) && t.value === value; }
  kind(value) { return this.peek().kind === value; }
  take() { this.charge(); this.previous = this.peek(); if (!this.kind("eof")) this.index++; return this.previous; }
  eat(value) { return this.at(value) ? this.take() : null; }
  expect(value) { if (!this.at(value)) this.fail("Expected '" + value + "'."); return this.take(); }
  expectKind(kind, message = "Expected " + kind + ".") { if (!this.kind(kind)) this.fail(message); return this.take(); }
  name() { return this.expectKind("name", "Expected an identifier."); }
  ending() { return ["newline", "dedent", "eof"].includes(this.peek().kind) || this.at(";"); }
  invalidTarget(value, action, nested = false) {
    let label = {Call: "function call", Binary: "expression", Unary: "expression", Boolean: "expression",
      Compare: "comparison", Conditional: "conditional expression", Lambda: "lambda",
      Dict: "dict literal", Set: "set display", Tuple: "tuple", List: "list", Starred: "starred"}[value.kind];
    if (value.kind === "Literal") label = value.literal.type === "none" ? "None" :
      value.literal.type === "bool" ? value.literal.value ? "True" : "False" : "literal";
    if (value.kind === "Comprehension") label = value.form === "generator" ? "generator expression" : value.form + " comprehension";
    let syntax;
    if (label) {
      let chain = action === "chain", depth = 0;
      const hint = !["lambda", "yield", "*"].includes(this.peek().value);
      if (action === "assign") for (const token of this.tokens.slice(this.index)) {
        this.charge();
        if (!depth && (token.kind === "newline" || token.value === ";")) break;
        if (!depth && token.value === "=") chain = true;
        if (["(", "[", "{"].includes(token.value)) depth++;
        if ([")", "]", "}"].includes(token.value)) depth--;
      }
      const message = action === "augment" ? "'" + label + "' is an illegal expression for augmented assignment" :
        "cannot " + (action === "delete" ? "delete " : "assign to ") + label +
        (action === "assign" && !nested && !chain && hint && !["None", "True", "False", "generator expression"].includes(label) ? " here. Maybe you meant '==' instead of '='?" : "");
      let first, last;
      for (const token of this.tokens) {
        this.charge();
        if (token.span[0] === value.span[0] && token.span[1] === value.span[1]) first ??= token;
        if (token.span[2] === value.span[2] && token.span[3] === value.span[3]) last = token;
      }
      if (value.kind === "Comprehension" && first) {
        let depth = 0;
        for (const token of this.tokens.slice(this.tokens.indexOf(first))) {
          this.charge();
          if (["(", "[", "{"].includes(token.value)) depth++;
          if ([")", "]", "}"].includes(token.value) && --depth === 0) { last = token; break; }
        }
      }
      if (first && last) {
        syntax = this.diagnostic(message, [value.span[0], value.span[1], last.span[2], last.span[3]]);
        syntax.repair = this.lexed.source.slice(0, first.start) + "__target" + this.lexed.source.slice(last.end);
      }
    }
    this.fail(action === "augment" ? "Invalid augmented assignment target." : "Invalid assignment/deletion target.", value, "SYNTAX", undefined, syntax);
  }
  target(value, deletion = false, nested = false, action = "assign") {
    if (value.kind === "Name") return;
    if (["Tuple", "List"].includes(value.kind)) {
      if (!deletion && value.items.filter(item => item.kind === "Starred").length > 1)
        this.controlError ??= {kind: "target", token: value, node: value, message: "multiple starred expressions in assignment"};
      value.items.forEach(item => this.target(item, deletion, true, action)); return;
    }
    if (value.kind === "Starred") {
      if (deletion) this.invalidTarget(value, "delete", nested);
      if (!nested) this.controlError ??= {kind: "target", token: value, node: value,
        message: "starred assignment target must be in a list or tuple"};
      this.target(value.value, false, false, "nested"); return;
    }
    if (this.classes && value.kind === "Attribute") return;
    if (value.kind === "Subscript" && (this.classes || value.index.kind !== "Slice")) return;
    if (["Attribute", "Subscript"].includes(value.kind)) this.unsupported("This attribute or slice target is not adopted.", value);
    this.invalidTarget(value, deletion ? "delete" : action, nested);
  }
  file() {
    const start = this.peek(), body = [], mode = this.options.mode ?? "exec";
    if (!["exec", "eval", "single"].includes(mode)) throw new TypeError("Invalid source mode.");
    if (mode === "eval") {
      while (this.kind("newline")) this.take();
      const value = this.expressionList();
      while (this.kind("newline")) this.take();
      if (!this.kind("eof")) this.fail("Expected a single expression.");
      body.push(this.node("Return", start, {value}));
    }
    let statements = 0, firstNewline = null;
    while (!this.kind("eof")) {
      if (this.kind("newline")) { this.take(); continue; }
      if (mode === "single" && statements++) {
        const message = "multiple statements found while compiling a single statement";
        let syntax;
        if (firstNewline) {
          syntax = this.diagnostic(message, firstNewline.span, {newline: true});
          const source = this.lexed.source, line = source.split("\n")[syntax.lineno - 1];
          const lineStart = source.lastIndexOf("\n", firstNewline.start - 1) + 1;
          const comment = source.indexOf("#", firstNewline.codeEnd);
          // A comment belongs to NEWLINE's range, including its terminating newline.
          if (comment >= lineStart && comment < firstNewline.start)
            syntax.offset = Array.from(source.slice(lineStart, comment)).length + 1;
          syntax.end_lineno = syntax.lineno;
          syntax.end_offset = Array.from(line).length + 2;
          delete syntax.metadata;
        }
        this.fail(message, this.peek(), "SYNTAX", undefined, syntax);
      }
      body.push(...this.statement());
      if (mode === "single" && statements === 1 && this.previous.kind === "newline" && !this.completedCompound)
        firstNewline = {...this.previous, codeEnd: this.tokens[this.index - 2].end};
    }
    if (mode === "single" && !body.length) {
      const source = this.lexed.source, lines = source.split("\n"), newline = source.endsWith("\n");
      if (!newline && /^[ \t\f]+$/.test(lines.at(-1))) this.fail("invalid syntax");
      const line = source.length ? lines.length - (newline ? 1 : 0) : 0;
      const syntax = this.diagnostic("invalid syntax", [line, 1, line, 1], {newline});
      syntax.text = line ? lines[line - 1] + (newline ? "\n" : "") : "";
      syntax.offset = syntax.end_offset = 0;
      this.fail("invalid syntax", this.peek(), "SYNTAX", undefined, syntax);
    }
    if (mode === "single" && !this.lexed.source.endsWith("\n") &&
        (this.handlerErrors.length || this.keywordErrors.length &&
          ["If", "While", "For", "Try", "Class", "Function"].includes(body[0]?.kind) && !this.tokens.some(token => token.kind === "indent")))
      this.fail("Interactive compound input requires a terminating newline.");
    if (mode === "single" && this.controlError && !this.lexed.source.endsWith("\n") && ["If", "While", "For", "Try", "Class", "Function"].includes(body[0]?.kind)) {
      const last = this.tokens.filter(token => !["newline", "eof", "indent", "dedent"].includes(token.kind)).at(-1);
      const lines = this.lexed.source.split("\n");
      this.controlError.qualified = last.span[2] === lines.length && /^[ \t\f]+\S/.test(lines.at(-1)) && /^[ \t]*$/.test(this.lexed.source.slice(last.end));
    }
    if (this.refusal) this.unsupported(this.refusal.message, this.refusal.node);
    const module = this.node("Module", start, {body});
    return freezeSourceTree({module, source: this.lexed.source, filename: this.filename, languageProfile: this.languageProfile,
      ...(this.controlError ? {controlError: this.controlError} : {}),
      ...(this.keywordErrors.length ? {keywordErrors: this.keywordErrors} : {}),
      ...(this.handlerErrors.length ? {handlerErrors: this.handlerErrors} : {}),
      stats: {...this.lexed.stats, work: this.work, nodes: this.nodes}});
  }
  statement() {
    const result = this.guard(() => {
      if (this.kind("indent") || this.kind("dedent")) {
        const token = this.peek(), syntax = this.kind("indent") ? this.diagnostic("unexpected indent", token.span, {endOffset: -1}) : undefined;
        if (syntax) {
          syntax.offset = Array.from(this.lexed.source.slice(token.start, token.end)).length;
          syntax.repair = this.lexed.source.slice(0, token.start) + this.lexed.source.slice(token.end);
        }
        this.fail("Unexpected indentation.", token, "SYNTAX", "IndentationError", syntax);
      }
      if (this.at("@") && this.classes) return [this.decorated()];
      if (this.at("def")) return [this.definition()];
      if (this.at("class") && this.classes) return [this.classDefinition()];
      if (this.at("if")) return [this.branch()];
      if (this.at("while") || this.at("for")) return [this.loop()];
      if (this.at("try")) return [this.attempt()];
      if (["class", "async", "with", "@"].some(value => this.at(value))) this.unsupported(this.classes ?
        "Async and context managers require later stages." : "Classes, async, context managers and decorators are not adopted.");
      return this.simpleLine();
    });
    if (result.some(node => ["If", "While", "For", "Try", "Class", "Function"].includes(node.kind))) this.completedCompound = true;
    return result;
  }
  suite(header) {
    if (header && !this.at(":") && this.kind("newline")) {
      const token = this.peek(), line = this.lexed.source.split("\n")[token.span[0] - 1] ?? "";
      const implicit = this.options.mode === "single" && this.lexed.source[token.start] !== "\n";
      const syntax = this.diagnostic("expected ':'", token.span, {newline: !implicit});
      const lineStart = this.lexed.source.lastIndexOf("\n", token.start - 1) + 1;
      const comment = this.lexed.source.indexOf("#", this.previous.end);
      syntax.offset = implicit ? Array.from(line).length : comment >= lineStart && comment < token.start ?
        Array.from(this.lexed.source.slice(lineStart, comment)).length + 1 : syntax.offset;
      syntax.end_offset = implicit ? -1 : Array.from(line).length + 2;
      syntax.end_lineno = syntax.lineno;
      this.fail("Expected ':'.", token, "SYNTAX", undefined, syntax);
    }
    this.expect(":");
    if (!this.kind("newline")) return this.simpleLine();
    this.take();
    if (!this.kind("indent")) {
      const token = this.peek(); let syntax;
      if (header) {
        const label = header.value === "def" ? "function definition" : header.value === "class" ? "class definition" : "'" + header.value + "' statement";
        syntax = this.diagnostic("expected an indented block after " + label + " on line " + header.span[0], token.span);
        const source = this.lexed.source, indent = (source.split("\n")[header.span[0] - 1].match(/^[ \t\f]*/)?.[0] ?? "") + " ";
        if (token.kind === "eof") {
          const normalized = syntax.metadata, lines = normalized.split("\n"), line = lines.length - (normalized.endsWith("\n") ? 1 : 0);
          syntax.lineno = syntax.end_lineno = line;
          syntax.text = lines[line - 1] + (normalized.endsWith("\n") ? "\n" : "");
          syntax.offset = Array.from(syntax.text).length; syntax.end_offset = -1;
          syntax.repair = source + (source.endsWith("\n") ? "" : "\n") + indent + "pass\n";
        } else {
          const lineStart = source.lastIndexOf("\n", token.start - 1) + 1;
          syntax.repair = ["else", "elif", "except", "finally"].includes(token.value) ?
            source.slice(0, lineStart) + indent + "pass\n" + source.slice(lineStart) :
            source.slice(0, lineStart) + indent + source.slice(token.start);
        }
      }
      this.fail("Expected an indented suite.", token, "SYNTAX", "IndentationError", syntax);
    }
    this.take();
    const body = [];
    while (!this.kind("dedent") && !this.kind("eof")) {
      if (this.kind("newline")) this.take(); else body.push(...this.statement());
    }
    this.expectKind("dedent", "Expected the end of an indented suite.");
    if (!body.length) this.fail("An empty suite requires pass.");
    return body;
  }
  simpleLine() {
    const result = [this.small()];
    while (this.eat(";")) { if (this.kind("newline")) break; result.push(this.small()); }
    this.expectKind("newline", "Expected the end of the statement.");
    return result;
  }
  small() {
    const start = this.peek();
    if (this.at("global") || this.at("nonlocal")) {
      const declaration = this.take().value, names = [this.name().value];
      while (this.eat(",")) names.push(this.name().value);
      return this.node("Declaration", start, {declaration, names});
    }
    if (this.eat("assert")) {
      const test = this.expression(), message = this.eat(",") ? this.expression() : null;
      return this.node("Assert", start, {test, message});
    }
    if (this.eat("pass")) return this.node("Pass", start);
    if (this.at("break") || this.at("continue")) {
      const op = this.take().value;
      const node = this.node(op === "break" ? "Break" : "Continue", start);
      if (!this.loopDepth) this.controlError ??= {kind: op, token: start, node};
      return node;
    }
    if (this.eat("return")) {
      const node = this.node("Return", start, {value: this.ending() ? null : this.expressionList()});
      if (!this.functionDepth) this.controlError ??= {kind: "return", token: start, node};
      return node;
    }
    if (this.eat("raise")) {
      const value = this.ending() ? null : this.expression();
      const cause = this.eat("from") ? this.expression() : null;
      return this.node("Raise", start, {value, cause});
    }
    if (this.eat("del")) {
      const targets = [this.expression()];
      while (this.eat(",")) { if (this.ending()) break; targets.push(this.expression()); }
      targets.forEach(value => this.target(value, true)); return this.node("Delete", start, {targets});
    }
    if (this.at("import") || this.at("from")) return this.imports();
    if (this.kind("name") && start.value === "type" && this.lexed.source.slice(start.start, start.end) === "type" && this.peek(1).kind === "name") return this.typeAlias();
    let value = this.expressionList();
    if (this.at(":")) this.unsupported("Annotations and pattern statements are not adopted.", start);
    if (this.eat("=")) {
      const targets = [value]; this.target(value);
      for (;;) {
        value = this.expressionList();
        if (!this.eat("=")) break;
        this.target(value, false, false, "chain"); targets.push(value);
      }
      return this.node("Assign", start, {targets, value});
    }
    if (AUGMENT.has(this.peek().value) && this.kind("op")) {
      if (!["Name", "Attribute", "Subscript"].includes(value.kind)) this.invalidTarget(value, "augment");
      this.target(value);
      const token = this.take(), operator = BINARY.get(token.value.slice(0, -1));
      if (!operator) this.unsupported("Augmented operator is not adopted.", token);
      return this.node("Augment", start, {target: value, operator, value: this.expressionList()});
    }
    if (this.at(":=")) this.fail("Assignment expressions require a permitted expression context.");
    return this.node("Expr", start, {value});
  }
  typeAlias() {
    const start = this.take(), name = this.name();
    if (name.value === "__debug__") this.fail("Cannot bind __debug__.", name);
    const before = this.typeExpression; this.typeExpression = true;
    let value;
    try {
      if (this.eat("[")) {
        const names = new Set(); let defaultSeen = false;
        do {
          const variadic = this.eat("*") || this.eat("**"), parameter = this.name();
          if (parameter.value === "__debug__") this.fail("Cannot bind __debug__.", parameter);
          if (names.has(parameter.value)) this.fail("Duplicate type parameter.", parameter);
          names.add(parameter.value);
          if (this.eat(":")) {
            if (variadic) this.fail("A variadic type parameter cannot have a bound.", parameter);
            this.expression();
          }
          if (this.eat("=")) {
            defaultSeen = true;
            if (variadic?.value === "*") this.eat("*");
            this.expression();
          } else if (defaultSeen) this.fail("A required type parameter follows a default.", parameter);
          if (!this.eat(",")) break;
        } while (!this.at("]"));
        this.expect("]");
      }
      this.expect("="); value = this.expression();
    } finally { this.typeExpression = before; }
    return this.defer("Type aliases are not adopted.", this.node("TypeAlias", start, {name: name.value, value}));
  }
  qualified() {
    let name = this.name().value;
    while (this.eat(".")) name += "." + this.name().value;
    return name;
  }
  imports() {
    const start = this.take(), aliases = [];
    let specifier = null, level = 0, parenthesized = false;
    if (start.value === "from") {
      while (this.at(".") || this.at("...")) level += this.take().value.length;
      specifier = this.kind("name") ? this.qualified() : "";
      if (!specifier && !level) this.fail("Expected an import module.");
      this.expect("import"); parenthesized = !!this.eat("(");
    }
    for (;;) {
      if (this.at("*")) {
        if (specifier === null) this.fail("Invalid import target.");
        this.unsupported("Wildcard imports are not adopted.");
      }
      const name = specifier === null ? this.qualified() : this.name().value;
      const asname = this.eat("as") ? this.importAlias() : null;
      aliases.push({name, asname});
      if (!this.eat(",")) break;
      if (parenthesized && this.at(")")) break;
      if (specifier !== null && !parenthesized && this.kind("newline")) {
        const token = this.peek(), source = this.lexed.source, line = source.split("\n")[token.span[0] - 1];
        const implicit = this.options.mode === "single" && source[token.start] !== "\n";
        const syntax = this.diagnostic("trailing comma not allowed without surrounding parentheses", token.span, {newline: !implicit});
        const lineStart = source.lastIndexOf("\n", token.start - 1) + 1;
        const comment = source.indexOf("#", this.previous.end);
        syntax.offset = implicit ? Array.from(line).length : comment >= lineStart && comment < token.start ?
          Array.from(source.slice(lineStart, comment)).length + 1 : syntax.offset;
        syntax.end_lineno = syntax.lineno;
        syntax.end_offset = implicit ? -1 : Array.from(line).length + 2;
        this.fail("A from-import trailing comma requires parentheses.", token, "SYNTAX", undefined, syntax);
      }
    }
    if (specifier === null && aliases.every(alias => alias.asname === null) && this.eat("from")) {
      this.qualified();
      let syntax;
      if (this.kind("newline")) {
        const token = this.peek(), implicit = this.options.mode === "single" && this.lexed.source[token.start] !== "\n";
        syntax = this.diagnostic("Did you mean to use 'from ... import ...' instead?",
          [start.span[0], start.span[1], token.span[0], token.span[1]], {newline: !implicit});
        syntax.end_offset = Array.from(this.lexed.source.split("\n")[token.span[0] - 1]).length + (implicit ? 0 : 1);
        if (syntax.lineno !== syntax.end_lineno) {
          syntax.text = syntax.text.replace(/\n$/, "");
          const bytes = new TextEncoder().encode(syntax.text + "\0");
          syntax.end_offset = Array.from(new TextDecoder().decode(bytes.subarray(0, token.span[1] - (implicit ? 1 : 0)))).length;
        }
      }
      this.fail("Reversed import statement.", start, "SYNTAX", undefined, syntax);
    }
    if (parenthesized) this.expect(")");
    return this.node("Import", start, {specifier, level, aliases});
  }
  importAlias() {
    if (this.kind("name") && (this.peek(1).kind === "newline" || [",", ")", ";"].includes(this.peek(1).value)))
      return this.name().value;
    const first = this.peek(); let value;
    try { value = this.expression(); }
    catch (error) {
      if (error instanceof SourceError && error.code === "SYNTAX") this.fail("Invalid import alias.", first);
      throw error;
    }
    const last = this.previous;
    let label = {Name: "name", Attribute: "attribute", Subscript: "subscript", Call: "function call",
      Binary: "expression", Unary: "expression", Boolean: "expression", Compare: "comparison",
      Conditional: "conditional expression", Lambda: "lambda", Dict: "dict literal", Set: "set display",
      Tuple: "tuple", List: "list"}[value.kind];
    if (value.kind === "Literal") label = value.literal.type === "none" ? "None" :
      value.literal.type === "bool" ? value.literal.value ? "True" : "False" : "literal";
    if (value.kind === "Comprehension") label = value.form === "generator" ? "generator expression" : value.form + " comprehension";
    let syntax;
    if (label) {
      const span = [...value.span];
      if (value.kind === "Comprehension") {
        let depth = 0;
        for (const token of this.tokens) {
          this.charge();
          if (token.start < first.start || token.span[0] < value.span[0] || token.span[0] === value.span[0] && token.span[1] < value.span[1]) continue;
          if (["(", "[", "{"].includes(token.value)) depth++;
          if ([")", "]", "}"].includes(token.value) && --depth === 0) {
            span[2] = token.span[2]; span[3] = token.span[3];
            break;
          }
        }
      }
      syntax = this.diagnostic("cannot use " + label + " as import target", span);
      if (syntax.lineno !== syntax.end_lineno) {
        syntax.text = syntax.text.replace(/\n$/, "");
        const bytes = new TextEncoder().encode(syntax.text + "\0");
        syntax.end_offset = Array.from(new TextDecoder().decode(bytes.subarray(0, span[3]))).length;
      }
      syntax.repair = this.lexed.source.slice(0, first.start) + "__import_target" + this.lexed.source.slice(last.end);
    }
    this.fail("Invalid import alias.", value, "SYNTAX", undefined, syntax);
  }
  decorated() {
    const decorators = [];
    while (this.eat("@")) {
      if (decorators.length >= PARSER_LIMITS.decorators) this.fail("Decorator count budget exceeded.", this.previous, "COMPILE_BUDGET");
      decorators.push(this.expression());
      this.expectKind("newline", "Expected a newline after the decorator expression.");
    }
    if (this.at("def")) return this.definition(decorators);
    if (this.at("class")) return this.classDefinition(decorators);
    if (this.at("async")) this.unsupported("Async definitions require a later stage.");
    this.fail("Decorators require a function or class definition.");
  }
  definition(decorators = []) {
    const start = this.expect("def"), name = this.name().value;
    if (this.at("[")) this.unsupported("Generic functions are not adopted.");
    this.expect("(");
    const params = this.parameters(")"); this.expect(")");
    if (this.at("->")) this.unsupported("Return annotations are not adopted.");
    const before = [this.functionDepth, this.loopDepth]; this.functionDepth++; this.loopDepth = 0;
    let body;
    try { body = this.suite(start); } finally { [this.functionDepth, this.loopDepth] = before; }
    return this.node("Function", start, {name, params, body, ...(decorators.length ? {decorators} : {})}, body.at(-1));
  }
  delimitedDiagnostic(message, token, end, joined = false) {
    const syntax = this.diagnostic(message, token.span);
    if (joined) {
      let depth = 0;
      for (const next of this.tokens.slice(this.index)) {
        this.charge();
        if (!depth && next.value === end) {
          if (next.span[0] !== token.span[0]) syntax.text = syntax.text.replace(/\n$/, "");
          break;
        }
        if (["(", "[", "{"].includes(next.value)) depth++;
        if ([")", "]", "}"].includes(next.value)) depth--;
      }
    }
    return syntax;
  }
  parameters(end) {
    let positional = [], posonly = [], kwonly = [], vararg = [], kwarg = [], slash = false, star = false, defaultSeen = false;
    let bareStar = null;
    while (!this.at(end)) {
      if (kwarg.length) this.fail("No parameter may follow a variadic keyword parameter.", this.peek(), "SYNTAX", undefined,
        this.kind("name") && !(end !== ":" && this.peek(1).value === ":") || ["*", "**", "/"].includes(this.peek().value) ?
          this.delimitedDiagnostic("arguments cannot follow var-keyword argument", this.peek(), end, this.kind("name")) : undefined);
      if (bareStar && !kwonly.length && this.at("**")) {
        const token = end === ":" ? this.peek() : bareStar;
        this.fail("A named keyword-only parameter must follow '*'.", token, "SYNTAX", undefined,
          this.delimitedDiagnostic("named arguments must follow bare *", token, end, true));
      }
      if (this.eat("**")) {
        const token = this.name();
        kwarg.push({name: token.value, value: null, span: token.span});
        if (end !== ":" && this.at(":")) this.unsupported("Parameter annotations are not adopted.");
        if (this.at("=")) this.fail("A variadic keyword parameter cannot have a default.", this.peek(), "SYNTAX", undefined,
          this.diagnostic("var-keyword argument cannot have default value", this.peek().span));
      } else
      if (this.eat("/")) {
        if (slash || star || !positional.length) {
          const message = star ? "/ must be ahead of *" : slash ? "/ may appear only once" :
            this.at(",") ? "at least one argument must precede /" : this.at(end) ? "invalid syntax" : null;
          this.fail("Invalid positional-only separator.", this.previous, "SYNTAX", undefined,
            message ? this.delimitedDiagnostic(message, this.previous, end) : undefined);
        }
        slash = true; posonly = positional; positional = [];
      } else if (this.eat("*")) {
        const separator = this.previous;
        if (star) this.fail("Duplicate keyword-only separator.", separator, "SYNTAX", undefined,
          this.kind("name") || this.at(",") ? this.delimitedDiagnostic("* argument may appear only once", separator, end) : undefined);
        if (this.kind("name")) {
          const token = this.take();
          vararg.push({name: token.value, value: null, span: token.span});
          if (end !== ":" && this.at(":")) this.unsupported("Parameter annotations are not adopted.");
          if (this.at("=")) this.fail("A variadic positional parameter cannot have a default.", this.peek(), "SYNTAX", undefined,
            this.diagnostic("var-positional argument cannot have default value", this.peek().span));
        } else bareStar = separator;
        star = true;
      } else {
        const token = this.name();
        if (end !== ":" && this.at(":")) this.unsupported("Parameter annotations are not adopted.");
        const value = this.eat("=") ? this.expression() : null;
        if (!star && defaultSeen && value === null) {
          const syntax = this.at(end) || this.at(",") ?
            this.delimitedDiagnostic("parameter without a default follows parameter with a default", token, end, true) : undefined;
          this.fail("A required positional parameter follows a default.", token, "SYNTAX", undefined, syntax);
        }
        if (!star && value !== null) defaultSeen = true;
        (star ? kwonly : positional).push({name: token.value, value, span: token.span});
      }
      if (this.at(end)) break;
      this.expect(",");
    }
    if (bareStar && !kwonly.length) {
      const token = end === ":" ? this.peek() : bareStar;
      this.fail("A named keyword-only parameter must follow '*'.", token, "SYNTAX", undefined,
        this.delimitedDiagnostic("named arguments must follow bare *", token, end, true));
    }
    return {posonly, positional, kwonly, ...(vararg.length ? {vararg} : {}), ...(kwarg.length ? {kwarg} : {})};
  }
  lambda() {
    const start = this.expect("lambda"), params = this.parameters(":"); this.expect(":");
    const before = [this.functionDepth, this.loopDepth]; this.functionDepth++; this.loopDepth = 0;
    let value;
    try { value = this.expression(); } finally { [this.functionDepth, this.loopDepth] = before; }
    return this.node("Lambda", start, {name: "<lambda>", params, body: [this.node("Return", value, {value}, value)]}, value);
  }
  classDefinition(decorators = []) {
    const start = this.expect("class"), name = this.name().value, bases = [];
    let metaclass = null, repeated = null;
    const keywords = [];
    if (this.at("[")) this.unsupported("Generic classes are not adopted.");
    if (this.eat("(")) {
      const parsed = this.arguments(true);
      bases.push(...parsed.args); keywords.push(...parsed.keywords);
      metaclass = keywords.find(item => item.name === "metaclass")?.value ?? null;
      repeated = parsed.repeated;
      this.expect(")");
    }
    const before = [this.functionDepth, this.loopDepth]; this.functionDepth = 0; this.loopDepth = 0;
    let body;
    try { body = this.suite(start); } finally { [this.functionDepth, this.loopDepth] = before; }
    const value = this.node("Class", start, {name, bases, body,
      ...((keywords.some(item => item.name !== "metaclass") || bases.some(item => item.kind === "StarredArgument")) ? {keywords} : metaclass ? {metaclass} : {}),
      ...(decorators.length ? {decorators} : {})}, body.at(-1));
    if (repeated) this.keywordErrors.push({node: value, site: repeated});
    return value;
  }
  branch(keyword = "if") {
    const start = this.expect(keyword), test = this.namedExpression(), body = this.suite(start);
    let otherwise = [];
    if (this.at("elif")) otherwise = [this.guard(() => this.branch("elif"))];
    else if (this.eat("else")) otherwise = this.suite(this.previous);
    return this.node("If", start, {test, body, otherwise}, otherwise.at(-1) || body.at(-1));
  }
  loop() {
    const start = this.take(), kind = start.value === "for" ? "For" : "While";
    let test = null, target = null, iterable = null;
    if (kind === "For") {
      target = this.expressionList(false, true); this.target(target, false, false, "loop");
      this.expect("in"); iterable = this.expressionList();
    } else test = this.namedExpression();
    this.loopDepth++; let body;
    try { body = this.suite(start); } finally { this.loopDepth--; }
    const otherwise = this.eat("else") ? this.suite(this.previous) : [];
    return this.node(kind, start, {test, target, iterable, body, otherwise}, otherwise.at(-1) || body.at(-1));
  }
  attempt() {
    const start = this.expect("try"), body = this.suite(start), handlers = [];
    while (this.eat("except")) {
      const clause = this.previous;
      if (this.at("*")) this.unsupported("Exception groups are not adopted.");
      const type = this.at(":") || this.kind("newline") ? null : this.expressionList();
      const alias = this.eat("as") ? this.name().value : null;
      if (type?.kind === "Tuple" && !this.grouped.has(type) && alias !== null) {
        let syntax;
        if (this.at(":")) {
          const first = type.items[0], last = this.previous;
          syntax = this.diagnostic("multiple exception types must be parenthesized when using 'as'",
            [first.span[0], first.span[1], last.span[2], last.span[3]]);
          if (syntax.lineno !== syntax.end_lineno) {
            syntax.text = syntax.text.replace(/\n$/, "");
            const bytes = new TextEncoder().encode(syntax.text + "\0");
            syntax.end_offset = Array.from(new TextDecoder().decode(bytes.subarray(0, last.span[3]))).length;
          }
        }
        this.fail("Multiple handler types require parentheses with an alias.", type, "SYNTAX", undefined, syntax);
      }
      if (type === null && alias !== null) this.fail("A bare handler cannot bind an alias.", clause);
      const handlerBody = this.suite(clause);
      handlers.push(this.node("Handler", clause, {expression: type, alias, body: handlerBody}, handlerBody.at(-1)));
    }
    const bare = handlers.slice(0, -1).find(handler => handler.expression === null);
    if (bare) this.handlerErrors.push(bare);
    let otherwise = [], final = [];
    if (!handlers.length && !this.at("finally")) {
      const token = this.peek(), syntax = this.diagnostic("expected 'except' or 'finally' block", token.span);
      if (token.kind === "eof") {
        const lines = syntax.metadata.split("\n"), line = lines.length - (syntax.metadata.endsWith("\n") ? 1 : 0);
        syntax.lineno = syntax.end_lineno = line;
        syntax.text = lines[line - 1] + (syntax.metadata.endsWith("\n") ? "\n" : "");
        syntax.offset = Array.from(syntax.text).length; syntax.end_offset = -1;
        if (this.options.mode === "single" && !syntax.metadata.endsWith("\n") && /^[ \t\f]*#/.test(syntax.text)) {
          syntax.msg = "invalid syntax"; syntax.offset = syntax.end_offset = 0;
        }
      } else if (token.kind === "dedent") { syntax.offset = 0; syntax.end_offset = -1; }
      this.fail("Try requires except or finally.", token, "SYNTAX", undefined, syntax);
    }
    if (this.eat("else")) otherwise = this.suite(this.previous);
    if (this.eat("finally")) final = this.suite(this.previous);
    return this.node("Try", start, {body, handlers, otherwise, final}, final.at(-1) || otherwise.at(-1) || handlers.at(-1) || body.at(-1));
  }
  starredExpression(named = false, target = false) {
    if (this.eat("*")) {
      const start = this.previous, value = this.bitwiseOr();
      return this.node("Starred", start, {value});
    }
    return target ? this.bitwiseOr() : named ? this.namedExpression() : this.expression();
  }
  expressionList(named = false, target = false) {
    const expression = () => this.starredExpression(named, target);
    const start = this.peek(), items = [expression()]; let tuple = false;
    while (this.eat(",")) {
      tuple = true;
      if (this.ending() || [")", "]", "}", ":", "="].some(value => this.at(value)) || target && this.at("in")) break;
      items.push(expression());
    }
    if (!tuple && items[0].kind === "Starred" && !this.at("=") && !(target && this.at("in")) && !(named && this.at("for")))
      this.fail("A starred expression requires a sequence display.", items[0]);
    return tuple ? this.node("Tuple", start, {items}) : items[0];
  }
  namedExpression() {
    if (this.kind("name") && this.peek(1).value === ":=") {
      const start = this.take(); this.expect(":=");
      if (this.typeExpression) this.fail("Assignment expressions cannot occur in type expressions.", start);
      if (start.value === "__debug__") this.fail("Cannot bind __debug__.", start);
      const value = this.expression();
      return this.node("NamedExpression", start, {name: start.value, value});
    }
    const value = this.expression();
    if (this.at(":=")) this.fail("An assignment expression requires a bare identifier target.");
    return value;
  }
  expression() {
    return this.guard(() => {
      if (this.at("yield")) {
        const start = this.take();
        if (!this.functionDepth) this.fail("Yield outside a function.", start);
        const delegate = !!this.eat("from");
        const value = !delegate && (this.ending() || this.at(")")) ? null : this.expressionList();
        return this.node("Yield", start, {value, delegate});
      }
      if (this.at("lambda")) return this.lambda();
      const body = this.disjunction();
      if (!this.eat("if")) return body;
      const test = this.disjunction(); this.expect("else"); const otherwise = this.expression();
      return this.node("Conditional", body, {body, test, otherwise}, otherwise);
    });
  }
  disjunction() {
    let value = this.conjunction();
    while (this.eat("or")) { const right = this.conjunction(); value = this.node("Boolean", value, {operator: "or", left: value, right}, right); }
    return value;
  }
  conjunction() {
    let value = this.negation();
    while (this.eat("and")) { const right = this.negation(); value = this.node("Boolean", value, {operator: "and", left: value, right}, right); }
    return value;
  }
  negation() {
    if (!this.eat("not")) return this.comparison();
    const start = this.previous, value = this.guard(() => this.negation());
    return this.node("Unary", start, {operator: "not", value}, value);
  }
  comparison() {
    const left = this.bitwiseOr(), parts = [];
    while ((["keyword", "op"].includes(this.peek().kind) && COMPARISONS.has(this.peek().value)) || this.at("not")) {
      const token = this.take(); let operator = COMPARISONS.get(token.value), invert = false;
      if (token.value === "not") { this.expect("in"); operator = "contains"; invert = true; }
      else if (token.value === "is" && this.eat("not")) invert = true;
      parts.push({operator, invert, right: this.bitwiseOr()});
    }
    return parts.length ? this.node("Compare", left, {left, parts}, parts.at(-1).right) : left;
  }
  binaryLayer(next, operators) {
    let value = this[next]();
    while (operators.some(operator => this.at(operator))) {
      const operator = BINARY.get(this.take().value), right = this[next]();
      value = this.node("Binary", value, {operator, left: value, right}, right);
    }
    return value;
  }
  bitwiseOr() { return this.binaryLayer("bitwiseXor", ["|"]); }
  bitwiseXor() { return this.binaryLayer("bitwiseAnd", ["^"]); }
  bitwiseAnd() { return this.binaryLayer("shift", ["&"]); }
  shift() { return this.binaryLayer("addition", ["<<", ">>"]); }
  addition() {
    let value = this.product();
    while (this.at("+") || this.at("-")) { const operator = BINARY.get(this.take().value), right = this.product(); value = this.node("Binary", value, {operator, left: value, right}, right); }
    return value;
  }
  product() {
    let value = this.unary();
    while (["*", "@", "/", "//", "%"].some(value => this.at(value))) {
      const operator = BINARY.get(this.take().value), right = this.unary(); value = this.node("Binary", value, {operator, left: value, right}, right);
    }
    return value;
  }
  unary() {
    if (this.at("+") || this.at("-") || this.at("~")) {
      const start = this.take(), value = this.guard(() => this.unary());
      return this.node("Unary", start, {operator: {"+": "positive", "-": "negative", "~": "invert"}[start.value], value}, value);
    }
    if (this.typeExpression && (this.at("yield") || this.at("await"))) this.fail("Yield and await cannot occur in type expressions.");
    if (["await", "yield"].some(value => this.at(value))) this.unsupported("This generator/async expression is not adopted.");
    const value = this.primary();
    if (this.eat("**")) {
      const right = this.guard(() => this.unary());
      return this.node("Binary", value, {operator: "power", left: value, right}, right);
    }
    return value;
  }
  arguments(classBases = false) {
    const args = [], keywords = [], seen = new Map();
    let repeated = null;
    let positionalError = null, followingMapping = false;
    while (!this.at(")")) {
      const separator = this.previous, argumentCount = args.length;
      let keywordSite = null;
      if (this.eat("**")) {
        keywords.push({name: null, value: this.expression()});
        if (positionalError) followingMapping = true;
      }
      else if (this.eat("*")) {
        // The second argument group stops before an inadmissible star.
        // Its already selected positional failure precedes that star's body.
        if (positionalError && followingMapping)
          this.fail("A positional argument follows a keyword argument.", this.previous, "SYNTAX", undefined,
            this.diagnostic(positionalError, this.previous.span));
        if (keywords.some(keyword => keyword.name === null) && !positionalError) {
          const start = this.previous;
          this.expression();
          let comma = this.eat(",");
          while (comma && this.eat("*")) { this.expression(); comma = this.eat(","); }
          const end = this.peek();
          const syntax = this.at(")") || comma && this.kind("name") ? this.diagnostic(
            "iterable argument unpacking follows keyword argument unpacking",
            [separator.span[0], separator.span[1], end.span[0], end.span[1]]) : undefined;
          if (syntax && syntax.lineno !== syntax.end_lineno) {
            syntax.text = syntax.text.replace(/\n$/, "");
            const bytes = new TextEncoder().encode(syntax.text + "\0");
            syntax.end_offset = Array.from(new TextDecoder().decode(bytes.subarray(0, end.span[1]))).length;
          }
          this.fail("Iterable unpacking follows keyword unpacking.", start, "SYNTAX", undefined, syntax);
        }
        const start = this.previous; args.push(this.node("StarredArgument", start, {value: this.expression()}));
      } else
      if (this.kind("name") && this.peek(1).value === "=") {
        const token = this.take(), equal = this.expect("=");
        if (classBases && keywords.length >= 128) this.fail("Class keyword budget exceeded.", this.peek(), "COMPILE_BUDGET");
        const argument = this.expression();
        keywordSite = {span: [token.span[0], token.span[1], equal.span[2], equal.span[3]]};
        if (seen.has(token.value)) {
          const first = seen.get(token.value);
          if (!repeated || first < repeated.first) repeated = {first, name: token.value,
            span: [token.span[0], token.span[1], this.previous.span[2], this.previous.span[3]]};
        } else seen.set(token.value, keywords.length);
        keywords.push({name: token.value, value: argument});
      } else {
        if (keywords.length) positionalError ??= keywords.some(keyword => keyword.name === null) ?
          "positional argument follows keyword argument unpacking" : "positional argument follows keyword argument";
        args.push(this.namedExpression());
      }
      if (this.at("for")) {
        if (args.length === argumentCount) {
          const token = this.peek(), element = keywords.at(-1).value;
          this.comprehension(element, "generator", element);
          const syntax = this.at(")") || this.at(",") ? this.delimitedDiagnostic(keywordSite ?
            "invalid syntax. Maybe you meant '==' or ':=' instead of '='?" : "invalid syntax", keywordSite ?? token, ")", true) : undefined;
          this.fail("A generator clause follows a keyword argument.", token, "SYNTAX", undefined, syntax);
        }
        const token = this.peek(), element = args.at(-1), generator = this.comprehension(element, "generator", element);
        if (classBases && args.length === 1 && !keywords.length &&
            (this.at(")") || element.kind === "StarredArgument" && this.at(",")))
          this.fail("A class generator base requires parentheses.", token, "SYNTAX", undefined,
            this.delimitedDiagnostic("invalid syntax", token, ")", true));
        if (args.length !== 1 || keywords.length || element.kind === "StarredArgument" || !this.at(")")) {
          const starred = args.length === 1 && !keywords.length && element.kind === "StarredArgument";
          const last = generator.clauses.at(-1), end = last.filters.at(-1) ?? last.iterable;
          const span = starred ? element.span : [element.span[0], element.span[1], end.span[2], end.span[3]];
          const syntax = this.at(")") || this.at(",") ? this.delimitedDiagnostic(starred ?
            "iterable unpacking cannot be used in comprehension" : "Generator expression must be parenthesized", {span}, ")", true) : undefined;
          if (syntax && span[0] !== span[2]) {
            // The pinned parser converts both offsets against the first error line.
            const bytes = new TextEncoder().encode(syntax.text + "\0");
            syntax.end_offset = Array.from(new TextDecoder().decode(bytes.subarray(0, span[3]))).length;
          }
          this.fail("A generator expression requires parentheses in this call.", element, "SYNTAX", undefined, syntax);
        }
        args[0] = generator;
      }
      if (!this.eat(",")) break;
    }
    if (positionalError) this.fail("A positional argument follows a keyword argument.", this.peek(), "SYNTAX", undefined,
      this.at(")") ? this.diagnostic(positionalError, this.peek().span) : undefined);
    return {args, keywords, repeated};
  }
  primary() {
    let value = this.atom();
    for (;;) {
      if (this.eat(".")) { const attr = this.name(); value = this.node("Attribute", value, {value, name: attr.value}, attr); }
      else if (this.eat("(")) {
        const {args, keywords, repeated} = this.arguments();
        this.expect(")"); value = this.node("Call", value, {callable: value, args, keywords});
        if (repeated) this.keywordErrors.push({node: value, site: repeated});
      } else if (this.eat("[")) {
        const start = this.peek(), items = [this.subscript()]; let tuple = false;
        while (this.eat(",")) { tuple = true; if (this.at("]")) break; items.push(this.subscript()); }
        const index = tuple ? this.node("Tuple", start, {items}) : items[0];
        this.expect("]"); value = this.node("Subscript", value, {value, index});
      } else break;
    }
    return value;
  }
  subscript() {
    const start = this.peek(); let index = this.at(":") ? null : this.namedExpression();
    if (!this.eat(":")) return index;
    if (index?.kind === "NamedExpression" && !this.grouped.has(index)) this.fail("A slice-bound assignment expression requires parentheses.", index);
    const stop = [":", ",", "]"].some(value => this.at(value)) ? null : this.expression();
    const step = this.eat(":") ? [",", "]"].some(value => this.at(value)) ? null : this.expression() : null;
    return this.node("Slice", start, {start: index, stop, step});
  }
  comprehension(start, form, element, key = null) {
    const clauses = [];
    while (this.eat("for")) {
      const target = this.expressionList(false, true);
      if (!this.at("in")) {
        const targets = target.kind === "Tuple" && !this.grouped.has(target) ? target.items : [target];
        const qualified = targets.every(value => value.kind !== "Starred");
        this.fail("Expected 'in' after comprehension variables.", this.peek(), "SYNTAX", undefined,
          qualified ? this.diagnostic("'in' expected after for-loop variables", this.peek().span) : undefined);
      }
      this.target(target, false, false, "loop"); this.expect("in");
      const iterable = this.disjunction(), filters = [];
      while (this.eat("if")) filters.push(this.disjunction());
      clauses.push({target, iterable, filters});
    }
    if (this.at("async")) this.unsupported("Async comprehensions require a separate stage.");
    if (element.kind === "Starred") {
      const end = form === "list" ? "]" : form === "generator" ? ")" : "}";
      this.fail("Comprehensions cannot unpack their element.", element, "SYNTAX", undefined,
        this.at(end) ? this.delimitedDiagnostic("iterable unpacking cannot be used in comprehension", element, end, true) : undefined);
    }
    return this.node("Comprehension", start, {form, element, key, clauses});
  }
  comprehensionElements(start, form, items, comma, end) {
    const first = items[0], last = items.length === 1 ? comma : items.at(-1);
    const begin = this.nativeRanges.get(first) ?? first.span, finish = this.nativeRanges.get(last) ?? last.span;
    this.comprehension(start, form, first.kind === "Starred" ? first.value : first);
    const span = [begin[0], begin[1], finish[2], finish[3]];
    const syntax = this.at(end) ? this.delimitedDiagnostic(
      "did you forget parentheses around the comprehension target?", {span}, end, true) : undefined;
    if (syntax && span[0] !== span[2]) {
      const bytes = new TextEncoder().encode(syntax.text + "\0");
      syntax.end_offset = Array.from(new TextDecoder().decode(bytes.subarray(0, span[3]))).length;
    }
    this.fail("A comprehension requires one element.", first, "SYNTAX", undefined, syntax);
  }
  atom() {
    const start = this.peek();
    if (this.kind("name")) { this.take(); return this.node("Name", start, {name: start.value}); }
    if (["None", "True", "False"].some(value => this.at(value))) {
      this.take(); return this.node("Literal", start, {literal: start.value === "None" ? {type: "none"} : {type: "bool", value: start.value === "True"}});
    }
    if (this.kind("number")) { this.take(); return this.node("Literal", start, {literal: start.literal}); }
    if (this.kind("string")) {
      const points = [], type = start.literal.type, field = type === "bytes" ? "bytes" : "codepoints";
      while (this.kind("string")) {
        const token = this.take();
        if (token.literal.type !== type) this.fail("Cannot mix bytes and nonbytes literals.", token);
        if (points.length + token.literal[field].length > SOURCE_LIMITS.text) this.fail("Adjacent string literal budget exceeded.", start, "COMPILE_BUDGET");
        for (const point of token.literal[field]) points.push(point);
      }
      return this.node("Literal", start, {literal: {type, [field]: points}});
    }
    if (this.eat("(")) {
      if (this.eat(")")) {
        const value = this.node("Tuple", start, {items: []});
        this.grouped.add(value); return value;
      }
      let value = this.expressionList(true);
      if (this.at("for")) {
        if (value.kind === "Tuple" && !this.grouped.has(value)) this.fail("A comprehension element cannot be an unparenthesized tuple.", value);
        value = this.comprehension(start, "generator", value);
      }
      this.expect(")");
      if (value.kind === "Tuple" && !this.grouped.has(value)) value = this.node("Tuple", start, {items: value.items});
      if (value.kind === "Comprehension" && value.form === "generator" && !this.grouped.has(value)) this.closeComprehension(value);
      this.groupRanges.set(value, [start.span[0], start.span[1], this.previous.span[2], this.previous.span[3]]);
      this.grouped.add(value); return value;
    }
    if (this.eat("[")) {
      const items = []; let comma = null;
      while (!this.at("]")) {
        if (comma && this.at("for")) this.comprehensionElements(start, "list", items, comma, "]");
        items.push(this.starredExpression(true));
        if (this.at("for")) {
          if (items.length !== 1) this.comprehensionElements(start, "list", items, comma, "]");
          const result = this.comprehension(start, "list", items[0]); this.expect("]"); return this.closeComprehension(result);
        }
        if (!(comma = this.eat(","))) break;
      }
      this.expect("]"); return this.node("List", start, {items});
    }
    if (this.eat("{")) {
      const entries = [], items = []; let form = null, comma = null, unpacking = null;
      while (!this.at("}")) {
        if (form === "set" && comma && this.at("for")) this.comprehensionElements(start, "set", items, comma, "}");
        if (this.at("*")) {
          if (form === "dict") this.fail("A dictionary display cannot contain a starred set element.");
          form = "set"; items.push(this.starredExpression(true));
        } else if (this.eat("**")) {
          if (form === "set") this.fail("A set display cannot contain a dictionary unpacking.");
          if (!entries.length) unpacking = this.previous;
          form = "dict"; entries.push([null, this.bitwiseOr()]);
        }
        else {
          const key = this.namedExpression();
          if (this.eat(":")) {
            if (key.kind === "NamedExpression" && !this.grouped.has(key)) this.fail("A dictionary-key assignment expression requires parentheses.", key);
            if (form === "set") this.fail("Mixed set and dictionary display.");
            const colon = this.previous;
            if (this.at("}") || this.at(",")) this.fail("A dictionary value requires an expression.", colon, "SYNTAX", undefined,
              this.delimitedDiagnostic("expression expected after dictionary key and ':'", colon, "}", true));
            if (this.eat("*")) {
              const starred = this.previous;
              this.bitwiseOr();
              const end = this.peek(), span = [starred.span[0], starred.span[1], end.span[0], end.span[1]];
              this.fail("A dictionary value cannot be starred.", starred, "SYNTAX", undefined,
                this.at("}") || this.at(",") ? this.delimitedDiagnostic(
                  "cannot use a starred expression in a dictionary value", {span}, "}", true) : undefined);
            }
            form = "dict"; const value = this.expression(); entries.push([key, value]);
          } else {
            if (form === "dict") {
              const range = this.nativeRanges.get(key) ?? key.span;
              const span = [range[2], range[3], range[2], range[3]];
              const syntax = key.kind === "NamedExpression" && !this.grouped.has(key) ? undefined :
                this.delimitedDiagnostic("':' expected after dictionary key", {span}, "}", true);
              if (syntax) { syntax.offset--; syntax.end_offset = 0; }
              this.fail("A dictionary element requires a value.", key, "SYNTAX", undefined, syntax);
            }
            form = "set"; items.push(key);
          }
        }
        if (this.at("for")) {
          if (form === "set" && items.length !== 1) this.comprehensionElements(start, "set", items, comma, "}");
          if (entries.length === 1 && entries[0][0] === null) {
            this.comprehension(start, "dict", entries[0][1]);
            this.fail("A dictionary comprehension cannot unpack its element.", unpacking, "SYNTAX", undefined,
              this.at("}") ? this.delimitedDiagnostic("dict unpacking cannot be used in dict comprehension", unpacking, "}", true) : undefined);
          }
          if (items.length + entries.length !== 1 || entries[0]?.[0] === null) this.fail("A comprehension requires one element or pair.");
          const result = this.comprehension(start, form, form === "set" ? items[0] : entries[0][1], form === "dict" ? entries[0][0] : null);
          this.expect("}"); return this.closeComprehension(result);
        }
        if (!(comma = this.eat(","))) break;
      }
      this.expect("}"); return this.node(form === "set" ? "Set" : "Dict", start, form === "set" ? {items} : {entries});
    }
    if (this.at("...")) this.unsupported("Ellipsis is not adopted.");
    const line = this.lexed.source.split("\n")[start.span[0] - 1] ?? "";
    const lastCode = this.tokens.filter(token => token.span[0] === start.span[0] && !["newline", "eof", "indent", "dedent"].includes(token.kind)).at(-1);
    let syntax;
    if (["newline", "eof"].includes(start.kind) && lastCode) {
      const implicit = this.options.mode && this.options.mode !== "exec" && this.lexed.source[start.start] !== "\n";
      syntax = syntaxDiagnostic(this.lexed.source, this.filename, "invalid syntax", [start.span[0], start.span[1], start.span[0], start.span[1]], {newline: !implicit});
      const lineStart = this.lexed.source.lastIndexOf("\n", start.start - 1) + 1;
      const comment = this.lexed.source.indexOf("#", lastCode.end);
      syntax.offset = implicit ? 0 : comment >= lineStart && comment < start.start ?
        Array.from(this.lexed.source.slice(lineStart, comment)).length + 1 : syntax.offset;
      syntax.end_offset = implicit ? 0 : Array.from(line).length + 2;
      syntax.metadata = this.lexed.source + (!this.options.mode || this.options.mode === "exec" ? this.lexed.source.endsWith("\n") ? "" : "\n" : "");
      syntax.metadataQualified = !this.completedCompound;
    }
    this.fail("Expected an expression.", start, "SYNTAX", undefined, syntax);
  }
}

export function parseSource(source, options = {}) { return new Parser(source, options).file(); }
