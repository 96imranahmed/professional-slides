import { createHash } from "node:crypto";
import { resolveGeography } from "./maps.mjs";

/** Prepare downloaded RFC 7946 polygons without guessing their coordinate system. */
export function importGeography(
  bytes,
  { id, title, url, license, idProperty, nameProperty = "name", bounds } = {},
) {
  const raw = Buffer.from(bytes),
    geojson = JSON.parse(raw.toString("utf8"));
  if (
    geojson.crs?.type === "name" &&
    [
      "urn:ogc:def:crs:OGC:1.3:CRS84",
      "urn:ogc:def:crs:EPSG::4326",
      "EPSG:4326",
    ].includes(geojson.crs.properties?.name)
  )
    delete geojson.crs;
  if (!Array.isArray(geojson.features))
    throw new Error("Download must be a GeoJSON FeatureCollection");
  const features = geojson.features.map((f) => ({
    ...f,
    id: f.id ?? f.properties?.[idProperty ?? "id"],
    properties: {
      ...f.properties,
      name: f.properties?.[nameProperty] ?? f.properties?.name,
    },
  }));
  const result = {
    id,
    title,
    source: {
      url,
      license,
      sha256: createHash("sha256").update(raw).digest("hex"),
    },
    geojson: { ...geojson, features },
    ...(bounds ? { bounds } : {}),
  };
  resolveGeography(result);
  return result;
}
