# -*- coding: utf-8 -*-
"""
InfraSet database module (web adaptation).

Material database and element recipes are ported faithfully from the InfraSet
Grasshopper backend (Backend_InfraSet (4).py, module Infraset238) authored for:

    Ataee, S. "InfraSet: A Parametric Life Cycle Assessment and Material Flow
    Analysis Model for Transport Infrastructure Assets", PhD thesis, UCLouvain.

Coefficients are per functional unit (FU = 1 m3 of material), sourced from the
EPiC hybrid LCA database as used in the thesis:
    - Embodied GHG        kgCO2e / m3
    - Embodied energy     MJ / m3
    - Embodied water      L / m3
    - Life span           years
    - Density             kg / m3

Notes:
  * "Concrete_28_MPA" is referenced by the Rail_Concrete_Sleeper_No recipe in
    the uploaded backend but was not defined in the material table; it is
    defined here as a standard structural concrete so the sleeper recipe works.
  * Layer material names are matched case/underscore-insensitively
    (the thesis "key-name normalization" fix), e.g. "Recycled_aggregate"
    matches the database entry "Recycled aggregate".
"""

MATERIAL_DATA = [
    {"Material": "Steel", "Categories": "Metals",
     "Embodied_GHG_Coefficient": 11358, "Embodied_Energy_Coefficient": 184172,
     "Embodied_Water_Coefficient": 203542, "Life_Span": 100, "Density": 7740},
    {"Material": "Concrete", "Categories": "Concrete and plaster products",
     "Embodied_GHG_Coefficient": 336, "Embodied_Energy_Coefficient": 3640,
     "Embodied_Water_Coefficient": 5180, "Life_Span": 100, "Density": 1400},
    {"Material": "Cement", "Categories": "Concrete and plaster products",
     "Embodied_GHG_Coefficient": 1950, "Embodied_Energy_Coefficient": 16520,
     "Embodied_Water_Coefficient": 10920, "Life_Span": 100, "Density": 1500},
    {"Material": "Wood", "Categories": "Timber",
     "Embodied_GHG_Coefficient": 944, "Embodied_Energy_Coefficient": 13632,
     "Embodied_Water_Coefficient": 19110, "Life_Span": 80, "Density": 430},
    {"Material": "Painting", "Categories": "Miscellaneous",
     "Embodied_GHG_Coefficient": 8500, "Embodied_Energy_Coefficient": 133200,
     "Embodied_Water_Coefficient": 247000, "Life_Span": 1, "Density": 1250},
    {"Material": "Polycarbonate", "Categories": "Plastics",
     "Embodied_GHG_Coefficient": 16800, "Embodied_Energy_Coefficient": 228000,
     "Embodied_Water_Coefficient": 318000, "Life_Span": 25, "Density": 1200},
    {"Material": "uPVC", "Categories": "Plastics",
     "Embodied_GHG_Coefficient": 5838, "Embodied_Energy_Coefficient": 106097,
     "Embodied_Water_Coefficient": 779390, "Life_Span": 35, "Density": 1390},
    {"Material": "Gravel", "Categories": "Sand, stone and ceramics",
     "Embodied_GHG_Coefficient": 66.24, "Embodied_Energy_Coefficient": 897.6,
     "Embodied_Water_Coefficient": 3496, "Life_Span": 30, "Density": 1840},
    {"Material": "Sand", "Categories": "Sand, stone and ceramics",
     "Embodied_GHG_Coefficient": 36, "Embodied_Energy_Coefficient": 510,
     "Embodied_Water_Coefficient": 2700, "Life_Span": 30, "Density": 1500},
    {"Material": "Asphalt", "Categories": "Miscellaneous",
     "Embodied_GHG_Coefficient": 530, "Embodied_Energy_Coefficient": 1125.8,
     "Embodied_Water_Coefficient": 7672, "Life_Span": 100, "Density": 2649},
    {"Material": "Aluminium", "Categories": "Metals",
     "Embodied_GHG_Coefficient": 79677, "Embodied_Energy_Coefficient": 1039096,
     "Embodied_Water_Coefficient": 661408, "Life_Span": 50, "Density": 2712},
    {"Material": "Recycled aggregate", "Categories": "Sand, stone and ceramics",
     "Embodied_GHG_Coefficient": 10.56, "Embodied_Energy_Coefficient": 145.2,
     "Embodied_Water_Coefficient": 132, "Life_Span": 100, "Density": 1320},
    {"Material": "Hot_rolled_structural_steel", "Categories": "Metals",
     "Embodied_GHG_Coefficient": 22790, "Embodied_Energy_Coefficient": 304640,
     "Embodied_Water_Coefficient": 291490, "Life_Span": 100, "Density": 7850},
    {"Material": "Concrete_25_MPA", "Categories": "Concrete and plaster products",
     "Embodied_GHG_Coefficient": 361, "Embodied_Energy_Coefficient": 2581,
     "Embodied_Water_Coefficient": 4200, "Life_Span": 100, "Density": 2409},
    {"Material": "uPVC pipe - 114.3 mm outer dia., 4.85 mm thick", "Categories": "Plastics",
     "Embodied_GHG_Coefficient": 5808.4, "Embodied_Energy_Coefficient": 106047.9,
     "Embodied_Water_Coefficient": 779041.9, "Life_Span": 25, "Density": 1400},
    {"Material": "uPVC pipe - 225.3 mm outer dia., 11.1 mm thick", "Categories": "Plastics",
     "Embodied_GHG_Coefficient": 5760.0, "Embodied_Energy_Coefficient": 105600.0,
     "Embodied_Water_Coefficient": 776800.0, "Life_Span": 25, "Density": 1400},
    {"Material": "Double_glazing_flat_glass_20mm", "Categories": "Glass",
     "Embodied_GHG_Coefficient": 5050, "Embodied_Energy_Coefficient": 66800,
     "Embodied_Water_Coefficient": 77900, "Life_Span": 25, "Density": 2600},
    {"Material": "RockWool_insulation", "Categories": "Insulation",
     "Embodied_GHG_Coefficient": 266, "Embodied_Energy_Coefficient": 3997,
     "Embodied_Water_Coefficient": 4354, "Life_Span": 25, "Density": 70},
    {"Material": "Concrete_55_MPA__0pct_SCM", "Categories": "Concrete and plaster products",
     "Embodied_GHG_Coefficient": 470, "Embodied_Energy_Coefficient": 4500,
     "Embodied_Water_Coefficient": 5180, "Life_Span": 100, "Density": 2400},
    {"Material": "Concrete_50_MPA_25pct_SCM", "Categories": "Concrete and plaster products",
     "Embodied_GHG_Coefficient": 336, "Embodied_Energy_Coefficient": 3220,
     "Embodied_Water_Coefficient": 3970, "Life_Span": 100, "Density": 2409},
    {"Material": "Concrete_40_MPA_25pct_SCM", "Categories": "Concrete and plaster products",
     "Embodied_GHG_Coefficient": 336 * 0.75, "Embodied_Energy_Coefficient": 3640 * 0.75,
     "Embodied_Water_Coefficient": 5180 * 0.75, "Life_Span": 100, "Density": 2400},
    {"Material": "Concrete_25_MPA_30pct_SCM", "Categories": "Concrete and plaster products",
     "Embodied_GHG_Coefficient": 336 * 0.70, "Embodied_Energy_Coefficient": 3640 * 0.70,
     "Embodied_Water_Coefficient": 5180 * 0.70, "Life_Span": 100, "Density": 2350},
    {"Material": "Reinforced_Concrete_Pipe_RCP", "Categories": "Concrete and plaster products",
     "Embodied_GHG_Coefficient": 336, "Embodied_Energy_Coefficient": 3640,
     "Embodied_Water_Coefficient": 5180, "Life_Span": 100, "Density": 2400},
    {"Material": "PE_Pipe_HDPE", "Categories": "Plastics",
     "Embodied_GHG_Coefficient": 1800, "Embodied_Energy_Coefficient": 75000,
     "Embodied_Water_Coefficient": 220000, "Life_Span": 50, "Density": 950},
    {"Material": "PVC_Pipe", "Categories": "Plastics",
     "Embodied_GHG_Coefficient": 2200, "Embodied_Energy_Coefficient": 85000,
     "Embodied_Water_Coefficient": 250000, "Life_Span": 40, "Density": 1400},
    {"Material": "Steel_UC_WC_Sections", "Categories": "Metals",
     "Embodied_GHG_Coefficient": 113578, "Embodied_Energy_Coefficient": 1841720,
     "Embodied_Water_Coefficient": 2035420, "Life_Span": 100, "Density": 7850},
    {"Material": "Steel_Reinforcing_Bar", "Categories": "Metals",
     "Embodied_GHG_Coefficient": 11382, "Embodied_Energy_Coefficient": 184172,
     "Embodied_Water_Coefficient": 203542, "Life_Span": 100, "Density": 7850},
    {"Material": "Crushed_Rock", "Categories": "Sand, stone and ceramics",
     "Embodied_GHG_Coefficient": 66.24, "Embodied_Energy_Coefficient": 897.6,
     "Embodied_Water_Coefficient": 3496, "Life_Span": 100, "Density": 2450},
    {"Material": "General_Fill", "Categories": "Sand, stone and ceramics",
     "Embodied_GHG_Coefficient": 15, "Embodied_Energy_Coefficient": 200,
     "Embodied_Water_Coefficient": 500, "Life_Span": 100, "Density": 1800},
    {"Material": "Stabilised_Sand", "Categories": "Sand, stone and ceramics",
     "Embodied_GHG_Coefficient": 36 + (1950 * 0.1), "Embodied_Energy_Coefficient": 510 + (16520 * 0.1),
     "Embodied_Water_Coefficient": 2700 + (10920 * 0.1), "Life_Span": 50, "Density": 1900},
    {"Material": "Rail_Ballast_0_80", "Categories": "Sand, stone and ceramics",
     "Embodied_GHG_Coefficient": 66.24, "Embodied_Energy_Coefficient": 897.6,
     "Embodied_Water_Coefficient": 3496, "Life_Span": 30, "Density": 1800},
    {"Material": "Rail_Subballast_0_32", "Categories": "Sand, stone and ceramics",
     "Embodied_GHG_Coefficient": 66.24, "Embodied_Energy_Coefficient": 897.6,
     "Embodied_Water_Coefficient": 3496, "Life_Span": 30, "Density": 1700},
    {"Material": "Rail_Bedding_Asphalt", "Categories": "Miscellaneous",
     "Embodied_GHG_Coefficient": 530, "Embodied_Energy_Coefficient": 1125.8,
     "Embodied_Water_Coefficient": 7672, "Life_Span": 20, "Density": 2350},
    {"Material": "Aluminum", "Categories": "Metals",
     "Embodied_GHG_Coefficient": 8000, "Embodied_Energy_Coefficient": 150000,
     "Embodied_Water_Coefficient": 50000, "Life_Span": 60, "Density": 2700},
    {"Material": "Mild_Steel", "Categories": "Metals",
     "Embodied_GHG_Coefficient": 17000, "Embodied_Energy_Coefficient": 280000,
     "Embodied_Water_Coefficient": 310000, "Life_Span": 100, "Density": 7850},
    {"Material": "General_Polymer", "Categories": "Plastics",
     "Embodied_GHG_Coefficient": 10000, "Embodied_Energy_Coefficient": 160000,
     "Embodied_Water_Coefficient": 15000, "Life_Span": 50, "Density": 1800},
    {"Material": "Concrete_50_MPA_20pct_SCM", "Categories": "Concrete and plaster products",
     "Embodied_GHG_Coefficient": 320, "Embodied_Energy_Coefficient": 3600,
     "Embodied_Water_Coefficient": 4600, "Life_Span": 100, "Density": 2500},
    {"Material": "Fly ash", "Categories": "Concrete and plaster products",
     "Embodied_GHG_Coefficient": 100, "Embodied_Energy_Coefficient": 1000,
     "Embodied_Water_Coefficient": 500, "Life_Span": 100, "Density": 2200},
    # Referenced by the Rail_Concrete_Sleeper_No recipe in the uploaded backend
    # but absent from its material table; defined here as standard structural
    # concrete (design life 50 years per the recipe comment).
    {"Material": "Concrete_28_MPA", "Categories": "Concrete and plaster products",
     "Embodied_GHG_Coefficient": 336, "Embodied_Energy_Coefficient": 3640,
     "Embodied_Water_Coefficient": 5180, "Life_Span": 50, "Density": 2400},
]

