#!/usr/bin/env python3
"""
Draws the MarkFlow app icon set deterministically (no AI, no external deps
beyond Pillow). Design: warm paper tile, bold ink "M" drawn as one marker
stroke, and a red-orange pen stroke sweeping into a checkmark beneath.

Outputs:
  src/app/icon.png         512  (favicon / browser tab)
  src/app/apple-icon.png   180  (iOS home screen)
  public/icon-192.png      192  (push notifications + manifest)
  public/icon-512.png      512  (manifest / install prompt)
"""
from PIL import Image, ImageDraw

SS = 4  # supersample factor for crisp anti-aliased edges
BASE = 1024

CREAM = (246, 243, 236, 255)
INK = (33, 29, 23, 255)
PEN = (217, 72, 31, 255)


def rounded_tile(size):
    img = Image.new("RGBA", (size * SS, size * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    radius = int(size * SS * 0.225)
    d.rounded_rectangle([0, 0, size * SS - 1, size * SS - 1], radius=radius, fill=CREAM)
    return img, d


def stroke_polyline(d, pts, width, color):
    """Polyline with round caps and joins (PIL only does butt caps)."""
    w = int(width * SS)
    r = w / 2
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        d.line([x0 * SS, y0 * SS, x1 * SS, y1 * SS], fill=color, width=w)
    for x, y in pts:
        d.ellipse([x * SS - r, y * SS - r, x * SS + r, y * SS + r], fill=color)


def bezier(p0, p1, p2, n=40):
    """Quadratic bezier sampled into points, scaled to supersampled grid."""
    pts = []
    for i in range(n + 1):
        t = i / n
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1]
        pts.append((x, y))
    return pts


def draw_mark(size):
    img, d = rounded_tile(size)
    s = size / BASE  # scale from the 1024 design grid

    # --- the "M": one confident marker stroke, rounded ends ---
    m = [(268, 566), (268, 306), (512, 476), (756, 306), (756, 566)]
    stroke_polyline(d, [(x * s, y * s) for x, y in m], width=88 * s, color=INK)

    # --- the pen stroke: sweeps right then flicks up into a tick ---
    swoosh = bezier((252, 712), (468, 812), (744, 668))
    stroke_polyline(d, [(x * s, y * s) for x, y in swoosh], width=64 * s, color=PEN)

    return img


def save(img, out, size):
    down = img.resize((size, size), Image.LANCZOS)
    down.save(out)
    print("wrote", out, size)


if __name__ == "__main__":
    master = draw_mark(BASE)
    save(master, "src/app/icon.png", 512)
    save(master, "src/app/apple-icon.png", 180)
    save(master, "public/icon-192.png", 192)
    save(master, "public/icon-512.png", 512)
