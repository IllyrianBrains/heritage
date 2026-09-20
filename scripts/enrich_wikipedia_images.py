#!/usr/bin/env python3
"""Enrich linked nature areas with Wikidata, Wikipedia text and Commons images."""
from __future__ import annotations

import html
import json
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, unquote, urlencode, urlparse

from extract_places import DATA_DIR, request_json

AREA_FILES = ("parqe.geojson", "mbrojtura.geojson", "rezervate.geojson")
GENERIC_SUMMARY_ENDINGS = (
    "kufiri dhe të dhënat vijnë nga OpenStreetMap.",
    "Të dhënat për këtë vend vijnë nga OpenStreetMap.",
)


def plain(value: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", value or "")).strip()


def add_source(properties: dict, label: str, url: str) -> None:
    sources = properties.setdefault("sources", [])
    if url and all(source.get("url") != url for source in sources):
        sources.append({"label": label, "url": url})


def wikipedia_source(properties: dict) -> tuple[str, str] | None:
    for source in properties.get("sources", []):
        parsed = urlparse(source.get("url", ""))
        language = parsed.hostname.split(".")[0] if parsed.hostname else ""
        if language != "commons" and re.fullmatch(r"[a-z][a-z-]{1,11}", language) and parsed.hostname.endswith(".wikipedia.org") and parsed.path.startswith("/wiki/"):
            return language, unquote(parsed.path.removeprefix("/wiki/"))
    return None


def wikidata_id(properties: dict) -> str | None:
    value = ((properties.get("osm") or {}).get("tags") or {}).get("wikidata", "")
    if re.fullmatch(r"Q[1-9]\d*", value):
        return value
    for source in properties.get("sources", []):
        match = re.fullmatch(r"https://www\.wikidata\.org/wiki/(Q[1-9]\d*)", source.get("url", ""))
        if match:
            return match.group(1)
    return None


def wikidata_entity(qid: str) -> dict:
    data = request_json(f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json", timeout=25)
    return (data.get("entities") or {}).get(qid) or {}


def best_sitelink(entity: dict) -> tuple[str, str] | None:
    sitelinks = entity.get("sitelinks") or {}
    for key in ("sqwiki", "enwiki"):
        if sitelinks.get(key, {}).get("title"):
            return key.removesuffix("wiki"), sitelinks[key]["title"]
    for key, value in sitelinks.items():
        if key != "commonswiki" and re.fullmatch(r"[a-z][a-z-]{1,11}wiki", key) and value.get("title"):
            return key.removesuffix("wiki"), value["title"]
    return None


def wikidata_description(entity: dict) -> str:
    descriptions = entity.get("descriptions") or {}
    for language in ("sq", "en"):
        if descriptions.get(language, {}).get("value"):
            return descriptions[language]["value"].strip()
    return ""


def wikidata_image(entity: dict) -> str:
    for claim in (entity.get("claims") or {}).get("P18", []):
        value = (((claim.get("mainsnak") or {}).get("datavalue") or {}).get("value"))
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def commons_image(filename: str, alt: str) -> dict | None:
    if not filename:
        return None
    params = urlencode({
        "action": "query", "titles": f"File:{filename}", "prop": "imageinfo",
        "iiprop": "url|extmetadata", "iiurlwidth": 1000, "format": "json",
    })
    data = request_json(f"https://commons.wikimedia.org/w/api.php?{params}", timeout=25)
    pages = (data.get("query") or {}).get("pages") or {}
    info = next((item["imageinfo"][0] for item in pages.values() if item.get("imageinfo")), None)
    if not info:
        return None
    metadata = info.get("extmetadata") or {}
    license_url = (metadata.get("LicenseUrl") or {}).get("value", "")
    license_name = plain((metadata.get("LicenseShortName") or {}).get("value", ""))
    allowed = ("creativecommons.org/licenses/by/", "creativecommons.org/licenses/by-sa/", "creativecommons.org/publicdomain/")
    if not any(value in license_url.lower() for value in allowed):
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
        "license": license_name or license_url,
        "licenseUrl": license_url,
        "alt": alt,
    }


def article_summary(language: str, title: str) -> dict:
    slug = quote(title.replace(" ", "_"), safe="()")
    return request_json(f"https://{language}.wikipedia.org/api/rest_v1/page/summary/{slug}", timeout=25)


def image_filename(page: dict) -> str:
    original = (page.get("originalimage") or {}).get("source", "")
    parsed = urlparse(original)
    if parsed.hostname == "upload.wikimedia.org" and "/wikipedia/commons/" in parsed.path:
        return unquote(parsed.path.rsplit("/", 1)[-1])
    return ""


def enrich(properties: dict) -> tuple[bool, bool]:
    properties["sources"] = [
        source for source in properties.get("sources", [])
        if urlparse(source.get("url", "")).hostname != "commons.wikipedia.org"
    ]
    qid = wikidata_id(properties)
    wiki = wikipedia_source(properties)
    if not qid and not wiki:
        return False, False

    entity = wikidata_entity(qid) if qid else {}
    if qid:
        add_source(properties, "Wikidata", f"https://www.wikidata.org/wiki/{qid}")
    if not wiki:
        wiki = best_sitelink(entity)
        if wiki:
            language, title = wiki
            add_source(properties, f"Wikipedia ({language})", f"https://{language}.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}")

    page = {}
    extract = ""
    if wiki:
        language, title = wiki
        page = article_summary(language, title)
        if page.get("type") != "disambiguation":
            extract = plain(page.get("extract", ""))

    description = wikidata_description(entity)
    current_summary = properties.get("summary", "")
    if extract:
        short = extract if len(extract) <= 320 else extract[:317].rsplit(" ", 1)[0] + "…"
        if any(current_summary.endswith(ending) for ending in GENERIC_SUMMARY_ENDINGS):
            properties["summary"] = short
        properties["details"] = [extract[:1600]]
        properties["wikipediaAttribution"] = f"Përmbledhje nga Wikipedia ({wiki[0]}); shiko licencën dhe autorët në artikull."
    elif description and any(current_summary.endswith(ending) for ending in GENERIC_SUMMARY_ENDINGS):
        properties["summary"] = description[0].upper() + description[1:] + "."
    elif any(current_summary.endswith(ending) for ending in GENERIC_SUMMARY_ENDINGS):
        label = properties.get("categoryLabel", "Zonë e mbrojtur")
        location = properties.get("location", "rajonin e hartës")
        properties["summary"] = f"{label} në {location}, e dokumentuar në OpenStreetMap dhe Wikidata."

    added_image = False
    if not properties.get("image"):
        filename = image_filename(page) or wikidata_image(entity)
        image = commons_image(filename, properties.get("name", filename))
        if image:
            properties["image"] = image
            added_image = True
    return True, added_image


def main() -> None:
    linked = described = imaged = 0
    for filename in AREA_FILES:
        path = DATA_DIR / "groups" / filename
        document = json.loads(path.read_text())
        changed = False
        for feature in document["features"]:
            properties = feature.get("properties") or {}
            if not wikidata_id(properties) and not wikipedia_source(properties):
                continue
            linked += 1
            print(f"Enriching {properties.get('name', feature.get('id'))}…")
            try:
                has_description, added_image = enrich(properties)
                described += int(has_description)
                imaged += int(added_image)
                changed = True
            except (HTTPError, URLError, TimeoutError, ValueError, KeyError) as error:
                print(f"Skipped {feature.get('id')}: {error}", file=sys.stderr)
            time.sleep(0.15)
        if changed:
            path.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n")
    print(f"Linked records: {linked}; descriptions: {described}; new images: {imaged}")


if __name__ == "__main__":
    main()
