import bpy, math, json, os
from mathutils import Vector, Matrix
scene=bpy.context.scene
output=r'C:\Users\xxtro\Documents\Codex\2026-10-16\new-chat\outputs'
asset_path=os.path.join(output,'house-game','dist','assets','district.json')
with open(asset_path,encoding='utf-8') as f: asset=json.load(f)
# Restore the already-designed town details into the open older scene, without
# replacing the user's scene or re-generating the buildings.
if not bpy.data.collections.get('06 | TOWN REMASTER'):
    with bpy.data.libraries.load(os.path.join(output,'ashfall-town-remastered.blend'),link=False) as (src,dst):
        dst.collections=[n for n in src.collections if n=='06 | TOWN REMASTER']
    for c in dst.collections:
        if c:scene.collection.children.link(c)
    for o in list(bpy.data.objects):
        if o.name.startswith(('DZ | Dry fountain','DZ | Fountain top')) or (' shop window' in o.name and o.name.startswith('DZ |')):bpy.data.objects.remove(o,do_unlink=True)
for o in list(bpy.data.objects):
    if o.get('template')=='zombie' or o.name.startswith('COMBAT |') or o.name in ['DZ | Station '+s for s in ['rifle','shotgun']] or o.name in ['DZ | Station '+kind+' '+s for s in ['rifle','shotgun'] for kind in ['screen','stripe']]:bpy.data.objects.remove(o,do_unlink=True)
col=bpy.data.collections.get('07 | COMBAT UPDATE') or bpy.data.collections.new('07 | COMBAT UPDATE')
if col.name not in scene.collection.children:scene.collection.children.link(col)
def mat(name,color,rough=.9,metal=0,glow=0):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
    n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');n.inputs['Base Color'].default_value=(*color,1);n.inputs['Roughness'].default_value=rough;n.inputs['Metallic'].default_value=metal
    n.inputs['Emission Color'].default_value=(*color,1);n.inputs['Emission Strength'].default_value=glow
    return m
skin=mat('Combat | ashen skin',(.28,.32,.23));cloth=mat('Combat | torn uniform',(.10,.135,.075));dark=mat('Combat | deep recess',(.012,.018,.012));boot=mat('Combat | worn leather',(.045,.049,.035));bone=mat('Combat | old teeth',(.58,.53,.36));scar=mat('Combat | dry scars',(.14,.075,.042));eye=mat('Combat | amber eyes',(1,.46,.04),.4,0,3);steel=mat('Combat | wall steel',(.045,.067,.069),.55,.65);chalk=mat('Combat | wall chalk',(.58,.81,.72),.8,0,.6);price=mat('Combat | price amber',(.9,.53,.20),.6,0,.5)
def game(v):return Vector((v[0],-v[2],v[1]))
def mesh(name,vs,faces,m,pos=(0,0,0),template=None,boneid=None,smooth=False):
    me=bpy.data.meshes.new('COMBAT | '+name);me.from_pydata([game(v) for v in vs],[],faces);me.update()
    o=bpy.data.objects.new('COMBAT | '+name,me);col.objects.link(o);o.location=game(pos);o.data.materials.append(m)
    for p in me.polygons:p.use_smooth=smooth
    if template:o.location.x+=70;o['template']='zombie';o['game_bone']=boneid or 'torso'
    o['combat_update']=True;return o
def box(name,p,s,m,b=None):
    x,y,z=[v/2 for v in s];vs=[(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)]
    return mesh(name,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)],m,p,bool(b),b)
def ellipsoid(name,p,s,m,b,ring=12,rows=10):
    vs=[];faces=[]
    for j in range(rows+1):
        a=math.pi*j/rows
        for i in range(ring):
            t=math.tau*i/ring;vs.append((s[0]*math.sin(a)*math.cos(t),s[1]*math.cos(a),s[2]*math.sin(a)*math.sin(t)))
    for j in range(rows):
        for i in range(ring):k=j*ring+i;n=j*ring+(i+1)%ring;faces.append((k,n,n+ring,k+ring))
    return mesh(name,vs,faces,m,p,True,b,True)
def limb(name,p,s,m,b):
    vs=[];faces=[]
    for y,r in [(-.5,1),(.5,.82)]:
        for i in range(10):t=math.tau*i/10;vs.append((math.cos(t)*s[0]*r,y*s[1],math.sin(t)*s[2]*r))
    for i in range(10):j=(i+1)%10;faces.append((i,i+10,j+10,j))
    faces.extend([tuple(range(10)),tuple(reversed(range(10,20)))]);return mesh(name,vs,faces,m,p,True,b,True)
rig=[{'id':'torso','pivot':[0,.83,0],'parent':None},{'id':'head','pivot':[.015,1.71,-.09],'parent':'torso'}]
ellipsoid('pelvis',(0,.87,0),(.23,.17,.145),cloth,'torso')
# Shaped ribcage with shoulders, waist and curved profile rather than a box.
vs=[];faces=[]
for radius,y in [(.20,.90),(.235,1.02),(.29,1.29),(.285,1.45),(.19,1.52)]:
    for i in range(14):t=math.tau*i/14;vs.append((radius*math.cos(t),y,radius*.61*math.sin(t)))
