#!/usr/bin/env python3
"""Extract named rivers and hiking trails from OpenStreetMap.

Rivers are usually split into many short ways sharing the same name; this
merges same-named segments into one line per river with shapely.ops.linemerge.
Hiking trails come from route=hiking relations, whose way members are merged
the same way (ignoring member role, since hiking routes don't use outer/inner).
"""
from __future__ import annotations

import argparse
import sys
import time
from collections import defaultdict
from math import atan2, cos, radians, sin, sqrt
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote, urlencode

from shapely.geometry import LineString, mapping
from shapely.ops import linemerge

from extract_places import DATA_DIR, OVERPASS_URL, request_json, wikipedia_from_tag
from geometry import coordinates

GROUPS = {
    "lumenj": {"label": "Lumenjtë", "color": "#2f7fb0"},
    "shtigje": {"label": "Shtigje ecjeje", "color": "#a5672f"},
}
COUNTRIES = {"AL": "Shqipëri", "XK": "Kosovë"}
SAC_SCALE_LABELS = {
    "hiking": "Shteg i thjeshtë", "mountain_hiking": "Shteg malor",
    "demanding_mountain_hiking": "Shteg malor kërkues", "alpine_hiking": "Shteg alpin",
    "demanding_alpine_hiking": "Shteg alpin kërkues", "difficult_alpine_hiking": "Shteg alpin i vështirë",
}
NETWORK_LABELS = {"iwn": "Rrjet ndërkombëtar", "nwn": "Rrjet kombëtar", "rwn": "Rrjet rajonal", "lwn": "Rrjet vendor"}


def river_query(country: str) -> str:
    return f'''[out:json][timeout:180];
area["ISO3166-1"="{country}"][admin_level=2]->.country;
way["waterway"="river"]["name"](area.country);
out geom;'''


def trail_query(country: str) -> str:
    return f'''[out:json][timeout:180];
area["ISO3166-1"="{country}"][admin_level=2]->.country;
relation["route"="hiking"]["name"](area.country);
out geom;'''


def query_overpass(country: str, query_fn, endpoint: str, attempts: int = 5) -> dict:
    payload = urlencode({"data": query_fn(country)}).encode("utf-8")
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            return request_json(endpoint, data=payload, timeout=200)
        except (HTTPError, ValueError) as error:
            last_error = error
            delay = 15 * (attempt + 1)
            print(f"Overpass busy for {country} ({error}); retrying in {delay}s", file=sys.stderr)
            time.sleep(delay)
    raise last_error


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    (lon1, lat1), (lon2, lat2) = a, b
    dlat, dlon = radians(lat2 - lat1), radians(lon2 - lon1)
    h = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 6371 * 2 * atan2(sqrt(h), sqrt(1 - h))


def line_length_km(geometry) -> float:
    lines = geometry.geoms if geometry.geom_type == "MultiLineString" else [geometry]
    total = 0.0
    for line in lines:
        points = list(line.coords)
        total += sum(haversine_km(points[i], points[i + 1]) for i in range(len(points) - 1))
    return total


def merge_ways(way_elements: list[dict], simplify_tolerance: float):
    lines = [LineString(points) for element in way_elements if len(points := coordinates(element.get("geometry") or [])) >= 2]
    if not lines:
        return None
    merged = linemerge(lines) if len(lines) > 1 else lines[0]
    if merged.is_empty:
        return None
    if simplify_tolerance > 0:
        # Long routes (e.g. multi-day trails) come from OSM at full survey density;
        # simplifying keeps shape at country-map zoom while cutting file size ~90%.
        merged = merged.simplify(simplify_tolerance, preserve_topology=False)
    return None if merged.is_empty else merged


def source_links(kind: str, osm_id: int, tags: dict) -> list[dict]:
    links = [{"label": "OpenStreetMap", "url": f"https://www.openstreetmap.org/{kind}/{osm_id}"}]
    wiki = wikipedia_from_tag(tags.get("wikipedia"))
    if wiki:
        lang, title = wiki
        links.append({"label": f"Wikipedia ({lang})", "url": f"https://{lang}.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}"})
    return links


