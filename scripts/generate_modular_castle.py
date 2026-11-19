"""Generate an editable, modular low-poly castle prototype in a fresh Blender process."""
import bpy, math, os, shutil
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT=os.path.join(ROOT,'art','castle-3d')
os.makedirs(OUT, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def material(name, color, metallic=0, roughness=.65):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.metallic=metallic; m.roughness=roughness
    m.use_nodes=True
    shader=m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value=(*color,1)
    shader.inputs['Metallic'].default_value=metallic
    shader.inputs['Roughness'].default_value=roughness
    return m
stone=material('Sandstone',(.72,.52,.34)); highlight=material('Limestone',(1,.85,.66))
stone_dark=material('Mortar',(.48,.33,.23)); roof=material('Rose red roof',(.65,.095,.105))
roof_edge=material('Roof tile edges',(.40,.045,.055)); gold=material('Gilded brass',(1,.57,.045),.45,.32)
gold_light=material('Gold highlights',(1,.79,.2),.35,.3); wood=material('Carved warm wood',(.38,.16,.055))
wood_edge=material('Wood seams',(.21,.075,.025)); dark=material('Window glass',(.09,.035,.018))
lantern=material('Lantern light',(1,.61,.10)); purple=material('Purple banner',(.39,.08,.57))
green=material('Leaves',(.18,.42,.055)); grass=material('Grass',(.27,.53,.075))
parts=[]
def obj(name, material):
    ob=bpy.context.object; ob.name=name; ob.data.materials.append(material); parts.append(ob); return ob
def cube(name, loc, size, mat, bevel=.035):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); ob=bpy.context.object; ob.dimensions=size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        m=ob.modifiers.new('Rounded edges','BEVEL'); m.width=bevel; m.segments=2
        ob.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return obj(name,mat)
def cyl(name, loc, r, depth, mat, vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=r, depth=depth, location=loc)
    ob=obj(name,mat)
    bevel=ob.modifiers.new('Soft stone edges','BEVEL'); bevel.width=.025; bevel.segments=2
    ob.modifiers.new('Weighted normals','WEIGHTED_NORMAL'); return ob
def sphere(name, loc, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, location=loc)
    ob=bpy.context.object; ob.scale=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for p in ob.data.polygons: p.use_smooth=True
    return obj(name,mat)
def cone(name, loc, r, depth, mat):
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=r, radius2=.09, depth=depth, location=loc)
    ob=obj(name,mat); b=ob.modifiers.new('Edge highlight','BEVEL'); b.width=.025; b.segments=2
    ob.modifiers.new('Weighted normals','WEIGHTED_NORMAL'); return ob
def torus(name, loc, major, minor, mat):
    bpy.ops.mesh.primitive_torus_add(major_segments=12, minor_segments=6, location=loc, major_radius=major, minor_radius=minor)
    return obj(name,mat)
# Base is intentionally a separate part and retains empty space for scene integration.
cube('Foundation_Island',(0,0,.13),(4.4,2.75,.26),stone_dark,.11)
cube('Foundation_Grass',(0,0,.29),(4.28,2.62,.16),grass,.08)
# Central sandstone keep and front face.
cube('Keep_MainWall',(0,.1,1.3),(2.55,1.65,1.95),stone,.07)
cube('Keep_FrontPanel',(0,-.78,1.25),(2.3,.18,1.8),highlight,.05)
# Horizontal mortar joints emphasize masonry yet remain independent, cheap strips.
for z in (.60,.88,1.16,1.44,1.72,2.0):
    cube('Keep_Mortar_%02d'%int(z*100),(0,-.884,z),(2.26,.025,.022),stone_dark,.006)
# Three circular towers each consist of a shaft, bands, and separately editable roof.
for name,x,y,r,h in [('Left',-1.34,.08,.53,2.05),('Center',0,.38,.70,2.8),('Right',1.34,.08,.48,1.87)]:
    cyl('Tower_'+name+'_Wall',(x,y,.36+h/2),r,h,highlight)
    for j,z in enumerate((.62,.98,1.34,1.70)):
        if z < .36+h:
            torus('Tower_'+name+'_MasonryBand_%d'%j,(x,y,z),r,.022,stone)
    cyl('Tower_'+name+'_Cornice',(x,y,.36+h),r*1.10,.16,stone)
    rh=.80 if name!='Center' else .94
    cone('Tower_'+name+'_Roof',(x,y,.40+h+rh/2),r*1.17,rh,roof)
    # Raised rims suggest roof tiles without a costly subdivided mesh.
    for j in range(1,4):
        fraction=j/4
        torus('Tower_'+name+'_RoofBand_%d'%j,(x,y,.40+h+rh*fraction),r*1.17*(1-fraction)+.09*fraction,.018,roof_edge)
    sphere('Tower_'+name+'_Finial',(x,y,.42+h+rh),(.095,.095,.095),gold)
    # Dark, vertically elongated inset windows on tower fronts.
    for index,dx in enumerate((-.17,.17) if name=='Center' else (0,)):
        sphere('Tower_'+name+'_Window_%d'%index,(x+dx,y-r-.018,.47+h*.69),(.105,.045,.19),dark)
