# -*- coding: utf-8 -*-
"""Build the InfraSet Grasshopper plugin ZIP from the author's uploaded files."""
import os
import zipfile

UPLOAD = "/home/z/my-project/upload"
OUT_DIR = "/home/z/my-project/public/plugins"
ZIP_PATH = os.path.join(OUT_DIR, "InfraSet_Grasshopper_plugin_v0.2.zip")

FILES = [
    # (source in upload/, name inside the package)
    ("Backend_InfraSet (4).py", "Infraset238.py"),
    ("Frontend_element_InfraSet (1).py", "Frontend_element_InfraSet.py"),
    ("Frontend_assembly_InfraSet (1).py", "Frontend_assembly_InfraSet.py"),
    ("Frontend_Infrastructure_InfraSet (1).py", "Frontend_Infrastructure_InfraSet.py"),
    ("Result_InfraSet (1).py", "Result_InfraSet.py"),
]

README = """InfraSet Grasshopper plugin package
===================================

InfraSet: A parametric Life Cycle Assessment and Material Flow Analysis
model for Transport Infrastructure Assets.
(C) Soroosh Ataee, PhD research, Universite catholique de Louvain.

Contents
--------
Infraset238.py                          Database module (materials, elements,
                                        assemblies) imported by every component.
Frontend_element_InfraSet.py            Grasshopper "InfraSet Element" component.
Frontend_assembly_InfraSet.py           Grasshopper "InfraSet Assembly" component.
Frontend_Infrastructure_InfraSet.py     Grasshopper "InfraSet Infrastructure"
                                        aggregator component (up to 10 assemblies).
Result_InfraSet.py                      Grasshopper "Result" component (CSV export).

Requirements
------------
- Rhinoceros 7 or 8 (Windows or macOS), Grasshopper included.
- IronPython 2.7 (the engine embedded in Rhino; nothing else to install).
- The EPiC hybrid-LCA coefficients are already embedded in Infraset238.py.

Installation
------------
1. Unblock the ZIP before extracting (Windows: right-click > Properties >
   Unblock > OK), then extract it.
2. Copy Infraset238.py next to your Grasshopper definition, or add its folder
   to the GHPython search paths (Grasshopper > Python > Tools > Edit Python
   search paths).
3. Create each GHPython component on the canvas (Components > Python > Python
   component), paste the matching Frontend_*.py / Result_InfraSet.py script,
   and rename the component (Element, Assembly, Infrastructure, Result).
4. On each InfraSet component, press the connect_button input once: the
   component creates and wires the category value list automatically.
5. Chain the components: Element > Assembly > Infrastructure > Result, set the
   parameters (No, wastage %, POA / material service life, traffic factor,
   energy / water / GHG reduction factors, optional PKT), and connect Panels
   to the outputs.
6. Use the Result component to export every output to a CSV file.

Support
-------
The web tool on the InfraSet site uses the same databases ported to CPython 3
for OpenStreetMap-based quantity take-off; the Grasshopper package above is
the author's original parametric implementation.
"""

os.makedirs(OUT_DIR, exist_ok=True)
with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as z:
    for src, dst in FILES:
        with open(os.path.join(UPLOAD, src), "r", encoding="utf-8", errors="replace") as f:
            text = f.read()
        # normalise line endings for Windows editors
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        z.writestr(dst, text)
    z.writestr("README.txt", README)

print("wrote", ZIP_PATH, os.path.getsize(ZIP_PATH), "bytes")
with zipfile.ZipFile(ZIP_PATH) as z:
    for info in z.infolist():
        print("  ", info.filename, info.file_size, "bytes")
