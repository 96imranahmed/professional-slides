# Geography

An annotated map is only as good as its boundaries. This is how to get them,
what shape they have to arrive in, and what the runtime does with them.

The skill ships world countries and 25 named presets (`world`, `usa`, `europe`,
`gcc`, `india`, …) in `runtime/natural-earth-map-data.mjs`. Anything below
national level — boroughs, counties, postcodes, sales territories, catchments —
you supply, and it becomes a first-class geography through
`runtime/import-geography.mjs`.

## Where boundaries come from

| You need | Source | Licence |
| --- | --- | --- |
| Countries, states, provinces, big cities | [Natural Earth](https://www.naturalearthdata.com) `admin_1_states_provinces` | Public domain |
| US states, counties, tracts, ZCTAs | US Census [TIGER/Line](https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html) or the smaller [cartographic boundary files](https://www.census.gov/geographies/mapping-files/time-series/geo/carto-boundary-file.html) | Public domain |
| NYC boroughs and neighbourhoods | NYC Open Data — *Borough Boundaries*, *NTA (Neighborhood Tabulation Areas)* | Public domain |
| UK regions, local authorities, wards, MSOAs | ONS [Open Geography Portal](https://geoportal.statistics.gov.uk) | OGL — attribution required |
| EU regions (NUTS) | Eurostat GISCO | Free with attribution |
| Anything else, quickly | [geoBoundaries](https://www.geoboundaries.org) | CC-BY |

**Prefer the generalised or cartographic file over the full-resolution one.** A
county map drawn from TIGER's survey-grade boundaries carries hundreds of
thousands of points, none of which survive being drawn 300px wide. The
cartographic boundary files (`cb_*_500k`) are the right starting size.

Record the source URL, the licence and a SHA-256 of the file you actually used.
`importGeography` requires all three and carries them onto the page, because a
map with no provenance is a claim with no source.

## Shapefile to GeoJSON

A shapefile is four or five files that must travel together (`.shp`, `.shx`,
`.dbf`, `.prj`). Convert once, keep the GeoJSON.

```bash
# GDAL: convert, reproject to WGS84, keep only the fields you need
ogr2ogr -f GeoJSON boroughs.geojson nybb.shp \
  -t_srs EPSG:4326 \
  -select BoroName,BoroCode

# mapshaper: the same, plus simplification, without installing GDAL
npx mapshaper nybb.shp \
  -proj wgs84 \
  -simplify 8% keep-shapes \
  -filter-fields BoroName,BoroCode \
  -o format=geojson boroughs.geojson
```

`-t_srs EPSG:4326` / `-proj wgs84` is not optional. The runtime refuses a
projected file outright (`Reproject to WGS84`), because a map drawn from State
Plane feet silently lands in the wrong hemisphere rather than failing.

**Simplify until it stops looking better.** `-simplify 8% keep-shapes` typically
takes a county file from megabytes to tens of kilobytes with no visible change
at slide size; `keep-shapes` stops small polygons vanishing entirely. Check the
result at the size it will be drawn, not at full screen.

## What each feature has to carry

```json
{ "type": "Feature", "id": "manhattan",
  "properties": { "name": "Manhattan", "labelPoint": [-73.968, 40.785] },
  "geometry": { "type": "Polygon", "coordinates": [[[-74.02, 40.70], …]] } }
```

- **`id`** — stable and unique. It is what a choropleth value keys on, so it
  outlives a renaming.
- **`name`** — what the reader is shown. `labelText` may add line breaks to that
  name and nothing else; it cannot say something different.
- **`labelPoint`** — `[lon, lat]`, and it must fall **inside that feature's own
  polygon**. The runtime checks, because a label leader drawn to a point in the
  sea is worse than no map. For an L-shaped or multi-part feature the centroid
  is often outside it: use a point you have chosen, not a computed centre.
- Rings close (first point repeated) and are cleaned of holes-as-separate-
  features; `importGeography` rejects an unclosed ring and a duplicate id.

`mapshaper -points inner` computes visually-inside label points for you:

```bash
npx mapshaper boroughs.geojson -points inner -o inner.geojson
```

## Importing and colouring

```js
import { importGeography } from "./runtime/import-geography.mjs";
const geography = importGeography(readFileSync("boroughs.geojson"), {
  id: "nyc-boroughs", title: "New York City boroughs",
  url: "https://data.cityofnewyork.us/…/nybb.zip",
  license: "NYC Open Data, public domain",
  idProperty: "BoroCode",     // which property is the stable id
});
```

Then the exhibit. Every feature needs a value — the runtime refuses a partial
choropleth rather than letting a missing region read as a neutral one, because a
grey borough and a zero borough look identical and mean opposite things.

```json
{ "type": "map", "geography": { "…imported…" },
  "choropleth": {
    "values": [
      { "featureId": "1", "value": 4.6,
        "note": "Closest to the central offices and the most expensive; building quality decides it." },
      { "featureId": "3", "value": 2.4,
        "note": "Two lines and a ferry, but every cross-town destination costs a transfer." }
    ],
    "scale": { "domain": [1, 5], "unit": "£k/month", "palette": "theme-sequential" },
    "labels": { "placement": "external" }
  } }
```

`palette` is one of `theme-sequential` (the deck's own colour, light to dark),
`red-white`, `red-white-green` or `red-yellow-green`. Use a diverging palette
only where the measure genuinely has a midpoint that means something; a
sequential ramp is right for a rent, a count or a share.

`note` is what turns the map into the page: the lane beside the map carries each
region's sentence under its name, with a leader drawn to the region it is about.
Without notes the lane carries names only and stays narrow.

## When not to draw a map

A map shows *where*. If the finding is a ranking, a bar chart says it better and
in a fifth of the space — five regions with five values is a bar chart, not a
choropleth. Draw the map when adjacency, distance, contiguity or coverage is
part of the argument, or when the reader thinks in the geography and needs to
find themselves on it. A map of twelve markets coloured by revenue, whose finding
is "three markets carry the growth", is a ranked bar chart wearing a map.
