#!/usr/bin/env python3
"""Generate River Green icons from the existing entrance-sign wordmark.

Run from any directory with ``python3 scripts/generate-favicons.py``.
Requires Pillow. No font substitution, generated lettering, or logo tracing is
used: the capital G and its attached leaf are cropped from the brand asset.
"""

import base64
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
SOURCE = PUBLIC / "branding" / "river-green-wordmark.png"
FOREST = "#162b20"
CREAM = "#f7f6ee"
SIZE = 512

# Original 2172 x 724 wordmark: only the capital G and its attached leaf.
# Its whole-wordmark proportions are too wide for a legible browser-tab icon.
SOURCE_CROP = (1070, 215, 1360, 537)


def icon(mark: Image.Image, rounded: bool = True) -> Image.Image:
    canvas = Image.new("RGBA", (SIZE, SIZE))
    drawing = ImageDraw.Draw(canvas)
    if rounded:
        drawing.rounded_rectangle((0, 0, SIZE - 1, SIZE - 1), radius=104, fill=FOREST)
    else:
        drawing.rectangle((0, 0, SIZE - 1, SIZE - 1), fill=FOREST)
    canvas.alpha_composite(mark, ((SIZE - mark.width) // 2, (SIZE - mark.height) // 2))
    return canvas


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    if source.size != (2172, 724):
        raise ValueError("The source wordmark dimensions changed; review SOURCE_CROP first.")
    crop = source.crop(SOURCE_CROP)
    # Remove nearly invisible extraction speckles without changing the outline.
    alpha = crop.getchannel("A").point(lambda value: value if value >= 32 else 0)
    mark = Image.new("RGBA", crop.size, CREAM)
    mark.putalpha(alpha)
    mark = mark.crop(alpha.getbbox())
    scaled_mark = ImageOps.contain(mark, (420, 420), Image.Resampling.LANCZOS)
    rounded = icon(scaled_mark)
    square = icon(scaled_mark, rounded=False)

    for size in (48, 96):
        rounded.resize((size, size), Image.Resampling.LANCZOS).save(
            PUBLIC / f"favicon-{size}.png", optimize=True
        )
    rounded.save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    square.resize((180, 180), Image.Resampling.LANCZOS).save(
        PUBLIC / "apple-touch-icon.png", optimize=True
    )
    (PUBLIC / "icons").mkdir(exist_ok=True)
    for size in (192, 512):
        square.resize((size, size), Image.Resampling.LANCZOS).save(
            PUBLIC / "icons" / f"icon-{size}.png", optimize=True
        )

    # Embed the actual cropped bitmap in SVG instead of approximating its serif
    # and leaf with a different font or inventing a replacement vector logo.
    encoded = BytesIO()
    mark.save(encoded, format="PNG", optimize=True)
    png = base64.b64encode(encoded.getvalue()).decode("ascii")
    x, y = (SIZE - scaled_mark.width) // 2, (SIZE - scaled_mark.height) // 2
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n'
        '  <title>River Green</title>\n'
        f'  <rect width="512" height="512" rx="104" fill="{FOREST}"/>\n'
        f'  <image x="{x}" y="{y}" width="{scaled_mark.width}" '
        f'height="{scaled_mark.height}" href="data:image/png;base64,{png}"/>\n'
        '</svg>\n'
    )
    (PUBLIC / "favicon.svg").write_text(svg, encoding="utf-8")
    print("Generated SVG, ICO (16/32/48), PNG (48/96), Apple (180), and web (192/512) icons.")


if __name__ == "__main__":
    main()
