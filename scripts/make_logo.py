"""Crop the uploaded InfraSet logo, pad to square, export to public/logo.png."""
from PIL import Image

SRC = 'upload/pasted_image_1795195908492.png'
DST = 'public/logo.png'

im = Image.open(SRC).convert('RGBA')

# Find content bbox ignoring near-white background
g = im.convert('L')
mask = g.point(lambda p: 255 if p < 245 else 0)
bbox = mask.getbbox()
print('content bbox:', bbox)

# Crop with a small margin
l, t, r, b = bbox
m = 6
l, t = max(0, l - m), max(0, t - m)
r, b = min(im.width, r + m), min(im.height, b + m)
crop = im.crop((l, t, r, b))

# Pad to square (white background, matching the logo's own canvas)
side = max(crop.size)
canvas = Image.new('RGBA', (side, side), (255, 255, 255, 255))
canvas.paste(crop, ((side - crop.width) // 2, (side - crop.height) // 2), crop)

out = canvas.resize((256, 256), Image.LANCZOS)
out.save(DST)
print('saved', DST, out.size)
