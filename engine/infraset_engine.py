# -*- coding: utf-8 -*-
"""
InfraSet web engine.

Bridges OpenStreetMap / GIS data and the InfraSet calculation model:

  1. `match` : reads raw OSM features (Overpass JSON) + user parameters,
     classifies roads / railways / tramways / stations / ancillaries
     (light posts, sign posts, bollards, level crossings), computes lengths
     with the haversine formula and assigns each group to an InfraSet
     element recipe from the database (Backend_InfraSet (4).py port).

  2. `calc`  : computes the multi-scale LCA / MFA results (initial and
     maintenance embodied energy, water, GHG and mass flows by material
     category), following the thesis equations (Appendix E):
         - initial impacts are computed once (no time scaling);
         - maintenance impacts scale with the period of analysis (POA/60)
           and with the Traffic Factor for wear-sensitive elements only
           (asphalt pavement / rail track), per the thesis corrections.

CLI usage (JSON on stdin, JSON on stdout):
    python3 infraset_engine.py match
    python3 infraset_engine.py calc
"""

import json
import math
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from infraset_db import MaterialDatabase, ElementDatabase, CATEGORIES  # noqa: E402

# ---------------------------------------------------------------------------
# Defaults (all user-editable from the web interface)
# ---------------------------------------------------------------------------

# Default carriageway widths (m) by OSM highway class
DEFAULT_ROAD_WIDTHS = {
    "motorway": 15.0, "trunk": 12.0, "primary": 9.0, "secondary": 8.0,
    "tertiary": 7.0, "unclassified": 5.5, "residential": 6.0,
    "living_street": 5.0, "service": 4.0, "busway": 6.0,
}

# Default widths (m) for active-transport surfaces (mapped to the
# Pedestrian_Path_Vol concrete path recipe)
DEFAULT_PATH_WIDTHS = {
    "footway": 2.0, "path": 1.5, "pedestrian": 3.0, "cycleway": 1.5,
    "steps": 1.0,
}

ROAD_CLASSES = sorted(DEFAULT_ROAD_WIDTHS.keys())
PATH_CLASSES = sorted(DEFAULT_PATH_WIDTHS.keys())

TRAM_CLASSES = {"tram"}
TRACK_CLASSES = {"rail", "light_rail", "subway", "narrow_gauge"}

RAILS_PER_TRACK = 2  # a single track has two running rails

DEFAULTS = {
    "double_track": 2,          # multiplier applied to railway track quantities
    "platform_width": 3.0,      # m, for railway=platform ways
    "station_area": 150.0,      # m2 of platform/surroundings per station node
    "crossing_area": 60.0,      # m2 of paved panel per level-crossing node
}

R_EARTH = 6371000.0


def haversine_length_m(geometry):
    """Length in metres of a polyline given as [{lat, lon}, ...]."""
    total = 0.0
    prev = None
    for pt in geometry:
        lat = float(pt["lat"]) * math.pi / 180.0
        lon = float(pt["lon"]) * math.pi / 180.0
        if prev is not None:
            plat, plon = prev
            dlat = lat - plat
            dlon = lon - plon
            a = (math.sin(dlat / 2.0) ** 2
                 + math.cos(plat) * math.cos(lat) * math.sin(dlon / 2.0) ** 2)
            total += 2.0 * R_EARTH * math.asin(math.sqrt(a))
        prev = (lat, lon)
    return total


def _item_id(osm_class, element_key):
    return "%s__%s" % (osm_class, element_key)


# ---------------------------------------------------------------------------
# MATCHING
# ---------------------------------------------------------------------------

