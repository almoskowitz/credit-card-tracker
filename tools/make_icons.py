#!/usr/bin/env python3
"""Generates the PWA icon set: app icons (192, 512) and the iOS apple-touch-icon (180).

Run with: /usr/bin/python3 tools/make_icons.py
(That interpreter has Pillow installed; the homebrew python3 does not.)

Not part of the build -- output is checked in under public/.
"""
import math
import os

from PIL import Image, ImageDraw

BG = (11, 18, 32, 255)  # #0b1220
MINT = (74, 222, 155, 255)  # #4ade9b
MINT_DIM = (74, 222, 155, 90)

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "icons")


def rounded_square(size: int, radius_frac: float) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    radius = int(size * radius_frac)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=BG)
    return img, draw


def draw_card_glyph(draw: ImageDraw.ImageDraw, size: int) -> None:
    """A simple credit-card glyph: rounded rect outline with a stripe and a chip mark."""
    w = size * 0.62
    h = size * 0.42
    x0 = (size - w) / 2
    y0 = (size - h) / 2
    x1 = x0 + w
    y1 = y0 + h
    r = h * 0.16
    stroke = max(2, round(size * 0.028))

    # Card body outline.
    draw.rounded_rectangle([x0, y0, x1, y1], radius=r, outline=MINT, width=stroke)

    # Magnetic stripe near the top of the card.
    stripe_y0 = y0 + h * 0.22
    stripe_y1 = y0 + h * 0.34
    draw.rounded_rectangle([x0 + stroke, stripe_y0, x1 - stroke, stripe_y1], radius=r * 0.3, fill=MINT)

    # Two short "number" lines toward the bottom, in a dimmer mint.
    line_h = h * 0.09
    line_y0 = y0 + h * 0.62
    draw.rounded_rectangle(
        [x0 + w * 0.12, line_y0, x0 + w * 0.5, line_y0 + line_h], radius=line_h / 2, fill=MINT_DIM
    )
    line_y1 = line_y0 + h * 0.18
    draw.rounded_rectangle(
        [x0 + w * 0.12, line_y1, x0 + w * 0.32, line_y1 + line_h], radius=line_h / 2, fill=MINT_DIM
    )


def make_icon(size: int, radius_frac: float, path: str) -> None:
    img, draw = rounded_square(size, radius_frac)
    draw_card_glyph(draw, size)
    img.save(path, "PNG")
    print(f"wrote {path} ({size}x{size})")


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    # Android/PWA manifest icons -- squared corners, the platform chrome rounds them.
    make_icon(192, 0.18, os.path.join(OUT_DIR, "icon-192.png"))
    make_icon(512, 0.18, os.path.join(OUT_DIR, "icon-512.png"))
    # iOS applies its own rounding/mask, so ship a full-bleed square for the touch icon.
    make_icon(180, 0.0, os.path.join(OUT_DIR, "apple-touch-icon.png"))


if __name__ == "__main__":
    main()
