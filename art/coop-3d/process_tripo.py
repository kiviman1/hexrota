"""Prepare the Tripo coop models for Unity (headless Blender).

Usage (from the repository root):
    blender -b --factory-startup --python art/coop-3d/process_tripo.py -- \
        --src art/coop-3d/source --out unity-client/Assets/Hexrota/Art/3D/Coop --report art/coop-3d/report.md

For each art/coop-3d/source/coop_L<n>.glb (n = 0..4) it:
  * measures the real triangle count and reports it against the level budget;
  * removes the grass/soil base disk Tripo adds under every model, so the model stands directly on
    the plot's soil: the disk top is the lowest layer of upward-facing faces whose area adds up to
    the footprint disk; that layer, everything under it and the rim side wall are deleted;
  * moves the pivot to the ground centre (middle of that layer -> z = 0, footprint centred on x/y), keeps metres,
    and leaves the front (Blender -Y, the side with the door/gate) on Unity -Z, where the coop camera stands;
  * decimates only when a model is still over its budget;
  * joins everything into one mesh with one material and bakes the texture down to 2048 x 2048
    (written without any view transform, so the albedo keeps its source colours);
  * exports CP_L<n>.fbx and CP_L<n>_basecolor.png into the Unity folder.
The source GLBs stay out of git (see .gitignore); this script and its report are the record.
"""
import argparse
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

BUDGETS = {0: 2000, 1: 5000, 2: 7000, 3: 9000, 4: 15000}
TEXTURE_SIZE = 2048
DISK_SEARCH_HEIGHT = 0.2   # the disk top is looked for in the bottom 20 cm
RIM = 0.8                  # faces outside 80 % of the footprint radius can be the disk's side wall
UP = 0.75                  # normal.z above this counts as an upward face


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(argv)


def triangles(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def import_level(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    if not meshes:
        raise RuntimeError("No mesh in " + path)
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    # Unparent and bake every transform into the vertices, so the numbers below are world metres.
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in [o for o in bpy.data.objects if o.type != "MESH"]:
        bpy.data.objects.remove(o, do_unlink=True)
    return obj


def disk_layer(bm):
    """Height band of the disk's top surface.

    The disk top is not flat (grass rim, bumps, a raised yard), so it is taken as the lowest layer of
    upward-facing faces whose area adds up to the footprint disk (pi * r^2): from its dominant height
    (low) up to the height where that area is reached (high), capped at DISK_SEARCH_HEIGHT.
    """
    xs = [v.co.x for v in bm.verts]
    ys = [v.co.y for v in bm.verts]
    radius = min(max(xs) - min(xs), max(ys) - min(ys)) / 2
    disk_area = math.pi * radius * radius
    bins = {}
    for f in bm.faces:
        c = f.calc_center_median()
        if f.normal.z > UP and c.z < DISK_SEARCH_HEIGHT:
            key = int(c.z / 0.005)
            bins[key] = bins.get(key, 0.0) + f.calc_area()
    if not bins:
        return 0.0, 0.0
    low = max(bins, key=bins.get) * 0.005
    total, high = 0.0, low
    for key in sorted(bins):
        total += bins[key]
        high = (key + 1) * 0.005
        if total >= disk_area:
            break
    return low, min(high, DISK_SEARCH_HEIGHT)


def remove_base_disk(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.normal_update()
    low, high = disk_layer(bm)
    xs = [v.co.x for v in bm.verts]
    rim = (max(xs) - min(xs)) / 2 * RIM
    doomed = []
    for f in bm.faces:
        zs = [v.co.z for v in f.verts]
        c = f.calc_center_median()
        underside = max(zs) < low - 0.004                          # bottom and lower side wall
        surface = f.normal.z > UP and max(zs) <= high + 0.004      # the disk's top surface
        wall = f.normal.z <= UP and max(zs) <= high + 0.004 and math.hypot(c.x, c.y) > rim  # rim side wall
        if underside or surface or wall:
            doomed.append(f)
    bmesh.ops.delete(bm, geom=doomed, context="FACES")
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context="VERTS")
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    # The model stands where the removed surface was: halfway through its height band.
    return (low + high) / 2, len(doomed), low, high


def ground_pivot(obj, top):
    xs = [v.co.x for v in obj.data.vertices]
    ys = [v.co.y for v in obj.data.vertices]
    shift = Vector((-(min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, -top))
    for v in obj.data.vertices:
        v.co += shift
    obj.data.update()
    obj.location = (0, 0, 0)


def decimate(obj, budget):
    count = triangles(obj)
    if count <= budget:
        return False
    mod = obj.modifiers.new("Budget", "DECIMATE")
    mod.ratio = budget / count * 0.98
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return True


def single_material(obj, level, out_dir):
    """One material slot; its base colour image is resized to TEXTURE_SIZE and saved as PNG."""
    image = None
    for mat in obj.data.materials:
        if mat and mat.use_nodes:
            for node in mat.node_tree.nodes:
                if node.type == "TEX_IMAGE" and node.image is not None:
                    image = node.image
                    break
        if image:
            break
    if image is None:
        raise RuntimeError("Level %d has no base colour texture" % level)
    source_size = tuple(image.size)
    first = obj.data.materials[0]
    obj.data.materials.clear()
    obj.data.materials.append(first)
    for poly in obj.data.polygons:
        poly.material_index = 0
    first.name = "CP_L%d" % level
    if tuple(image.size) != (TEXTURE_SIZE, TEXTURE_SIZE):
        image.scale(TEXTURE_SIZE, TEXTURE_SIZE)
    name = "CP_L%d_basecolor.png" % level
    # Write the albedo pixels as they are: Image.save keeps them untouched, whereas save_render
    # would apply the scene's view transform (AgX by default) and darken/desaturate the texture.
    image.file_format = "PNG"
    image.save(filepath=os.path.join(out_dir, name))
    return source_size, name


def export_fbx(obj, path):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    obj.name = os.path.splitext(os.path.basename(path))[0]
    bpy.ops.export_scene.fbx(
        filepath=path, use_selection=True, object_types={"MESH"},
        apply_unit_scale=True, apply_scale_options="FBX_SCALE_ALL", global_scale=1.0,
        axis_forward="-Z", axis_up="Y", bake_space_transform=True,
        mesh_smooth_type="FACE", use_mesh_modifiers=True, path_mode="STRIP",
        embed_textures=False, add_leaf_bones=False, bake_anim=False)


def bounds(obj):
    vs = [v.co for v in obj.data.vertices]
    return (Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs))),
            Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs))))