def match_features(payload):
    params = payload.get("params") or {}
    features = payload.get("features") or []
    bbox = payload.get("bbox")

    double_track = int(params.get("double_track") or DEFAULTS["double_track"])
    if double_track < 1:
        double_track = 1
    platform_width = float(params.get("platform_width") or DEFAULTS["platform_width"])
    station_area = float(params.get("station_area") or DEFAULTS["station_area"])
    crossing_area = float(params.get("crossing_area") or DEFAULTS["crossing_area"])
    road_widths = dict(DEFAULT_ROAD_WIDTHS)
    for k, v in (params.get("road_widths") or {}).items():
        if v is not None and float(v) > 0:
            road_widths[k] = float(v)
    path_widths = dict(DEFAULT_PATH_WIDTHS)
    for k, v in (params.get("path_widths") or {}).items():
        if v is not None and float(v) > 0:
            path_widths[k] = float(v)

    material_db = MaterialDatabase()
    element_db = ElementDatabase(material_db.material_db)

    # accumulators: key = (asset_type, osm_class)
    way_len = {}       # (type, class) -> metres
    way_count = {}     # (type, class) -> number of ways
    node_count = {}    # (type, class) -> number of nodes
    skipped = 0

    for el in features:
        try:
            el_type = el.get("type")
            tags = el.get("tags") or {}
            if el_type == "way":
                hw = tags.get("highway")
                rw = tags.get("railway")
                geom = el.get("geometry") or []
                if len(geom) < 2:
                    skipped += 1
                    continue
                length = haversine_length_m(geom)
                if hw in DEFAULT_ROAD_WIDTHS:
                    key = ("road", hw)
                elif hw in DEFAULT_PATH_WIDTHS:
                    key = ("path", hw)
                elif rw == "platform":
                    key = ("platform", "platform")
                elif rw in TRACK_CLASSES:
                    key = ("rail", rw)
                elif rw in TRAM_CLASSES:
                    key = ("tram", rw)
                else:
                    skipped += 1
                    continue
                way_len[key] = way_len.get(key, 0.0) + length
                way_count[key] = way_count.get(key, 0) + 1
            elif el_type == "node":
                hw = tags.get("highway")
                rw = tags.get("railway")
                barrier = tags.get("barrier")
                if hw == "street_lamp":
                    key = ("lamp", "street_lamp")
                elif hw in ("stop", "give_way"):
                    key = ("sign", "traffic_sign")
                elif tags.get("traffic_sign") is not None:
                    key = ("sign", "traffic_sign")
                elif barrier == "bollard":
                    key = ("bollard", "bollard")
                elif rw == "level_crossing":
                    key = ("crossing", "level_crossing")
                elif rw in ("station", "halt", "tram_stop"):
                    key = ("station", rw)
                else:
                    skipped += 1
                    continue
                node_count[key] = node_count.get(key, 0) + 1
            else:
                skipped += 1
        except (KeyError, TypeError, ValueError):
            skipped += 1

    items = []

    def add_item(asset_type, osm_class, element_key, qty, count_features,
                 length_m=None, detail=None):
        if qty <= 0:
            return
        recipe = element_db.element_db.get(element_key)
        if recipe is None:
            return
        unit = recipe["unit"]
        items.append({
            "id": _item_id(osm_class, element_key),
            "asset_type": asset_type,
            "osm_class": osm_class,
            "element_key": element_key,
            "element_label": recipe["label"],
            "unit": unit,
            "unit_label": recipe["unit_label"],
            "qty": round(qty, 3),
            "count_features": count_features,
            "length_m": round(length_m, 2) if length_m is not None else None,
            "wear_sensitive": recipe["wear_sensitive"],
            "replacement_factor": recipe["replacement_factor"],
            "included": True,
            "detail": detail,
        })

    # Roads -> flexible pavement recipe (asphalt), area = length x width
    for (asset_type, osm_class), length in sorted(way_len.items()):
        count = way_count.get((asset_type, osm_class), 0)
        if asset_type == "road":
            width = road_widths.get(osm_class, 6.0)
            add_item("road", osm_class, "Road_Pavement_Flexible_Vol",
                     length * width, count, length_m=length,
                     detail="Width assumed %.1f m (editable)" % width)
        elif asset_type == "path":
            width = path_widths.get(osm_class, 2.0)
            add_item("path", osm_class, "Pedestrian_Path_Vol",
                     length * width, count, length_m=length,
                     detail="Width assumed %.1f m (editable)" % width)
        elif asset_type == "platform":
            add_item("platform", "platform", "Pedestrian_Path_Vol",
                     length * platform_width, count, length_m=length,
                     detail="Width assumed %.1f m (editable)" % platform_width)
        elif asset_type in ("rail", "tram"):
            # Track elements per metre of line, multiplied by number of tracks
            n_tracks = double_track
            detail = "%d track(s) x %.1f m" % (n_tracks, length) if n_tracks > 1 \
                else "single track, %.1f m" % length
            add_item(asset_type, osm_class, "Rail_Steel_Rail_60kgm",
                     length * n_tracks * RAILS_PER_TRACK, count, length_m=length,
                     detail=detail + " x %d rails/track" % RAILS_PER_TRACK)
            add_item(asset_type, osm_class, "Rail_Concrete_Sleeper_No",
                     length * n_tracks, count, length_m=length, detail=detail)
            add_item(asset_type, osm_class, "Rail_Ballast_0_80_No",
                     length * n_tracks, count, length_m=length, detail=detail)
            add_item(asset_type, osm_class, "Rail_Subballast_0_32_No",
                     length * n_tracks, count, length_m=length, detail=detail)

    # Ancillary nodes
    lamps = node_count.get(("lamp", "street_lamp"), 0)
    if lamps:
        add_item("lamp", "street_lamp", "Light_post_0.5tonne_12meters_No",
                 lamps, lamps)
    signs = node_count.get(("sign", "traffic_sign"), 0)
    if signs:
        add_item("sign", "traffic_sign", "Sign_post_No", signs, signs)
    bollards = node_count.get(("bollard", "bollard"), 0)
    if bollards:
        add_item("bollard", "bollard", "Bollard_Vol", bollards, bollards)
    crossings = node_count.get(("crossing", "level_crossing"), 0)
    if crossings:
        add_item("crossing", "level_crossing", "Road_Pavement_Flexible_Vol",
                 crossings * crossing_area, crossings,
                 detail="%.0f m2 paved panel per crossing (editable)"
                        % crossing_area)
    stations = node_count.get(("station", "station"), 0) + \
        node_count.get(("station", "halt"), 0) + \
        node_count.get(("station", "tram_stop"), 0)
    if stations:
        add_item("station", "station", "Pedestrian_Path_Vol",
                 stations * station_area, stations,
                 detail="%.0f m2 platform & surroundings per station (editable)"
                        % station_area)

    summary = {
        "bbox": bbox,
        "counts": {},
        "lengths_m": {},
        "total_features": len(features),
        "skipped": skipped,
        "n_items": len(items),
    }
    for (asset_type, osm_class), c in way_count.items():
        summary["counts"]["%s:%s" % (asset_type, osm_class)] = c
        summary["lengths_m"]["%s:%s" % (asset_type, osm_class)] = \
            round(way_len[(asset_type, osm_class)], 1)
    for (asset_type, osm_class), c in node_count.items():
        summary["counts"]["%s:%s" % (asset_type, osm_class)] = c

    return {"items": items, "summary": summary}


