#!/usr/bin/env python3
"""Attach openly licensed Wikimedia Commons thumbnails to park records."""
from __future__ import annotations

import html
import json
import re
import time
from pathlib import Path
from urllib.parse import quote, unquote, urlencode, urlparse

from extract_places import DATA_DIR, request_json

TITLES = {
    "Bjeshkët e Nemuna National Park": "Bjeshkët e Nemuna National Park",
    "Sharri National Park": "Sharr Mountains National Park",
    "Valbona Valley National Park": "Valbonë Valley National Park",
    "Divjakë-Karavasta National Park": "Divjakë-Karavasta National Park",
    "Llogara National Park": "Llogara National Park",
    "Theth National Park": "Theth National Park",
    "Dajti National Park": "Dajti Mountain National Park",
    "Prespa National Park": "Prespa National Park (Albania)",
    "Shebenik-Jabllanicë National Park": "Shebenik-Jabllanicë National Park",
}


def plain(value: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", value or "")).strip()


def commons_image(page: dict) -> dict | None:
    original = (page.get("originalimage") or {}).get("source", "")
    parsed = urlparse(original)
    if parsed.hostname != "upload.wikimedia.org" or "/wikipedia/commons/" not in parsed.path:
        return None
    filename = unquote(parsed.path.rsplit("/", 1)[-1])
    params = urlencode({"action": "query", "titles": f"File:{filename}", "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": 1000, "format": "json"})
    data = request_json(f"https://commons.wikimedia.org/w/api.php?{params}", timeout=25)
    pages = (data.get("query") or {}).get("pages") or {}
    info = next((item["imageinfo"][0] for item in pages.values() if item.get("imageinfo")), None)
    if not info:
        return None
    metadata = info.get("extmetadata") or {}
    license_url = (metadata.get("LicenseUrl") or {}).get("value", "")
    license_name = plain((metadata.get("LicenseShortName") or {}).get("value", ""))
    if not any(value in license_url.lower() for value in ("creativecommons.org/licenses/by/", "creativecommons.org/licenses/by-sa/", "creativecommons.org/publicdomain/")):
        return None
    image_url = info.get("thumburl") or info.get("url")
    if not image_url:
        return None
    artist = plain((metadata.get("Artist") or {}).get("value", ""))
    if len(artist) > 140:
        artist = artist[:137] + "…"
    return {
        "url": image_url,
        "source": info.get("descriptionurl") or f"https://commons.wikimedia.org/wiki/File:{quote(filename)}",
        "credit": artist or "Wikimedia Commons contributor",
        "license": license_name or license_url, "licenseUrl": license_url,
        "alt": page.get("title") or filename,
    }


def main() -> None:
    path = DATA_DIR / "groups/zona.geojson"
    document = json.loads(path.read_text())
    found = 0
    for feature in document["features"]:
        properties = feature["properties"]
        title = TITLES.get(properties.get("name"))
        if not title:
            continue
        try:
            page = request_json(f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(title.replace(' ', '_'))}", timeout=25)
            image = commons_image(page)
            if not image:
                print(f"No licensed Commons image: {title}")
                continue
            properties["image"] = image
            article_url = (page.get("content_urls") or {}).get("desktop", {}).get("page")
            if article_url and all(source.get("url") != article_url for source in properties.get("sources", [])):
                properties.setdefault("sources", []).append({"label": "Wikipedia", "url": article_url})
            found += 1
            print(f"Image: {title}")
        except Exception as error:
            print(f"Skipped {title}: {error}")
        time.sleep(0.2)
    path.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n")
    print(f"Added {found} park images")


if __name__ == "__main__":
    main()
