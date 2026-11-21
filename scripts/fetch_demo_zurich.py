#!/usr/bin/env python3
"""Fetch a small Zürich HB–Hardbrücke extract from overpass.osm.ch and bundle
it as a third offline demo corridor for the InfraSet web tool."""
import json
import time
import urllib.request
import urllib.parse

BBOX = [47.375, 8.515, 47.395, 8.545]  # south, west, north, east
OUT = "/home/z/my-project/public/demo/zurich_hb_ch.json"

QUERY = f"""[out:json][timeout:120];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|living_street|busway)$"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["highway"~"^(footway|path|pedestrian|cycleway|steps)$"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["railway"~"^(rail|light_rail|subway|narrow_gauge)$"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["railway"="tram"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["railway"="platform"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  node["highway"="street_lamp"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  node["highway"~"^(stop|give_way)$"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  node["traffic_sign"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  node["barrier"="bollard"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  node["railway"="level_crossing"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  node["railway"~"^(station|halt|tram_stop)$"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
);
out geom;"""


def main() -> None:
    data = urllib.parse.urlencode({"data": QUERY}).encode()
    req = urllib.request.Request(
        "https://overpass.osm.ch/api/interpreter",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    print("Querying overpass.osm.ch ...")
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=150) as res:
        doc = json.loads(res.read().decode())
    elements = doc.get("elements", [])
    print(f"Got {len(elements)} elements in {time.time() - t0:.1f}s")

    # sanity: count classes
    n_rail = sum(1 for e in elements if e.get("type") == "way" and (e.get("tags") or {}).get("railway") in ("rail", "light_rail", "subway", "narrow_gauge"))
    n_tram = sum(1 for e in elements if e.get("type") == "way" and (e.get("tags") or {}).get("railway") == "tram")
    n_lamp = sum(1 for e in elements if (e.get("tags") or {}).get("highway") == "street_lamp")
    n_stations = sum(1 for e in elements if e.get("type") == "node" and (e.get("tags") or {}).get("railway") in ("station", "halt", "tram_stop"))
    print(f"rail ways: {n_rail}, tram ways: {n_tram}, lamps: {n_lamp}, stations: {n_stations}")

    out_doc = {
        "name": "Zürich HB – Hardbrücke rail & tram pocket (Switzerland)",
        "bbox": BBOX,
        "source": "OpenStreetMap extract via overpass.osm.ch (bundled for offline demo)",
        "elements": elements,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out_doc, f, ensure_ascii=False)
    print(f"Wrote {OUT} ({len(json.dumps(out_doc)) // 1024} KB)")


if __name__ == "__main__":
    main()