# ---------------------------------------------------------------------------
# CALCULATION
# ---------------------------------------------------------------------------

def calculate(payload):
    items = payload.get("items") or []
    params = payload.get("params") or {}

    poa = float(params.get("poa") or 60)                # period of analysis, years
    tf = float(params.get("traffic_factor") or 1.0)     # traffic factor
    wastage = float(params.get("wastage") or 0.0) / 100.0
    energy_red = float(params.get("energy_reduction") or 0.0) / 100.0
    water_red = float(params.get("water_reduction") or 0.0) / 100.0
    ghg_red = float(params.get("ghg_reduction") or 0.0) / 100.0
    tf_on_road = bool(params.get("tf_on_road", True))
    tf_on_rail = bool(params.get("tf_on_rail", True))
    pkt = params.get("pkt")  # optional PKT normalization (million passenger-km / 60 y)
    pkt = float(pkt) if pkt else None

    material_db = MaterialDatabase()
    element_db = ElementDatabase(material_db.material_db)

    totals = {
        "initial_mass": 0.0, "initial_energy": 0.0,
        "initial_water": 0.0, "initial_ghg": 0.0,
        "maint_mass": 0.0, "maint_energy": 0.0,
        "maint_water": 0.0, "maint_ghg": 0.0,
    }
    by_cat = {}
    for c in CATEGORIES:
        by_cat[c] = {
            "initial_mass": 0.0, "initial_energy": 0.0,
            "initial_water": 0.0, "initial_ghg": 0.0,
            "maint_mass": 0.0, "maint_energy": 0.0,
            "maint_water": 0.0, "maint_ghg": 0.0,
        }

    item_results = []
    warnings = []

    for item in items:
        if not item.get("included", True):
            continue
        key = item.get("element_key")
        if key not in element_db.element_db:
            warnings.append("Unknown element key: %s" % key)
            continue
        qty = float(item.get("qty") or 0.0)
        if qty <= 0:
            continue
        unit_imp = element_db.unit_impacts(key)

        # Traffic Factor applies to wear-sensitive elements only
        wear = unit_imp["wear_sensitive"]
        asset_type = item.get("asset_type")
        tf_eff = tf
        if wear and asset_type in ("road", "crossing") and not tf_on_road:
            tf_eff = 1.0
        if wear and asset_type in ("rail", "tram") and not tf_on_rail:
            tf_eff = 1.0
        if not wear:
            tf_eff = 1.0

        poa_factor = poa / 60.0

        # --- Initial (no time scaling; happens once) ---
        i_ghg = unit_imp["ghg"] * qty * (1 + wastage) * (1 - ghg_red)
        i_energy = unit_imp["energy"] * qty * (1 + wastage) * (1 - energy_red)
        i_water = unit_imp["water"] * qty * (1 + wastage) * (1 - water_red)
        i_mass = unit_imp["mass"] * qty * (1 + wastage)
        # --- Maintenance (scales with POA and TF) ---
        m_ghg = unit_imp["maint_ghg_60y"] * qty * poa_factor * tf_eff * \
            (1 + wastage) * (1 - ghg_red)
        m_energy = unit_imp["maint_energy_60y"] * qty * poa_factor * tf_eff * \
            (1 + wastage) * (1 - energy_red)
        m_water = unit_imp["maint_water_60y"] * qty * poa_factor * tf_eff * \
            (1 + wastage) * (1 - water_red)
        m_mass = unit_imp["maint_mass_60y"] * qty * poa_factor * tf_eff * \
            (1 + wastage)

        res = dict(item)
        res.update({
            "initial_ghg": i_ghg, "initial_energy": i_energy,
            "initial_water": i_water, "initial_mass": i_mass,
            "maint_ghg": m_ghg, "maint_energy": m_energy,
            "maint_water": m_water, "maint_mass": m_mass,
            "tf_effective": tf_eff,
        })
        item_results.append(res)

        totals["initial_ghg"] += i_ghg
        totals["initial_energy"] += i_energy
        totals["initial_water"] += i_water
        totals["initial_mass"] += i_mass
        totals["maint_ghg"] += m_ghg
        totals["maint_energy"] += m_energy
        totals["maint_water"] += m_water
        totals["maint_mass"] += m_mass

        for c in CATEGORIES:
            bc = by_cat[c]
            bc["initial_ghg"] += unit_imp["by_category_ghg"][c] * qty * \
                (1 + wastage) * (1 - ghg_red)
            bc["initial_energy"] += unit_imp["by_category_energy"][c] * qty * \
                (1 + wastage) * (1 - energy_red)
            bc["initial_water"] += unit_imp["by_category_water"][c] * qty * \
                (1 + wastage) * (1 - water_red)
            bc["initial_mass"] += unit_imp["by_category_mass"][c] * qty * (1 + wastage)
            bc["maint_ghg"] += unit_imp["by_category_maint_ghg"][c] * qty * \
                poa_factor * tf_eff * (1 + wastage) * (1 - ghg_red)
            bc["maint_energy"] += unit_imp["by_category_maint_energy"][c] * qty * \
                poa_factor * tf_eff * (1 + wastage) * (1 - energy_red)
            bc["maint_water"] += unit_imp["by_category_maint_water"][c] * qty * \
                poa_factor * tf_eff * (1 + wastage) * (1 - water_red)
            bc["maint_mass"] += unit_imp["by_category_maint_mass"][c] * qty * \
                poa_factor * tf_eff * (1 + wastage)

    # PKT normalization (functional unit: per million passenger-km over 60 y)
    pkt_div = pkt if (pkt and pkt > 0) else 1.0

    def norm(x):
        return x / pkt_div

    headline = {
        "total_mass_t": norm((totals["initial_mass"] + totals["maint_mass"]) / 1000.0),
        "initial": {
            "mass_t": norm(totals["initial_mass"] / 1000.0),
            "energy_MJ": norm(totals["initial_energy"]),
            "water_L": norm(totals["initial_water"]),
            "ghg_kgCO2e": norm(totals["initial_ghg"]),
        },
        "maintenance": {
            "mass_t": norm(totals["maint_mass"] / 1000.0),
            "energy_MJ": norm(totals["maint_energy"]),
            "water_L": norm(totals["maint_water"]),
            "ghg_kgCO2e": norm(totals["maint_ghg"]),
        },
        "total": {
            "mass_t": norm((totals["initial_mass"] + totals["maint_mass"]) / 1000.0),
            "energy_MJ": norm(totals["initial_energy"] + totals["maint_energy"]),
            "water_L": norm(totals["initial_water"] + totals["maint_water"]),
            "ghg_kgCO2e": norm(totals["initial_ghg"] + totals["maint_ghg"]),
        },
        "annualised_ghg_kgCO2e_per_year": norm(
            (totals["initial_ghg"] + totals["maint_ghg"]) / poa if poa > 0 else 0),
    }

    categories_out = []
    for c in CATEGORIES:
        d = by_cat[c]
        if all(abs(d[k]) < 1e-9 for k in d):
            continue
        categories_out.append({
            "category": c,
            "initial_mass_t": norm(d["initial_mass"] / 1000.0),
            "maint_mass_t": norm(d["maint_mass"] / 1000.0),
            "initial_energy_MJ": norm(d["initial_energy"]),
            "maint_energy_MJ": norm(d["maint_energy"]),
            "initial_water_L": norm(d["initial_water"]),
            "maint_water_L": norm(d["maint_water"]),
            "initial_ghg_kgCO2e": norm(d["initial_ghg"]),
            "maint_ghg_kgCO2e": norm(d["maint_ghg"]),
        })

    # CSV rows in the same "Parameter,Value" layout as the InfraSet Result
    # component (Result_InfraSet.py)
    csv_rows = [["Parameter", "Value"]]
    csv_rows.append(["Period of analysis (years)", poa])
    csv_rows.append(["Traffic factor", tf])
    csv_rows.append(["Wastage coefficient (%)", wastage * 100])
    csv_rows.append(["Energy reduction factor (%)", energy_red * 100])
    csv_rows.append(["Water reduction factor (%)", water_red * 100])
    csv_rows.append(["GHG reduction factor (%)", ghg_red * 100])
    if pkt:
        csv_rows.append(["PKT normalization (million passenger-km/60y)", pkt])
    for k, v in sorted(totals.items()):
        csv_rows.append([k, round(norm(v), 4)])
    csv_rows.append(["Total mass (t)", round(headline["total_mass_t"], 4)])
    for d in item_results:
        csv_rows.append(["%s | %s | qty %s %s | initial GHG (kgCO2e)"
                         % (d["asset_type"], d["element_key"], d["qty"], d["unit"]),
                         round(d["initial_ghg"], 4)])
        csv_rows.append(["%s | %s | qty %s %s | maintenance GHG (kgCO2e)"
                         % (d["asset_type"], d["element_key"], d["qty"], d["unit"]),
                         round(d["maint_ghg"], 4)])

    return {
        "headline": headline,
        "categories": categories_out,
        "items": item_results,
        "csv_rows": csv_rows,
        "warnings": warnings,
        "params_used": {
            "poa": poa, "traffic_factor": tf,
            "wastage_pct": wastage * 100,
            "energy_reduction_pct": energy_red * 100,
            "water_reduction_pct": water_red * 100,
            "ghg_reduction_pct": ghg_red * 100,
            "tf_on_road": tf_on_road, "tf_on_rail": tf_on_rail,
            "pkt": pkt,
        },
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ("match", "calc"):
        print("usage: infraset_engine.py match|calc  (JSON in, JSON out)",
              file=sys.stderr)
        sys.exit(2)
    mode = sys.argv[1]
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw) if raw.strip() else {}
    except ValueError as e:
        print(json.dumps({"error": "invalid JSON input: %s" % str(e)}))
        sys.exit(1)
    try:
        if mode == "match":
            out = match_features(payload)
        else:
            out = calculate(payload)
        json.dump(out, sys.stdout, separators=(",", ":"))
        sys.stdout.write("\n")
    except Exception as e:  # pragma: no cover
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
