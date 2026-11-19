# /// script
# dependencies = ["pillow>=10", "numpy>=1.26"]
# ///
"""Cut the coop level images out of their flat background for Unity.

Run from the repository root (uv installs the two dependencies on first use):
    uv run art/coop-2d/cut_sprites.py

Input:  art/coop-2d/source/Coop_L0.png .. Coop_L4.png (L0 = foundation, L1..L4 = coop levels),
        each on a flat light background (light blue or magenta; read from the image border).
Output: unity-client/Assets/Hexrota/Art/Coop2D/
        Coop_L<n>.png      RGBA, background removed, halo and colour spill cleaned, cropped
        Dust_<n>.png       three soft dust puffs for the upgrade transition
        Shadow.png         soft elliptical blob for the contact shadow
        coop_sprites.json  per level: size, pivot (bottom-centre of the base disk) and disk width,
                           read by the Unity builder so every level stands on the same point.
The source folder stays out of git; this script is the record of how the sprites are made.
"""
import json
import pathlib

import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT / "art" / "coop-2d" / "source"
OUT = ROOT / "unity-client" / "Assets" / "Hexrota" / "Art" / "Coop2D"
LEVELS = 5
# Colour distance (0..255) from the background where alpha starts / reaches full opacity.
KEY_LOW, KEY_HIGH = 22.0, 70.0
RIM_BAND, RIM_KEY_HIGH = 6, 120.0  # edge band (px) and its wider key for the sky-coloured rim
PADDING = 4            # transparent pixels kept round the crop
DISK_BAND = 0.18       # the base disk is looked for in the bottom 18 % of the subject
EDGE = 10              # pixels near transparency that get spill suppression (also the sky bounce on the disk rim)


def background_model(rgb):
    """Least-squares plane per channel through the border pixels (handles a slight gradient)."""
    h, w, _ = rgb.shape
    border = np.zeros((h, w), bool)
    border[:3, :] = border[-3:, :] = True
    border[:, :3] = border[:, -3:] = True
    ys, xs = np.nonzero(border)
    samples = rgb[ys, xs]
    # Ignore border pixels far from the median (in case the subject touches the edge).
    median = np.median(samples, axis=0)
    keep = np.linalg.norm(samples - median, axis=1) < 40
    A = np.stack([np.ones(keep.sum()), xs[keep] / w, ys[keep] / h], axis=1)
    coef, *_ = np.linalg.lstsq(A, samples[keep], rcond=None)
    gy, gx = np.mgrid[0:h, 0:w]
    plane = coef[0] + (gx / w)[..., None] * coef[1] + (gy / h)[..., None] * coef[2]
    return plane, median


def largest_component(mask):
    """Keeps the largest 4-connected component of a boolean mask (iterative flood fill)."""
    h, w = mask.shape
    labels = np.zeros((h, w), np.int32)
    best, best_size, current = 0, 0, 0
    for y0, x0 in zip(*np.nonzero(mask)):
        if labels[y0, x0]:
            continue
        current += 1
        stack = [(y0, x0)]
        labels[y0, x0] = current
        size = 0
        while stack:
            y, x = stack.pop()
            size += 1
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                    labels[ny, nx] = current
                    stack.append((ny, nx))
        if size > best_size:
            best, best_size = current, size
    return labels == best


def dilate(mask, steps):
    out = mask.copy()
    for _ in range(steps):
        grown = out.copy()
        grown[1:, :] |= out[:-1, :]
        grown[:-1, :] |= out[1:, :]
        grown[:, 1:] |= out[:, :-1]
        grown[:, :-1] |= out[:, 1:]
        out = grown
    return out


