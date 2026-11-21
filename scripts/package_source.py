# -*- coding: utf-8 -*-
"""Package the InfraSet web portal source code into download/ for the user."""
import os
import zipfile

ROOT = "/home/z/my-project"
OUT = os.path.join(ROOT, "download", "InfraSet_web_portal_source.zip")

INCLUDE_DIRS = ["src", "engine", "public", "scripts", "prisma"]
INCLUDE_FILES = [
    "package.json", "bun.lock", "README.md", "Dockerfile", ".dockerignore",
    "next.config.ts", "tsconfig.json", "tailwind.config.ts", "postcss.config.mjs",
    "eslint.config.mjs", "components.json",
]
EXCLUDE_PREFIX = ("node_modules/", ".next/", "__pycache__/")
EXCLUDE_SUFFIX = (".pyc", ".log")

count = 0
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    for d in INCLUDE_DIRS:
        base = os.path.join(ROOT, d)
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [x for x in dirnames
                           if x not in ("node_modules", "__pycache__", ".next")]
            for fn in filenames:
                if fn.endswith(EXCLUDE_SUFFIX):
                    continue
                full = os.path.join(dirpath, fn)
                rel = os.path.relpath(full, ROOT)
                z.write(full, os.path.join("infraset-web", rel))
                count += 1
    for fn in INCLUDE_FILES:
        full = os.path.join(ROOT, fn)
        if os.path.isfile(full):
            z.write(full, os.path.join("infraset-web", fn))
            count += 1

print("wrote", OUT, os.path.getsize(OUT), "bytes,", count, "files")
