import bpy, json, os
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.fbx(filepath=os.path.abspath('art/castle-3d/CastleModules.fbx'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
required=['Keep_MainWall','Entrance_Door','Tower_Left_Wall','Tower_Left_Roof','Tower_Center_Wall','Tower_Center_Roof','Tower_Right_Wall','Tower_Right_Roof']
assert all(any(o.name.startswith(name) for o in meshes) for name in required)
assert len(meshes)>=30
print('CASTLE_FBX_CHECK',json.dumps({'mesh_objects':len(meshes),'vertices':sum(len(o.data.vertices) for o in meshes),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes),'required_modules':required}))
