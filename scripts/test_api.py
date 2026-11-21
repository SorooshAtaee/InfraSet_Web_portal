"""End-to-end test of the InfraSet web tool API (match + calculate)."""
import json
import urllib.request

BASE = "http://localhost:3000"


def post(path, payload):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload).encode(),
        headers={"content-type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode())


for slug in ("louvain_ottignies_be", "coburg_moreland_au"):
    with open(f"/home/z/my-project/public/demo/{slug}.json") as f:
        doc = json.load(f)
    print(f"--- {slug}: {doc['name']} ({len(doc['elements'])} elements)")

    match = post("/api/infraset/match", {
        "bbox": doc["bbox"],
        "params": {"double_track": 2, "platform_width": 3.0,
                   "station_area": 150.0, "crossing_area": 60.0},
        "features": doc["elements"],
    })
    s = match["summary"]
    print(f"  match: {match['summary']['n_items']} groups, "
          f"total_features={s['total_features']}, skipped={s['skipped']}")
    rails = {k: v for k, v in s["lengths_m"].items()
             if k.startswith(("rail:", "tram:"))}
    print(f"  rail/tram lengths: {rails}")

    calc = post("/api/infraset/calculate", {
        "items": match["items"],
        "params": {"poa": 60, "traffic_factor": 1.5, "wastage": 5,
                   "energy_reduction": 0, "water_reduction": 0,
                   "ghg_reduction": 10, "tf_on_road": True,
                   "tf_on_rail": True},
    })
    h = calc["headline"]
    print(f"  calc: total mass {h['total']['mass_t']:.1f} t, "
          f"GHG {h['total']['ghg_kgCO2e']:.0f} kgCO2e, "
          f"energy {h['total']['energy_MJ']:.0f} MJ, "
          f"water {h['total']['water_L']:.0f} L")
    print(f"  categories: {[c['category'] for c in calc['categories']]}")
    print(f"  warnings: {calc['warnings']}")
print("OK")
