import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from sync_status import load_known_areas, parse_areas, parse_interventions, parse_legislation, parse_organizations, write_json


def make_data_dir(root: Path) -> None:
    groups = root / "groups"
    groups.mkdir(parents=True)
    (groups / "zona.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": [
        {"type": "Feature", "id": "osm-way-1", "geometry": {"type": "Point", "coordinates": [20, 41]}, "properties": {"name": "Parku Thethi"}},
    ]}))
    manual = root / "manual"
    manual.mkdir(parents=True)
    (manual / "zona.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": [
        {"type": "Feature", "id": "local-1", "geometry": {"type": "Point", "coordinates": [20, 41]}, "properties": {"name": "Zonë lokale"}},
    ]}))


class StatusTests(unittest.TestCase):
    def test_load_known_areas_scans_groups_and_manual(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            make_data_dir(root)
            known = load_known_areas(root)
            self.assertEqual(known["osm-way-1"], {"name": "Parku Thethi", "group": "zona"})
            self.assertEqual(known["local-1"]["name"], "Zonë lokale")

    def test_load_known_areas_tolerates_missing_manual_dir(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "groups").mkdir()
            (root / "groups/zona.geojson").write_text('{"type":"FeatureCollection","features":[]}')
            self.assertEqual(load_known_areas(root), {})

    def test_parse_areas_valid_row(self):
        known = {"osm-way-1": {"name": "Parku Thethi", "group": "zona"}}
        rows = [{
            "ID i zonës": "osm-way-1", "Emri i zonës": "Parku Thethi", "Statusi i përgjithshëm": "Në vëzhgim",
            "Niveli i kërcënimit": "Mesatar", "Tendenca e habitatit": "Stabël", "Zbatimi i mbrojtjes": "Pjesshëm",
            "Data e vlerësimit": "2026-08-01", "Organizata vlerësuese": "PPNEA", "Shënime": "Presion nga ndërtimet.",
            "Lidhje dëshmie": "https://example.org/raporti",
        }]
        areas, warnings = parse_areas(rows, known)
        self.assertEqual(warnings, [])
        self.assertEqual(areas, [{
            "areaId": "osm-way-1", "areaName": "Parku Thethi", "group": "zona", "status": "watch",
            "indicators": {"threatLevel": "medium", "habitatTrend": "stable", "enforcementLevel": "partial"},
            "lastAssessed": "2026-08-01", "assessedBy": "PPNEA", "notes": "Presion nga ndërtimet.",
            "evidenceUrl": "https://example.org/raporti",
        }])

    def test_parse_areas_unknown_id_is_dropped_with_warning(self):
        areas, warnings = parse_areas([{"ID i zonës": "osm-way-999", "Statusi i përgjithshëm": "Kritike"}], {})
        self.assertEqual(areas, [])
        self.assertEqual(len(warnings), 1)
        self.assertIn("osm-way-999", warnings[0])

    def test_parse_areas_missing_id_is_dropped(self):
        areas, warnings = parse_areas([{"ID i zonës": "", "Statusi i përgjithshëm": "Kritike"}], {})
        self.assertEqual(areas, [])
        self.assertEqual(len(warnings), 1)

    def test_parse_areas_bad_enum_is_coerced_and_warned(self):
        known = {"osm-way-1": {"name": "Parku Thethi", "group": "zona"}}
        areas, warnings = parse_areas([{"ID i zonës": "osm-way-1", "Statusi i përgjithshëm": "??"}], known)
        self.assertEqual(areas[0]["status"], "unassessed")
        self.assertEqual(len(warnings), 1)

    def test_parse_areas_bad_date_is_null_and_warned(self):
        known = {"osm-way-1": {"name": "Parku Thethi", "group": "zona"}}
        areas, warnings = parse_areas([{"ID i zonës": "osm-way-1", "Data e vlerësimit": "not-a-date"}], known)
        self.assertIsNone(areas[0]["lastAssessed"])
        self.assertEqual(len(warnings), 1)

    def test_parse_interventions_valid_row(self):
        known = {"osm-way-1": {"name": "Parku Thethi", "group": "zona"}}
        rows = [{
            "ID i zonës": "osm-way-1", "Titulli": "Patrullim", "Përshkrimi": "Patrullime të përjavshme.",
            "Prioriteti": "I lartë", "Statusi": "Në vazhdim", "Organizata": "PPNEA",
            "Data e fillimit": "2026-03-01", "Data e mbylljes": "", "Lidhje": "https://example.org/projekti",
        }]
        interventions, warnings = parse_interventions(rows, known)
        self.assertEqual(warnings, [])
        self.assertEqual(interventions[0]["priority"], "high")
        self.assertEqual(interventions[0]["status"], "ongoing")
        self.assertIsNone(interventions[0]["endDate"])

    def test_parse_interventions_missing_title_is_dropped(self):
        known = {"osm-way-1": {"name": "Parku Thethi", "group": "zona"}}
        interventions, warnings = parse_interventions([{"ID i zonës": "osm-way-1", "Titulli": ""}], known)
        self.assertEqual(interventions, [])
        self.assertEqual(len(warnings), 1)

    def test_parse_legislation_valid_row(self):
        known = {"osm-way-1": {"name": "Parku Thethi", "group": "zona"}}
        rows = [{
            "ID i zonës": "osm-way-1", "Kategoria e mbrojtjes": "Park Kombëtar (Kategoria II IUCN)",
            "Baza ligjore": "Ligji Nr. 81/2017 'Për zonat e mbrojtura'", "Niveli i përgjegjësisë": "Qendror",
            "Përparësia e qeverisë": "I lartë", "Plani i menaxhimit": "Në hartim",
            "Shënime": "Plani pritet brenda vitit.", "Lidhje": "https://example.org/ligji",
        }]
        legislation, warnings = parse_legislation(rows, known)
        self.assertEqual(warnings, [])
        self.assertEqual(legislation, [{
            "areaId": "osm-way-1", "protectionCategory": "Park Kombëtar (Kategoria II IUCN)",
            "legalBasis": "Ligji Nr. 81/2017 'Për zonat e mbrojtura'", "responsibilityLevel": "central",
            "governmentPriority": "high", "managementPlan": "in_progress",
            "notes": "Plani pritet brenda vitit.", "link": "https://example.org/ligji",
        }])

    def test_parse_legislation_unknown_id_is_dropped(self):
        legislation, warnings = parse_legislation([{"ID i zonës": "osm-way-999"}], {})
        self.assertEqual(legislation, [])
        self.assertEqual(len(warnings), 1)

    def test_parse_legislation_missing_id_is_dropped(self):
        legislation, warnings = parse_legislation([{"ID i zonës": ""}], {})
        self.assertEqual(legislation, [])
        self.assertEqual(len(warnings), 1)

    def test_parse_legislation_bad_enum_is_coerced_and_warned(self):
        known = {"osm-way-1": {"name": "Parku Thethi", "group": "zona"}}
        legislation, warnings = parse_legislation([{"ID i zonës": "osm-way-1", "Niveli i përgjegjësisë": "??"}], known)
        self.assertIsNone(legislation[0]["responsibilityLevel"])
        self.assertEqual(len(warnings), 1)

    def test_parse_organizations_skips_blank_names(self):
        rows = [{"Emri i organizatës": "PPNEA", "Fokusi": "Kafshë të egra", "Kontakt": "info@ppnea.org", "Faqja": "https://ppnea.org"}, {"Emri i organizatës": ""}]
        organizations = parse_organizations(rows)
        self.assertEqual(len(organizations), 1)
        self.assertEqual(organizations[0]["name"], "PPNEA")

    def test_write_json_round_trips(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "status/areas.json"
            write_json(path, {"areas": []})
            self.assertEqual(json.loads(path.read_text()), {"areas": []})


if __name__ == "__main__":
    unittest.main()
