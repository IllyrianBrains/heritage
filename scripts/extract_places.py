#!/usr/bin/env python3
"""Build grouped GeoJSON layers from named OpenStreetMap features via Overpass.

Only OSM objects with a useful name and a heritage/historic/nature tag are
considered. Wikipedia enrichment is optional and never blocks the OSM import.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from collections import Counter
from pathlib import Path

from geometry import osm_geometry
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlparse
from urllib.request import Request, urlopen

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
USER_AGENT = "heritage-map-importer/0.1 (https://github.com/pomodoren/heritage)"
DATA_DIR = Path(__file__).resolve().parents[1] / "public/data"
GROUPS = {"historike": {"label": "Historike", "color": "#b46447"}, "kulture": {"label": "Kulturë", "color": "#795987"}, "natyre": {"label": "Natyrë", "color": "#31816f"}}
HISTORIC_TYPES = "archaeological_site|castle|fort|monument|ruins|city_gate|tomb|battlefield"
CATEGORY_LABELS = {
    "historike": "Vend historik",
    "kulture": "Kulturë dhe muze",
    "natyre": "Zonë natyrore",
}
TYPE_LABELS = {
    "archaeological_site": "Vend arkeologjik",
    "castle": "Kala",
    "fort": "Fortifikim",
    "monument": "Monument",
    "ruins": "Rrënoja",
    "city_gate": "Portë historike",
    "tomb": "Varrezë historike",
    "battlefield": "Fushëbetejë historike",
}


def overpass_query(country: str) -> str:
    if not re.fullmatch(r"[A-Z]{2}", country):
        raise ValueError("Country must be a two-letter ISO code")
    return f'''[out:json][timeout:120];
area["ISO3166-1"="{country}"][admin_level=2]->.country;
(
  nwr["historic"~"^({HISTORIC_TYPES})$"]["name"](area.country);
  nwr["tourism"="museum"]["name"](area.country);
  nwr["heritage"]["name"](area.country);
  nwr["leisure"="nature_reserve"]["name"](area.country);
  nwr["boundary"="national_park"]["name"](area.country);
);
out center tags;'''


def request_json(url: str, *, data: bytes | None = None, timeout: int = 60) -> dict:
    request = Request(
        url,
        data=data,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
        },
        method="POST" if data is not None else "GET",
    )
    with urlopen(request, timeout=timeout) as response:
        return json.load(response)


def fetch_overpass(country: str, endpoint: str) -> dict:
    payload = urlencode({"data": overpass_query(country)}).encode("utf-8")
    return request_json(endpoint, data=payload, timeout=180)


def safe_url(value: str | None) -> str:
    if not value:
        return ""
    value = value.strip().split(";")[0].strip()
    parsed = urlparse(value)
    return value if parsed.scheme in ("http", "https") and parsed.netloc else ""


def wikipedia_from_tag(value: str | None) -> tuple[str, str] | None:
    if not value:
        return None
    value = value.split(";")[0].strip()
    match = re.fullmatch(r"([a-z][a-z\-]{1,11}):(.+)", value)
    if match:
        return match.group(1), match.group(2).replace("_", " ")
    parsed = urlparse(value)
    if parsed.scheme == "https" and parsed.hostname and parsed.hostname.endswith(".wikipedia.org") and parsed.path.startswith("/wiki/"):
        return parsed.hostname.split(".")[0], parsed.path.removeprefix("/wiki/").replace("_", " ")
    return None


def label_for(tags: dict) -> tuple[str, str]:
    if tags.get("leisure") == "nature_reserve" or tags.get("boundary") == "national_park":
        return "natyre", "Rezervat natyror" if tags.get("leisure") == "nature_reserve" else "Park kombëtar"
    if tags.get("tourism") == "museum":
        return "kulture", "Muze"
    historic = tags.get("historic", "")
    if historic in TYPE_LABELS:
        return "historike", TYPE_LABELS[historic]
    return "kulture", "Objekt i trashëgimisë"


def candidate(element: dict, country: str = "AL") -> dict | None:
    tags = element.get("tags") or {}
    name = (tags.get("name:sq") or tags.get("name") or "").strip()
    coordinates = element.get("center") or element
    lat, lon = coordinates.get("lat"), coordinates.get("lon")
    if not name or lat is None or lon is None or element.get("type") not in ("node", "way", "relation"):
        return None
    if tags.get("disused") == "yes" or tags.get("abandoned") == "yes":
        return None
    category, label = label_for(tags)
    wiki = wikipedia_from_tag(tags.get("wikipedia"))
    source_url = f'https://www.openstreetmap.org/{element["type"]}/{element["id"]}'
    region = tags.get("addr:city") or tags.get("addr:place") or tags.get("is_in:city") or tags.get("addr:county") or tags.get("is_in") or "Pa adresë në OSM"
    summary = (tags.get("description:sq") or "").strip()
    if not summary:
        summary = f"{label}. Të dhënat për këtë vend vijnë nga OpenStreetMap."
    if len(summary) > 320:
        summary = summary[:317].rsplit(" ", 1)[0] + "…"
    links = [{"label": "OpenStreetMap", "url": source_url}]
    if wiki:
        lang, title = wiki
        links.append({"label": f"Wikipedia ({lang})", "url": f"https://{lang}.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}"})
    for key, text in (("heritage:website", "Regjistri i trashëgimisë"), ("website", "Faqja e vendit"), ("source:website", "Burim tjetër")):
        url = safe_url(tags.get(key))
        if url and url not in {item["url"] for item in links}:
            links.append({"label": text, "url": url})
    score = (
        5 * bool(wiki)
        + 3 * bool(tags.get("heritage"))
        + 2 * bool(tags.get("wikidata"))
        + 2 * bool(tags.get("heritage:website") or tags.get("website"))
        + bool(tags.get("description:sq") or tags.get("description"))
        + (3 if element["type"] == "relation" else 2 if element["type"] == "way" else 0)
    )
    return {
        "id": f'osm-{element["type"]}-{element["id"]}',
        "name": name,
        "category": category,
        "categoryLabel": label,
        "location": region,
        "latitude": round(float(lat), 6),
        "longitude": round(float(lon), 6),
        "summary": summary,
        "details": ([tags["description"]] if tags.get("description") and not tags.get("description:sq") else []),
        "mapNote": "Pika është koordinata e objektit OSM." if element["type"] == "node" else "Pika është qendra e gjeometrisë OSM; nuk tregon kufirin e objektit.",
        "sources": links,
        "osm": {"type": element["type"], "id": element["id"], "tags": {key: tags[key] for key in ("historic", "heritage", "heritage:operator", "tourism", "leisure", "boundary", "wikidata", "wikipedia") if key in tags}},
        "_wiki": wiki,
        "_score": score,
    }


def select_candidates(elements: list[dict], limit: int, country: str = "AL") -> list[dict]:
    candidates = [item for element in elements if (item := candidate(element, country))]
    # One place is often mapped as both a point and a polygon. Prefer the
    # better sourced object; a shared Wikidata ID is the strongest match.
    candidates.sort(key=lambda item: (-item["_score"], item["name"].casefold(), item["id"]))
    unique: list[dict] = []
    seen = set()
    per_category = Counter()
    category_cap = max(1, (limit + 2) // 3)
    for item in candidates:
        wikidata = item["osm"]["tags"].get("wikidata")
        key = ("wikidata", wikidata) if wikidata else ("name", item["name"].casefold(), item["category"], round(item["latitude"], 2), round(item["longitude"], 2))
        if key in seen or per_category[item["category"]] >= category_cap:
            continue
        seen.add(key)
        unique.append(item)
        per_category[item["category"]] += 1
        if len(unique) >= limit:
            break
    unique.sort(key=lambda item: (item["category"], item["name"].casefold()))
    return unique


def enrich_wikipedia(records: list[dict], maximum: int) -> None:
    fetched = 0
    for item in records:
        if not item["_wiki"] or fetched >= maximum:
            continue
        lang, title = item["_wiki"]
        url = f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{quote(title.replace(' ', '_'))}"
        try:
            page = request_json(url, timeout=20)
            extract = (page.get("extract") or "").strip()
            if extract and page.get("type") != "disambiguation":
                item["details"] = [extract[:1200]]
                if lang == "sq":
                    item["summary"] = (extract[:280].rsplit(" ", 1)[0] + "…") if len(extract) > 280 else extract
                item["wikipediaAttribution"] = f"Përmbledhje nga Wikipedia ({lang}); shiko licencën dhe autorët në artikull."
            fetched += 1
            time.sleep(0.15)
        except (HTTPError, URLError, TimeoutError, ValueError) as error:
            print(f"Wikipedia skipped for {item['id']}: {error}", file=sys.stderr)
            # If the API is inaccessible, do not repeat a failing request.
            if isinstance(error, (URLError, TimeoutError)) or getattr(error, "code", 0) in (403, 429):
                break


def geometry_query(records: list[dict]) -> str:
    by_type = {"node": [], "way": [], "relation": []}
    for item in records:
        osm = item["osm"]
        by_type[osm["type"]].append(str(osm["id"]))
    statements = [f'{"rel" if kind == "relation" else kind}(id:{",".join(ids)});' for kind, ids in by_type.items() if ids]
    return "[out:json][timeout:180];(" + "".join(statements) + ");out geom;"


def fetch_geometry(records: list[dict], endpoint: str, batch_size: int = 25) -> dict:
    output = {}
    for start in range(0, len(records), batch_size):
        batch = records[start:start + batch_size]
        payload = urlencode({"data": geometry_query(batch)}).encode("utf-8")
        for attempt in range(5):
            try:
                response = request_json(endpoint, data=payload, timeout=240)
                break
            except HTTPError as error:
                if error.code not in (429, 502, 503, 504) or attempt == 4:
                    raise
                delay = 20 * (attempt + 1)
                print(f"Overpass HTTP {error.code}; retrying in {delay}s", file=sys.stderr)
                time.sleep(delay)
        for element in response.get("elements", []):
            output[(element["type"], element["id"])] = element
        print(f"Geometry: {min(start + batch_size, len(records))}/{len(records)}", file=sys.stderr)
        if start + batch_size < len(records):
            time.sleep(5)
    return output


def to_feature(item: dict, osm_element: dict | None) -> dict:
    geometry, note = osm_geometry(osm_element, item["latitude"], item["longitude"])
    properties = {key: value for key, value in item.items() if not key.startswith("_") and key != "mapNote"}
    properties["mapNote"] = note
    properties["geometryType"] = geometry["type"]
    return {"type": "Feature", "id": item["id"], "geometry": geometry, "properties": properties}


def write_layers(records: list[dict], geometries: dict, data_dir: Path) -> None:
    group_dir = data_dir / "groups"
    group_dir.mkdir(parents=True, exist_ok=True)
    manual_dir = data_dir / "manual"
    manual_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = data_dir / "groups.json"
    if manifest_path.exists():
        existing = json.loads(manifest_path.read_text())
        existing_groups = {group["id"]: group for group in existing.get("groups", []) if isinstance(group, dict) and "id" in group}
    else:
        existing_groups = {}
    manifest = {"groups": []}
    for group_id, config in GROUPS.items():
        features = []
        for item in records:
            if item["category"] != group_id:
                continue
            osm = item["osm"]
            features.append(to_feature(item, geometries.get((osm["type"], osm["id"]))))
        generated_name = f"groups/{group_id}.geojson"
        manual_name = f"manual/{group_id}.geojson"
        target = data_dir / generated_name
        document = {"type": "FeatureCollection", "features": features}
        staged = target.with_suffix(".tmp")
        staged.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n")
        staged.replace(target)
        manual_path = data_dir / manual_name
        if not manual_path.exists():
            manual_path.write_text(json.dumps({"type": "FeatureCollection", "features": []}, ensure_ascii=False, indent=2) + "\n")
        previous = existing_groups.pop(group_id, {})
        required_files = [f"/data/{generated_name}", f"/data/{manual_name}"]
        extra_files = [file for file in previous.get("files", []) if file not in required_files]
        manifest["groups"].append({"id": group_id, **config, **previous, "files": required_files + extra_files})
        counts = Counter(feature["geometry"]["type"] for feature in features)
        print(f"{group_id}: {len(features)} features {dict(counts)}")
    manifest["groups"].extend(existing_groups.values())
    staged = manifest_path.with_suffix(".tmp")
    staged.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    staged.replace(manifest_path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--country", default="AL", help="ISO 3166-1 country code (default: AL)")
    parser.add_argument("--input", type=Path, help="Read a saved Overpass discovery response")
    parser.add_argument("--records", type=Path, help="Reuse an existing places.json instead of discovering places again")
    parser.add_argument("--geometry-input", type=Path, help="Read a saved Overpass geometry response instead of querying it")
    parser.add_argument("--output-dir", type=Path, default=DATA_DIR, help="Directory for groups.json, groups/, and manual/")
    parser.add_argument("--limit", type=int, default=120, help="Maximum total records (balanced across categories)")
    parser.add_argument("--wikipedia-limit", type=int, default=35, help="Maximum Wikipedia summary requests; 0 disables enrichment")
    parser.add_argument("--overpass-url", default=OVERPASS_URL)
    args = parser.parse_args()
    if args.limit < 1 or args.wikipedia_limit < 0:
        parser.error("--limit must be positive and --wikipedia-limit cannot be negative")
    try:
        if args.records:
            records = json.loads(args.records.read_text())[:args.limit]
        else:
            payload = json.loads(args.input.read_text()) if args.input else fetch_overpass(args.country.upper(), args.overpass_url)
            if "elements" not in payload or not isinstance(payload["elements"], list):
                raise ValueError("Overpass response has no elements list")
            records = select_candidates(payload["elements"], args.limit, args.country.upper())
            if args.wikipedia_limit:
                enrich_wikipedia(records, args.wikipedia_limit)
        if not records:
            raise ValueError("No places found; existing output was left untouched")
        if args.geometry_input:
            response = json.loads(args.geometry_input.read_text())
            geometries = {(element["type"], element["id"]): element for element in response.get("elements", [])}
        else:
            geometries = fetch_geometry(records, args.overpass_url)
    except (HTTPError, URLError, TimeoutError, ValueError, OSError, KeyError) as error:
        print(f"Could not prepare map data: {error}", file=sys.stderr)
        return 1
    for item in records:
        item.pop("_score", None)
        item.pop("_wiki", None)
    write_layers(records, geometries, args.output_dir)
    print(f"Wrote {len(records)} places to {args.output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
