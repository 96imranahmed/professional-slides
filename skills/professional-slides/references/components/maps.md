# Maps

Use the shared `map` component when geographic position is evidence: market coverage, regional concentration, location-bound performance, or a priority geography. Do not use a map for an unordered segment comparison or as decorative background.

The component renders editable native country polygons from [Natural Earth Admin 0 Countries at 1:110m](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/). Natural Earth describes this scale as suitable for schematic world and locator maps, and publishes the vector data in the [public domain](https://www.naturalearthdata.com/about/terms-of-use/). The importer supplements Bahrain from the matching [1:50m country set](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson), because Bahrain is a GCC member omitted by the 1:110m set. The repository pins the exact commit and SHA-256 for both inputs in [`import_natural_earth_maps.mjs`](../../../../evals/scripts/import_natural_earth_maps.mjs), preserves interior rings, then generates compact runtime data in [`natural-earth-map-data.mjs`](../../runtime/natural-earth-map-data.mjs).

## Standard geographies

| Canonical geography | Common inputs | Construction |
| --- | --- | --- |
| `world` | World, global, worldwide | world except Antarctica |
| `usa` | US, USA, U.S., U.S.A., United States | full United States including Alaska and Hawaii |
| `usa-contiguous` | lower 48, continental US, contiguous US | contiguous United States crop |
| `canada` | Canada | country crop |
| `brazil` | Brazil | country crop |
| `north-america` | North America | Natural Earth continent membership |
| `south-america` | South America | Natural Earth continent membership |
| `latin-america` | Latin America, LAC | South America, Central America, Caribbean, and Mexico |
| `americas` | Americas | North and South America |
| `europe` | Europe | Natural Earth Europe plus Cyprus and Turkey |
| `united-kingdom` | UK, U.K. | United Kingdom country crop |
| `mena` | MENA, Middle East and North Africa | declared Middle East and North Africa country set |
| `middle-east` | Middle East | declared Middle East country set |
| `gcc` | GCC, Gulf Cooperation Council | six members; Bahrain uses the pinned 1:50m supplement |
| `africa` | Africa | Natural Earth continent membership |
| `sub-saharan-africa` | SSA, Sub-Saharan Africa | Africa excluding Northern Africa |
| `asia` | Asia | Natural Earth continent membership |
| `asia-pacific` | APAC, Asia-Pacific | East, South, and Southeast Asia plus Oceania |
| `oceania` | Oceania, Australasia | Natural Earth continent membership |
| `emea` | EMEA | Europe, Africa, and the declared Middle East set |
| `china`, `india`, `australia`, `japan` | country name | country crop |

Use `country:ISO` for any other included Natural Earth country, such as `country:DEU`. A country name after `country:` also resolves when it matches the source.

These regional presets are transparent display conveniences, not universal analytical taxonomies. MENA, EMEA, APAC, Latin America, Sub-Saharan Africa, and GCC membership can vary by institution and use case. Confirm the declared membership before making an analytical claim. The 1:110m source is intentionally schematic and omits some very small states; Bahrain is the only built-in 1:50m supplement. Detailed country or disputed-boundary analysis requires a separately authorized higher-resolution source and an explicit point-of-view review.

The executable definitions live in [`maps.mjs`](../../runtime/maps.mjs). The acronym presets use these exact rules:

| Preset | Included Natural Earth identifiers or rule |
| --- | --- |
| MENA | ARE, CYP, DZA, EGY, IRN, IRQ, ISR, JOR, KWT, LBN, LBY, MAR, OMN, PSX, QAT, SAH, SAU, SDN, SYR, TUN, TUR, YEM |
| Middle East | ARE, CYP, EGY, IRN, IRQ, ISR, JOR, KWT, LBN, OMN, PSX, QAT, SAU, SYR, TUR, YEM |
| GCC | ARE, BHR, KWT, OMN, QAT, SAU |
| EMEA | every source country assigned to Europe or Africa, plus the Middle East identifiers above |
| APAC | every source country assigned to Oceania, Eastern Asia, South-Eastern Asia, or Southern Asia |
| LAC | every source country assigned to South America, Central America, or the Caribbean, plus Mexico |
| SSA | every source country assigned to Africa except those assigned to Northern Africa |

When the assignment uses a different membership, disclose that definition and supply a separately authorized geometry or a set of explicit country crops rather than silently changing a standard preset.

## Component contract

Set `geography` to a canonical name or alias. Set `highlightCountries` to country names or Natural Earth three-character identifiers when a small number of geographies carry the claim. The highlighted countries use the active component primary; all peers remain neutral. Do not use colour as the sole cue when the highlighted state has a substantive meaning: add a concise direct label or shared legend.

Markers accept either a country anchor or crop-relative coordinates:

```js
{
  component: "map",
  props: {
    geography: "Europe",
    highlightCountries: ["GBR", "DEU"],
    markers: [
      { country: "GBR", label: "United Kingdom", fraction: 1 },
      { x: 0.72, y: 0.54, label: "Priority cluster", fraction: 0.5 }
    ]
  }
}
```

For unit coordinates, the origin is the displayed crop's top-left, x increases right, and y increases down. Coordinates always resolve against the visible crop, not the uncropped world. Country anchors use the source label point and are rejected when the country is outside the selected geography.

## Composition and title

Let the map dominate the available exhibit field. Keep labels close to their location, avoid country-by-country narration, and use a legend only when one encoding is shared across multiple locations. Use a table or ranked chart instead when exact comparison matters more than spatial pattern.

The action title should state the geographic concentration, difference, gap, or coverage implication. It should not merely name the region or say that the slide is a map.

## Theme and adapter contract

The component consumes `--map-land`, `--map-highlight`, `--map-boundary`, `--map-label-font`, `--map-label-color`, `--map-marker-bg`, `--map-marker-color`, and `--map-marker-line`. The canonical defaults bind to neutral surface, component primary, canvas boundary, label role, secondary text, canvas, ink, and hairline tokens.

HTML renders one SVG path per country. PowerPoint renders one editable native custom-geometry shape per country. Both adapters retain stable country IDs and pinned source provenance in the scene data.

## Acceptance check

The displayed crop matches the declared geography. Every highlighted country and marker resolves inside it. The analytical membership is explicit where a regional acronym is used. Labels remain legible without covering the location they describe. State is not conveyed by colour alone. The exact HTML and PowerPoint renders preserve the same crop, country set, marker positions, and emphasis.

## Arbitrary locations

`map.props.geography` may be a sourced object instead of a preset name: `{id, title, source: {url, license, sha256}, geojson, bounds?}`. `geojson` is an RFC 7946 WGS84 FeatureCollection of Polygon/MultiPolygon features with unique IDs. City, district, campus and custom-region boundaries use the same editable map renderer. Highlight feature IDs with `highlightCountries`; place markers with `longitude` and `latitude` and an explicit label.

Find boundary data at the jurisdiction's official open-data portal first; use Census TIGER/Line for US administrative areas, Natural Earth for suitable regional detail, or OpenStreetMap with its attribution requirements. Match boundary vintage and geographic unit to the comparison. Record the download URL, licence and hash of the downloaded bytes. Never relabel a nearby preset as the requested location.

In a source checkout, `node evals/scripts/import_geography.mjs config.json output.json` downloads and validates a GeoJSON source. Config supplies `url`, `license`, `id`, `title`, and optional `idProperty`, `nameProperty`, `bounds`. In an installed plugin, call `importGeography(bytes, config)` from `runtime/import-geography.mjs` and keep output in the task directory. The CLI writes exact downloaded bytes to `output.json.source.geojson` beside `output.json`, with exclusive creation to protect existing evidence. When calling the runtime directly, preserve original bytes beside the normalized result so provenance can be verified. Rendering never fetches network data.

Reproject other coordinate systems to WGS84 and split antimeridian-crossing rings before import; the runtime rejects them rather than guessing. Preserve polygon holes and inspect coastline, labels and highlights in both observers. Use equal map scales when comparing physical extent; otherwise label independent crops. This simplified local projection does not support distance or area measurement.

## Quantitative regional maps

Use `choropleth: { values: [{ featureId, value }], scale: { domain: [min, max], unit: "%", palette: "red-white-green", decimals: 1 }, labels: { placement: "external" } }` with sourced custom GeoJSON. Every included feature must have one finite value within the explicit domain; unknown IDs, duplicates and missing values reject. Quantitative fills cannot combine with independent country highlights or markers. Values, units, domain, scale bin and source hashes remain attached to editable polygon nodes.

The shared quantitative legend and geography use the same eleven theme-bound heat-scale bins. Supported palettes are `theme-sequential`, `red-white`, `red-white-green`, and explicitly relative `red-yellow-green`; this is a discretized quantitative scale, not a continuous gradient or source-specific local palette. Domain endpoints and units appear once in a measured native legend. Keep exact numbers in the accompanying chart or necessary labels.

For external feature names, custom GeoJSON properties provide `name` and a WGS84 `labelPoint` inside the intended region. Derive an interior representative point from the sourced polygon rather than guessing a geographic center. `labelText` may add line breaks to the complete name, preserving every non-whitespace character. The owner measures two external lanes, orders labels by anchor height and routes leaders through a common lane boundary to avoid crossovers. All labels and leaders depend on their own land feature. Impossible name, lane or geography capacity rejects rather than reducing typography or dropping regions. Inspect the native render at the complete analytical frame before acceptance.


For an explicitly relative low-to-high value comparison, use `scale: { domain: [min, max], unit: "%", palette: "red-yellow-green", semantics: "relative-level" }`. This shared eleven-bin palette uses a yellow midpoint rather than the canvas color; its legend prints Low and High alongside the exact numeric endpoints and unit. Relative level does not assert that red means a negative value or that the midpoint is zero. The red-yellow-green palette requires this explicit semantic declaration. Quantitative map regions use visible `color.rule` boundaries, so even a white-bin region in another scale remains distinguishable against the canvas. All marks retain the scale semantics, feature values, IDs and source provenance.


## Spatial decision evidence and identity

Each map states the spatial question it answers. Use sourced locations and boundaries; distinguish actual destinations from illustrative proxies. Pins and straight-line connectors do not establish walking access, school eligibility or travel time. Never invent catchments, routes or commute polygons to make an exhibit more persuasive.

Reuse option IDs, labels and a consistent visual identity across maps, tables and recommendations. Color cannot be the only identity cue. Mark observed geography and assumed scenarios distinctly both visually and verbally. Pair spatial evidence with the compact decision evidence needed to interpret it, not decorative pins.
