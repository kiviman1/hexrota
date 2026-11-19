"""Create a stylized Tavik 3D prototype and three in-place animation clips.
Run with Blender 5.3: blender -b --python scripts/generate_tavik_prototype.py
This is a modular, rigid-weight prototype inspired by the approved concept sprite.
"""
import bpy, math, os
from mathutils import Vector
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DEST = os.path.join(ROOT, 'unity-client', 'Assets', 'Hexrota', 'Art', 'Tavik3D')
SOURCE = os.path.join(ROOT, 'art', 'tavik-3d')
os.makedirs(DEST, exist_ok=True); os.makedirs(SOURCE, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for collection in (bpy.data.meshes, bpy.data.armatures, bpy.data.actions, bpy.data.materials):
    for data in list(collection):
        if data.users == 0: collection.remove(data)

def mat(name, color, roughness=.6, metallic=0):
    m = bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    node=m.node_tree.nodes.get('Principled BSDF'); node.inputs['Base Color'].default_value=(*color,1)
    node.inputs['Roughness'].default_value=roughness; node.inputs['Metallic'].default_value=metallic
    return m
cream=mat('Cream body feathers',(.89,.78,.57)); creamlight=mat('Ivory breast',(.99,.91,.73))
purple=mat('Purple feathers',(.245,.075,.36)); purple_light=mat('Wing feather purple',(.43,.16,.60))
purple_dark=mat('Plum eye surround',(.29,.055,.30)); red=mat('Red comb',(.71,.035,.045)); scarf=mat('Burgundy scarf',(.59,.035,.035))
orange=mat('Orange beak and feet',(1,.39,.025)); darkorange=mat('Dark lower beak',(.7,.18,.01))
white=mat('Warm white eyes',(1,.96,.85),.3); iris=mat('Warm brown irises',(.33,.16,.055),.28); black=mat('Pupils',(.015,.01,.018),.16)
gold=mat('Antique gold fittings',(.90,.48,.07),.29,.55); brass_dark=mat('Goggle bronze',(.38,.15,.03),.38,.38)
blueglass=mat('Goggle turquoise glass',(.04,.34,.43),.18,.22); brown=mat('Explorer leather',(.25,.105,.038)); brownlight=mat('Leather edges',(.47,.22,.07))

arm_data=bpy.data.armatures.new('TavikRig'); rig=bpy.data.objects.new('TavikRig',arm_data); bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig; rig.select_set(True); bpy.ops.object.mode_set(mode='EDIT')
def bone(name, head, tail, parent=None):
    b=arm_data.edit_bones.new(name); b.head=head; b.tail=tail
    if parent: b.parent=arm_data.edit_bones[parent]
    return b
bone('Body',(0,0,.48),(0,0,1.03)); bone('Head',(0,-.12,1.03),(0,-.16,1.52),'Body')
bone('Wing.L',(.32,0,.88),(.60,0,.70),'Body'); bone('Wing.R',(-.32,0,.88),(-.60,0,.70),'Body')
bone('Leg.L',(.19,-.01,.40),(.19,-.01,.10),'Body'); bone('Leg.R',(-.19,-.01,.40),(-.19,-.01,.10),'Body')
bone('Tail',(0,.25,.84),(0,.55,1.12),'Body'); bpy.ops.object.mode_set(mode='OBJECT'); rig.select_set(False)
parts=[]
def assign(obj,name,material,group):
    obj.name=name; obj.data.materials.append(material)
    for poly in obj.data.polygons: poly.use_smooth=True
    v=obj.vertex_groups.new(name=group); v.add(list(range(len(obj.data.vertices))),1.0,'REPLACE'); parts.append(obj); return obj

def oval(name,loc,scale,material,group,rot=None,seg=16,rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=loc); o=bpy.context.object
    o.scale=scale
    if rot is not None: o.rotation_euler=rot
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return assign(o,name,material,group)
def torus(name,loc,major,minor,material,group,rot=(math.pi/2,0,0), scale=None):
    bpy.ops.mesh.primitive_torus_add(major_segments=20,minor_segments=8,location=loc,rotation=rot,major_radius=major,minor_radius=minor)
    o=bpy.context.object
    if scale: o.scale=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return assign(o,name,material,group)
def cone(name,loc,r1,r2,depth,material,group,rot=(math.pi/2,0,0),verts=12):
    bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r1,radius2=r2,depth=depth,location=loc,rotation=rot)
    return assign(bpy.context.object,name,material,group)