for j in range(4):
    for i in range(14):k=j*14+i;n=j*14+(i+1)%14;faces.append((k,k+14,n+14,n))
faces.extend([tuple(range(14)),tuple(reversed(range(56,70)))]);mesh('shaped torso',vs,faces,cloth,(0,0,0),True,'torso',True)
ellipsoid('sunken abdomen',(0,1.06,-.105),(.18,.18,.075),dark,'torso')
box('torn shirt front',(-.08,1.26,-.165),(.14,.26,.014),dark,'torso')
box('belt',(0,.95,-.018),(.46,.065,.30),boot,'torso');box('belt buckle',(.035,.95,-.18),(.065,.045,.02),bone,'torso')
box('chest strap',(.15,1.20,-.175),(.035,.43,.025),boot,'torso')
for k in range(4):box('ragged shirt hem '+str(k),(-.19+k*.12,.87,-.14),(.07,.10+(k%2)*.055,.025),cloth,'torso')
limb('neck',(0,1.54,-.045),(.085,.16,.08),skin,'torso')
def headpart(n,p,s,m):return ellipsoid(n,(p[0]+.015,p[1]+1.71,p[2]-.09),s,m,'head')
headpart('skull',(0,.015,0),(.145,.185,.133),skin);headpart('occiput',(0,.045,.035),(.14,.145,.115),skin);headpart('temple scar',(-.12,.045,-.035),(.016,.07,.061),scar)
for sign in [-1,1]:
    headpart('ear '+str(sign),(sign*.15,-.005,.012),(.028,.051,.022),skin)
    headpart('eye socket '+str(sign),(sign*.057,.019,-.113),(.050,.039,.025),dark)
    headpart('amber eye '+str(sign),(sign*.057,.018,-.139),(.020,.014,.009),eye)
    headpart('brow '+str(sign),(sign*.056,.060,-.113),(.061,.025,.031),skin)
    headpart('cheekbone '+str(sign),(sign*.091,-.056,-.098),(.046,.036,.034),skin)
headpart('nose bridge',(0,-.009,-.127),(.023,.057,.035),skin);headpart('nose hollow',(0,-.049,-.153),(.016,.012,.009),dark)
headpart('open mouth',(.01,-.105,-.102),(.068,.042,.031),dark);headpart('slack jaw',(.013,-.15,-.070),(.085,.052,.066),skin)
for k in range(5):box('broken tooth '+str(k),(-.023+k*.021,1.619,-.223),(.013,.015+(k%2)*.007,.009),bone,'head')
for side,sign in [('left',-1),('right',1)]:
    a='arm_'+side;f='forearm_'+side;l='leg_'+side;s='shin_'+side
    rig.extend([{'id':a,'pivot':[sign*.285,1.41,.005],'parent':'torso'},{'id':f,'pivot':[sign*.285,1.07,.005],'parent':a},{'id':l,'pivot':[sign*.135,.87,0],'parent':None},{'id':s,'pivot':[sign*.135,.47,0],'parent':l}])
    ellipsoid('shoulder '+side,(sign*.285,1.38,.005),(.128,.14,.13),cloth,a);limb('upper arm '+side,(sign*.285,1.23,.005),(.085,.30,.085),cloth,a)
    box('ragged sleeve '+side,(sign*.32,1.11,-.04),(.11,.07,.10),dark,a)
    ellipsoid('elbow '+side,(sign*.285,1.07,.005),(.072,.075,.071),skin,f);limb('forearm '+side,(sign*.285,.92,.005),(.055,.28,.063),skin,f)
    box('forearm scar '+side,(sign*.285,.92,-.056),(.065,.09,.007),scar,f);ellipsoid('hand '+side,(sign*.285,.743,-.007),(.067,.085,.029),skin,f)
    for k in range(4):limb('finger '+side+str(k),(sign*.285-.046+k*.029,.659,-.017),(.012,.092-(.02 if k==3 else 0),.012),skin,f)
    limb('thumb '+side,(sign*.36,.73,0),(.018,.075,.018),skin,f)
    limb('thigh '+side,(sign*.135,.68,0),(.103,.37,.105),cloth,l);ellipsoid('knee '+side,(sign*.135,.47,-.012),(.082,.082,.087),skin,s)
    limb('shin '+side,(sign*.135,.30,0),(.068,.33,.077),cloth,s);box('torn trouser cuff '+side,(sign*.135+.02,.18,-.07),(.09,.11,.025),dark,s)
    ellipsoid('boot '+side,(sign*.135,.10,-.055),(.10,.082,.175),boot,s);box('boot sole '+side,(sign*.135,.055,-.055),(.185,.035,.28),boot,s)
