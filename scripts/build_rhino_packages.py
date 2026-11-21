"""Build clean Rhino 7 / Rhino 9 plugin distribution ZIPs from the user's uploaded ZIPs."""
import zipfile
from pathlib import Path

UP = Path('upload')
OUT = Path('public/plugins')
DL = Path('download')

# {output zip: (source upload zip, {member name -> arcname})}
JOBS = {
    'Infraset2_plugin_v2.0.0_Rhino7.zip': (
        UP / 'Rhino 7.zip',
        {
            'Rhino 7/Infraset2 (2).gha': 'Infraset2.gha',
            'Rhino 7/infraset2-2.0.0-rh7_0-any (4).yak': 'infraset2-2.0.0-rh7_0-any.yak',
            'Rhino 7/Infraset2-source (1).zip': 'Infraset2-source.zip',
        },
    ),
    'Infraset2_plugin_v2.0.0_Rhino9.zip': (
        UP / 'Rhino 9.zip',
        {
            'Rhino 9/Infraset2-rhino9.gha': 'Infraset2-rhino9.gha',
            'Rhino 9/infraset2-2.0.0-rh9_0-any.yak': 'infraset2-2.0.0-rh9_0-any.yak',
            'Rhino 9/Infraset2-source (1).zip': 'Infraset2-source.zip',
        },
    ),
}

OUT.mkdir(parents=True, exist_ok=True)
DL.mkdir(parents=True, exist_ok=True)

for out_name, (src_zip, mapping) in JOBS.items():
    out_path = OUT / out_name
    with zipfile.ZipFile(src_zip) as src, zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as z:
        for member, arc in mapping.items():
            data = src.read(member)
            z.writestr(arc, data)
            print(f'  + {arc}  ({len(data):,} B)')
    (DL / out_name).write_bytes(out_path.read_bytes())
    print(f'wrote {out_path} ({out_path.stat().st_size:,} B) + download/ copy')

# sanity: verify each output zip and the embedded source zip
for out_name in JOBS:
    with zipfile.ZipFile(OUT / out_name) as z:
        bad = z.testzip()
        assert bad is None, f'corrupt member {bad} in {out_name}'
        print(f'{out_name}: OK -> {z.namelist()}')
        with zipfile.ZipFile(z.open('Infraset2-source.zip')) as sz:
            names = sz.namelist()
            print(f'  source zip OK, {len(names)} entries, e.g. {names[:3]}')
