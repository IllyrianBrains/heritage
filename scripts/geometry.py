"""Convert Overpass way/relation geometry to valid GeoJSON shapes."""
from __future__ import annotations

from shapely.geometry import GeometryCollection, LineString, MultiPolygon, Point, Polygon, mapping
from shapely.ops import polygonize, unary_union
from shapely.validation import make_valid


def coordinates(points: list[dict]) -> list[tuple[float, float]]:
    return [(float(p["lon"]), float(p["lat"])) for p in points if "lon" in p and "lat" in p]


def polygon_parts(geometry) -> list[Polygon]:
    if isinstance(geometry, Polygon):
        return [geometry] if not geometry.is_empty else []
    if isinstance(geometry, MultiPolygon):
        return [part for part in geometry.geoms if not part.is_empty]
    if isinstance(geometry, GeometryCollection):
        parts = []
        for item in geometry.geoms:
            parts.extend(polygon_parts(item))
        return parts
    return []


def joined_polygons(lines: list[LineString]) -> list[Polygon]:
    if not lines:
        return []
    return list(polygonize(unary_union(lines)))


def relation_geometry(element: dict):
    outer = []
    inner = []
    for member in element.get("members", []):
        if member.get("type") != "way" or member.get("role") not in ("outer", "inner"):
            continue
        points = coordinates(member.get("geometry") or [])
        if len(points) < 2:
            continue
        line = LineString(points)
        (inner if member["role"] == "inner" else outer).append(line)
    shells = joined_polygons(outer)
    if not shells:
        return None
    shape = unary_union(shells)
    holes = joined_polygons(inner)
    if holes:
        shape = shape.difference(unary_union(holes))
    shape = make_valid(shape)
    parts = polygon_parts(shape)
    if not parts:
        return None
    return parts[0] if len(parts) == 1 else MultiPolygon(parts)


def osm_geometry(element: dict | None, fallback_lat: float, fallback_lon: float) -> tuple[dict, str]:
    """Return GeoJSON geometry and a plain Albanian note about its fidelity."""
    if element:
        if element.get("type") == "node" and "lat" in element and "lon" in element:
            return mapping(Point(element["lon"], element["lat"])), "Pika është vendndodhja e nyjës në OpenStreetMap."
        if element.get("type") == "way":
            points = coordinates(element.get("geometry") or [])
            if len(points) >= 4 and points[0] == points[-1]:
                shape = make_valid(Polygon(points))
                parts = polygon_parts(shape)
                if parts:
                    area = parts[0] if len(parts) == 1 else MultiPolygon(parts)
                    return mapping(area), "Sipërfaqja vjen nga kufiri i objektit në OpenStreetMap."
            if len(points) >= 2:
                return mapping(LineString(points)), "Objekti është vizatuar si vijë në OpenStreetMap."
        if element.get("type") == "relation":
            shape = relation_geometry(element)
            if shape is not None:
                return mapping(shape), "Sipërfaqja bashkon anët e jashtme dhe përjashton vrimat e relation në OpenStreetMap."
    return mapping(Point(fallback_lon, fallback_lat)), "OSM nuk ktheu një kufi të mbyllur; shfaqet vetëm pika përfaqësuese."