# Wall-mounted weapons use the existing Blender weapon meshes, duplicated in the
# scene and transformed onto steel-backed mounts. All visible detail is exported.
wall_objects=[]
for wid,cx,cz,nx,nz,cost in [('rifle',4.8,7.85,0,1,900),('shotgun',-18.78,30,1,0,1400)]:
    tangent=Vector((nz,0,-nx));normal=Vector((nx,0,nz));center=Vector((cx,1.83,cz))
    def wp(p):return tuple(center+tangent*p[0]+Vector((0,p[1],0))+normal*p[2])
    def board(n,p,s,m):
        # Build directly in world coordinates to keep the panel normal correct.
        x,y,z=[v/2 for v in s];local=[(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)];vs=[wp((v[0]+p[0],v[1]+p[1],v[2]+p[2])) for v in local]
        o=mesh('Wall '+wid+' '+n,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)],m);wall_objects.append(o);return o
    board('backing',(0,0,0),(2.1,1.15,.10),steel)
    for xx in [-1.035,1.035]:board('side rail',(xx,0,.075),(.025,1.15,.025),chalk)
    for yy in [-.56,.56]:board('end rail',(0,yy,.075),(2.1,.025,.025),chalk)
    for xx in [-.70,.62]:board('gun hook',(xx,-.10,.16),(.035,.22,.20),steel)
    for source in [o for o in bpy.data.objects if o.get('template')==wid]:
        # Existing template coordinates: Blender offset 80 -> game local.
        ev=source.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh();me.calc_loop_triangles();verts=[];faces=[]
        for v in me.vertices:
            w=source.matrix_world@v.co-Vector((80,0,0));gx,gy,gz=w.x,w.z,-w.y
            verts.append(wp((-gz*.95-.33,gy*.95-.08,gx*.95+.18)))
        for p in me.polygons:faces.append(tuple(p.vertices))
        o=mesh('Wall '+wid+' '+source.name,verts,faces,source.data.materials[0]);wall_objects.append(o);ev.to_mesh_clear()
    # Lettering created as Blender text, converted by evaluated mesh on export.
    cu=bpy.data.curves.new('Wall buy price '+wid,'FONT');cu.body=('NIMR 47' if wid=='rifle' else 'RAAD 12')+'  /  '+str(cost);cu.align_x='CENTER';cu.size=.13;cu.extrude=.0015
    o=bpy.data.objects.new('COMBAT | Wall '+wid+' price',cu);col.objects.link(o);o.data.materials.append(price);o.location=game(wp((0,-.43,.07)))
    # Text local X follows the wall tangent; local Y follows world height.
    bx=game(tuple(tangent));by=Vector((0,0,1));bz=bx.cross(by);o.rotation_euler=Matrix((bx,by,bz)).transposed().to_euler();o['combat_update']=True;wall_objects.append(o)
    st=next(s for s in asset['stations'] if s['id']==wid);st.update({'x':cx+nx*.45,'z':cz+nz*.45,'label':('بندقية نمر 47' if wid=='rifle' else 'خرطوش رعد 12'),'wall':{'x':cx,'z':cz,'normal':[nx,nz]}})
def xyz(v):return [round(v.x,5),round(v.z,5),round(-v.y,5)]
deps=bpy.context.evaluated_depsgraph_get()
def export(o,template=False):
    ev=o.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles();verts=[];norms=[];offset=Vector((70,0,0)) if template else Vector((0,0,0));origin=o.matrix_world.translation-offset;normal=o.matrix_world.to_3x3().inverted().transposed()
    for tri in me.loop_triangles:
        for vi in tri.vertices:
            p=o.matrix_world@me.vertices[vi].co-offset
            if template:p-=origin
            verts.extend(xyz(p));norms.extend(xyz((normal@(me.vertices[vi].normal if me.polygons[tri.polygon_index].use_smooth else tri.normal)).normalized()))
    m=o.data.materials[0];n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');asset['materials'][m.name]={'color':list(n.inputs['Base Color'].default_value[:3]),'roughness':float(n.inputs['Roughness'].default_value),'metalness':float(n.inputs['Metallic'].default_value),'glow':float(n.inputs['Emission Strength'].default_value)}
    row={'name':o.name,'positions':verts,'normals':norms,'material':m.name}
    if template:row.update({'origin':xyz(origin),'bone':o.get('game_bone','torso')})
    else:row.update({'roof':False,'gate':False})
    ev.to_mesh_clear();return row
old_station_names=['DZ | Station '+kind+s for s in ['rifle','shotgun'] for kind in ['', 'screen ','stripe ']]
asset['objects']=[r for r in asset['objects'] if r['name'] not in old_station_names and not r['name'].startswith('COMBAT |')]
asset['colliders']=[r for r in asset['colliders'] if r['name'] not in old_station_names]
bpy.context.view_layer.update()
asset['templates']['zombie']=[export(o,True) for o in col.objects if o.get('template')=='zombie']
asset['objects'].extend(export(o) for o in wall_objects)
asset['enemyRig']=rig;asset['environment']['combatVersion']=3
with open(asset_path+'.tmp','w',encoding='utf-8') as f:json.dump(asset,f,separators=(',',':'))
os.replace(asset_path+'.tmp',asset_path)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(output,'ashfall-combat-update.blend'))
print('COMBAT EXPORT OK:',len(asset['templates']['zombie']),'zombie meshes;',len(wall_objects),'wall buy meshes;',len(rig),'joints; scene saved:',bpy.data.filepath)