def collect(country_elements: dict[str, dict], countries: list[str], query_fn, endpoint: str) -> dict:
    """Fetch elements per country and merge duplicates (border-crossing features), unioning their countries."""
    merged: dict[int, dict] = {}
    for country in countries:
        print(f"Overpass: duke kërkuar në {COUNTRIES[country]}…")
        payload = query_overpass(country, query_fn, endpoint)
        elements = payload.get("elements", [])
        print(f"Overpass {country}: {len(elements)} elemente")
        for element in elements:
            if not (element.get("tags") or {}).get("name"):
                continue
            entry = merged.setdefault(element["id"], {"element": element, "countries": set()})
            entry["countries"].add(country)
    return merged


def river_features(elements: dict[int, dict], simplify_tolerance: float) -> list[dict]:
    groups: dict[str, list[dict]] = defaultdict(list)
    countries_by_name: dict[str, set] = defaultdict(set)
    for entry in elements.values():
        tags = entry["element"]["tags"]
        name = (tags.get("name:sq") or tags["name"]).strip()
        key = name.casefold()
        groups[key].append(entry["element"])
        countries_by_name[key] |= entry["countries"]
    features = []
    for key, way_elements in groups.items():
        geometry = merge_ways(way_elements, simplify_tolerance)
        if geometry is None:
            continue
        tags = way_elements[0]["tags"]
        name = (tags.get("name:sq") or tags["name"]).strip()
        countries = countries_by_name[key]
        country_label = ", ".join(COUNTRIES[code] for code in sorted(countries))
        length_km = round(line_length_km(geometry))
        properties = {
            "name": name, "category": "lumenj", "categoryLabel": "Lum",
            "location": country_label, "countryCodes": sorted(countries),
            "summary": f"Lumi {name} në {country_label}. Vija ndjek {len(way_elements)} segmente të hartëzuara në OpenStreetMap, gjatësi e hartëzuar ~{length_km} km.",
            "details": [], "mapNote": "Vija ndjek shtratin e lumit sipas segmenteve të hartëzuara në OpenStreetMap; mund të jetë e paplotë aty ku mungojnë segmente.",
            "geometryType": geometry.geom_type,
            "sources": source_links("way", way_elements[0]["id"], tags),
            "extra": {"Gjatësia e hartëzuar": f"~{length_km} km", "Segmente": str(len(way_elements))},
            "osm": {"type": "way", "id": way_elements[0]["id"], "tags": {k: tags[k] for k in ("waterway", "wikidata", "wikipedia") if k in tags}},
        }
        features.append({"type": "Feature", "id": f'lumi-{way_elements[0]["id"]}', "geometry": mapping(geometry), "properties": properties})
    return features


def trail_features(elements: dict[int, dict], simplify_tolerance: float) -> list[dict]:
    features = []
    for entry in elements.values():
        element = entry["element"]
        geometry = merge_ways(element.get("members", []), simplify_tolerance)
        if geometry is None:
            continue
        tags = element["tags"]
        name = (tags.get("name:sq") or tags["name"]).strip()
        countries = entry["countries"]
        country_label = ", ".join(COUNTRIES[code] for code in sorted(countries))
        length_km = round(line_length_km(geometry))
        extra = {"Gjatësia e hartëzuar": f"~{length_km} km"}
        if tags.get("sac_scale") in SAC_SCALE_LABELS:
            extra["Vështirësia"] = SAC_SCALE_LABELS[tags["sac_scale"]]
        if tags.get("network") in NETWORK_LABELS:
            extra["Rrjeti"] = NETWORK_LABELS[tags["network"]]
        if tags.get("ref"):
            extra["Referenca"] = tags["ref"]
        summary = (tags.get("description:sq") or tags.get("description") or f"Shteg ecjeje në {country_label}. Itinerari vjen nga OpenStreetMap.").strip()
        if len(summary) > 320:
            summary = summary[:317].rsplit(" ", 1)[0] + "…"
        properties = {
            "name": name, "category": "shtigje", "categoryLabel": "Shteg ecjeje",
            "location": country_label, "countryCodes": sorted(countries),
            "summary": summary, "details": [],
            "mapNote": "Vija ndjek itinerarin e shënuar në OpenStreetMap; kontrollo gjithmonë shenjëzimin në terren para se të ecësh.",
            "geometryType": geometry.geom_type,
            "sources": source_links("relation", element["id"], tags), "extra": extra,
            "osm": {"type": "relation", "id": element["id"], "tags": {k: tags[k] for k in ("route", "network", "sac_scale", "operator", "wikidata", "wikipedia") if k in tags}},
        }
        features.append({"type": "Feature", "id": f'shteg-{element["id"]}', "geometry": mapping(geometry), "properties": properties})
    return features


