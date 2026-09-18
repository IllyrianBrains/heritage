import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from extract_places import write_layers


class LayerTests(unittest.TestCase):
    def test_group_files_and_manual_layers_survive_refresh(self):
        record = {
            "id": "osm-way-1", "name": "Kalaja", "category": "historike",
            "categoryLabel": "Kala", "latitude": 40, "longitude": 20,
            "summary": "Kala në hartë.", "details": [], "sources": [],
            "osm": {"type": "way", "id": 1, "tags": {"historic": "castle"}},
        }
        geometry = {("way", 1): {"type": "way", "id": 1, "geometry": [
            {"lon": 20, "lat": 40}, {"lon": 21, "lat": 40},
            {"lon": 21, "lat": 41}, {"lon": 20, "lat": 40},
        ]}}
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            write_layers([record], geometry, root)
            generated = json.loads((root / "groups/historike.geojson").read_text())
            self.assertEqual(generated["features"][0]["geometry"]["type"], "Polygon")
            manual = root / "manual/historike.geojson"
            manual.write_text('{"type":"FeatureCollection","features":[{"type":"Feature","id":"local","geometry":{"type":"Point","coordinates":[20,40]},"properties":{"name":"Lokal"}}]}')
            manifest_path = root / "groups.json"
            manifest = json.loads(manifest_path.read_text())
            manifest["groups"].append({"id": "tjera", "label": "Të tjera", "color": "#123456", "files": ["/data/manual/tjera.geojson"]})
            manifest_path.write_text(json.dumps(manifest))
            write_layers([record], geometry, root)
            self.assertIn('"id":"local"', manual.read_text())
            result = json.loads(manifest_path.read_text())
            self.assertEqual(len(result["groups"]), 4)
            self.assertEqual(result["groups"][-1]["id"], "tjera")


if __name__ == "__main__":
    unittest.main()
