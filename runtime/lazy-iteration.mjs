import {LazyIteratorValue} from "./function-objects.mjs";
import {completion, unaryTask, callTask, valueTask} from "./operations.mjs";

// Lazy traversals run one acquisition, pull or callback at a time on the shared
// operation machine. Each pending tuple owns its already acquired values.
export function lazyIteration({state, values, allocate, charge, python}) {
  const acquire = (record, site) => {
    charge(record.iterators.length + 1);
    if (record.position === record.args.length)
      return valueTask(allocate(LazyIteratorValue, record.name, record.iterators, record.callable, record.strict), site, record.after);
    return unaryTask("iter", record.args[record.position], site, completion("lazy-acquire", record), record.depth);
  };
  const construct = (record, site) => {
    if (record.args.length < 2) python("TypeError", "map() must have at least two arguments.");
    return acquire({...record, callable: record.args[0], args: record.args.slice(1), iterators: [], position: 0}, site);
  };
  const start = (name, args, keywords, keywordValues, site, after, depth) => {
    if (keywords.length > 1) python("TypeError", name + "() takes at most 1 keyword argument (" + keywords.length + " given)");
    if (keywords.length && keywords[0] !== "strict") python("TypeError", name + "() got an unexpected keyword argument '" + keywords[0] + "'");
    const record = {name, args, after, depth, strict: false};
    return keywords.length ? unaryTask("truth", keywordValues[0], site, completion("lazy-strict", record), depth) : construct(record, site);
  };
  const pull = (record, site) => {
    charge(record.items.length + 1);
    if (record.position === record.receiver.iterators.length)
      return callTask(record.receiver.callable, record.items, [], [], site, completion("lazy-return", record), record.depth);
    return unaryTask("next", record.receiver.iterators[record.position], site, completion("lazy-item", record), record.depth);
  };
  const next = (receiver, site, after, depth) => pull({receiver, items: [], position: 0, after, depth}, site);
  const mismatch = (receiver, position, relation) => python("ValueError", receiver.kind + "() argument " + (position + 1) +
    " is " + relation + " than argument" + (position === 1 ? " 1" : "s 1-" + position));
  const probe = (record, site) => record.position === record.receiver.iterators.length ?
    unaryTask("iterator-stop", record.receiver, site, record.after) :
    unaryTask("next", record.receiver.iterators[record.position], site, completion("lazy-probe", record), record.depth);
  const stopped = (record, site) => {
    if (record.kind === "lazy-probe") return probe({...record, position: record.position + 1}, site);
    if (record.kind !== "lazy-item" || !record.receiver.strict) return null;
    if (record.position) return mismatch(record.receiver, record.position, "shorter");
    return probe({...record, items: [], position: 1}, site);
  };
  const resume = (record, value, site) => {
    if (record.kind === "lazy-strict") return construct({...record, strict: value}, site);
    if (record.kind === "lazy-acquire") return acquire({...record, iterators: [...record.iterators, value], position: record.position + 1}, site);
    if (record.kind === "lazy-item") return pull({...record, items: [...record.items, value], position: record.position + 1}, site);
    if (record.kind === "lazy-probe") return mismatch(record.receiver, record.position, "longer");
    if (record.kind === "lazy-return") return valueTask(value, site, record.after);
    throw new TypeError("Invalid lazy traversal phase.");
  };
  return {start, next, resume, stopped};
}
