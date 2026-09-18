#!/usr/bin/env python3
"""Add a small set of named OSM park polygons through Nominatim when Overpass is busy."""
from __future__ import annotations

import json
import time
from pathlib import Path
from urllib.parse import urlencode

from extract_places import DATA_DIR, request_json

PARKS = [
    ("Bjeshkët e Nemuna National Park", "XK"),
    ("Sharri National Park", "XK"),
    ("Valbona Valley National Park", "AL"),
    ("Divjakë-Karavasta National Park", "AL"),
    ("Llogara National Park", "AL"),
    ("Theth National Park", "AL"),
    ("Dajti National Park", "AL"),
    ("Prespa National Park", "AL"),
    ("Shebenik-Jabllanicë National Park", "AL"),
    ("Vjosa Wild River National Park", "AL"),
]


def main() -> None:
    path = DATA_DIR / "groups/parqe.geojson"
    document = json.loads(path.read_text()) if path.exists() else {"type": "FeatureCollection", "features": []}
    by_id = {feature["id"]: feature for feature in document["features"]}
    for name, country in PARKS:
        if any(feature.get("properties", {}).get("name") == name for feature in by_id.values()):
            print(f"Skip (already imported): {name}")
            continue
        print(f"Nominatim: duke kërkuar {name}…")
        params = urlencode({"q": name, "countrycodes": country.lower(), "format": "geojson", "polygon_geojson": 1, "limit": 3})
        try:
            response = request_json(f"https://nominatim.openstreetmap.org/search?{params}", timeout=35)
            matches = [feature for feature in response.get("features", []) if feature.get("geometry", {}).get("type") in ("Polygon", "MultiPolygon")]
            if not matches:
                print(f"No polygon: {name}")
                continue
            match = matches[0]
            source = match["properties"]
            kind = source.get("osm_type", "relation")
            kind = {"R": "relation", "W": "way", "N": "node"}.get(kind, kind).lower()
            osm_id = source["osm_id"]
            record_id = f"osm-{kind}-{osm_id}"
            by_id[record_id] = {"type": "Feature", "id": record_id, "geometry": match["geometry"], "properties": {
                "name": name, "category": "parqe", "categoryLabel": "Park kombëtar",
                "location": "Kosovë" if country == "XK" else "Shqipëri", "countryCodes": [country],
                "summary": f"Park kombëtar në {'Kosovë' if country == 'XK' else 'Shqipëri'}. Kufiri vjen nga OpenStreetMap.",
                "details": [], "mapNote": "Kufiri i objektit OSM, marrë përmes Nominatim.",
                "geometryType": match["geometry"]["type"],
                "sources": [{"label": "OpenStreetMap", "url": f"https://www.openstreetmap.org/{kind}/{osm_id}"}],
                "osm": {"type": kind, "id": osm_id, "tags": {}},
            }}
            print(f"Added {name}: {match['geometry']['type']}")
        except Exception as error:
            print(f"Skipped {name}: {error}")
        time.sleep(1.1)
    document["features"] = list(by_id.values())
    path.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n")
    print(f"Total natural areas: {len(by_id)}")


if __name__ == "__main__":
    main()
