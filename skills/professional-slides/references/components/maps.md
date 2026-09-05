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
