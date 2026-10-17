// National flags as marks: a country named on a page - `flag: "France"`, or
// its ISO code, "FR" or "FRA" - wherever a mark beside a label takes an image
// (a chart's category mark, a table's logo cell or column header, a card's or
// a logos member's logo). The compile resolves the name to one country of the
// table below, refuses one it cannot with the nearest it can, and plans the
// mark as a picture `{ flag: "<ISO>", alt: "Flag of <country>" }`; the build
// fills it from assets/flags/ or fetches it from Wikimedia Commons
// (fetch-flags.mjs), and the composer draws it at its own proportions with a
// hairline round it (media.mjs flagFrame), so a white flag is not lost on a
// white page.
//
// Sampled consulting pages set flags beside country bars and table rows ten
// times where nothing could draw one: every flag file had to be found and
// supplied by hand.

// [ISO 3166-1 alpha-2, alpha-3, the name a page prints, the Commons file's subject where it is not the name, ...other
// names it is written as]. The Commons subject is the one in "Flag of <subject>.svg": "the Netherlands", "the People's
// Republic of China". A code is the id the flag's file is saved under; a place with no ISO country code carries the one
// it is known by (EU, GB-ENG).
const COUNTRIES = [
  ["AF", "AFG", "Afghanistan"], ["AL", "ALB", "Albania"], ["DZ", "DZA", "Algeria"], ["AD", "AND", "Andorra"], ["AO", "AGO", "Angola"],
  ["AG", "ATG", "Antigua and Barbuda"], ["AR", "ARG", "Argentina"], ["AM", "ARM", "Armenia"], ["AU", "AUS", "Australia"], ["AT", "AUT", "Austria"],
  ["AZ", "AZE", "Azerbaijan"], ["BS", "BHS", "Bahamas", "the Bahamas"], ["BH", "BHR", "Bahrain"], ["BD", "BGD", "Bangladesh"], ["BB", "BRB", "Barbados"],
  ["BY", "BLR", "Belarus"], ["BE", "BEL", "Belgium"], ["BZ", "BLZ", "Belize"], ["BJ", "BEN", "Benin"], ["BT", "BTN", "Bhutan"], ["BO", "BOL", "Bolivia"],
  ["BA", "BIH", "Bosnia and Herzegovina"], ["BW", "BWA", "Botswana"], ["BR", "BRA", "Brazil"], ["BN", "BRN", "Brunei"], ["BG", "BGR", "Bulgaria"],
  ["BF", "BFA", "Burkina Faso"], ["BI", "BDI", "Burundi"], ["CV", "CPV", "Cape Verde", null, "Cabo Verde"], ["KH", "KHM", "Cambodia"], ["CM", "CMR", "Cameroon"],
  ["CA", "CAN", "Canada"], ["CF", "CAF", "Central African Republic", "the Central African Republic"], ["TD", "TCD", "Chad"], ["CL", "CHL", "Chile"],
  ["CN", "CHN", "China", "the People's Republic of China", "People's Republic of China", "PRC", "Mainland China"], ["CO", "COL", "Colombia"],
  ["KM", "COM", "Comoros", "the Comoros"], ["CG", "COG", "Republic of the Congo", "the Republic of the Congo", "Congo", "Congo-Brazzaville"],
  ["CD", "COD", "Democratic Republic of the Congo", "the Democratic Republic of the Congo", "DR Congo", "DRC", "Congo-Kinshasa"], ["CR", "CRI", "Costa Rica"],
  ["CI", "CIV", "Côte d'Ivoire", null, "Ivory Coast"], ["HR", "HRV", "Croatia"], ["CU", "CUB", "Cuba"], ["CY", "CYP", "Cyprus"],
  ["CZ", "CZE", "Czech Republic", "the Czech Republic", "Czechia"], ["DK", "DNK", "Denmark"], ["DJ", "DJI", "Djibouti"], ["DM", "DMA", "Dominica"],
  ["DO", "DOM", "Dominican Republic", "the Dominican Republic"], ["EC", "ECU", "Ecuador"], ["EG", "EGY", "Egypt"], ["SV", "SLV", "El Salvador"],
  ["GQ", "GNQ", "Equatorial Guinea"], ["ER", "ERI", "Eritrea"], ["EE", "EST", "Estonia"], ["SZ", "SWZ", "Eswatini", null, "Swaziland"], ["ET", "ETH", "Ethiopia"],
  ["FJ", "FJI", "Fiji"], ["FI", "FIN", "Finland"], ["FR", "FRA", "France"], ["GA", "GAB", "Gabon"], ["GM", "GMB", "Gambia", "The Gambia"], ["GE", "GEO", "Georgia"],
  ["DE", "DEU", "Germany"], ["GH", "GHA", "Ghana"], ["GR", "GRC", "Greece"], ["GD", "GRD", "Grenada"], ["GT", "GTM", "Guatemala"], ["GN", "GIN", "Guinea"],
  ["GW", "GNB", "Guinea-Bissau"], ["GY", "GUY", "Guyana"], ["HT", "HTI", "Haiti"], ["HN", "HND", "Honduras"], ["HU", "HUN", "Hungary"], ["IS", "ISL", "Iceland"],
  ["IN", "IND", "India"], ["ID", "IDN", "Indonesia"], ["IR", "IRN", "Iran"], ["IQ", "IRQ", "Iraq"], ["IE", "IRL", "Ireland", null, "Republic of Ireland"],
  ["IL", "ISR", "Israel"], ["IT", "ITA", "Italy"], ["JM", "JAM", "Jamaica"], ["JP", "JPN", "Japan"], ["JO", "JOR", "Jordan"], ["KZ", "KAZ", "Kazakhstan"],
  ["KE", "KEN", "Kenya"], ["KI", "KIR", "Kiribati"], ["KP", "PRK", "North Korea", null, "DPRK", "Korea, North"],
  ["KR", "KOR", "South Korea", null, "Korea", "Republic of Korea", "Korea, South"], ["KW", "KWT", "Kuwait"], ["KG", "KGZ", "Kyrgyzstan"], ["LA", "LAO", "Laos"],
  ["LV", "LVA", "Latvia"], ["LB", "LBN", "Lebanon"], ["LS", "LSO", "Lesotho"], ["LR", "LBR", "Liberia"], ["LY", "LBY", "Libya"], ["LI", "LIE", "Liechtenstein"],
  ["LT", "LTU", "Lithuania"], ["LU", "LUX", "Luxembourg"], ["MG", "MDG", "Madagascar"], ["MW", "MWI", "Malawi"], ["MY", "MYS", "Malaysia"],
  ["MV", "MDV", "Maldives", "the Maldives"], ["ML", "MLI", "Mali"], ["MT", "MLT", "Malta"], ["MH", "MHL", "Marshall Islands", "the Marshall Islands"],
  ["MR", "MRT", "Mauritania"], ["MU", "MUS", "Mauritius"], ["MX", "MEX", "Mexico"], ["FM", "FSM", "Micronesia", "the Federated States of Micronesia", "Federated States of Micronesia"],
  ["MD", "MDA", "Moldova"], ["MC", "MCO", "Monaco"], ["MN", "MNG", "Mongolia"], ["ME", "MNE", "Montenegro"], ["MA", "MAR", "Morocco"], ["MZ", "MOZ", "Mozambique"],
  ["MM", "MMR", "Myanmar", null, "Burma"], ["NA", "NAM", "Namibia"], ["NR", "NRU", "Nauru"], ["NP", "NPL", "Nepal"], ["NL", "NLD", "Netherlands", "the Netherlands", "Holland"],
  ["NZ", "NZL", "New Zealand"], ["NI", "NIC", "Nicaragua"], ["NE", "NER", "Niger"], ["NG", "NGA", "Nigeria"], ["MK", "MKD", "North Macedonia", null, "Macedonia"],
  ["NO", "NOR", "Norway"], ["OM", "OMN", "Oman"], ["PK", "PAK", "Pakistan"], ["PW", "PLW", "Palau"], ["PS", "PSE", "Palestine"], ["PA", "PAN", "Panama"],
  ["PG", "PNG", "Papua New Guinea"], ["PY", "PRY", "Paraguay"], ["PE", "PER", "Peru"], ["PH", "PHL", "Philippines", "the Philippines"], ["PL", "POL", "Poland"],
  ["PT", "PRT", "Portugal"], ["QA", "QAT", "Qatar"], ["RO", "ROU", "Romania"], ["RU", "RUS", "Russia", null, "Russian Federation"], ["RW", "RWA", "Rwanda"],
  ["KN", "KNA", "Saint Kitts and Nevis"], ["LC", "LCA", "Saint Lucia"], ["VC", "VCT", "Saint Vincent and the Grenadines"], ["WS", "WSM", "Samoa"],
  ["SM", "SMR", "San Marino"], ["ST", "STP", "Sao Tome and Principe"], ["SA", "SAU", "Saudi Arabia"], ["SN", "SEN", "Senegal"],
  ["RS", "SRB", "Serbia", null, "Republic of Serbia"], ["SC", "SYC", "Seychelles"], ["SL", "SLE", "Sierra Leone"], ["SG", "SGP", "Singapore"],
  ["SK", "SVK", "Slovakia"], ["SI", "SVN", "Slovenia"], ["SB", "SLB", "Solomon Islands", "the Solomon Islands"], ["SO", "SOM", "Somalia"],
  ["ZA", "ZAF", "South Africa"], ["SS", "SSD", "South Sudan"], ["ES", "ESP", "Spain"], ["LK", "LKA", "Sri Lanka"], ["SD", "SDN", "Sudan"], ["SR", "SUR", "Suriname"],
  ["SE", "SWE", "Sweden"], ["CH", "CHE", "Switzerland"], ["SY", "SYR", "Syria"], ["TJ", "TJK", "Tajikistan"],
  ["TZ", "TZA", "Tanzania", null, "United Republic of Tanzania"], ["TH", "THA", "Thailand"], ["TL", "TLS", "East Timor", null, "Timor-Leste"], ["TG", "TGO", "Togo"],
  ["TO", "TON", "Tonga"], ["TT", "TTO", "Trinidad and Tobago"], ["TN", "TUN", "Tunisia"], ["TR", "TUR", "Turkey", null, "Türkiye"], ["TM", "TKM", "Turkmenistan"],
  ["TV", "TUV", "Tuvalu"], ["UG", "UGA", "Uganda"], ["UA", "UKR", "Ukraine"], ["AE", "ARE", "United Arab Emirates", "the United Arab Emirates", "UAE"],
  ["GB", "GBR", "United Kingdom", "the United Kingdom", "UK", "Great Britain", "Britain"],
  ["US", "USA", "United States", "the United States", "United States of America", "America"], ["UY", "URY", "Uruguay"], ["UZ", "UZB", "Uzbekistan"],
  ["VU", "VUT", "Vanuatu"], ["VA", "VAT", "Vatican City", "the Vatican City", "Holy See", "Vatican"], ["VE", "VEN", "Venezuela"],
  ["VN", "VNM", "Vietnam", null, "Viet Nam"], ["YE", "YEM", "Yemen"], ["ZM", "ZMB", "Zambia"], ["ZW", "ZWE", "Zimbabwe"],
  // Places a deck compares as countries, with a flag of their own on Commons.
  ["TW", "TWN", "Taiwan", "the Republic of China", "Republic of China"], ["HK", "HKG", "Hong Kong"], ["MO", "MAC", "Macau", null, "Macao"],
  ["XK", "XKX", "Kosovo", null, "KOS"], ["PR", "PRI", "Puerto Rico"], ["GL", "GRL", "Greenland"],
  ["EU", null, "European Union", "Europe", "EU"], ["GB-ENG", null, "England"], ["GB-SCT", null, "Scotland"], ["GB-WLS", null, "Wales"],
];