CATEGORIES = [
    "Concrete and plaster products", "Plastics", "Metals", "Miscellaneous",
    "Sand, stone and ceramics", "Timber", "Glass", "Insulation",
]


def _norm_key(name):
    return name.lower().replace("_", " ").replace("-", " ").strip()


class MaterialDatabase(object):
    """Material database with normalized lookup (key-name normalization)."""

    def __init__(self):
        self.material_db = {}
        self._norm_index = {}
        for mat in MATERIAL_DATA:
            entry = {
                "Embodied_GHG_Coefficient_(kgCO2e/FU)": mat["Embodied_GHG_Coefficient"],
                "Embodied_Energy_Coefficient_(MJ/FU)": mat["Embodied_Energy_Coefficient"],
                "Embodied_Water_Coefficient_(L/FU)": mat["Embodied_Water_Coefficient"],
                "Life_Span_(Years)": mat["Life_Span"],
                "Density_(kg/m3)": mat["Density"],
                "Categories": mat["Categories"],
            }
            self.material_db[mat["Material"]] = entry
            self._norm_index[_norm_key(mat["Material"])] = entry

    def get(self, material_name):
        """Case/underscore-insensitive material lookup."""
        if material_name in self.material_db:
            return self.material_db[material_name]
        return self._norm_index.get(_norm_key(material_name))