def main():
    args = parse_args()
    os.makedirs(args.out, exist_ok=True)
    rows = []
    for level in range(5):
        src = os.path.join(args.src, "coop_L%d.glb" % level)
        obj = import_level(src)
        source_tris = triangles(obj)
        top, removed, low, high = remove_base_disk(obj)
        ground_pivot(obj, top)
        after_disk = triangles(obj)
        decimated = decimate(obj, BUDGETS[level])
        final = triangles(obj)
        source_size, texture = single_material(obj, level, args.out)
        export_fbx(obj, os.path.join(args.out, "CP_L%d.fbx" % level))
        lo, hi = bounds(obj)
        rows.append((level, source_tris, "%.3f–%.3f" % (low, high), removed, after_disk, decimated, final, BUDGETS[level],
                     source_size, texture, lo, hi))
        print("CP_L%d: %d tris (source %d, budget %d)" % (level, final, source_tris, BUDGETS[level]))

    with open(args.report, "w", encoding="utf-8") as report:
        report.write("# Kümes modelleri — işleme raporu\n\n")
        report.write("`process_tripo.py` çıktısı. Üçgenler Blender'ın gerçek üçgen sayısıdır.\n\n")
        report.write("| Seviye | Kaynak üçgen | Disk üst bandı (m) | Silinen yüz | Disk sonrası | Decimate | Son üçgen | Bütçe | Kaynak doku | Boyut (G × D × Y, m) |\n")
        report.write("|---|---|---|---|---|---|---|---|---|---|\n")
        for (level, source_tris, top, removed, after_disk, decimated, final, budget, size, texture, lo, hi) in rows:
            report.write("| CP_L%d | %d | %s | %d | %d | %s | %d | %d | %d×%d → %d² | %.2f × %.2f × %.2f |\n" % (
                level, source_tris, top, removed, after_disk, "evet" if decimated else "hayır", final, budget,
                size[0], size[1], TEXTURE_SIZE, hi.x - lo.x, hi.y - lo.y, hi.z - lo.z))
        report.write("\nPivot zemin merkezinde (silinen disk üst bandının ortası z = 0), ölçek metre, ön yüz (kapı) Blender −Y → Unity −Z (kümes kamerası bu taraftan bakar).\n")


if __name__ == "__main__":
    main()
