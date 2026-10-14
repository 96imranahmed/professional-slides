// JSON edited in its own text.
//
// A part file is written by one agent and read by others, by git and by the
// person who owns the deck. An edit made by parsing the file and writing it
// back whole rewrites every line it did not mean to: a row kept on one line is
// spread over six, an escaped character is written out, a number written
// `1.0` comes back `1`, and the diff of a one-word fix is the whole file. So
// an edit here rewrites only the bytes of the value it changes. The text is
// read once into a tree of spans - where each value, member and item starts
// and ends - and a value is replaced, an entry removed or one added by
// splicing those spans, every other byte as it was written: a file no edit
// touches is the same file byte for byte.
//
// A value written new is set out the way its neighbours are: on one line
// inside a container written on one line (with the spacing that container
// uses), else over lines at the file's own indent unit and line ending, and
// with non-ASCII characters escaped where the file escapes them.

/**
 * The span tree of a JSON text: `{ kind, start, end }` for every value, with
 * `members: [{ key, start, end, value }]` on an object (`start` at the key's
 * opening quote) and `items: [node]` on an array. `end` is one past the last
 * character. Throws on text that is not JSON, naming the offset.
 */
export function spanTree(text) {
  let at = 0;
  const fail = (what) => { throw new SyntaxError(`not JSON at offset ${at}: ${what}`); };
  const space = () => { while (at < text.length && " \t\n\r".includes(text[at])) at += 1; };
  const string = () => {
    const start = at;
    at += 1;
    while (at < text.length && text[at] !== "\"") at += text[at] === "\\" ? 2 : 1;
    if (at >= text.length) fail("a string that does not close");
    at += 1;
    return { kind: "string", start, end: at };
  };
  const value = () => {
    space();
    const start = at, char = text[at];
    if (char === "{") {
      at += 1; const members = [];
      space();
      if (text[at] === "}") { at += 1; return { kind: "object", start, end: at, members }; }
      for (;;) {
        space();
        if (text[at] !== "\"") fail("a key that is not a string");
        const key = string();
        space();
        if (text[at] !== ":") fail("a key with no colon");
        at += 1;
        const node = value();
        members.push({ key: JSON.parse(text.slice(key.start, key.end)), start: key.start, keyEnd: key.end, end: node.end, value: node });
        space();
        if (text[at] === ",") { at += 1; continue; }
        if (text[at] === "}") { at += 1; return { kind: "object", start, end: at, members }; }
        fail("an object that does not close");
      }
    }
    if (char === "[") {
      at += 1; const items = [];
      space();
      if (text[at] === "]") { at += 1; return { kind: "array", start, end: at, items }; }
      for (;;) {
        items.push(value());
        space();
        if (text[at] === ",") { at += 1; continue; }
        if (text[at] === "]") { at += 1; return { kind: "array", start, end: at, items }; }
        fail("an array that does not close");
      }
    }
    if (char === "\"") return string();
    const literal = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/y;
    literal.lastIndex = at;
    const match = literal.exec(text);
    if (!match) fail("no value");
    at += match[0].length;
    return { kind: /^[-\d]/.test(match[0]) ? "number" : match[0], start, end: at };
  };
  const root = value();
  space();
  if (at !== text.length) fail("text after the value");
  return root;
}

/** The node at `steps` (keys and indices) under `node`, or null where the path leaves the tree. */
export function nodeAt(node, steps) {
  let at = node;
  for (const step of steps) {
    if (at?.kind === "object") at = at.members.find((member) => member.key === step)?.value ?? null;
    else if (at?.kind === "array" && Number.isInteger(step)) at = at.items[step] ?? null;
    else return null;
    if (!at) return null;
  }
  return at;
}

/**
 * How the file `text` is set out: its indent unit (the first nested line's
 * indentation), its line ending, and whether it escapes non-ASCII characters
 * (as a file written by Python's json module does).
 */
