#!/usr/bin/env python3
"""Validate that OSM API 0.6 map-call XML can be converted to the Overpass-style
element JSON the InfraSet engine expects (nodes with tags, ways with geometry),
including checking whether returned ways have complete node references."""
import json
import re
import subprocess

XML = open("/tmp/osmapi_test.xml", encoding="utf-8").read()

ATTR = re.compile(r'(\w+)="([^"]*)"')

# --- parse nodes ---
nodes = {}
way_blocks = []
for m in re.finditer(r'<node\s+([^>]*?)/?>', XML):
    attrs = dict(ATTR.findall(m.group(1)))
    if "id" in attrs:
        nodes[int(attrs["id"])] = (float(attrs["lat"]), float(attrs["lon"]))
print("nodes parsed:", len(nodes))

for m in re.finditer(r'<way\s+([^>]*?)>(.*?)</way>', XML, re.S):
    attrs = dict(ATTR.findall(m.group(1)))
    body = m.group(2)
    refs = [int(r) for r in re.findall(r'<nd ref="(\d+)"', body)]
    tags = {k: v for k, v in re.findall(r'<tag k="([^"]+)" v="([^"]+)"', body)}
    way_blocks.append((int(attrs["id"]), refs, tags))
print("ways parsed:", len(way_blocks))

missing = 0
partial_ways = 0
for wid, refs, tags in way_blocks:
    miss = sum(1 for r in refs if r not in nodes)
    missing += miss
    if miss:
        partial_ways += 1
print("missing node refs:", missing, "| ways with missing refs:", partial_ways)

HIGHWAY_RE = re.compile(r"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|living_street|busway|footway|path|pedestrian|cycleway|steps)$")
NODE_OK = {
    ("highway", "street_lamp"), ("highway", "stop"), ("highway", "give_way"),
    ("barrier", "bollard"), ("railway", "level_crossing"),
    ("railway", "station"), ("railway", "halt"), ("railway", "tram_stop"),
}

def way_keep(t):
    h = t.get("highway", "")
    r = t.get("railway", "")
    if h and HIGHWAY_RE.match(h):
        return True
    if r in ("rail", "light_rail", "subway", "narrow_gauge", "tram", "platform"):
        return True
    return False

def node_keep(t):
    for (k, v) in NODE_OK:
        if t.get(k) == v:
            return True
    if t.get("traffic_sign"):
        return True
    return False

elements = []
for wid, refs, tags in way_blocks:
    if not way_keep(tags):
        continue
    geom = [{"lat": nodes[r][0], "lon": nodes[r][1]} for r in refs if r in nodes]
    if len(geom) >= 2:
        elements.append({"type": "way", "id": wid, "tags": tags, "geometry": geom})
for nid, (lat, lon) in nodes.items():
    pass  # tags needed - re-scan
node_tags = {}
for m in re.finditer(r'<node\s+([^>]*?)>(.*?)</node>', XML, re.S):
    attrs = dict(ATTR.findall(m.group(1)))
    tags = {k: v for k, v in re.findall(r'<tag k="([^"]+)" v="([^"]+)"', m.group(2))}
    if tags and node_keep(tags):
        node_tags[int(attrs["id"])] = {"type": "node", "id": int(attrs["id"]),
                                       "lat": float(attrs["lat"]), "lon": float(attrs["lon"]), "tags": tags}
for nid, el in node_tags.items():
    elements.append(el)
print("filtered elements:", len(elements),
      "| ways:", sum(1 for e in elements if e["type"] == "way"),
      "| nodes:", sum(1 for e in elements if e["type"] == "node"))

payload = {"bbox": [50.663, 4.555, 50.673, 4.575],
           "params": {"double_track": 2, "platform_width": 3, "station_area": 150, "crossing_area": 60},
           "features": elements}
r = subprocess.run(["python3", "/home/z/my-project/engine/infraset_engine.py", "match"],
                   input=json.dumps(payload).encode(), capture_output=True, timeout=60)
res = json.loads(r.stdout)
print("engine items:", len(res["items"]), "| total_features:", res["summary"]["total_features"], "| skipped:", res["summary"]["skipped"])
for it in res["items"][:6]:
    print("  -", it["asset_type"], "|", it["element_label"], "|", round(it["qty"], 1), it["unit"])
