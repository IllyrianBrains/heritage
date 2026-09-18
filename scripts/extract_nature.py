#!/usr/bin/env python3
"""Extract natural heritage boundaries from OSM and species observations from GBIF."""
from __future__ import annotations

import argparse
import json
import sys
import hashlib
import re
from collections import Counter
from pathlib import Path
from urllib.parse import urlencode
from urllib.parse import urlparse
from urllib.error import HTTPError
from shapely.geometry import Point, shape

from extract_places import DATA_DIR, OVERPASS_URL, fetch_geometry, request_json
from geometry import osm_geometry

GROUPS = {
    "parqe": {"label": "Parqe kombëtare", "color": "#1f7a52"},
    "mbrojtura": {"label": "Zona të mbrojtura", "color": "#2f9e6b"},
    "rezervate": {"label": "Rezervate natyrore", "color": "#4caf7d"},
    "flora": {"label": "Flora", "color": "#789f43"},
    "fauna": {"label": "Fauna", "color": "#bd7848"},
}
# OSM boundary/leisure tags mapped to the group id whose GeoJSON file they belong in.
AREA_CATEGORIES = {("boundary", "national_park"): "parqe", ("boundary", "protected_area"): "mbrojtura", ("leisure", "nature_reserve"): "rezervate"}
COUNTRIES = {"AL": "Shqipëri", "XK": "Kosovë"}
# English names for Nominatim's structured search; querying the native names with
# the free-text "q" parameter can rank an unrelated place higher than the country itself.
NOMINATIM_COUNTRY_NAMES = {"AL": "Albania", "XK": "Kosovo"}
BBOXES = {"AL": "39.62,19.25,42.67,21.10", "XK": "41.90,20.00,43.27,21.80"}
GBIF_URL = "https://api.gbif.org/v1/occurrence/search"
# IUCN protection categories, as tagged on OSM boundary=protected_area via protect_class.
PROTECT_CLASS_LABELS = {
    "1a": "Rezervat i rreptë natyror", "1b": "Zonë e egër", "2": "Park kombëtar",
    "3": "Monument natyror", "4": "Zonë menaxhimi habitati/specie",
    "5": "Peizazh i mbrojtur", "6": "Zonë e mbrojtur burimesh",
}


def gbif_image(record: dict) -> dict | None:
    options = []
    for media in record.get("media") or []:
        identifier = media.get("identifier", "")
        media_type = (media.get("type") or "").lower()
        licence = (media.get("license") or "").lower()
        if media_type not in ("stillimage", "image") or urlparse(identifier).scheme not in ("http", "https"):
            continue
        allowed = ("creativecommons.org/publicdomain/zero", "creativecommons.org/licenses/by/", "creativecommons.org/licenses/by-sa/", "creativecommons.org/licenses/by-nc/", "creativecommons.org/licenses/by-nc-sa/")
        if not any(mark in licence for mark in allowed):
            continue
        options.append((int("/by-nc" in licence), media))
    for _, media in sorted(options, key=lambda item: item[0]):
        identifier = media["identifier"]
        licence = media["license"]
        digest = hashlib.md5(identifier.encode("utf-8")).hexdigest()
        reference = media.get("references") or ""
        source = reference if urlparse(reference).scheme in ("http", "https") else f'https://www.gbif.org/occurrence/{record["key"]}'
        match = re.search(r"creativecommons.org/licenses/([^/]+)/([0-9.]+)/?", licence)
        license_name = f"CC {match.group(1).upper()} {match.group(2)}" if match else "CC0"
        return {
            "url": f'https://api.gbif.org/v1/image/cache/800x/occurrence/{record["key"]}/media/{digest}',
            "source": source,
            "credit": media.get("creator") or media.get("rightsHolder") or record.get("rightsHolder") or record.get("datasetName") or "GBIF contributor",
            "license": license_name, "licenseUrl": licence, "alt": record.get("species") or "Fotografi e vëzhgimit",
        }
    return None


def overpass_query(country: str) -> str:
    if country not in COUNTRIES:
        raise ValueError(f"Unsupported country: {country}")
    bbox = BBOXES[country]
    return f'''[out:json][timeout:45];
(
  relation["boundary"="national_park"]["name"]({bbox});
  way["boundary"="national_park"]["name"]({bbox});
  relation["boundary"="protected_area"]["name"]({bbox});
  way["boundary"="protected_area"]["name"]({bbox});
  relation["leisure"="nature_reserve"]["name"]({bbox});
  way["leisure"="nature_reserve"]["name"]({bbox});
);
out center tags;'''