def cut(level):
    image = Image.open(SOURCE / ("Coop_L%d.png" % level)).convert("RGB")
    rgb = np.asarray(image, dtype=np.float64)
    bg, bg_colour = background_model(rgb)
    distance = np.linalg.norm(rgb - bg, axis=2)
    alpha = np.clip((distance - KEY_LOW) / (KEY_HIGH - KEY_LOW), 0, 1)
    alpha = alpha * alpha * (3 - 2 * alpha)  # smoothstep

    # One subject: drop specks, keep soft edges that touch the main body.
    body = largest_component(alpha > 0.5)
    alpha = np.where(dilate(body, 2), alpha, 0)

    # The rim of the base disk catches the sky colour (bounce light). Near the edge, pixels that are
    # still close to the background colour are keyed with a wider threshold, so no light-blue line stays.
    rim = dilate(alpha < 0.98, RIM_BAND) & (alpha > 0)
    wide = np.clip((distance - KEY_LOW) / (RIM_KEY_HIGH - KEY_LOW), 0, 1)
    wide = wide * wide * (3 - 2 * wide)
    alpha = np.where(rim, np.minimum(alpha, wide), alpha)

    # Undo the background mix on soft edges: observed = a * F + (1 - a) * bg.
    a = alpha[..., None]
    fg = np.where(a > 0.02, (rgb - (1 - a) * bg) / np.maximum(a, 0.02), rgb)
    fg = np.clip(fg, 0, 255)
    # Spill: near the edge, no pixel may lean further toward the key colour than its own warm channels.
    near_edge = dilate(alpha < 0.98, EDGE) & (alpha > 0)
    key_channel = int(np.argmax(bg_colour - bg_colour.mean()))  # blue for sky blue, R/B pair for magenta
    others = [c for c in range(3) if c != key_channel]
    cap = fg[..., others].max(axis=2)
    spill = near_edge & (fg[..., key_channel] > cap)
    fg[..., key_channel] = np.where(spill, cap, fg[..., key_channel])
    # Tighten the edge by a fraction of a pixel so no background tint is left in the antialiasing.
    alpha = np.clip((alpha - 0.08) / 0.92, 0, 1)

    ys, xs = np.nonzero(alpha > 0.01)
    y0, y1 = max(ys.min() - PADDING, 0), min(ys.max() + PADDING + 1, alpha.shape[0])
    x0, x1 = max(xs.min() - PADDING, 0), min(xs.max() + PADDING + 1, alpha.shape[1])
    rgba = np.dstack([fg, alpha * 255])[y0:y1, x0:x1]
    solid = alpha[y0:y1, x0:x1] > 0.5

    # Base disk: the widest row in the bottom band; pivot = its centre on the lowest opaque row.
    rows = np.nonzero(solid.any(axis=1))[0]
    top, bottom = rows.min(), rows.max()
    band_start = int(bottom - (bottom - top) * DISK_BAND)
    best_row, best_span, centre = bottom, 0, solid.shape[1] / 2
    for row in range(band_start, bottom + 1):
        cols = np.nonzero(solid[row])[0]
        if len(cols) and cols.max() - cols.min() > best_span:
            best_row, best_span, centre = row, cols.max() - cols.min(), (cols.max() + cols.min()) / 2
    height, width = rgba.shape[:2]
    pivot = (centre / width, (height - 1 - bottom) / height)  # Unity sprite pivot: origin bottom-left

    name = "Coop_L%d.png" % level
    Image.fromarray(np.round(rgba).astype(np.uint8), "RGBA").save(OUT / name, optimize=True)
    return {
        "level": level, "file": name, "width": int(width), "height": int(height),
        "pivot": [round(float(pivot[0]), 4), round(float(pivot[1]), 4)],
        "diskWidth": int(best_span), "diskRow": int(best_row),
        "background": [int(round(c)) for c in bg_colour],
    }


def dust(index, size=256, seed=7):
    """A soft dust puff: a few overlapping gaussian blobs, white (tinted at runtime)."""
    rng = np.random.default_rng(seed + index)
    gy, gx = np.mgrid[0:size, 0:size] / size
    density = np.zeros((size, size))
    for _ in range(5 + index):
        cx, cy = rng.uniform(.32, .68, 2)
        r = rng.uniform(.13, .22)
        density += np.exp(-(((gx - cx) ** 2 + (gy - cy) ** 2) / (2 * r * r)))
    density /= density.max()
    edge = np.clip(1 - np.hypot(gx - .5, gy - .5) / .5, 0, 1)  # fade to zero before the border
    alpha = np.clip(density * 1.6 - .1, 0, 1) * edge
    rgba = np.dstack([np.full((size, size, 3), 255.0), alpha * 255])
    name = "Dust_%d.png" % index
    Image.fromarray(np.round(rgba).astype(np.uint8), "RGBA").save(OUT / name, optimize=True)
    return name


def shadow(width=512, height=256):
    """Soft elliptical blob for the contact shadow, white (tinted purple at runtime)."""
    gy, gx = np.mgrid[0:height, 0:width]
    d = np.hypot((gx + .5) / width * 2 - 1, (gy + .5) / height * 2 - 1)
    alpha = np.clip(1 - d, 0, 1) ** 1.6
    rgba = np.dstack([np.full((height, width, 3), 255.0), alpha * 255])
    Image.fromarray(np.round(rgba).astype(np.uint8), "RGBA").save(OUT / "Shadow.png", optimize=True)
    return "Shadow.png"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    levels = [cut(level) for level in range(LEVELS)]
    puffs = [dust(i) for i in range(3)]
    blob = shadow()
    with open(OUT / "coop_sprites.json", "w", encoding="utf-8") as f:
        json.dump({"levels": levels, "dust": puffs, "shadow": blob}, f, indent=2)
    for entry in levels:
        print("Coop_L%(level)d: %(width)dx%(height)d pivot %(pivot)s disk %(diskWidth)dpx bg %(background)s" % entry)


if __name__ == "__main__":
    main()