# A pitched gable: wood understructure, tiled red roof as separate slabs.
def roof_slope(name, x, angle):
    ob=cube(name,(x,-.85,2.12),(.15,1.02,1.55),roof,.035)
    ob.rotation_euler[1]=angle
    return ob
roof_slope('Entrance_Roof_Left',-.57,math.radians(43))
roof_slope('Entrance_Roof_Right',.57,-math.radians(43))
# Recessed arched door: dark round top and rectangular lower portion framed by gold strips.
cube('Entrance_Door',(0,-.994,.92),(.92,.15,1.13),wood,.04)
sphere('Entrance_DoorTop',(0,-1.00,1.42),(.46,.08,.46),wood)
for x in (-.28,0,.28): cube('Entrance_Plank_%s'%x,(x,-1.083,.93),(.018,.025,.95),wood_edge,.003)
for x in (-.55,.55): cube('Entrance_FrameSide_%s'%x,(x,-1.08,.92),(.13,.14,1.15),gold,.025)
# The gable crown and matching angled trim are separate modules.
for side in (-1,1):
    trim=cube('Entrance_GableTrim_%s'%side,(side*.39,-1.13,1.94),(.11,.16,1.06),gold,.025)
    trim.rotation_euler[1]=-side*math.radians(44)
sphere('Entrance_GoldCrest',(0,-1.16,1.92),(.16,.075,.16),gold_light)
for x in (-.76,.76):
    cube('Lantern_Case_%s'%x,(x,-1.08,1.15),(.20,.17,.27),wood_edge,.025)
    cube('Lantern_Light_%s'%x,(x,-1.18,1.15),(.135,.05,.18),lantern,.02)
    cone('Lantern_Roof_%s'%x,(x,-1.08,1.34),.16,.14,wood_edge)
# Two banner objects and medallions remain independent.
for x in (-.96,.96):
    cube('Banner_Cloth_%s'%x,(x,-1.01,.90),(.31,.06,.54),purple,.015)
    cube('Banner_TopBar_%s'%x,(x,-1.04,1.18),(.38,.08,.06),gold,.02)
    sphere('Banner_Badge_%s'%x,(x,-1.06,.88),(.085,.035,.085),gold_light)
# Front steps are individually movable.
for j in range(3):
    cube('Step_%d'%j,(0,-1.02-j*.21,.38-j*.075),(1.1+j*.17,.44,.15),highlight,.035)
# Low-poly garden clusters.
for j,(x,y) in enumerate([(-1.9,-.72),(-1.65,-1.05),(1.8,-.75),(1.65,-1.05),(-1.88,.82),(1.92,.75)]):
    for k,dx in enumerate((-.10,.09)):
        sphere('Garden_Bush_%d_%d'%(j,k),(x+dx,y,.46),(.22,.18,.18),green)
# Export only modular castle geometry.
bpy.ops.object.select_all(action='DESELECT')
for part in parts: part.select_set(True)
bpy.context.view_layer.objects.active=parts[0]
bpy.ops.export_scene.fbx(filepath=os.path.join(OUT,'CastleModules.fbx'), use_selection=True,
    object_types={'MESH'}, apply_unit_scale=True, axis_forward='-Z', axis_up='Y', mesh_smooth_type='FACE')
unity_out=os.path.join(ROOT,'unity-client','Assets','Hexrota','Art','Castle3D')
os.makedirs(unity_out, exist_ok=True)
shutil.copyfile(os.path.join(OUT,'CastleModules.fbx'),os.path.join(unity_out,'CastleModules.fbx'))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'CastleModules.blend'))
# Quality-check image, kept outside the saved modular scene.
bpy.context.scene.render.engine='BLENDER_EEVEE'; bpy.context.scene.render.film_transparent=True
bpy.context.scene.render.resolution_x=800; bpy.context.scene.render.resolution_y=800
bpy.context.scene.render.resolution_percentage=100; bpy.context.scene.render.image_settings.file_format='PNG'
def area(name,loc,energy,size):
    light=bpy.data.lights.new(name,'AREA'); light.energy=energy; light.shape='DISK'; light.size=size
    o=bpy.data.objects.new(name,light); bpy.context.collection.objects.link(o); o.location=loc
    o.rotation_euler=(Vector((0,0,1.5))-o.location).to_track_quat('-Z','Y').to_euler()
area('Key',(4,-5,7),900,5); area('Fill',(-5,-3,5),650,5); area('Rim',(2,4,6),1000,4)
camera=bpy.data.cameras.new('PreviewCamera'); camera.type='ORTHO'; camera.ortho_scale=6
cam=bpy.data.objects.new('PreviewCamera',camera); bpy.context.collection.objects.link(cam)
cam.location=(5,-9,6); cam.rotation_euler=(Vector((0,0,1.55))-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.context.scene.camera=cam; bpy.context.scene.render.filepath=os.path.join(OUT,'CastleModulesPreview.png')
bpy.ops.render.render(write_still=True)
print('CASTLE_BUILD_OK objects=%d vertices=%d faces=%d'%(len(parts),sum(len(p.data.vertices) for p in parts),sum(len(p.data.polygons) for p in parts)))
