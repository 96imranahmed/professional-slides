// Compare effective native character styles, including runs split at line breaks.
const decode = text => text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
  if (entity[0] === '#') return String.fromCodePoint(entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1)));
  return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[entity];
});
const attributes = xml => Object.fromEntries([...xml.matchAll(/\b([\w:]+)="([^"]*)"/g)].map(m => [m[1], decode(m[2])]));
function style(xml, inherited = {}) {
  const attrs = attributes(xml.match(/^<[^>]+>/)?.[0] || '');
  return {
    face: xml.match(/<a:latin\b[^>]*typeface="([^"]*)"/)?.[1] ? decode(xml.match(/<a:latin\b[^>]*typeface="([^"]*)"/)[1]) : inherited.face,
    size: attrs.sz === undefined ? inherited.size : Number(attrs.sz),
    bold: attrs.b === undefined ? (inherited.bold ?? false) : ['1', 'true'].includes(attrs.b)
  };
}
const properties = (xml, tag) => xml.match(new RegExp(`<a:${tag}\\b[^>]*(?:/>|>[\\s\\S]*?</a:${tag}>)`))?.[0] || '';

export function auditNativeTextStyle(block, node) {
  const expectedBase = {face:node.style.fontFamily.value,size:Math.round(node.style.fontSize.value * 100),bold:Boolean(node.style.fontWeight ? node.style.fontFamily.nativeBold : node.style.bold)};
  const expected = (node.runs || [{text:node.text,bold:expectedBase.bold}]).flatMap(run => [...run.text].filter(c => !/\s/u.test(c)).map(text => ({text,...expectedBase,bold:run.bold})));
  const actual = [];
  for (const paragraph of block?.match(/<a:p\b[^>]*>[\s\S]*?<\/a:p>/g) || []) {
    const inherited = style(properties(paragraph, 'defRPr'));
    for (const run of paragraph.match(/<a:r\b[^>]*>[\s\S]*?<\/a:r>/g) || []) {
      const effective = style(properties(run, 'rPr'), inherited);
      const text = decode(run.match(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/)?.[1] || '');
      actual.push(...[...text].filter(c => !/\s/u.test(c)).map(text => ({text,...effective})));
    }
  }
  const index = expected.findIndex((value, i) => JSON.stringify(value) !== JSON.stringify(actual[i]));
  if (index < 0 && expected.length === actual.length) return [];
  const offset = index < 0 ? expected.length : index;
  return [{id:node.id,characterOffset:offset,expected:expected[offset] || null,actual:actual[offset] || null,expectedCharacterCount:expected.length,actualCharacterCount:actual.length}];
}