// A name as it is compared: case, accents, "&", punctuation and a leading "the" set aside.
const keyOf = (value) => String(value ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/&/g, " and ")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").replace(/^the-/, "");

const FLAG_COUNTRIES = Object.freeze(COUNTRIES.map(([iso2, iso3, name, subject, ...aliases]) => Object.freeze({
  id: iso3 ?? iso2, iso2, ...(iso3 ? { iso3 } : {}), name, subject: subject ?? name, aliases: Object.freeze(aliases) })));
const BY_KEY = new Map(FLAG_COUNTRIES.flatMap((country) => [country.iso2, country.iso3, country.name, country.subject, ...country.aliases]
  .filter(Boolean).map((written) => [keyOf(written), country])));

/** The country a page names - its name, a name it is also written as, or its ISO code (FR, FRA) - or null. */
export function flagCountry(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  return BY_KEY.get(keyOf(value)) ?? null;
}

/**
 * The names nearest one no country answers to, for the refusal: by edit
 * distance against every name and alias, a shared stem counting as near
 * ("Netherland", "Korea Rep"), each country once.
 */
export function nearestCountries(value, count = 3) {
  const want = keyOf(value);
  const distance = (a, b) => {
    const row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i += 1) {
      let prev = row[0]; row[0] = i;
      for (let j = 1; j <= b.length; j += 1) { const next = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = next; }
    }
    return row[b.length];
  };
  const stem = (a, b) => (b.length >= 4 && a.length >= 4 && (a.startsWith(b) || b.startsWith(a)) ? 0.1 : b.length >= 4 && a.length >= 4 && (a.includes(b) || b.includes(a)) ? 0.3 : null);
  const scored = [...BY_KEY].filter(([key]) => key.length > 3).map(([key, country]) => ({ country, score: stem(want, key) ?? distance(want, key) / Math.max(want.length, key.length) }));
  const best = new Map();
  for (const { country, score } of scored.sort((a, b) => a.score - b.score)) if (!best.has(country)) best.set(country, score);
  return [...best].filter(([, score]) => score <= 0.5).slice(0, count).map(([country]) => country.name);
}

