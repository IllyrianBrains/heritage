import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from extract_nature import gbif_image, osm_feature, overpass_query, write_layers


class NatureTests(unittest.TestCase):
    def test_gbif_image_uses_media_license_and_photo_credit(self):
        record = {"key": 42, "species": "Test species", "media": [
            {"type": "StillImage", "identifier": "https://example.org/restricted.jpg", "license": "https://creativecommons.org/licenses/by-nc-nd/4.0/"},
            {"type": "StillImage", "identifier": "https://example.org/photo.jpg", "license": "https://creativecommons.org/licenses/by/4.0/", "creator": "Photographer"},
        ]}
        image = gbif_image(record)
        self.assertIn("/occurrence/42/media/", image["url"])
        self.assertEqual(image["credit"], "Photographer")
        self.assertEqual(image["license"], "CC BY 4.0")

    def test_queries_both_countries_and_natural_categories(self):
        for country in ("AL", "XK"):
            query = overpass_query(country)
            self.assertIn("protected_area", query)
            self.assertIn("39.62,19.25,42.67,21.10" if country == "AL" else "41.90,20.00,43.27,21.80", query)
            self.assertIn('boundary"="protected_area', query)
            self.assertNotIn('"historic"', query)

    def test_osm_polygon_and_per_group_files(self):
        item = {"element": {"type": "way", "id": 7, "center": {"lat": 42, "lon": 21}, "tags": {"name": "Test park", "boundary": "national_park"}}, "category": "zona", "countries": {"XK"}}
        geometries = {("way", 7): {"type": "way", "id": 7, "geometry": [
            {"lon": 21, "lat": 42}, {"lon": 21.1, "lat": 42}, {"lon": 21.1, "lat": 42.1}, {"lon": 21, "lat": 42},
        ]}}
        feature = osm_feature(item, geometries)
        self.assertEqual(feature["geometry"]["type"], "Polygon")
        self.assertEqual(feature["properties"]["countryCodes"], ["XK"])
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            write_layers([feature], root)
            self.assertEqual(json.loads((root / "groups/zona.geojson").read_text())["features"][0]["id"], "osm-way-7")
            self.assertEqual([group["id"] for group in json.loads((root / "groups.json").read_text())["groups"]], ["zona", "flora", "fauna"])


if __name__ == "__main__":
    unittest.main()
