"""Build a stylized, low-poly, rigged chicken asset using a fresh Blender process.
Run: blender -b --python scripts/generate_home_chicken.py
"""
import bpy
import math
import os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'unity-client', 'Assets', 'Hexrota', 'Art', 'Chicken3D')
SOURCE_OUT = os.path.join(ROOT, 'art', 'chicken-3d')
os.makedirs(OUT, exist_ok=True)
os.makedirs(SOURCE_OUT, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for collection in (bpy.data.meshes, bpy.data.armatures, bpy.data.actions, bpy.data.materials):
    for data in list(collection):
        if data.users == 0:
            collection.remove(data)

def material(name, rgb, roughness=.68):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    return m

ivory = material('Feather - warm ivory', (0.93, .87, .72))
cream = material('Feather - light', (1.0, .96, .84))
wing_white = material('Wing - pearl', (.91, .88, .80))
red = material('Comb - coral red', (.75, .055, .035))
orange = material('Beak and feet - gold orange', (1.0, .43, .025))
orange_dark = material('Beak - lower', (.73, .23, .015))
eye_black = material('Eyes - warm black', (.035, .022, .015), .22)
eye_white = material('Eyes - sparkle', (1, 1, .96), .18)
blush = material('Cheek - soft peach', (1.0, .54, .39))

arm_data = bpy.data.armatures.new('ChickenRig')
rig = bpy.data.objects.new('ChickenRig', arm_data)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
def bone(name, head, tail, parent=None):
    b = arm_data.edit_bones.new(name)
    b.head, b.tail = head, tail
    if parent:
        b.parent = arm_data.edit_bones[parent]
    return b
bone('Body', (0, 0, .48), (0, 0, 1.0))
bone('Head', (0, -.17, 1.0), (0, -.20, 1.40), 'Body')
bone('Wing.L', (.39, -.02, .89), (.68, -.02, .80), 'Body')
bone('Wing.R', (-.39, -.02, .89), (-.68, -.02, .80), 'Body')
bone('Leg.L', (.21, -.03, .38), (.21, -.03, .10), 'Body')
bone('Leg.R', (-.21, -.03, .38), (-.21, -.03, .10), 'Body')
bpy.ops.object.mode_set(mode='OBJECT')
rig.select_set(False)
parts = []

def assign(obj, name, mat, group):
    obj.name = name
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    vg = obj.vertex_groups.new(name=group)
    vg.add(list(range(len(obj.data.vertices))), 1.0, 'REPLACE')
    parts.append(obj)
    return obj

def oval(name, center, scale, mat, group, segments=16, rings=8, rotation=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=center)
    obj = bpy.context.object
    obj.scale = scale
    if rotation is not None:
        obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return assign(obj, name, mat, group)

def cone(name, center, radius1, radius2, depth, rotation, mat, group):
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=radius1, radius2=radius2, depth=depth, location=center, rotation=rotation)
    return assign(bpy.context.object, name, mat, group)

# Compact round body and head, built as separate low-poly feather forms.
oval('Body', (0, .035, .75), (.55, .44, .49), ivory, 'Body', 20, 12)
oval('Breast', (0, -.29, .73), (.39, .18, .34), cream, 'Body')
oval('Head', (0, -.20, 1.18), (.36, .32, .36), cream, 'Head', 20, 12)
# The crest and facial pieces follow the head bone.
for i, (y, z, size) in enumerate([(-.32, 1.49, .14), (-.16, 1.53, .16), (.01, 1.48, .13)]):
    oval('Comb_%02d' % i, (0, y, z), (size*.75, size, size*1.12), red, 'Head')
cone('Upper beak', (0, -.56, 1.13), .13, .012, .29, (math.pi/2, 0, 0), orange, 'Head')
cone('Lower beak', (0, -.53, 1.04), .095, .008, .21, (math.pi/2, 0, 0), orange_dark, 'Head')
oval('Wattle', (0, -.43, .99), (.085, .075, .14), red, 'Head')
for side in (-1, 1):
    x = .21 * side
    oval('Eye_%s' % side, (x, -.472, 1.245), (.059, .035, .083), eye_black, 'Head')
    oval('Eye_glint_%s' % side, (x-.013, -.502, 1.275), (.019, .012, .023), eye_white, 'Head', 12, 6)
    oval('Cheek_%s' % side, (.27*side, -.43, 1.09), (.075, .023, .045), blush, 'Head', 12, 6)
    # The wings are independent bone-weighted forms, with three subtle feathers.
    wing_bone = 'Wing.L' if side > 0 else 'Wing.R'
    oval('Wing_%s' % side, (.46*side, -.02, .79), (.18, .32, .24), wing_white, wing_bone,
         rotation=(0, .14*side, -.16*side))
    for j in range(3):
        oval('Wing_feather_%s_%s' % (side,j), ((.52+j*.018)*side, -.11+j*.10, .71-j*.018),
             (.12, .13, .095), cream, wing_bone, 12, 6)
    # Each foot and toes follow its leg; short legs keep the silhouette readable.
    leg_bone = 'Leg.L' if side > 0 else 'Leg.R'
    oval('Leg_%s' % side, (.21*side, -.025, .20), (.055, .055, .18), orange, leg_bone, 12, 6)
    oval('Foot_%s' % side, (.21*side, -.12, .075), (.15, .16, .065), orange, leg_bone, 12, 6)
    for j in (-1, 0, 1):
        oval('Toe_%s_%s' % (side,j), (.21*side + j*.085, -.22, .062), (.047, .12, .04), orange, leg_bone, 12, 6,
             rotation=(0, 0, j * .22))