/** Why a flag is refused: the name as written, the nearest the table holds, and what else is read. */
export function unknownFlag(value) {
  const near = typeof value === "string" ? nearestCountries(value) : [];
  return `no country is named "${String(value)}"${near.length ? `; the nearest are ${near.join(", ")}` : ""}. Write the country's name ("France") or its ISO code ("FR" or "FRA")`;
}

/** What the flag's picture says it shows. */
export const flagAlt = (country) => `Flag of ${country.subject}`;
/** The Commons file the flag is drawn from: "File:Flag of France.svg". */
export const flagCommonsTitle = (country) => `File:Flag of ${country.subject}.svg`;
/** Where the flag's PNG is read from, and saved to, beside the deck: assets/flags/<id>.png. */
export const flagFile = (country) => `assets/flags/${country.id.toLowerCase()}.png`;

/** Whether a value is a picture planned by its flag. */
export const isFlagRef = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value) && value.flag !== undefined;

// The keys under which a page carries a mark beside a label - a chart category's, a table cell's, a column's, a card's,
// a logos member's - and so a flag's picture.
const MARK_KEYS = new Set(["image", "media", "logo"]);
const WHERE = "a flag is a mark beside a label: a chart's `categoryIcons` entry, a table cell (drawn as a logo cell, the flag before its `text`), a column header, or the `image`, `media` or `logo` of a card or a logos member";