# ---------------------------------------------------------------------------
# Element recipes (port of the relevant entries of populate_elements()).
# Each layer thickness is expressed in m3 of material per functional unit of
# the element (1 m2 surface for *_Vol area elements, 1 m for per-metre track
# elements, 1 unit for *_No count elements), exactly as in the InfraSet model.
# replacement_factor = number of replacements over the 60-year reference
# period (e.g. asphalt pavement DL 20 y -> 60/20 = 3).
# ---------------------------------------------------------------------------

ELEMENT_RECIPES = {
    "Road_Pavement_Flexible_Vol": {
        "label": "Flexible road pavement",
        "unit": "m2",
        "unit_label": "m2 of pavement surface",
        "replacement_factor": 3,  # DL = 20 years -> 60/20 = 3
        "wear_sensitive": True,
        "layers": [
            {"material": "Asphalt", "thickness_m": 0.15},
            {"material": "Crushed_Rock", "thickness_m": 0.30},
            {"material": "Recycled_aggregate", "thickness_m": 0.20},
        ],
    },
    "Pedestrian_Path_Vol": {
        "label": "Pedestrian path / platform surface",
        "unit": "m2",
        "unit_label": "m2 of path surface",
        "replacement_factor": 3,
        "wear_sensitive": False,
        "layers": [
            {"material": "Concrete_25_MPA_30pct_SCM", "thickness_m": 0.12},
            {"material": "Sand", "thickness_m": 0.10},
            {"material": "Crushed_Rock", "thickness_m": 0.15},
        ],
    },
    "Light_post_0.5tonne_12meters_No": {
        "label": "Light post (12 m, 0.5 t class)",
        "unit": "No",
        "unit_label": "light post",
        "replacement_factor": 0.5,
        "wear_sensitive": False,
        "layers": [
            {"material": "Painting", "thickness_m": 0.0008},
            {"material": "Concrete", "thickness_m": 0.07},
            {"material": "Hot_rolled_structural_steel", "thickness_m": 0.15},
            {"material": "Polycarbonate", "thickness_m": 0.0025},
            {"material": "Steel", "thickness_m": 0.007},
        ],
    },
    "Sign_post_No": {
        "label": "Sign post",
        "unit": "No",
        "unit_label": "sign post",
        "replacement_factor": 2,
        "wear_sensitive": False,
        "layers": [
            {"material": "Painting", "thickness_m": 0.2},
            {"material": "Concrete", "thickness_m": 0.036},
            {"material": "Steel", "thickness_m": 0.07},
        ],
    },
    "Tram_post_0.2tonne_6meters_No": {
        "label": "Tram / catenary post (6 m, 0.2 t class)",
        "unit": "No",
        "unit_label": "tram post",
        "replacement_factor": 1,
        "wear_sensitive": False,
        "layers": [
            {"material": "Painting", "thickness_m": 0.0008},
            {"material": "Concrete", "thickness_m": 0.09},
            {"material": "Steel", "thickness_m": 0.017},
            {"material": "Hot_rolled_structural_steel", "thickness_m": 0.002},
        ],
    },
    "Steel_Railing_No": {
        "label": "Steel railing",
        "unit": "No",
        "unit_label": "railing unit",
        "replacement_factor": 1,
        "wear_sensitive": False,
        "layers": [
            {"material": "Painting", "thickness_m": 0.00008},
            {"material": "Concrete", "thickness_m": 0.0125},
            {"material": "Steel", "thickness_m": 0.0022},
        ],
    },
    "Bollard_Vol": {
        "label": "Bollard",
        "unit": "No",
        "unit_label": "bollard",
        "replacement_factor": 1,
        "wear_sensitive": False,
        "layers": [
            {"material": "Hot_rolled_structural_steel", "thickness_m": 0.10},
            {"material": "Painting", "thickness_m": 0.0008},
        ],
    },
    "Rail_Steel_Rail_60kgm": {
        "label": "Steel rail UIC60",
        "unit": "m",
        "unit_label": "m of single rail",
        "replacement_factor": 1,
        "wear_sensitive": True,
        "layers": [
            {"material": "Steel", "thickness_m": 0.0076},  # 60 kg/m / 7740 kg/m3
        ],
    },
    "Rail_Concrete_Sleeper_No": {
        "label": "Concrete sleeper (per m of track)",
        "unit": "m",
        "unit_label": "m of track",
        "replacement_factor": 1,
        "wear_sensitive": True,
        "layers": [
            {"material": "Concrete_28_MPA", "thickness_m": 0.143},
        ],
    },
    "Rail_Ballast_0_80_No": {
        "label": "Rail ballast 0/80 (per m of track)",
        "unit": "m",
        "unit_label": "m of track",
        "replacement_factor": 1,
        "wear_sensitive": True,
        "layers": [
            {"material": "Rail_Ballast_0_80", "thickness_m": 1.015},
        ],
    },
    "Rail_Subballast_0_32_No": {
        "label": "Rail sub-ballast 0/32 (per m of track)",
        "unit": "m",
        "unit_label": "m of track",
        "replacement_factor": 1,
        "wear_sensitive": True,
        "layers": [
            {"material": "Rail_Subballast_0_32", "thickness_m": 1.16},
        ],
    },
    "Rail_Bedding_Asphalt_No": {
        "label": "Rail bedding asphalt (slab track, per m)",
        "unit": "m",
        "unit_label": "m of track",
        "replacement_factor": 1,
        "wear_sensitive": False,
        "layers": [
            {"material": "Rail_Bedding_Asphalt", "thickness_m": 0.464},
        ],
    },
}


