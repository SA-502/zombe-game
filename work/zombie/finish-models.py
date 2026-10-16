import bpy, json, os
from mathutils import Vector
scene=bpy.context.scene
col=bpy.data.collections['04 | ASHFALL DISTRICT']
rust=bpy.data.materials['District | corroded steel']
def fence(name,x,z,w,d):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,1.8));o=bpy.context.object;o.name=name;o.dimensions=(w,d,3.2)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for c in list(o.users_collection):c.objects.unlink(o)
    col.objects.link(o);o.data.materials.append(rust);o['district']=True;o['game_collision']=True
fence('DZ | Power perimeter west',19.8,49,.35,24)
fence('DZ | Power perimeter east',38.2,49,.35,24)
fence('DZ | Power perimeter back',29,61,18.75,.35)
o=bpy.data.objects['DZ | Power gate'];o.location.x=29;o.dimensions.x=18.75
o['dynamic_gate']=True
# Moved the gate control in front of the barrier, reachable before unlocking.
for m in bpy.data.materials:
    if m.name.startswith('Warm ivory'):
        n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');n.inputs['Base Color'].default_value=(.46,.45,.36,1)
print('Sealed the power station perimeter and aged the safehouse materials.')