export function layoutOf(text) {
  const unit = /^[[{]\r?\n([ \t]+)/.exec(text)?.[1] ?? /\n([ \t]+)\S/.exec(text)?.[1] ?? "  ";
  return { unit, eol: text.includes("\r\n") ? "\r\n" : "\n", ascii: /\\u[0-9a-fA-F]{4}/.test(text) && !/[^\x00-\x7f]/.test(text) };
}

// The indentation of the line `offset` sits on.
const lineIndent = (text, offset) => /^[ \t]*/.exec(text.slice(text.lastIndexOf("\n", offset - 1) + 1))[0];
// A span written on one line.
const oneLine = (text, node) => !/[\r\n]/.test(text.slice(node.start, node.end));
const escaped = (json, ascii) => (ascii ? json.replace(/[\u0080-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`) : json);

/**
 * `value` as JSON set where a value of `container` goes: on one line where the
 * container is written on one line - spaced after its commas and colons where
 * the container is - else over lines at `indent`, the indentation of the line
 * it starts on.
 */
function render(value, { text, container, indent, layout }) {
  if (container && oneLine(text, container)) {
    const inside = text.slice(container.start, container.end), spaced = /,\s|:\s/.test(inside);
    const flat = (v) => (Array.isArray(v) ? `[${v.map(flat).join(spaced ? ", " : ",")}]`
      : v && typeof v === "object" ? `{${Object.entries(v).map(([k, inner]) => `${JSON.stringify(k)}${spaced ? ": " : ":"}${flat(inner)}`).join(spaced ? ", " : ",")}}`
        : JSON.stringify(v));
    return escaped(flat(value), layout.ascii);
  }
  return escaped(JSON.stringify(value, null, layout.unit), layout.ascii).replace(/\n/g, `${layout.eol}${indent}`);
}

/** `text` with the value at `node` (inside `container`) replaced by `value`. */
export function replaceValue(text, { node, container }, value) {
  const layout = layoutOf(text);
  return `${text.slice(0, node.start)}${render(value, { text, container, indent: lineIndent(text, node.start), layout })}${text.slice(node.end)}`;
}

/** `text` with entry `index` of `container` (a member of an object, an item of an array) taken out, with its comma. */
export function removeEntry(text, container, index) {
  const entries = container.kind === "object" ? container.members : container.items;
  if (entries.length === 1) return `${text.slice(0, container.start + 1)}${text.slice(container.end - 1)}`;
  const [from, to] = index < entries.length - 1 ? [entries[index].start, entries[index + 1].start] : [entries[index - 1].end, entries[index].end];
  return `${text.slice(0, from)}${text.slice(to)}`;
}

/**
 * `text` with `value` added at the end of `container`: an item of an array, or
 * the member `key` of an object. It takes the separator its last two entries
 * are written with (a comma, then the line break and indentation, or a space).
 */
export function appendEntry(text, container, value, { key = null } = {}) {
  const layout = layoutOf(text), entries = container.kind === "object" ? container.members : container.items;
  // The colon as the object's last member writes it (`": "`, `":"`); an empty object says nothing, and takes the spaced one.
  const colon = (member) => (member ? text.slice(member.keyEnd, member.value.start) : ": ");
  const entry = (indent) => `${key === null ? "" : `${JSON.stringify(key)}${colon(entries.at(-1))}`}${render(value, { text, container, indent, layout })}`;
  if (!entries.length) {
    if (oneLine(text, container)) return `${text.slice(0, container.start + 1)}${entry("")}${text.slice(container.end - 1)}`;
    const outer = lineIndent(text, container.start), inner = `${outer}${layout.unit}`;
    return `${text.slice(0, container.start + 1)}${layout.eol}${inner}${entry(inner)}${layout.eol}${outer}${text.slice(container.end - 1)}`;
  }
  const last = entries.at(-1);
  // A container of one entry shows no separator: the space it opens with stands for one (`[\n    "a"` gives `,\n    `).
  const separator = entries.length > 1 ? text.slice(entries.at(-2).end, entries.at(-1).start) : `,${text.slice(container.start + 1, entries[0].start) || (oneLine(text, container) ? " " : "")}`;
  const indent = oneLine(text, container) ? "" : lineIndent(text, last.start);
  return `${text.slice(0, last.end)}${separator}${entry(indent)}${text.slice(last.end)}`;
}