class ElementDatabase(object):
    def __init__(self, material_db=None):
        self.material_db = material_db if material_db is not None else MaterialDatabase()
        self.element_db = ELEMENT_RECIPES

    def unit_impacts(self, element_key):
        """Compute per-unit initial impacts and mass by material category for
        an element recipe (mirrors Infraset calculate_embodied_metrics)."""
        recipe = self.element_db[element_key]
        res = {
            "mass": 0.0,
            "energy": 0.0,
            "water": 0.0,
            "ghg": 0.0,
            "by_category_mass": {c: 0.0 for c in CATEGORIES},
            "by_category_energy": {c: 0.0 for c in CATEGORIES},
            "by_category_water": {c: 0.0 for c in CATEGORIES},
            "by_category_ghg": {c: 0.0 for c in CATEGORIES},
            "layers": [],
            "missing_materials": [],
        }
        for layer in recipe["layers"]:
            mat = self.material_db.get(layer["material"])
            if mat is None:
                res["missing_materials"].append(layer["material"])
                continue
            vol = layer["thickness_m"]  # m3 per functional unit
            ghg = vol * mat["Embodied_GHG_Coefficient_(kgCO2e/FU)"]
            energy = vol * mat["Embodied_Energy_Coefficient_(MJ/FU)"]
            water = vol * mat["Embodied_Water_Coefficient_(L/FU)"]
            mass = vol * mat["Density_(kg/m3)"]
            cat = mat["Categories"]
            res["ghg"] += ghg
            res["energy"] += energy
            res["water"] += water
            res["mass"] += mass
            res["by_category_ghg"][cat] += ghg
            res["by_category_energy"][cat] += energy
            res["by_category_water"][cat] += water
            res["by_category_mass"][cat] += mass
            res["layers"].append({
                "material": layer["material"],
                "category": cat,
                "thickness_m": layer["thickness_m"],
                "mass_kg": round(mass, 3),
            })
        # Maintenance over the 60-year reference period = initial x replacements
        rf = recipe["replacement_factor"]
        res["maint_energy_60y"] = res["energy"] * rf
        res["maint_water_60y"] = res["water"] * rf
        res["maint_ghg_60y"] = res["ghg"] * rf
        res["maint_mass_60y"] = res["mass"] * rf
        for cat in CATEGORIES:
            res["by_category_maint_energy"] = res.get("by_category_maint_energy", {c: 0.0 for c in CATEGORIES})
            res["by_category_maint_water"] = res.get("by_category_maint_water", {c: 0.0 for c in CATEGORIES})
            res["by_category_maint_ghg"] = res.get("by_category_maint_ghg", {c: 0.0 for c in CATEGORIES})
            res["by_category_maint_mass"] = res.get("by_category_maint_mass", {c: 0.0 for c in CATEGORIES})
            res["by_category_maint_energy"][cat] = res["by_category_energy"][cat] * rf
            res["by_category_maint_water"][cat] = res["by_category_water"][cat] * rf
            res["by_category_maint_ghg"][cat] = res["by_category_ghg"][cat] * rf
            res["by_category_maint_mass"][cat] = res["by_category_mass"][cat] * rf
        res["replacement_factor"] = rf
        res["wear_sensitive"] = recipe["wear_sensitive"]
        res["unit"] = recipe["unit"]
        res["unit_label"] = recipe["unit_label"]
        return res