/** A flag reference resolved: the country's code as `flag`, its `alt` unless the page wrote one, and what else the page set. */
function resolved(ref, id, where) {
  const country = flagCountry(ref.flag);
  if (!country) throw new Error(`${id}: ${where} - ${typeof ref.flag === "string" ? unknownFlag(ref.flag) : "`flag` is a country's name or its ISO code, a string"}`);
  return { ...ref, flag: country.id, alt: typeof ref.alt === "string" && ref.alt.trim() ? ref.alt : flagAlt(country) };
}

/**
 * Plan every flag a compiled page names, in place, or refuse the page: a
 * chart category's `{ flag }` becomes `{ image: { flag, alt } }`; a table
 * cell's `{ flag, text }` a logo cell with its flag before its text; a
 * column's `{ label, flag }` the column's `logo`; and `{ flag }` under an
 * `image`, `media` or `logo` key the same picture. A name no country answers
 * to is refused with the nearest names, and a flag anywhere else - a
 * photograph's place, a point - with where a flag is drawn: nothing is dropped.
 */
export function planFlags(slide, id) {
  // `where` is what the value is to its holder: a chart's category mark, a table row, a row's cell, a column.
  const place = (holder, key, where) => {
    const { flag, ...rest } = holder[key];
    if (MARK_KEYS.has(key)) holder[key] = resolved(holder[key], id, `the flag under \`${key}\``);
    else if (where === "category") holder[key] = { ...rest, image: resolved({ flag }, id, `the category mark of ${JSON.stringify(key)}`) };
    else if (where === "cell") {
      if (rest.type !== undefined && rest.type !== "logo") throw new Error(`${id}: a table cell with a \`flag\` is a logo cell, the flag before its \`text\`; this one says type "${rest.type}" - drop the type, or the flag`);
      holder[key] = { ...rest, type: "logo", media: resolved({ flag }, id, "a table cell's flag") };
    } else if (where === "column") holder[key] = { ...rest, logo: resolved({ flag }, id, `the flag of column "${rest.label ?? key}"`) };
    else throw new Error(`${id}: \`flag\` is not read on \`${key}\` - ${WHERE}`);
  };
  const visit = (holder, key, where) => {
    const value = holder[key];
    if (!value || typeof value !== "object") return;
    if (isFlagRef(value)) { place(holder, key, where); return; }
    // A row is its cells, or `{ cells, style }`.
    const cells = where === "row" ? (Array.isArray(value) ? value : Array.isArray(value.cells) ? value.cells : null) : null;
    if (cells) { cells.forEach((_, at) => visit(cells, at, "cell")); return; }
    const inside = key === "rows" ? "row" : key === "columns" ? "column" : key === "categoryIcons" ? "category" : null;
    for (const child of Object.keys(value)) visit(value, child, inside);
  };
  for (const key of Object.keys(slide)) visit(slide, key, null);
  return slide;
}

/** Every flag a spec plans: each picture `{ flag }`, wherever the compile set it. */
export function flagRefs(spec) {
  const found = [];
  const walk = (value) => {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (!value || typeof value !== "object") return;
    if (isFlagRef(value)) { found.push(value); return; }
    for (const child of Object.values(value)) walk(child);
  };
  walk(spec);
  return found;
}
