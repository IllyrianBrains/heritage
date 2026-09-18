import sys
import unittest
from pathlib import Path

from shapely.geometry import shape

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from geometry import osm_geometry


def path(points):
    return [{"lon": x, "lat": y} for x, y in points]


class GeometryTests(unittest.TestCase):
    def test_closed_way_is_polygon(self):
        element = {"type": "way", "geometry": path([(0, 0), (4, 0), (4, 4), (0, 4), (0, 0)])}
        geometry, _ = osm_geometry(element, 2, 2)
        self.assertEqual(geometry["type"], "Polygon")
        self.assertEqual(shape(geometry).area, 16)

    def test_split_relation_with_hole_is_multipolygon(self):
        element = {"type": "relation", "members": [
            {"type": "way", "role": "outer", "geometry": path([(0, 0), (4, 0), (4, 4)])},
            {"type": "way", "role": "outer", "geometry": path([(4, 4), (0, 4), (0, 0)])},
            {"type": "way", "role": "inner", "geometry": path([(1, 1), (1, 2), (2, 2), (2, 1), (1, 1)])},
            {"type": "way", "role": "outer", "geometry": path([(6, 0), (7, 0), (7, 1), (6, 1), (6, 0)])},
        ]}
        geometry, _ = osm_geometry(element, 0, 0)
        result = shape(geometry)
        self.assertEqual(geometry["type"], "MultiPolygon")
        self.assertTrue(result.is_valid)
        self.assertEqual(result.area, 16)

    def test_unclosed_relation_does_not_invent_area(self):
        element = {"type": "relation", "members": [
            {"type": "way", "role": "outer", "geometry": path([(0, 0), (4, 0), (4, 4)])},
        ]}
        geometry, note = osm_geometry(element, 1, 2)
        self.assertEqual(geometry["type"], "Point")
        self.assertEqual(geometry["coordinates"], (2.0, 1.0))
        self.assertIn("nuk ktheu", note)

    def test_open_way_stays_line(self):
        element = {"type": "way", "geometry": path([(0, 0), (1, 1), (2, 2)])}
        geometry, _ = osm_geometry(element, 0, 0)
        self.assertEqual(geometry["type"], "LineString")


if __name__ == "__main__":
    unittest.main()
