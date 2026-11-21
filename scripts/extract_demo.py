#!/usr/bin/env python3
"""Extract demo OSM datasets for the two InfraSet thesis case-study corridors
using the main OSM API map endpoint (reachable from this sandbox), reconstruct
way geometries from nodes, filter to transport-relevant tags, and save them as
Overpass-like JSON files under public/demo/ so the web tool can load them as
offline demo corridors (identical shape to live Overpass responses)."""

import json
import math
import os
import xml.etree.ElementTree as ET
import urllib.request

OSM_API = "https://api.openstreetmap.org/api/0.6/map?bbox={l},{b},{r},{t}"

KEEP_WAY_TAGS = {
    "highway", "railway", "name", "service", "gauge", "electrified", "usage",
    "bridge", "tunnel", "layer", "public_transport",
}
KEEP_NODE_TAGS = {
    "highway", "railway", "barrier", "traffic_sign", "name",
    "public_transport", "crossing",
}

HIGHWAY_RE = {
    "motorway", "trunk", "primary", "secondary", "tertiary", "unclassified",
    "residential", "service", "living_street", "busway", "footway", "path",
    "pedestrian", "cycleway", "steps",
}
RAILWAY_RE = {
    "rail", "tram", "light_rail", "subway", "narrow_gauge", "platform",
    "station", "halt", "tram_stop", "level_crossing",
}

CORRIDORS = [
    {
        "slug": "louvain_ottignies_be",
        "name": "Louvain-la-Neuve - Ottignies rail corridor (Belgium, Line 161)",
        "bbox": (50.644, 4.560, 50.672, 4.630),
    },
    {
        "slug": "coburg_moreland_au",
        "name": "Coburg - Moreland / Upfield line (Melbourne, Australia)",
        "bbox": (-37.7505, 144.947, -37.741, 144.970),
    },
]