# The head, face and equipment stay on one head bone; wings and feet are independent.
oval('Pear shaped body',(0,.06,.74),(.40,.34,.47),cream,'Body',seg=20,rings=12)
oval('Soft breast',(0,-.247,.73),(.31,.18,.33),creamlight,'Body')
oval('Purple head',(0,-.12,1.25),(.39,.32,.36),purple,'Head',seg=20,rings=12)
for i,(y,z,s) in enumerate([(-.20,1.57,.14),(-.03,1.61,.16),(.13,1.55,.14)]):
    oval('Crimson crest %d'%i,(0,y,z),(.105,s,s*1.08),red,'Head')
# Large plum eye rims and white eyes are the most distinctive Tavik feature.
for s in (-1,1):
    x=.19*s
    oval('Plum eye surround %s'%s,(x,-.40,1.30),(.205,.075,.218),purple_dark,'Head')
    oval('Eye white %s'%s,(x,-.458,1.30),(.164,.07,.177),white,'Head')
    oval('Iris %s'%s,(x+.035,-.520,1.293),(.071,.027,.093),iris,'Head')
    oval('Pupil %s'%s,(x+.042,-.543,1.298),(.044,.018,.066),black,'Head',seg=12,rings=8)
    oval('Catchlight %s'%s,(x+.025,-.560,1.325),(.018,.008,.024),white,'Head',seg=12,rings=8)
    # brass and turquoise aviator goggles sit above eyes on the crown
    torus('Goggle rim %s'%s,(x,-.344,1.635),.135,.029,gold,'Head',rot=(1.02,0,0),scale=(1,.80,1))
    oval('Goggle glass %s'%s,(x,-.354,1.641),(.108,.035,.084),blueglass,'Head',rot=(.45,0,0))
    torus('Goggle dark trim %s'%s,(x,-.337,1.633),.165,.016,brass_dark,'Head',rot=(1.02,0,0),scale=(1,.80,1))
# Short pointed beak and red wattle.
cone('Upper beak',(0,-.57,1.11),.14,.012,.25,orange,'Head')
cone('Lower beak',(0,-.535,1.035),.10,.01,.17,darkorange,'Head')
oval('Wattle',(0,-.455,.98),(.066,.052,.112),red,'Head')
# Scarf, pendant and leather backpack.
torus('Scarf collar',(0,-.04,1.02),.28,.065,scarf,'Body',rot=(0,0,0),scale=(1,.89,1))
oval('Scarf front knot',(.19,-.30,.99),(.13,.09,.105),scarf,'Body')
oval('Scarf end',(.29,-.295,.84),(.08,.06,.19),scarf,'Body',rot=(0,-.35,0))
cone('Pendant gold hex',(0,-.443,.88),.115,.115,.045,gold,'Body',verts=6)
cone('Pendant enamel',(0,-.474,.88),.075,.075,.016,brownlight,'Body',verts=6)
oval('Backpack leather',(0,.32,.82),(.31,.20,.30),brown,'Body')
oval('Backpack top roll',(0,.40,1.12),(.32,.14,.11),brownlight,'Body')
torus('Bedroll spiral',(.0,.535,1.12),.065,.018,gold,'Body')
for s in (-1,1):
    oval('Shoulder strap %s'%s,(s*.29,-.135,.88),(.052,.047,.29),brownlight,'Body',rot=(0,s*.18,0))
    wing='Wing.L' if s>0 else 'Wing.R'; leg='Leg.L' if s>0 else 'Leg.R'
    oval('Wing %s'%s,(s*.37,-.03,.78),(.155,.26,.22),purple,'Wing.L' if s>0 else 'Wing.R',rot=(0,s*.12,-s*.20))
    for i in range(3):
        oval('Wing feather %s %d'%(s,i),(s*(.41+i*.018),-.12+i*.09,.71-i*.018),(.115,.115,.08),purple_light,wing,seg=12,rings=8)
    oval('Thigh %s'%s,(s*.18,-.005,.32),(.07,.07,.19),orange,leg,seg=12,rings=8)
    oval('Foot %s'%s,(s*.18,-.11,.08),(.13,.14,.065),orange,leg,seg=12,rings=8)
    for i in (-1,0,1): oval('Toe %s %s'%(s,i),(s*.18+i*.075,-.20,.06),(.043,.105,.04),orange,leg,rot=(0,0,i*.20),seg=12,rings=8)
# Three curved, purple explorer tail feathers.
for i,x in enumerate((-.15,0,.15)):
    oval('Tail plume %d'%i,(x,.38,1.04),(.105,.15,.30),purple_light,'Tail',rot=(.65,x*1.4,0),seg=12,rings=8)

