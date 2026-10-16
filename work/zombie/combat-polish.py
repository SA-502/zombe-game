import bpy, math, json, os
from mathutils import Vector
from mathutils import noise
out=r'C:\Users\xxtro\Documents\Codex\2026-10-16\new-chat\outputs'
path=os.path.join(out,'house-game','dist','assets','district.json')
with open(path,encoding='utf-8') as f:a=json.load(f)
col=bpy.data.collections['07 | COMBAT UPDATE'];rig=bpy.data.objects['COMBAT | Infected walk rig'];rig.data.pose_position='REST'
def adjust(prefix,scale):
    for o in col.objects:
        if o.name.startswith('COMBAT | '+prefix):
            for v in o.data.vertices:v.co.x*=scale[0];v.co.z*=scale[1];v.co.y*=scale[2]
adjust('skull',(.88,1.04,.92));adjust('occiput',(.88,1,.9));adjust('cheekbone',(.55,.66,.46));adjust('brow',(.88,.46,.8));adjust('amber eye',(.72,.45,1));adjust('ear',(.7,.9,.7));adjust('open mouth',(.78,.78,.9));adjust('slack jaw',(.89,.86,.9));adjust('shoulder',(.83,.86,.9))
for o in list(col.objects):
    if o.name in ['COMBAT | broken tooth 0','COMBAT | broken tooth 4']:bpy.data.objects.remove(o,do_unlink=True)
for o in col.objects:
    if o.name.startswith('COMBAT | broken tooth'):
        o.location.z-=.008 if o.name.endswith('2') else .003
    if o.name.startswith('COMBAT | brow'):
        o.rotation_euler.y=.17 if o.name.endswith('-1') else -.14
cloth=bpy.data.materials['Combat | torn uniform'];n=cloth.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(.075,.071,.045,1);cloth.diffuse_color=(.075,.071,.045,1)
# Dirty patches are authored as Blender vertex colors, exported with the mesh.
for o in col.objects:
    if o.get('template')!='zombie':continue
    colors=o.data.color_attributes.new(name='Combat grime',type='FLOAT_COLOR',domain='POINT');m=o.data.materials[0]
    for v in o.data.vertices:
        pos=o.matrix_world@v.co-Vector((70,0,0));f=.78+noise.noise(pos*17)*.30+noise.noise(pos*43)*.09
        colors.data[v.index].color=(max(.38,f),max(.38,f*.97),max(.38,f*.92),1)
    if m.name not in ['Combat | amber eyes'] and not m.node_tree.nodes.get('Combat vertex grime'):
        n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');v=m.node_tree.nodes.new('ShaderNodeVertexColor');v.name='Combat vertex grime';v.layer_name='Combat grime';mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[1].default_value=n.inputs['Base Color'].default_value;m.node_tree.links.new(v.outputs['Color'],mix.inputs[2]);m.node_tree.links.new(mix.outputs[0],n.inputs['Base Color'])
def material(name,c,glow):
    m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*c,1);n.inputs['Roughness'].default_value=.72;n.inputs['Metallic'].default_value=.3;n.inputs['Emission Color'].default_value=(*c,1);n.inputs['Emission Strength'].default_value=glow;return m
metal=material('Combat | wall gun steel',(.32,.37,.34),.15);wood=material('Combat | wall gun grip',(.32,.19,.09),.15);outline=material('Combat | chalk weapon trace',(.55,.78,.68),.75)
for o in list(col.objects):
    if o.type=='MESH' and o.name.startswith('COMBAT | Wall ') and ' DZ | ' in o.name:
        o.data.materials[0]=wood if any(t in o.name for t in ['stock','grip','handguard','pump']) else metal
        wire=o.copy();wire.data=o.data.copy();wire.name=o.name+' chalk trace';col.objects.link(wire);wire.data.materials[0]=outline;mod=wire.modifiers.new('Chalk silhouette edges','WIREFRAME');mod.thickness=.006;mod.use_replace=True;wire['combat_update']=True
def xyz(v):return [round(v.x,5),round(v.z,5),round(-v.y,5)]
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
def export(o,template=False):
    ev=o.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles();verts=[];normals=[];colors=[];offset=Vector((70,0,0)) if template else Vector((0,0,0));origin=o.matrix_world.translation-offset;normal=o.matrix_world.to_3x3().inverted().transposed();attr=me.color_attributes.get('Combat grime')
    for tri in me.loop_triangles:
        for vi in tri.vertices:
            p=o.matrix_world@me.vertices[vi].co-offset
            if template:p-=origin
            verts.extend(xyz(p));normals.extend(xyz((normal@(me.vertices[vi].normal if me.polygons[tri.polygon_index].use_smooth else tri.normal)).normalized()))
            if attr:colors.extend([round(c,4) for c in attr.data[vi].color[:3]])
    m=o.data.materials[0];n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');a['materials'][m.name]={'color':list(n.inputs['Base Color'].default_value[:3]),'roughness':float(n.inputs['Roughness'].default_value),'metalness':float(n.inputs['Metallic'].default_value),'glow':float(n.inputs['Emission Strength'].default_value)}
    r={'name':o.name,'positions':verts,'normals':normals,'material':m.name}
    if colors:r['colors']=colors
    if template:r.update({'origin':xyz(origin),'bone':o['game_bone']})
    else:r.update({'roof':False,'gate':False})
    ev.to_mesh_clear();return r
a['templates']['zombie']=[export(o,True) for o in col.objects if o.get('template')=='zombie'];a['objects']=[r for r in a['objects'] if not r['name'].startswith('COMBAT | Wall ')];a['objects'].extend(export(o) for o in col.objects if o.name.startswith('COMBAT | Wall ') and o.type in ['MESH','FONT'])
with open(path+'.tmp','w',encoding='utf-8') as f:json.dump(a,f,separators=(',',':'))
os.replace(path+'.tmp',path);rig.data.pose_position='POSE'
scene=bpy.context.scene;previous=scene.camera;engine=scene.render.engine;settings=(scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage,scene.render.filepath)
scene.camera=bpy.data.objects['COMBAT | Portrait camera'];key=bpy.data.objects['COMBAT | Portrait softbox'];key.hide_render=False;scene.render.engine='CYCLES';scene.cycles.samples=20;scene.render.resolution_x=700;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.filepath=os.path.join(out,'ashfall-zombie-updated.png');bpy.ops.render.render(write_still=True)
key.hide_render=True;scene.camera=previous;scene.render.engine=engine;scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage,scene.render.filepath=settings
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out,'ashfall-combat-update.blend'))
print('Polished Blender character anatomy and vertex grime; wall gun chalk traces exported:',len(a['templates']['zombie']),len(a['objects']))