def osm_records(endpoint: str, countries: list[str], limit: int) -> tuple[list[dict], dict]:
    from extract_places import request_json
    candidates = {}
    for country in countries:
        print(f"Nominatim: duke kërkuar kufirin e {COUNTRIES[country]}…")
        params = urlencode({"country": NOMINATIM_COUNTRY_NAMES[country], "format": "geojson", "polygon_geojson": 1, "limit": 1})
        boundary_response = request_json(f"https://nominatim.openstreetmap.org/search?{params}", timeout=45)
        boundary_matches = [feature for feature in boundary_response.get("features", []) if feature.get("geometry", {}).get("type") in ("Polygon", "MultiPolygon")]
        if not boundary_matches:
            raise ValueError(f"No country boundary from Nominatim for {country}")
        boundary = shape(boundary_matches[0]["geometry"])
        print(f"Overpass: duke kërkuar parqe, zona të mbrojtura, rezervate dhe florë të etiketuar në {COUNTRIES[country]} (deri në 240s)…")
        try:
            payload = request_json(endpoint, data=urlencode({"data": overpass_query(country)}).encode(), timeout=240)
        except HTTPError as error:
            raise ValueError(f"Overpass {country}: HTTP {error.code}: {error.read().decode('utf-8', 'replace')[:700]}") from error
        elements = payload.get("elements", [])
        new_in_country = 0
        for element in elements:
            tags = element.get("tags") or {}
            center = element.get("center") or element
            if not tags.get("name") or center.get("lat") is None or center.get("lon") is None:
                continue
            if not boundary.covers(Point(center["lon"], center["lat"])):
                continue
            key = (element["type"], element["id"])
            if tags.get("species") or tags.get("taxon"):
                category = "flora"
            else:
                category = next((value for (tag_key, tag_value), value in AREA_CATEGORIES.items() if tags.get(tag_key) == tag_value), "mbrojtura")
            if key in candidates:
                candidates[key]["countries"].add(country)
                continue
            candidates[key] = {"element": element, "category": category, "countries": {country}}
            new_in_country += 1
        print(f"Overpass {country}: {len(elements)} elemente të kthyera, {new_in_country} brenda kufirit të vendit")
    print(f"OSM: {len(candidates)} kandidatë gjithsej; duke renditur dhe zgjedhur deri në {limit}…")
    ranked_all = sorted(candidates.values(), key=lambda item: (
        item["category"] == "flora",
        item["element"]["type"] == "node",
        -int(bool(item["element"].get("tags", {}).get("wikipedia"))),
        item["element"]["tags"]["name"].casefold(),
    ))
    zones = [item for item in ranked_all if item["category"] != "flora"]
    flora = [item for item in ranked_all if item["category"] == "flora"]
    ranked = zones[: max(1, limit * 2 // 3)] + flora[: max(1, limit // 3)]
    if len(ranked) < limit:
        chosen = {(item["element"]["type"], item["element"]["id"]) for item in ranked}
        ranked.extend(item for item in ranked_all if (item["element"]["type"], item["element"]["id"]) not in chosen and len(ranked) < limit)
    print(f"OSM: {len(ranked)} objekte të zgjedhura; duke marrë gjeometrinë nga Overpass…")
    geometry_records = [{"osm": {"type": item["element"]["type"], "id": item["element"]["id"]}} for item in ranked]
    geometries = fetch_geometry(geometry_records, endpoint)
    return ranked, geometries


def osm_feature(item: dict, geometries: dict) -> dict:
    element = item["element"]
    tags = element["tags"]
    center = element.get("center") or element
    geometry, note = osm_geometry(geometries.get((element["type"], element["id"])), center["lat"], center["lon"])
    category = item["category"]
    kind = (
        "Park kombëtar" if tags.get("boundary") == "national_park"
        else PROTECT_CLASS_LABELS.get(tags.get("protect_class"), "Zonë e mbrojtur") if tags.get("boundary") == "protected_area"
        else "Rezervat natyror" if tags.get("leisure") == "nature_reserve"
        else "Pyje dhe bimësi"
    )
    if category == "flora":
        kind = "Flora e hartëzuar në OSM"
    countries = ", ".join(COUNTRIES[code] for code in sorted(item["countries"]))
    source = f'https://www.openstreetmap.org/{element["type"]}/{element["id"]}'
    links = [{"label": "OpenStreetMap", "url": source}]
    wiki = tags.get("wikipedia", "")
    if ":" in wiki and not wiki.startswith("http"):
        language, title = wiki.split(":", 1)
        from urllib.parse import quote
        links.append({"label": "Wikipedia", "url": f"https://{language}.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}"})
    properties = {
        "name": tags.get("name:sq") or tags["name"], "category": category,
        "categoryLabel": kind, "location": countries, "countryCodes": sorted(item["countries"]),
        "summary": tags.get("description:sq") or tags.get("description") or f"{kind} në {countries}; kufiri dhe të dhënat vijnë nga OpenStreetMap.",
        "details": [], "mapNote": note, "geometryType": geometry["type"], "sources": links,
        "osm": {"type": element["type"], "id": element["id"], "tags": {key: tags[key] for key in ("boundary", "leisure", "natural", "species", "taxon", "protect_class", "wikidata") if key in tags}},
    }
    return {"type": "Feature", "id": f'osm-{element["type"]}-{element["id"]}', "geometry": geometry, "properties": properties}


def gbif_features(country: str, kingdom_key: int, category: str, limit: int) -> list[dict]:
    print(f"GBIF: duke kërkuar deri në {limit} vëzhgime {category} në {COUNTRIES[country]}…")
    parameters = {"country": country, "kingdomKey": kingdom_key, "hasCoordinate": "true", "hasGeospatialIssue": "false", "occurrenceStatus": "PRESENT", "taxonRank": "SPECIES", "limit": min(limit, 300)}
    query = urlencode(parameters)
    payload = request_json(f"{GBIF_URL}?{query}", timeout=90)
    photo_query = urlencode({**parameters, "mediaType": "StillImage"})
    photo_payload = request_json(f"{GBIF_URL}?{photo_query}", timeout=90)
    features = []
    seen = set()
    for record, image_only in ([(item, False) for item in payload.get("results", [])] + [(item, True) for item in photo_payload.get("results", [])]):
        if image_only and not gbif_image(record):
            continue
        lon, lat = record.get("decimalLongitude"), record.get("decimalLatitude")
        species = record.get("species")
        if lon is None or lat is None or not species or not (-180 <= lon <= 180 and -90 <= lat <= 90):
            continue
        # One visible observation per species and rounded location avoids a dense stack.
        signature = (species, round(lon, 2), round(lat, 2))
        if signature in seen:
            continue
        seen.add(signature)
        date = (record.get("eventDate") or "").split("T")[0]
        source = f'https://www.gbif.org/occurrence/{record["key"]}'
        locality = record.get("locality") or record.get("stateProvince") or COUNTRIES[country]
        licence = record.get("license") or "Shiko licencën në GBIF"
        properties = {
            "name": species, "category": category, "categoryLabel": "Vëzhgim flore" if category == "flora" else "Vëzhgim faune",
            "location": f"{locality}, {COUNTRIES[country]}", "countryCodes": [country],
            "summary": f"Vëzhgim i {species}" + (f" më {date}" if date else "") + f" në {COUNTRIES[country]}. Të dhënat nga GBIF.",
            "details": ["Një regjistrim i pranishmërisë së llojit; pika nuk paraqet shtrirjen e habitatit."],
            "mapNote": "Koordinata e vëzhgimit nga GBIF; saktësia dhe origjina kontrollohen te regjistrimi burimor.",
            "geometryType": "Point", "sources": [{"label": "GBIF · regjistrimi dhe licenca", "url": source}],
            "extra": {"Lloji": species, "Data": date or "E panjohur", "Licenca": licence, "Burimi": record.get("datasetName") or "GBIF"},
        }
        image = gbif_image(record)
        if image:
            properties["image"] = image
        features.append({"type": "Feature", "id": f'gbif-{record["key"]}', "geometry": {"type": "Point", "coordinates": [lon, lat]}, "properties": properties})
    print(f"GBIF {country}/{category}: {len(features)} vëzhgime unike")
    return features


def write_layers(features: list[dict], data_dir: Path, group_ids: list[str] | None = None) -> None:
    """Write one GeoJSON per group. Groups outside `group_ids` (default: all of them)
    are left untouched on disk, and their existing groups.json entry is preserved as-is."""
    group_dir, manual_dir = data_dir / "groups", data_dir / "manual"
    group_dir.mkdir(parents=True, exist_ok=True)
    manual_dir.mkdir(parents=True, exist_ok=True)
    existing_path = data_dir / "groups.json"
    existing = json.loads(existing_path.read_text()) if existing_path.exists() else {"groups": []}
    active_ids = list(GROUPS) if group_ids is None else group_ids
    skipped_ids = set(GROUPS) - set(active_ids)
    custom = [group for group in existing.get("groups", []) if group.get("id") not in GROUPS and group.get("id") not in ("historike", "kulture", "natyre", "zona")]
    preserved = [group for group in existing.get("groups", []) if group.get("id") in skipped_ids]
    groups = []
    for group_id in active_ids:
        config = GROUPS[group_id]
        path = group_dir / f"{group_id}.geojson"
        selected = [feature for feature in features if feature["properties"]["category"] == group_id]
        path.write_text(json.dumps({"type": "FeatureCollection", "features": selected}, ensure_ascii=False, indent=2) + "\n")
        manual_path = manual_dir / f"{group_id}.geojson"
        if not manual_path.exists():
            manual_path.write_text('{"type":"FeatureCollection","features":[]}\n')
        groups.append({"id": group_id, **config, "files": [f"/data/groups/{group_id}.geojson", f"/data/manual/{group_id}.geojson"]})
        print(f"{group_id}: {len(selected)} {dict(Counter(f['geometry']['type'] for f in selected))}")
    existing_path.write_text(json.dumps({"groups": groups + preserved + custom}, ensure_ascii=False, indent=2) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--countries", nargs="+", default=["AL", "XK"], choices=list(COUNTRIES))
    parser.add_argument("--osm-limit", type=int, default=100)
    parser.add_argument("--gbif-limit", type=int, default=100, help="Maximum fetched observations per kingdom and country")
    parser.add_argument("--overpass-url", default=OVERPASS_URL)
    parser.add_argument("--reuse-osm", type=Path, help="Use an existing OSM GeoJSON layer when Overpass is unavailable")
    parser.add_argument("--skip-osm", action="store_true", help="Refresh GBIF observations without querying Overpass")
    parser.add_argument("--skip-gbif", action="store_true", help="Fetch only the OSM/Overpass boundary layers, without querying GBIF")
    parser.add_argument("--output-dir", type=Path, default=DATA_DIR)
    args = parser.parse_args()
    try:
        if args.skip_osm:
            print("OSM: duke anashkaluar Overpass; ruhen shtresat ekzistuese parqe/mbrojtura/rezervate.")
            features = []
            for group_id in ("parqe", "mbrojtura", "rezervate"):
                old_layer = args.output_dir / f"groups/{group_id}.geojson"
                if old_layer.exists():
                    layer_features = json.loads(old_layer.read_text()).get("features", [])
                    print(f"OSM: {len(layer_features)} objekte ekzistuese të ripërdorura nga {old_layer.name}")
                    features.extend(layer_features)
        elif args.reuse_osm:
            print(f"OSM: duke ripërdorur shtresën nga {args.reuse_osm}")
            existing = json.loads(args.reuse_osm.read_text())
            features = []
            for feature in existing.get("features", []):
                properties = feature.get("properties") or {}
                if not str(feature.get("id", "")).startswith("osm-"):
                    continue
                properties.update({"category": "mbrojtura", "categoryLabel": "Zonë e mbrojtur", "countryCodes": ["AL"]})
                feature["properties"] = properties
                features.append(feature)
            print(f"OSM: {len(features)} objekte të marra nga skedari i ripërdorur")
        else:
            print(f"OSM: duke nisur importin nga Overpass/Nominatim për {', '.join(args.countries)}…")
            items, geometries = osm_records(args.overpass_url, args.countries, args.osm_limit)
            features = [osm_feature(item, geometries) for item in items]
        if not args.skip_gbif:
            print(f"GBIF: duke nisur importin e vëzhgimeve për {', '.join(args.countries)}…")
            for country in args.countries:
                for kingdom, category in ((6, "flora"), (1, "fauna")):
                    try:
                        features.extend(gbif_features(country, kingdom, category, args.gbif_limit))
                    except Exception as error:
                        print(f"GBIF {country}/{category} skipped: {error}", file=sys.stderr)
        else:
            print("GBIF: duke anashkaluar (--skip-gbif).")
        if not features:
            raise ValueError("No natural heritage features received")
        print(f"Duke shkruar {len(features)} objekte gjithsej te {args.output_dir}…")
        group_ids = ["parqe", "mbrojtura", "rezervate"] if args.skip_gbif else None
        write_layers(features, args.output_dir, group_ids)
    except Exception as error:
        print(f"Extraction failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