# Fan-shaped tail tufts rise behind the body.
for i, x in enumerate((-.18, 0, .18)):
    oval('Tail_%d' % i, (x, .39, 1.02), (.13, .17, .30 - abs(x)*.5), cream, 'Body', 12, 8,
         rotation=(.4, x*1.2, 0))

# Join while keeping per-part bone weights and material slots, then add the skin modifier.
bpy.ops.object.select_all(action='DESELECT')
for obj in parts: obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
mesh = bpy.context.object
mesh.name = 'ChickenMesh'
modifier = mesh.modifiers.new('Chicken skin', 'ARMATURE')
modifier.object = rig
mesh.parent = rig

for p in rig.pose.bones:
    p.rotation_mode = 'XYZ'
rig.animation_data_create()
def key(action, frame, bone_name, rotation=None, location=None):
    p = rig.pose.bones[bone_name]
    if rotation is not None:
        p.rotation_euler = tuple(math.radians(x) for x in rotation)
        p.keyframe_insert(data_path='rotation_euler', frame=frame, group=bone_name)
    if location is not None:
        p.location = location
        p.keyframe_insert(data_path='location', frame=frame, group=bone_name)

def reset():
    for p in rig.pose.bones:
        p.rotation_euler = (0, 0, 0)
        p.location = (0, 0, 0)

def build_action(name, n, animator):
    reset()
    act = bpy.data.actions.new(name)
    rig.animation_data.action = act
    animator()
    rig.animation_data.action = None
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 1, act)
    track.mute = True
    return act

def idle():
    for f, ang in [(1, -3), (13, 3), (25, -3), (37, 3), (49, -3)]:
        key(None, f, 'Head', (0, 0, ang))
        key(None, f, 'Body', (ang*.35, 0, 0))
        key(None, f, 'Wing.L', (0, 0, ang*.25))
        key(None, f, 'Wing.R', (0, 0, -ang*.25))

def walk():
    for f, a in [(1, 25), (7, 0), (13, -25), (19, 0), (25, 25)]:
        key(None, f, 'Leg.L', (a, 0, 0))
        key(None, f, 'Leg.R', (-a, 0, 0))
        key(None, f, 'Body', (0, 0, a*.08), (0, .025 if f in (7,19) else 0, 0))
        key(None, f, 'Head', (0, 0, -a*.12))

def flap():
    for f, a in [(1, 0), (5, 45), (9, -12), (13, 45), (17, -12), (21, 45), (25, 0)]:
        key(None, f, 'Wing.L', (0, 0, a))
        key(None, f, 'Wing.R', (0, 0, -a))
        key(None, f, 'Head', (a*.08, 0, 0))

build_action('Idle', 49, idle)
build_action('Walk', 25, walk)
build_action('Flap', 25, flap)
# The FBX exporter bakes visible NLA tracks into individually named animation stacks.
for track in rig.animation_data.nla_tracks: track.mute = False
bpy.context.scene.render.fps = 24
bpy.context.scene.frame_start = 1
bpy.context.scene.frame_end = 49
bpy.context.scene.frame_set(1)

# Isolate only the mobile asset in the export; the preview camera is never exported.
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True); mesh.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.fbx(filepath=os.path.join(OUT, 'ChickenRig.fbx'), use_selection=True,
    object_types={'ARMATURE','MESH'}, add_leaf_bones=False, bake_anim=True,
    bake_anim_use_nla_strips=True, bake_anim_use_all_actions=False, bake_anim_simplify_factor=0,
    axis_forward='-Z', axis_up='Y', mesh_smooth_type='FACE')
# Save the fully editable source rig with all three animation strips.
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SOURCE_OUT, 'ChickenRig.blend'))

# Separate temporary render setup for a quality-check preview.
world = bpy.context.scene.world
world.color = (.16, .16, .16)
bpy.context.scene.render.engine = 'BLENDER_EEVEE'
bpy.context.scene.render.film_transparent = True
bpy.context.scene.render.resolution_x = 640
bpy.context.scene.render.resolution_y = 640
bpy.context.scene.render.resolution_percentage = 100
bpy.context.scene.render.image_settings.file_format = 'PNG'
def area(name, loc, energy, size):
    data = bpy.data.lights.new(name, 'AREA'); data.energy=energy; data.shape='DISK'; data.size=size
    obj = bpy.data.objects.new(name, data); bpy.context.collection.objects.link(obj); obj.location=loc
    obj.rotation_euler=(Vector((0,0,.8))-obj.location).to_track_quat('-Z','Y').to_euler()
area('Key', (3,-4,5), 450, 4)
area('Fill', (-3,-2,3), 250, 3)
area('Rim', (1,3,4), 350, 3)
cam_data = bpy.data.cameras.new('PreviewCamera'); cam = bpy.data.objects.new('PreviewCamera', cam_data)
bpy.context.collection.objects.link(cam)
cam.location=(3,-6,2.7); cam.rotation_euler=(Vector((0,0,.83))-cam.location).to_track_quat('-Z','Y').to_euler()
cam_data.type='ORTHO'; cam_data.ortho_scale=2.3
bpy.context.scene.camera=cam
bpy.context.scene.render.filepath=os.path.join(SOURCE_OUT, 'ChickenRigPreview.png')
bpy.ops.render.render(write_still=True)
print('CHICKEN_BUILD_OK vertices=%d triangles=%d bones=%d actions=%s' % (len(mesh.data.vertices), sum(len(p.vertices)-2 for p in mesh.data.polygons), len(rig.data.bones), ','.join(a.name for a in bpy.data.actions)))

