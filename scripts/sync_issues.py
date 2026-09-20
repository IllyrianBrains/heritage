#!/usr/bin/env python3
"""Convert an Excel-compatible risk register CSV or Google Sheet to map issue data."""
from __future__ import annotations

import argparse
import csv
import io
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "public/data"
DEFAULT_CSV = ROOT / "data/issues.csv"
PRIORITIES = {"i lartë": "high", "mesatar": "medium", "i ulët": "low"}
STATUSES = {"në vazhdim": "ongoing", "për verifikim": "verification", "pezulluar": "paused", "mbyllur": "closed"}


def cell(row: dict, key: str) -> str:
    return (row.get(key) or "").strip()


def load_known_areas() -> dict[str, str]:
    known = {}
    for folder in (DATA_DIR / "groups", DATA_DIR / "manual"):
        for path in sorted(folder.glob("*.geojson")):
            collection = json.loads(path.read_text(encoding="utf-8"))
            for feature in collection.get("features", []):
                feature_id = feature.get("id") or (feature.get("properties") or {}).get("id")
                if feature_id:
                    known[str(feature_id)] = (feature.get("properties") or {}).get("name", "")
    return known


def read_rows(csv_path: Path, sheet_id: str | None, tab: str) -> list[dict]:
    if sheet_id:
        url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?tqx=out:csv&sheet={quote(tab)}"
        request = Request(url, headers={"User-Agent": "heritage-risk-register/1.0"})
        with urlopen(request, timeout=60) as response:
            content = response.read().decode("utf-8-sig")
    else:
        content = csv_path.read_text(encoding="utf-8-sig")
    return list(csv.DictReader(io.StringIO(content)))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV, help="CSV exported from Excel (default: data/issues.csv)")
    parser.add_argument("--sheet-id", help="Google Sheet ID; when set, reads the sheet instead of the CSV")
    parser.add_argument("--tab", default="Çështjet", help="Google Sheet tab name")
    args = parser.parse_args()
    known = load_known_areas()
    warnings, issues = [], []
    try:
        rows = read_rows(args.csv, args.sheet_id, args.tab)
    except OSError as error:
        print(f"Regjistri nuk u lexua: {error}", file=sys.stderr)
        return 1
    for row_number, row in enumerate(rows, start=2):
        issue_id, area_id = cell(row, "ID e çështjes"), cell(row, "ID e zonës")
        activity, evidence = cell(row, "Aktiviteti"), cell(row, "Lidhje dëshmie")
        if not issue_id or not area_id or not activity or not evidence:
            warnings.append(f"Rreshti {row_number}: mungon ID, zona, aktiviteti ose dëshmia")
            continue
        if area_id not in known:
            warnings.append(f"Rreshti {row_number}: zona e panjohur '{area_id}'")
            continue
        priority_raw, status_raw = cell(row, "Prioriteti").casefold(), cell(row, "Statusi").casefold()
        issues.append({
            "id": issue_id,
            "areaId": area_id,
            "areaName": known[area_id],
            "activity": activity,
            "threatType": cell(row, "Lloji i rrezikut") or None,
            "description": cell(row, "Përshkrimi") or None,
            "priority": PRIORITIES.get(priority_raw, "medium"),
            "status": STATUSES.get(status_raw, "verification"),
            "reportedAt": cell(row, "Data e raportimit") or None,
            "updatedAt": cell(row, "Përditësuar më") or None,
            "reportedBy": cell(row, "Organizata raportuese") or None,
            "evidenceUrl": evidence,
        })
    payload = {"generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "warnings": len(warnings), "issues": issues}
    output = DATA_DIR / "status/issues.json"
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for warning in warnings:
        print(warning, file=sys.stderr)
    print(f"Çështjet: {len(issues)} ({len(warnings)} paralajmërime) → {output}")
    return 0 if issues else 1


if __name__ == "__main__":
    raise SystemExit(main())
