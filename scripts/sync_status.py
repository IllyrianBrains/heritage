#!/usr/bin/env python3
"""Sync area health status, interventions, organizations and legislation from a Google Sheet.

Reads four tabs of a shared Google Sheet (published to the web is not required;
"anyone with the link can view" sharing is enough for the gviz CSV endpoint used
here), joins rows to areas already mapped in ``public/data/groups`` and
``public/data/manual``, and writes ``public/data/status/{areas,interventions,
organizations,legislation}.json`` for the dashboard and the map to read. A bad
row (unknown area id, missing required field, unrecognised choice) is skipped
or coerced and counted as a warning; it never stops the sync.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

DATA_DIR = Path(__file__).resolve().parents[1] / "public/data"
USER_AGENT = "heritage-map-status-sync/0.1 (https://github.com/pomodoren/heritage)"

DEFAULT_AREAS_TAB = "Zonat"
DEFAULT_INTERVENTIONS_TAB = "Ndërhyrjet"
DEFAULT_ORGANIZATIONS_TAB = "Organizatat"
DEFAULT_LEGISLATION_TAB = "Legjislacioni"

AREA_STATUS = {"e mirë": "good", "në vëzhgim": "watch", "kritike": "critical", "e papërcaktuar": "unassessed"}
THREAT_LEVEL = {"i ulët": "low", "mesatar": "medium", "i lartë": "high"}
HABITAT_TREND = {"përmirësohet": "improving", "stabël": "stable", "përkeqësohet": "declining"}
ENFORCEMENT_LEVEL = {"i mirë": "good", "pjesshëm": "partial", "i dobët": "weak"}
PRIORITY = {"i lartë": "high", "mesatar": "medium", "i ulët": "low"}
INTERVENTION_STATUS = {"planifikuar": "planned", "në vazhdim": "ongoing", "përfunduar": "done"}
RESPONSIBILITY_LEVEL = {"qendror": "central", "vendor": "local", "të përbashkët": "shared"}
MANAGEMENT_PLAN = {"ka": "yes", "në hartim": "in_progress", "nuk ka": "none"}


def gviz_csv_url(sheet_id: str, tab: str) -> str:
    return f"https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?tqx=out:csv&sheet={quote(tab)}"


def fetch_csv(url: str) -> list[dict]:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=60) as response:
        text = response.read().decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text)))


def read_rows(*, sheet_id: str | None, tab: str, local_csv: Path | None) -> list[dict]:
    if local_csv:
        return list(csv.DictReader(io.StringIO(local_csv.read_text(encoding="utf-8-sig"))))
    if not sheet_id:
        raise ValueError("--sheet-id is required unless a local CSV override is given")
    return fetch_csv(gviz_csv_url(sheet_id, tab))


def cell(row: dict, key: str) -> str:
    return (row.get(key) or "").strip()


def choice(row: dict, key: str, table: dict[str, str], default: str | None, warnings: list[str], label: str) -> str | None:
    value = cell(row, key).casefold()
    if not value:
        return default
    if value in table:
        return table[value]
    warnings.append(f"{label}: vlerë e panjohur '{cell(row, key)}' te {key!r}, u vendos '{default}'")
    return default


def parse_date(row: dict, key: str, warnings: list[str], label: str) -> str | None:
    value = cell(row, key)
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date().isoformat()
    except ValueError:
        warnings.append(f"{label}: datë e pavlefshme '{value}' te {key!r}, u shpërfill")
        return None


def load_known_areas(data_dir: Path) -> dict[str, dict]:
    """Map every known area id (from groups/ and manual/ GeoJSON) to its name and group."""
    known: dict[str, dict] = {}
    for folder in ("groups", "manual"):
        directory = data_dir / folder
        if not directory.is_dir():
            continue
        for path in sorted(directory.glob("*.geojson")):
            try:
                collection = json.loads(path.read_text())
            except (OSError, json.JSONDecodeError):
                continue
            for feature in collection.get("features", []):
                feature_id = feature.get("id") or (feature.get("properties") or {}).get("id")
                if feature_id is None:
                    continue
                properties = feature.get("properties") or {}
                known[str(feature_id)] = {"name": properties.get("name", ""), "group": path.stem}
    return known


def parse_areas(rows: list[dict], known_areas: dict[str, dict]) -> tuple[list[dict], list[str]]:
    areas, warnings = [], []
    for index, row in enumerate(rows, start=2):
        area_id = cell(row, "ID i zonës")
        if not area_id:
            warnings.append(f"Zonat rreshti {index}: mungon 'ID i zonës', u shpërfill")
            continue
        known = known_areas.get(area_id)
        if not known:
            warnings.append(f"Zonat rreshti {index}: ID e panjohur '{area_id}', u shpërfill")
            continue
        areas.append({
            "areaId": area_id,
            "areaName": known["name"] or cell(row, "Emri i zonës"),
            "group": known["group"],
            "status": choice(row, "Statusi i përgjithshëm", AREA_STATUS, "unassessed", warnings, "Zonat"),
            "indicators": {
                "threatLevel": choice(row, "Niveli i kërcënimit", THREAT_LEVEL, None, warnings, "Zonat"),
                "habitatTrend": choice(row, "Tendenca e habitatit", HABITAT_TREND, None, warnings, "Zonat"),
                "enforcementLevel": choice(row, "Zbatimi i mbrojtjes", ENFORCEMENT_LEVEL, None, warnings, "Zonat"),
            },
            "lastAssessed": parse_date(row, "Data e vlerësimit", warnings, "Zonat"),
            "assessedBy": cell(row, "Organizata vlerësuese") or None,
            "notes": cell(row, "Shënime") or None,
            "evidenceUrl": cell(row, "Lidhje dëshmie") or None,
        })
    return areas, warnings


def parse_interventions(rows: list[dict], known_areas: dict[str, dict]) -> tuple[list[dict], list[str]]:
    interventions, warnings = [], []
    for index, row in enumerate(rows, start=2):
        area_id = cell(row, "ID i zonës")
        title = cell(row, "Titulli")
        if not area_id or not title:
            warnings.append(f"Ndërhyrjet rreshti {index}: mungon 'ID i zonës' ose 'Titulli', u shpërfill")
            continue
        if area_id not in known_areas:
            warnings.append(f"Ndërhyrjet rreshti {index}: ID e panjohur '{area_id}', u shpërfill")
            continue
        interventions.append({
            "areaId": area_id,
            "title": title,
            "description": cell(row, "Përshkrimi") or None,
            "priority": choice(row, "Prioriteti", PRIORITY, "medium", warnings, "Ndërhyrjet"),
            "status": choice(row, "Statusi", INTERVENTION_STATUS, "planned", warnings, "Ndërhyrjet"),
            "organization": cell(row, "Organizata") or None,
            "startDate": parse_date(row, "Data e fillimit", warnings, "Ndërhyrjet"),
            "endDate": parse_date(row, "Data e mbylljes", warnings, "Ndërhyrjet"),
            "link": cell(row, "Lidhje") or None,
        })
    return interventions, warnings


def parse_organizations(rows: list[dict]) -> list[dict]:
    organizations = []
    for row in rows:
        name = cell(row, "Emri i organizatës")
        if not name:
            continue
        organizations.append({
            "name": name,
            "focus": cell(row, "Fokusi") or None,
            "contact": cell(row, "Kontakt") or None,
            "website": cell(row, "Faqja") or None,
        })
    return organizations


def parse_legislation(rows: list[dict], known_areas: dict[str, dict]) -> tuple[list[dict], list[str]]:
    legislation, warnings = [], []
    for index, row in enumerate(rows, start=2):
        area_id = cell(row, "ID i zonës")
        if not area_id:
            warnings.append(f"Legjislacioni rreshti {index}: mungon 'ID i zonës', u shpërfill")
            continue
        if area_id not in known_areas:
            warnings.append(f"Legjislacioni rreshti {index}: ID e panjohur '{area_id}', u shpërfill")
            continue
        legislation.append({
            "areaId": area_id,
            "protectionCategory": cell(row, "Kategoria e mbrojtjes") or None,
            "legalBasis": cell(row, "Baza ligjore") or None,
            "responsibilityLevel": choice(row, "Niveli i përgjegjësisë", RESPONSIBILITY_LEVEL, None, warnings, "Legjislacioni"),
            "governmentPriority": choice(row, "Përparësia e qeverisë", PRIORITY, None, warnings, "Legjislacioni"),
            "managementPlan": choice(row, "Plani i menaxhimit", MANAGEMENT_PLAN, None, warnings, "Legjislacioni"),
            "notes": cell(row, "Shënime") or None,
            "link": cell(row, "Lidhje") or None,
        })
    return legislation, warnings


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    staged = path.with_suffix(".tmp")
    staged.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    staged.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sheet-id", help="ID i Google Sheet (nga URL-ja e tij)")
    parser.add_argument("--areas-tab", default=DEFAULT_AREAS_TAB)
    parser.add_argument("--interventions-tab", default=DEFAULT_INTERVENTIONS_TAB)
    parser.add_argument("--organizations-tab", default=DEFAULT_ORGANIZATIONS_TAB)
    parser.add_argument("--legislation-tab", default=DEFAULT_LEGISLATION_TAB)
    parser.add_argument("--data-dir", type=Path, default=DATA_DIR)
    parser.add_argument("--areas-csv", type=Path, help="Përdor një CSV lokal në vend të Google Sheets (testim/offline)")
    parser.add_argument("--interventions-csv", type=Path)
    parser.add_argument("--organizations-csv", type=Path)
    parser.add_argument("--legislation-csv", type=Path)
    args = parser.parse_args()

    try:
        known_areas = load_known_areas(args.data_dir)
        areas_rows = read_rows(sheet_id=args.sheet_id, tab=args.areas_tab, local_csv=args.areas_csv)
        interventions_rows = read_rows(sheet_id=args.sheet_id, tab=args.interventions_tab, local_csv=args.interventions_csv)
        organizations_rows = read_rows(sheet_id=args.sheet_id, tab=args.organizations_tab, local_csv=args.organizations_csv)
        legislation_rows = read_rows(sheet_id=args.sheet_id, tab=args.legislation_tab, local_csv=args.legislation_csv)
    except HTTPError as error:
        print(f"Sinkronizimi dështoi: HTTP {error.code} nga Google Sheets", file=sys.stderr)
        return 1
    except (ValueError, OSError) as error:
        print(f"Sinkronizimi dështoi: {error}", file=sys.stderr)
        return 1

    areas, area_warnings = parse_areas(areas_rows, known_areas)
    interventions, intervention_warnings = parse_interventions(interventions_rows, known_areas)
    organizations = parse_organizations(organizations_rows)
    legislation, legislation_warnings = parse_legislation(legislation_rows, known_areas)

    if not areas and not interventions and not organizations and not legislation:
        print("Sinkronizimi dështoi: asnjë rresht i vlefshëm në asnjë skedë", file=sys.stderr)
        return 1

    for warning in [*area_warnings, *intervention_warnings, *legislation_warnings]:
        print(warning, file=sys.stderr)

    generated_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    status_dir = args.data_dir / "status"
    write_json(status_dir / "areas.json", {"generatedAt": generated_at, "warnings": len(area_warnings), "areas": areas})
    write_json(status_dir / "interventions.json", {"generatedAt": generated_at, "warnings": len(intervention_warnings), "interventions": interventions})
    write_json(status_dir / "organizations.json", {"generatedAt": generated_at, "organizations": organizations})
    write_json(status_dir / "legislation.json", {"generatedAt": generated_at, "warnings": len(legislation_warnings), "legislation": legislation})

    print(f"Zonat: {len(areas)} ({len(area_warnings)} paralajmërime)")
    print(f"Ndërhyrjet: {len(interventions)} ({len(intervention_warnings)} paralajmërime)")
    print(f"Organizatat: {len(organizations)}")
    print(f"Legjislacioni: {len(legislation)} ({len(legislation_warnings)} paralajmërime)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
