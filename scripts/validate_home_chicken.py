import bpy, os, json
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
p=os.path.abspath('unity-client/Assets/Hexrota/Art/Chicken3D/ChickenRig.fbx')
bpy.ops.import_scene.fbx(filepath=p, use_anim=True)
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
actions=[{'name':a.name,'range':[float(a.frame_range[0]),float(a.frame_range[1])]} for a in bpy.data.actions]
print('CHICKEN_FBX_CHECK',json.dumps({'meshes':[(o.name,len(o.data.vertices),len(o.data.polygons),len(o.vertex_groups)) for o in meshes],'rigs':[(o.name,len(o.data.bones)) for o in rigs],'actions':actions}))
assert len(meshes)==1 and len(rigs)==1 and len(rigs[0].data.bones)==6
assert len(actions)==3
rig=rigs[0]
rig.animation_data_create()
for name,bone,frames in [('Idle','Head',(1,13)),('Walk','Leg.L',(1,13)),('Flap','Wing.L',(1,5))]:
    action=next(a for a in bpy.data.actions if a.name.endswith('|'+name))
    rig.animation_data.action=action
    matrices=[]
    for frame in frames:
        bpy.context.scene.frame_set(frame)
        matrices.append(tuple(round(value,6) for row in rig.pose.bones[bone].matrix for value in row))
    assert matrices[0] != matrices[1], name + ' has no visible bone change'
    print('CHICKEN_ANIMATION_CHECK',name,bone,'animated')