bpy.ops.object.select_all(action='DESELECT')
for o in parts: o.select_set(True)
bpy.context.view_layer.objects.active=parts[0]; bpy.ops.object.join(); mesh=bpy.context.object; mesh.name='TavikMesh'
mod=mesh.modifiers.new('Tavik skin','ARMATURE'); mod.object=rig; mesh.parent=rig
for p in rig.pose.bones: p.rotation_mode='XYZ'
rig.animation_data_create()
def key(frame,name,rot=(0,0,0),loc=None):
    p=rig.pose.bones[name]; p.rotation_euler=tuple(math.radians(v) for v in rot); p.keyframe_insert(data_path='rotation_euler',frame=frame,group=name)
    if loc is not None: p.location=loc; p.keyframe_insert(data_path='location',frame=frame,group=name)
def action(name,frames):
    for p in rig.pose.bones: p.rotation_euler=(0,0,0); p.location=(0,0,0)
    act=bpy.data.actions.new(name); rig.animation_data.action=act
    # Every clip defines a rest value for every bone. Otherwise limbs may keep
    # the previous clip's last pose when switching actions in Blender or Unity.
    for p in rig.pose.bones:
        p.keyframe_insert(data_path='rotation_euler',frame=frames[0][0],group=p.name)
        p.keyframe_insert(data_path='location',frame=frames[0][0],group=p.name)
    for f,a in frames:
        if name=='Idle':
            key(f,'Head',(0,0,a)); key(f,'Body',(a*.18,0,0)); key(f,'Tail',(0,0,-a*.7))
        elif name=='Walk':
            key(f,'Leg.L',(a,0,0)); key(f,'Leg.R',(-a,0,0)); key(f,'Body',(0,0,a*.10),(0, .025 if a==0 else 0,0)); key(f,'Head',(0,0,-a*.1)); key(f,'Tail',(0,0,a*.2))
        else:
            key(f,'Wing.L',(0,0,-a)); key(f,'Wing.R',(0,0,a)); key(f,'Head',(a*.05,0,0))
    rig.animation_data.action=None; track=rig.animation_data.nla_tracks.new(); track.name=name; track.strips.new(name,1,act)
    return act
idle=action('Idle',[(1,-3),(13,3),(25,-3),(37,3),(49,-3)])
action('Walk',[(1,25),(7,0),(13,-25),(19,0),(25,25)])
action('Flap',[(1,0),(5,45),(9,-12),(13,45),(17,-12),(21,45),(25,0)])
# Enable strips for FBX export, then mute them in the editable source so Idle can be previewed alone.
for t in rig.animation_data.nla_tracks: t.mute=False
scene=bpy.context.scene; scene.render.fps=24; scene.frame_start=1; scene.frame_end=49; scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True); mesh.select_set(True); bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.fbx(filepath=os.path.join(DEST,'TavikPrototype.fbx'),use_selection=True,object_types={'ARMATURE','MESH'},
    add_leaf_bones=False,bake_anim=True,bake_anim_use_nla_strips=True,bake_anim_use_all_actions=False,bake_anim_simplify_factor=0,
    axis_forward='-Z',axis_up='Y',mesh_smooth_type='FACE')
for t in rig.animation_data.nla_tracks: t.mute=True
for p in rig.pose.bones: p.rotation_euler=(0,0,0); p.location=(0,0,0)
rig.animation_data.action=idle; scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SOURCE,'TavikPrototype.blend'))
# Preview remains outside the exported FBX and saved source.
scene.render.engine='BLENDER_EEVEE'; scene.render.film_transparent=True; scene.render.resolution_x=640; scene.render.resolution_y=640
scene.render.resolution_percentage=100; scene.render.image_settings.file_format='PNG'; scene.world.color=(.16,.16,.16)
def light(name,loc,energy,size):
    data=bpy.data.lights.new(name,'AREA'); data.energy=energy; data.shape='DISK'; data.size=size
    obj=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(obj); obj.location=loc
    obj.rotation_euler=(Vector((0,0,.9))-obj.location).to_track_quat('-Z','Y').to_euler()
light('Key',(3,-4,5),450,4); light('Fill',(-3,-2,3),250,3); light('Rim',(1,3,4),350,3)
camera_data=bpy.data.cameras.new('PreviewCamera'); camera=bpy.data.objects.new('PreviewCamera',camera_data); bpy.context.collection.objects.link(camera)
camera.location=(2,-7,2.4); camera.rotation_euler=(Vector((0,0,.91))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type='ORTHO'; camera_data.ortho_scale=2.35; scene.camera=camera
scene.render.filepath=os.path.join(SOURCE,'TavikPrototypePreview.png'); bpy.ops.render.render(write_still=True)
print('TAVIK_PROTOTYPE_OK vertices=%s triangles=%s bones=%s actions=%s' % (len(mesh.data.vertices),sum(len(p.vertices)-2 for p in mesh.data.polygons),len(rig.data.bones),','.join(a.name for a in bpy.data.actions)))
