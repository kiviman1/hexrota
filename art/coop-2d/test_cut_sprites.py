# /// script
# dependencies = ["pillow>=10", "numpy>=1.26"]
# ///
"""Tests for the coop edge cleaning in cut_sprites.py.

Run from the repository root:
    uv run art/coop-2d/test_cut_sprites.py

A synthetic coop (a warm building on a base disk, on a flat sky background) carries the three cases the
cleaning has to tell apart: a lilac-grey stone on the disk rim (content: must stay opaque), an opaque
sky bounce along the lower rim and a soft sky glow beside the disk (both must go). When the real source
images are present (art/coop-2d/source, kept out of git), every level is also checked: no cleaning pass
may clear a patch of opaque content larger than MAX_LOST_CLUSTER pixels.
"""
import pathlib
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import cut_sprites as cs  # noqa: E402

SKY = np.array([165.0, 220.0, 252.0])
SOIL = np.array([196.0, 120.0, 70.0])
WOOD = np.array([170.0, 105.0, 60.0])
LILAC_STONE = np.array([155.0, 143.0, 161.0])  # blue leads red by 6: grey stone with a violet cast
BOUNCE = np.array([100.0, 120.0, 172.0])       # opaque sky bounce painted on the rim (blue leads by ~50)
GLOW = np.array([150.0, 205.0, 250.0])         # soft sky glow beside the disk


def synthetic():
    h, w = 420, 640
    rgb = np.tile(SKY, (h, w, 1))
    gy, gx = np.mgrid[0:h, 0:w]
    cx, cy, a, b = 320.0, 300.0, 250.0, 80.0
    disk = ((gx - cx) / a) ** 2 + ((gy - cy) / b) ** 2 <= 1
    rgb[disk] = SOIL
    rgb[(gx > 230) & (gx < 410) & (gy > 60) & (gy < 300)] = WOOD             # the building
    stone = disk & (gx > 520) & (gy > 300) & (gy < 340)                         # stone on the right rim
    rgb[stone] = LILAC_STONE
    outline = disk & (((gx - cx) / (a - 7)) ** 2 + ((gy - cy) / (b - 7)) ** 2 > 1) & (gy > cy + 20) & ~stone
    rgb[outline] = BOUNCE                                                       # bounce along the lower rim
    ring = ((gx - cx) / (a + 10)) ** 2 + ((gy - cy) / (b + 10)) ** 2
    glow = ~disk & (ring <= 1) & (gx > cx + 180) & (gy < cy) & (gy > cy - 60)  # soft glow at the right side
    rgb[glow] = .5 * SKY + .5 * GLOW
    return rgb, {"stone": stone, "outline": outline, "glow": glow, "disk": disk, "ellipse": (cx, cy, a, b)}


def test_stone_on_the_rim_stays_opaque(rgb, masks, alpha):
    inner = cs.erode(masks["stone"].astype(float), 2) > 0
    assert inner.any()
    kept = (alpha[inner] > .9).mean()
    assert kept == 1, "lilac stone on the rim was cleared (%.0f %% kept)" % (kept * 100)


def test_sky_bounce_and_glow_are_removed(rgb, masks, alpha, fg):
    bounce = alpha[masks["outline"]]
    assert (bounce > .5).mean() < .05, "opaque sky bounce left on the rim (%.0f %%)" % ((bounce > .5).mean() * 100)
    glow = alpha[masks["glow"]]
    assert (glow > .1).mean() < .05, "sky glow left beside the disk (%.0f %%)" % ((glow > .1).mean() * 100)


def test_no_content_patch_is_lost(rgb, alpha, info):
    largest = (cs.clusters(cs.lost_content(rgb, alpha, info)) or [0])[0]
    assert largest <= cs.MAX_LOST_CLUSTER, "a patch of %d opaque content pixels was cleared" % largest


def test_lost_content_catches_a_notch(rgb, alpha, info):
    # The check itself: clear a 20 x 20 patch of the building, and it must be reported.
    notched = alpha.copy()
    notched[150:170, 300:320] = 0
    largest = (cs.clusters(cs.lost_content(rgb, notched, info)) or [0])[0]
    assert largest > cs.MAX_LOST_CLUSTER, "a 400 px notch was not reported (%d)" % largest


def test_rim_fit_matches_the_drawn_ellipse(masks):
    cx, cy, a, b = masks["ellipse"]
    solid = masks["disk"]
    width, depth = cs.fit_rim(solid, cx, int(cy), 2 * a, 2 * b)
    assert abs(width - 1) < .02 and abs(depth - 1) < .05, "fit %s x %s for an exact ellipse" % (width, depth)


def test_real_sources():
    paths = sorted(cs.SOURCE.glob("Coop_L*.png"))
    if not paths:
        print("  (no art/coop-2d/source images: real-source check skipped)")
        return
    for path in paths:
        rgb = np.asarray(Image.open(path).convert("RGB"), dtype=np.float64)
        _, alpha, info = cs.cut_image(rgb)
        largest = (cs.clusters(cs.lost_content(rgb, alpha, info)) or [0])[0]
        assert largest <= cs.MAX_LOST_CLUSTER, "%s: a patch of %d opaque content pixels was cleared" % (path.name, largest)
        print("  %s: largest cleared patch %d px (limit %d)" % (path.name, largest, cs.MAX_LOST_CLUSTER))


def main():
    rgb, masks = synthetic()
    fg, alpha, info = cs.cut_image(rgb)
    tests = [
        ("stone on the rim stays opaque", lambda: test_stone_on_the_rim_stays_opaque(rgb, masks, alpha)),
        ("sky bounce and glow are removed", lambda: test_sky_bounce_and_glow_are_removed(rgb, masks, alpha, fg)),
        ("no opaque content patch is lost", lambda: test_no_content_patch_is_lost(rgb, alpha, info)),
        ("the content check catches a notch", lambda: test_lost_content_catches_a_notch(rgb, alpha, info)),
        ("rim fit matches a drawn ellipse", lambda: test_rim_fit_matches_the_drawn_ellipse(masks)),
        ("real sources keep their content", test_real_sources),
    ]
    failed = 0
    for name, test in tests:
        try:
            test()
            print("ok    " + name)
        except AssertionError as error:
            failed += 1
            print("FAIL  %s: %s" % (name, error))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