def write_layers(features: list[dict], data_dir: Path) -> None:
    import json

    group_dir, manual_dir = data_dir / "groups", data_dir / "manual"
    group_dir.mkdir(parents=True, exist_ok=True)
    manual_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = data_dir / "groups.json"
    existing = json.loads(manifest_path.read_text()) if manifest_path.exists() else {"groups": []}
    existing_groups = {group["id"]: group for group in existing.get("groups", []) if isinstance(group, dict) and "id" in group}
    manifest_groups = []
    inserted = False
    for group in existing.get("groups", []):
        if group["id"] in GROUPS:
            continue
        manifest_groups.append(group)
        if group["id"] == "rezervate" and not inserted:
            for group_id, config in GROUPS.items():
                previous = existing_groups.get(group_id, {})
                selected = [feature for feature in features if feature["properties"]["category"] == group_id]
                path = group_dir / f"{group_id}.geojson"
                path.write_text(json.dumps({"type": "FeatureCollection", "features": selected}, ensure_ascii=False, indent=2) + "\n")
                manual_path = manual_dir / f"{group_id}.geojson"
                if not manual_path.exists():
                    manual_path.write_text('{"type":"FeatureCollection","features":[]}\n')
                manifest_groups.append({"id": group_id, **config, **{k: v for k, v in previous.items() if k not in ("id", "label", "color")}, "files": [f"/data/groups/{group_id}.geojson", f"/data/manual/{group_id}.geojson"]})
                print(f"{group_id}: {len(selected)} veçori")
            inserted = True
    if not inserted:
        for group_id, config in GROUPS.items():
            previous = existing_groups.get(group_id, {})
            selected = [feature for feature in features if feature["properties"]["category"] == group_id]
            path = group_dir / f"{group_id}.geojson"
            path.write_text(json.dumps({"type": "FeatureCollection", "features": selected}, ensure_ascii=False, indent=2) + "\n")
            manual_path = manual_dir / f"{group_id}.geojson"
            if not manual_path.exists():
                manual_path.write_text('{"type":"FeatureCollection","features":[]}\n')
            manifest_groups.append({"id": group_id, **config, **{k: v for k, v in previous.items() if k not in ("id", "label", "color")}, "files": [f"/data/groups/{group_id}.geojson", f"/data/manual/{group_id}.geojson"]})
            print(f"{group_id}: {len(selected)} veçori")
    manifest_path.write_text(json.dumps({"groups": manifest_groups}, ensure_ascii=False, indent=2) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--countries", nargs="+", default=["AL", "XK"], choices=list(COUNTRIES))
    parser.add_argument("--overpass-url", default=OVERPASS_URL)
    parser.add_argument("--output-dir", type=Path, default=DATA_DIR)
    parser.add_argument("--simplify-tolerance", type=float, default=0.0003, help="Degrees; 0 disables simplification")
    args = parser.parse_args()
    try:
        rivers = collect({}, args.countries, river_query, args.overpass_url)
        trails = collect({}, args.countries, trail_query, args.overpass_url)
        features = river_features(rivers, args.simplify_tolerance) + trail_features(trails, args.simplify_tolerance)
        if not features:
            raise ValueError("No river or trail features received")
        write_layers(features, args.output_dir)
        print(f"Wrote {len(features)} river/trail features to {args.output_dir}")
    except Exception as error:
        print(f"Extraction failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
