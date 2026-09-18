#!/usr/bin/env python3
"""Summarize GBIF observations inside each mapped natural area."""
from __future__ import annotations

import json
from pathlib import Path

from shapely.geometry import shape

DATA = Path(__file__).resolve().parents[1] / "public/data/groups"


def main() -> None:
    area_path = DATA / "zona.geojson"
    areas = json.loads(area_path.read_text())
    observations = {group: json.loads((DATA / f"{group}.geojson").read_text())["features"] for group in ("flora", "fauna")}
    for area in areas["features"]:
        polygon = shape(area["geometry"])
        properties = area["properties"]
        if (properties.get("image") or {}).get("derivedFromGbif"):
            properties.pop("image")
        details = [text for text in properties.get("details", []) if not text.startswith("Vëzhgime GBIF brenda kufirit:")]
        extra = {key: value for key, value in properties.get("extra", {}).items() if key not in ("Vëzhgime flore", "Vëzhgime faune")}
        summaries = []
        representative = None
        for group, label in (("flora", "flore"), ("fauna", "faune")):
            inside = [item for item in observations[group] if polygon.covers(shape(item["geometry"]))]
            if representative is None:
                representative = next((item for item in inside if item["properties"].get("image")), None)
            if not inside:
                continue
            extra[f"Vëzhgime {label}"] = len(inside)
            species = sorted({item["properties"]["name"] for item in inside})
            summaries.append(f"{len(inside)} vëzhgime {label}; lloje të regjistruara: {', '.join(species[:6])}" + ("…" if len(species) > 6 else ""))
        if summaries:
            details.append("Vëzhgime GBIF brenda kufirit: " + "; ".join(summaries) + ". Këto regjistrime nuk janë inventar i plotë i parkut.")
        if representative and not properties.get("image"):
            photo = dict(representative["properties"]["image"])
            photo["context"] = f"Vëzhgim i {representative['properties']['name']} brenda kufirit të parkut"
            photo["alt"] = photo["context"]
            photo["derivedFromGbif"] = True
            properties["image"] = photo
        properties["details"] = details
        properties["extra"] = extra
    area_path.write_text(json.dumps(areas, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
