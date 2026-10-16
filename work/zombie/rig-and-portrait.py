import bpy, math, os, json
from mathutils import Vector
scene=bpy.context.scene
out=r'C:\Users\xxtro\Documents\Codex\2026-10-16\new-chat\outputs'
with open(os.path.join(out,'house-game','dist','assets','district.json'),encoding='utf-8') as f:a=json.load(f)
def gv(v):return Vector((v[0],-v[2],v[1]))
col=bpy.data.collections['07 | COMBAT UPDATE']
arm=bpy.data.armatures.new('Infected editable skeleton');rig=bpy.data.objects.new('COMBAT | Infected walk rig',arm);col.objects.link(rig);rig.location.x=70;rig.show_in_front=True
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for j in a['enemyRig']:
    b=arm.edit_bones.new(j['id']);b.head=gv(j['pivot']);b.tail=b.head+Vector((0,0,.15))
    if j['parent']:b.parent=arm.edit_bones[j['parent']]
bpy.ops.object.mode_set(mode='OBJECT')
for o in col.objects:
    if o.get('template')=='zombie':
        group=o.vertex_groups.new(name=o['game_bone']);group.add(list(range(len(o.data.vertices))),1,'REPLACE');mod=o.modifiers.new('Rigid joint skinning','ARMATURE');mod.object=rig
for frame in [1,7,13,19,25]:
    t=(frame-1)/24*math.tau
    for name,p in rig.pose.bones.items():
        p.rotation_mode='XYZ';rx=0;rz=0
        if name=='torso':rx=-.13+math.sin(t*2)*.025;rz=math.sin(t)*.04
        elif name=='head':rx=.08;rz=.06
        else:
            sign=-1 if name.endswith('left') else 1
            if name.startswith('arm_'):rx=.70+math.sin(t+sign*.7)*.16;rz=sign*.10
            elif name.startswith('forearm_'):rx=.27+math.sin(t+sign)*.13
            elif name.startswith('leg_'):rx=math.sin(t)*.38*sign
            elif name.startswith('shin_'):rx=-max(0,math.sin(t)*sign)*.5
        p.rotation_euler=(rx,0,rz);p.keyframe_insert(data_path='rotation_euler',frame=frame)
scene.frame_start=1;scene.frame_end=25;scene.frame_set(7)
camera_data=bpy.data.cameras.new('Combat portrait camera');camera=bpy.data.objects.new('COMBAT | Portrait camera',camera_data);col.objects.link(camera)
camera.location=(71.1,3.1,1.65);target=Vector((70,0,1.03));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.lens=54
key_data=bpy.data.lights.new('Combat portrait softbox','AREA');key=bpy.data.objects.new('COMBAT | Portrait softbox',key_data);col.objects.link(key);key.location=(68.5,3,4);key.rotation_euler=(Vector((70,0,1))-key.location).to_track_quat('-Z','Y').to_euler();key_data.energy=300;key_data.shape='DISK';key_data.size=3
old_camera=scene.camera;old_engine=scene.render.engine;old_resolution=(scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage);old_filepath=scene.render.filepath
scene.camera=camera;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.render.resolution_x=700;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath=os.path.join(out,'ashfall-zombie-updated.png')
bpy.ops.render.render(write_still=True)
scene.camera=old_camera;scene.render.engine=old_engine;scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage=old_resolution;scene.render.filepath=old_filepath
key.hide_render=True;camera.hide_render=True
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out,'ashfall-combat-update.blend'))
print('Saved editable Blender skeleton with walk action and rendered zombie portrait.')