def http_get(url, timeout=180):
    req = urllib.request.Request(url, headers={"User-Agent": "InfraSet-demo-extract/1.0 (research demo)"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def parse_map_xml(xml_bytes):
    """Return (nodes dict, ways list) from an OSM API map response."""
    root = ET.fromstring(xml_bytes)
    nodes = {}
    node_tags = {}
    ways = []
    for child in root:
        if child.tag == "node":
            nid = int(child.get("id"))
            lat, lon = float(child.get("lat")), float(child.get("lon"))
            tags = {t.get("k"): t.get("v") for t in child.findall("tag")}
            nodes[nid] = (lat, lon)
            node_tags[nid] = tags
        elif child.tag == "way":
            wid = int(child.get("id"))
            refs = [int(n.get("ref")) for n in child.findall("nd")]
            tags = {t.get("k"): t.get("v") for t in child.findall("tag")}
            ways.append((wid, refs, tags))
    return nodes, node_tags, ways


def relevant_way(tags):
    hw = tags.get("highway")
    rw = tags.get("railway")
    return (hw in HIGHWAY_RE) or (rw in RAILWAY_RE)


def relevant_node(tags):
    hw = tags.get("highway")
    rw = tags.get("railway")
    bar = tags.get("barrier")
    ts = tags.get("traffic_sign")
    if hw == "street_lamp":
        return True
    if hw in ("give_way", "stop"):
        return True
    if rw in ("station", "halt", "tram_stop", "level_crossing"):
        return True
    if bar == "bollard":
        return True
    if ts is not None:
        return True
    return False


def fetch_tile(l, b, r, t):
    xml_bytes = http_get(OSM_API.format(l=round(l, 5), b=round(b, 5), r=round(r, 5), t=round(t, 5)))
    return parse_map_xml(xml_bytes)


def fetch_tile_resilient(l, b, r, t):
    """Fetch a tile with retries and backoff (the OSM API rate-limits rapid
    consecutive requests). Returns parsed (nodes, node_tags, ways) or None
    if the tile keeps failing after retries."""
    import time
    for attempt in range(4):
        try:
            return fetch_tile(l, b, r, t)
        except urllib.error.HTTPError as e:
            print("      HTTP %s (attempt %d) for tile %s" % (e.code, attempt + 1, (l, b, r, t)), flush=True)
            time.sleep(12 + attempt * 10)
        except Exception as e:
            print("      ERR %s (attempt %d)" % (e, attempt + 1), flush=True)
            time.sleep(12 + attempt * 10)
    return None


def fetch_bbox(bbox):
    """Fetch a bbox, splitting into tiles; on node-limit errors split recursively.
    Incoming bbox is (south, west, north, east); internal vars use
    (left=west, bottom=south, right=east, top=north) as the OSM API expects."""
    s, w, n, e = bbox
    l, b, r, t = w, s, e, n
    all_nodes = {}
    all_node_tags = {}
    ways = {}
    tried_tiles = []

    def tile_size_ok(l, b, r, t):
        # initial tile size in degrees
        return (r - l) <= 0.02 and (t - b) <= 0.015

    def _absorb(result):
        nodes, node_tags, ws = result
        for nid, ll in nodes.items():
            all_nodes[nid] = ll
        for nid, tg in node_tags.items():
            all_node_tags[nid] = tg
        for wid, refs, tags in ws:
            ways[wid] = (refs, tags)

    def process(l, b, r, t, depth=0):
        import time
        if depth > 4:
            print("    [warn] giving up on tiny tile", l, b, r, t, flush=True)
            return
        print("    tile depth", depth, round(l, 4), round(b, 4), round(r, 4), round(t, 4), flush=True)
        time.sleep(8)  # be gentle with the public OSM API (rate limits)
        result = fetch_tile_resilient(l, b, r, t)
        if result is None:
            # final retry failed -> split into 4 and try the pieces once
            lm, bm = (l + r) / 2.0, (b + t) / 2.0
            for (a, bb, c, dd) in ((l, b, lm, bm), (lm, b, r, bm), (l, bm, lm, t), (lm, bm, r, t)):
                if depth + 1 <= 4:
                    time.sleep(8)
                    sub = fetch_tile_resilient(a, bb, c, dd)
                    if sub is not None:
                        _absorb(sub)
                    else:
                        print("    [warn] tile lost:", a, bb, c, dd, flush=True)
            return
        _absorb(result)

    # build initial tile grid
    lat_span = t - b
    lon_span = r - l
    n_lat = max(1, math.ceil(lat_span / 0.02))
    n_lon = max(1, math.ceil(lon_span / 0.025))
    for i in range(n_lon):
        for j in range(n_lat):
            tl = l + i * lon_span / n_lon
            tr = l + (i + 1) * lon_span / n_lon
            tb = b + j * lat_span / n_lat
            tt = b + (j + 1) * lat_span / n_lat
            process(tl, tb, tr, tt)

    return all_nodes, all_node_tags, ways


def build_elements(nodes, node_tags, ways):
    elements = []

    # relevant standalone nodes
    for nid, tags in node_tags.items():
        if relevant_node(tags):
            kept = {k: v for k, v in tags.items() if k in KEEP_NODE_TAGS}
            lat, lon = nodes[nid]
            elements.append({
                "type": "node", "id": nid, "lat": round(lat, 6), "lon": round(lon, 6),
                "tags": kept,
            })

    # relevant ways with reconstructed geometry
    for wid, (refs, tags) in ways.items():
        if not relevant_way(tags):
            continue
        geom = []
        for ref in refs:
            if ref in nodes:
                lat, lon = nodes[ref]
                geom.append({"lat": round(lat, 6), "lon": round(lon, 6)})
        if len(geom) < 2:
            continue
        kept = {k: v for k, v in tags.items() if k in KEEP_WAY_TAGS}
        elements.append({
            "type": "way", "id": wid, "geometry": geom, "tags": kept,
        })

    # dedupe by (type,id)
    seen = set()
    uniq = []
    for el in elements:
        key = (el["type"], el["id"])
        if key in seen:
            continue
        seen.add(key)
        uniq.append(el)
    return uniq


def main():
    import sys
    slugs = sys.argv[1:] or [c["slug"] for c in CORRIDORS]
    out_dir = "/home/z/my-project/public/demo"
    os.makedirs(out_dir, exist_ok=True)
    for c in CORRIDORS:
        if c["slug"] not in slugs:
            continue
        print("Fetching", c["slug"], "...", flush=True)
        nodes, node_tags, ways = fetch_bbox(c["bbox"])
        print("  nodes:", len(nodes), "ways:", len(ways), flush=True)
        elements = build_elements(nodes, node_tags, ways)
        doc = {
            "name": c["name"],
            "bbox": list(c["bbox"]),
            "source": "OpenStreetMap via OSM API 0.6 map endpoint, extracted 2026-11-20 (ODbL)",
            "elements": elements,
        }
        path = os.path.join(out_dir, c["slug"] + ".json")
        with open(path, "w") as f:
            json.dump(doc, f, separators=(",", ":"))
        size_kb = os.path.getsize(path) / 1024.0
        stats = {}
        for el in elements:
            tags = el.get("tags") or {}
            key = tags.get("railway") or tags.get("highway") or tags.get("barrier") or tags.get("traffic_sign") or "other"
            stats[key] = stats.get(key, 0) + 1
        print("  saved", path, "%.1f KB" % size_kb, "| elements:", len(elements))
        print("  stats:", json.dumps(stats, sort_keys=True))


if __name__ == "__main__":
    import urllib.error
    main()
