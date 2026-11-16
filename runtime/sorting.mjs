import {completion, unaryTask, callTask, consumeTask, compareTask, valueTask, operationRoots} from "./operations.mjs";

// The private result and key lists remain ledger-owned throughout every callback.
// Stable binary insertion uses only less-than and Python truth conversion.
export function stableSorting({state, values, mutate, charge, python}) {
  const owned = task => { state.temporaries = operationRoots(task); return task; };
  const reverse = list => {
    charge(list.items.length + 1);
    mutate(list, () => { list.items.reverse(); return () => { list.items.reverse(); }; });
  };
  const insert = (list, index, lower) => {
    if (lower === index) return;
    charge(index - lower + 1);
    mutate(list, () => {
      const before = list.items.slice(lower, index + 1), item = list.items[index];
      for (let position = index; position > lower; position--) list.items[position] = list.items[position - 1];
      list.items[lower] = item;
      return () => { for (let offset = 0; offset < before.length; offset++) list.items[lower + offset] = before[offset]; };
    });
  };
  const sort = (record, site) => {
    let {index, lower, upper} = record;
    while (index < record.receiver.items.length) {
      if (lower < upper) return owned(compareTask("less", record.keys.items[index], record.keys.items[Math.floor((lower + upper) / 2)],
        site, completion("sort-compare", {...record, index, lower, upper}), record.depth));
      insert(record.receiver, index, lower);
      if (record.keys !== record.receiver) insert(record.keys, index, lower);
      index++; lower = 0; upper = index;
    }
    if (record.reverse) reverse(record.receiver);
    return valueTask(record.receiver, site, record.after);
  };
  const keys = (record, site) => {
    if (record.key !== null && record.index < record.receiver.items.length)
      return owned(callTask(record.key, [record.receiver.items[record.index]], [], [], site, completion("sort-key", record), record.depth));
    if (record.reverse) {
      reverse(record.receiver);
      if (record.keys !== record.receiver) reverse(record.keys);
    }
    return sort({...record, index: 1, lower: 0, upper: 1}, site);
  };
  const start = (args, keywords, keywordValues, site, after, depth) => {
    if (args.length !== 1) python("TypeError", "sorted expected 1 argument, got " + args.length);
    return consumeTask("list", args[0], site, completion("sort-input", {keywords, keywordValues, depth, after}), depth);
  };
  const resume = (record, value, site) => {
    if (record.kind === "sort-input") {
      const invalid = record.keywords.find(name => !["key", "reverse"].includes(name));
      if (invalid !== undefined) python("TypeError", "sort() got an unexpected keyword argument '" + invalid + "'");
      const key = record.keywords.includes("key") ? record.keywordValues[record.keywords.indexOf("key")] : null;
      const reverse = record.keywords.includes("reverse") ? record.keywordValues[record.keywords.indexOf("reverse")] : false;
      return unaryTask("truth", reverse, site, completion("sort-reverse", {receiver: value, key, depth: record.depth, after: record.after}), record.depth);
    }
    if (record.kind === "sort-reverse") {
      state.temporaries.push(record.receiver, record.key);
      return keys({...record, keys: record.key === null ? record.receiver : values.list([]), reverse: value, index: 0}, site);
    }
    if (record.kind === "sort-key") {
      state.temporaries.push(value); values.append(record.keys, value);
      return keys({...record, index: record.index + 1}, site);
    }
    if (record.kind === "sort-compare")
      return unaryTask("truth", value, site, completion("sort-truth", record), record.depth);
    if (record.kind === "sort-truth") {
      const middle = Math.floor((record.lower + record.upper) / 2);
      return sort({...record, ...(value ? {upper: middle} : {lower: middle + 1})}, site);
    }
    throw new TypeError("Invalid sort phase.");
  };
  return {start, resume};
}
