import bpy, math, random, json, os
from mathutils import Vector
random.seed(49)
scene=bpy.context.scene
worldcol=bpy.data.collections.new('04 | ASHFALL DISTRICT');scene.collection.children.link(worldcol)
assetcol=bpy.data.collections.new('05 | ZOMBIES AND WEAPONS');scene.collection.children.link(assetcol)
def mat(name,c,metal=0,rough=.8,glow=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
    n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    n.inputs['Base Color'].default_value=(*c,1);n.inputs['Roughness'].default_value=rough;n.inputs['Metallic'].default_value=metal
    if glow and 'Emission Color' in n.inputs:
        n.inputs['Emission Color'].default_value=(*c,1);n.inputs['Emission Strength'].default_value=glow
    return m
concrete=mat('District | weathered concrete',(.23,.25,.23))
plaster=mat('District | faded plaster',(.40,.37,.29))
brick=mat('District | brick',(.25,.13,.09))
asphalt=mat('District | asphalt',(.075,.085,.078))
rust=mat('District | corroded steel',(.26,.13,.055),.55)
metal=mat('District | black metal',(.035,.045,.043),.65,.4)
amber=mat('District | amber light',(1,.36,.055),0,.4,3)
teal=mat('District | emergency teal',(.05,.7,.65),0,.4,2)
red=mat('District | red light',(.7,.025,.012),0,.5,2)
paint=mat('District | worn road lines',(.50,.45,.30))
wood=mat('District | timber',(.19,.115,.065))
glass=mat('District | dark windows',(.045,.11,.12),.4,.25)
earth=mat('District | wasteland',(.16,.17,.12))
leaf=mat('District | dead foliage',(.14,.18,.08))
def box(name,x,z,y,w,d,h,m,solid=False,roof=False,collection=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y+h/2))
    o=bpy.context.object;o.name='DZ | '+name;o.dimensions=(w,d,h)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for c in list(o.users_collection):c.objects.unlink(o)
    (collection or worldcol).objects.link(o);o.data.materials.append(m)
    o['game_collision']=solid;o['district']=True;o['game_roof']=roof
    return o
def cylinder(name,x,z,y,r,h,m,solid=False,collection=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=h,location=(x,-z,y+h/2))
    o=bpy.context.object;o.name='DZ | '+name
    for c in list(o.users_collection):c.objects.unlink(o)
    (collection or worldcol).objects.link(o);o.data.materials.append(m);o['district']=True;o['game_collision']=solid
    return o
box('District foundation',0,24,-.9,100,102,.28,earth)
box('East west avenue',0,22,-.02,94,13,.20,asphalt)
box('North south avenue',0,43,-.02,18,49,.20,asphalt)
box('Station access road',28,38,-.02,13,48,.20,asphalt)
box('Rail yard hardstanding',-29,55,-.03,25,29,.20,concrete)
for x in range(-44,45,6):box('Lane marking',x,22,.19,2.7,.16,.025,paint)
for z in range(28,65,6):box('Lane marking',0,z,.19,.16,2.7,.025,paint)
for x in [-10.5,10.5]:box('Avenue curb',x,39,.12,.3,39,.20,concrete)
# Perimeter walls and visible silhouettes.
for x in [-48,48]:box('Boundary wall',x,24,.1,.65,100,3.5,concrete,True)
for z in [-26,74]:box('Boundary wall',0,z,.1,96,.65,3.5,concrete,True)
for x,z,w,d,h in [(-41,-12,10,15,13),(-25,-17,11,10,10),(28,-16,16,14,11),(43,5,8,15,14),(-43,40,7,10,16),(37,68,15,9,12)]:
    box('Abandoned skyline',x,z,.18,w,d,h,brick,True)
    for yy in range(2,int(h)-1,3):
        for xx in range(int(x-w/2+2),int(x+w/2),3):box('Empty skyline window',xx,z-d/2-.02,yy,1.1,.07,1.5,glass)
def building(name,x,z,w,d,h,wallmat):
    box(name+' floor',x,z,.12,w,d,.13,concrete)
    box(name+' west wall',x-w/2,z,.2,.35,d,h,wallmat,True)
    box(name+' east wall',x+w/2,z,.2,.35,d,h,wallmat,True)
    box(name+' rear wall',x,z+d/2,.2,w,.35,h,wallmat,True)
    gap=2.5;segment=(w-gap)/2
    box(name+' entry left',x-w/2+segment/2,z-d/2,.2,segment,.35,h,wallmat,True)
    box(name+' entry right',x+w/2-segment/2,z-d/2,.2,segment,.35,h,wallmat,True)
    box(name+' lintel',x,z-d/2,3.1,gap,.35,max(.2,h-2.9),wallmat)
    o=box(name+' roof',x,z,h+.2,w+.5,d+.5,.2,concrete,False,True)
    o['roof_zone']=json.dumps([x-w/2-.8,x+w/2+.8,z-d/2-.8,z+d/2+.8])
    for dx in [-w*.32,w*.32]:box(name+' shop window',x+dx,z-d/2-.2,1.25,2,.05,1.5,glass)
    return x,z
building('Clinic',-25,32,12,10,4.2,plaster)
building('Supply store',24,13,12,9,4.8,brick)
building('Depot',-26,53,14,12,4.7,brick)
building('Power hall',29,48,17,16,5.6,concrete)
# Broken industrial roof: remove the power hall roof and use open steel trusses.
o=bpy.data.objects.get('DZ | Power hall roof')
if o:bpy.data.objects.remove(o,do_unlink=True)
for z in [41,46,51,55]:box('Power hall roof truss',29,z,5.65,17.5,.18,.24,rust)
for x in [21,37]:box('Power hall support column',x,48,.2,.35,16,5.7,rust)
box('Central plaza',0,42,.12,21,20,.15,concrete)
cylinder('Dry fountain basin',0,42,.2,3.2,.8,concrete,True)
cylinder('Dry fountain pillar',0,42,1,1,1.5,concrete,True)
box('Fountain top',0,42,2.5,2.7,2.7,.22,concrete)
for x,z in [(-8,34),(8,34),(-8,49),(8,49)]:
    box('Square bench',x,z,.4,2.4,.65,.25,wood,True)
    for xx in [x-.8,x+.8]:box('Bench leg',xx,z,.18,.1,.6,.3,metal)
# Rail track, wagons, and cover objects with clearance on every side.
for x in [-36,-33]:box('Rail line',x,55,.19,.12,31,.12,rust)
for z in range(41,71,2):box('Rail sleeper',-34.5,z,.15,4,.24,.16,wood)
for z in [47,62]:
    box('Freight wagon',-34.5,z,1,3.5,7,3.2,rust,True)
    for zz in [z-2,z+2]:
        for x in [-36,-33]:cylinder('Train wheel',x,zz,.25,.42,.65,metal)
    for x in [-36.26,-32.74]:
        for zz in range(int(z-3),int(z+4)):box('Wagon ribs',x,zz,1,.06,.08,3.2,metal)
for x,z in [(-15,19),(16,31),(34,30),(-19,43),(14,57),(-8,61),(40,60)]:
    for i in range(3):box('Concrete road block',x+(i-1)*1.4,z,.18,1.1,.85,.95,concrete,True)
def car(x,z):
    box('Abandoned car body',x,z,.55,2.3,4.3,.85,rust,True)
    box('Car cabin',x,z,1.4,2,2,.65,metal)
    box('Car windshield',x,z-1.02,1.48,1.7,.05,.45,glass)
    for xx in [x-1.1,x+1.1]:
        for zz in [z-1.35,z+1.35]:box('Car wheel',xx,zz,.22,.3,.7,.7,metal)
car(-8,24);car(17,21)
for x,z in [(-17,29),(-17,49),(18,47),(36,38),(-31,21),(-39,34),(8,59)]:
    for i in range(2):
        box('Cargo crate',x+i*1.25,z,.2,1.1,1.1,1.2,wood,True)
        for yy in [.35,1.15]:box('Crate strap',x+i*1.25,z-.57,yy,1.1,.035,.08,metal)
for x,z in [(-11,18),(11,29),(-11,51),(12,63),(39,40),(-39,25)]:
    cylinder('Street lamp',x,z,.2,.08,6,metal)
    box('Lamp arm',x+.6,z,6,1.3,.12,.12,metal)
    box('Lamp light',x+1.1,z,5.9,.8,.5,.12,amber)
for x,z in [(-16,-9),(16,-9),(-43,18),(43,20),(-11,62),(43,65)]:
    cylinder('Dead tree trunk',x,z,.15,.18,4,wood,True)
    for i in range(5):
        a=i*1.5;box('Dead tree branch',x+math.cos(a)*.65,z+math.sin(a)*.65,3.6,.15,.15,2,wood)
    for i in range(3):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x+random.uniform(-.6,.6),-z+random.uniform(-.6,.6),4.6))
        o=bpy.context.object;o.name='DZ | Tree crown';o.scale=(1.4,1.2,1);o.data.materials.append(leaf)
        for c in list(o.users_collection):c.objects.unlink(o)
        worldcol.objects.link(o);o['district']=True
# Power switch, vending stations, workbench and barrier.
stations=[
 {'id':'rifle','x':4.8,'z':12,'label':'بندقية هجومية','cost':900},
 {'id':'shotgun','x':-24,'z':30,'label':'بندقية خرطوش','cost':1400},
 {'id':'ammo','x':-5,'z':16,'label':'تعبئة الذخيرة','cost':350},
 {'id':'power','x':29,'z':49,'label':'تشغيل الكهرباء','cost':0},
 {'id':'upgrade','x':-25,'z':53,'label':'ترقية السلاح','cost':2200},
 {'id':'armor','x':-27,'z':32,'label':'درع واقٍ','cost':800},
 {'id':'gate','x':21,'z':37,'label':'فتح بوابة المحطة','cost':750},
 {'id':'mystery','x':23,'z':12,'label':'صندوق الأسلحة','cost':700},
]
for s in stations:
    x,z=s['x'],s['z'];color=teal if s['id'] in ['power','upgrade'] else amber
    if s['id']=='gate':continue
    box('Station '+s['id'],x,z,.2,1.25,.6,1.55,metal,True)
    box('Station screen '+s['id'],x,z-.32,1.15,.9,.045,.45,color)
    box('Station stripe '+s['id'],x,z-.33,.5,.9,.04,.08,color)
gate=box('Power gate',28.5,37,.2,16,.45,2.2,rust,True);gate['dynamic_gate']=True
for x in range(21,37,2):box('Gate chevron',x,36.74,1.2,.7,.035,.15,paint)
# Articulated zombie template, parked outside the playable map in Blender.
skin=mat('Zombie | ashen skin',(.32,.38,.24))
cloth=mat('Zombie | ragged jacket',(.19,.23,.18))
trousers=mat('Zombie | torn trousers',(.09,.105,.09))
eyes=mat('Zombie | ember eyes',(1,.25,.02),0,.5,4)
zombie=[]
def zp(name,x,z,y,w,d,h,m):
    o=box('Zombie '+name,70+x,z,y,w,d,h,m,False,False,assetcol);o['template']='zombie';zombie.append(o);return o
zp('torso',0,0,.85,.58,.32,.68,cloth)
zp('neck',0,0,1.53,.18,.18,.13,skin)
zp('head',0,.015,1.64,.36,.34,.41,skin)
zp('jaw',0,-.16,1.61,.27,.15,.15,skin)
for x,side in [(-.12,'left'),(.12,'right')]:
    zp('eye '+side,x,-.17,1.88,.055,.04,.045,eyes)
for x,side in [(-.40,'left'),(.40,'right')]:
    zp('arm '+side,x,-.04,1.04,.18,.23,.61,cloth)
    zp('hand '+side,x,-.05,.84,.18,.23,.23,skin)
for x,side in [(-.17,'left'),(.17,'right')]:
    zp('leg '+side,x,0,.20,.23,.27,.68,trousers)
    zp('shoe '+side,x,-.08,.06,.25,.43,.18,metal)
# Weapon templates: original low-poly silhouettes, no branded assets.
gunsteel=mat('Weapon | graphite',(.055,.065,.065),.72,.32)
gunwood=mat('Weapon | grip',(.17,.105,.055),0,.65)
gunaccent=mat('Weapon | markings',(.45,.49,.39),.5,.4)
def gunpart(kind,name,x,z,y,w,d,h,m):
    o=box(kind+' '+name,80+x,z,y,w,d,h,m,False,False,assetcol);o['template']=kind;return o
for kind in ['pistol','rifle','shotgun']:
    if kind=='pistol':
        gunpart(kind,'slide',0,-.15,.12,.14,.44,.14,gunsteel)
        gunpart(kind,'grip',0,.01,-.12,.12,.16,.27,gunwood)
        gunpart(kind,'barrel',0,-.43,.15,.07,.18,.07,gunsteel)
        gunpart(kind,'front sight',0,-.34,.26,.025,.025,.04,gunaccent)
    elif kind=='rifle':
        gunpart(kind,'receiver',0,-.15,.08,.17,.56,.20,gunsteel)
        gunpart(kind,'handguard',0,-.62,.10,.13,.40,.14,gunwood)
        gunpart(kind,'barrel',0,-.99,.12,.065,.38,.065,gunsteel)
        gunpart(kind,'stock',0,.30,.06,.14,.36,.19,gunwood)
        gunpart(kind,'grip',0,.03,-.17,.11,.14,.25,gunwood)
        gunpart(kind,'magazine',0,-.28,-.20,.13,.18,.35,gunsteel)
        gunpart(kind,'sight',0,-.23,.28,.10,.13,.12,gunaccent)
    else:
        gunpart(kind,'receiver',0,-.15,.08,.17,.45,.19,gunsteel)
        gunpart(kind,'stock',0,.27,.02,.15,.38,.20,gunwood)
        gunpart(kind,'pump',0,-.56,.02,.19,.30,.16,gunwood)
        gunpart(kind,'barrel',0,-.92,.16,.09,.65,.09,gunsteel)
        gunpart(kind,'tube',0,-.80,.04,.07,.50,.07,gunsteel)
        gunpart(kind,'sight',0,-1.16,.22,.03,.04,.035,gunaccent)
# Export geometry, materials, collisions, roofs, and templates.
deps=bpy.context.evaluated_depsgraph_get();materials={};objects=[];templates={};colliders=[]
def xyz(v):return [round(v.x,4),round(v.z,4),round(-v.y,4)]
for o in scene.objects:
    if o.type!='MESH' or o.name=='Presentation ground' or o.get('player_part'):continue
    ev=o.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles()
    template=o.get('template');verts=[];norms=[];normal=o.matrix_world.to_3x3().inverted().transposed()
    offset=Vector((70 if template=='zombie' else 80,0,0)) if template else Vector((0,0,0))
    origin=o.matrix_world.translation-offset
    for tri in me.loop_triangles:
        for vi in tri.vertices:
            p=o.matrix_world@me.vertices[vi].co-offset
            if template:p-=origin
            verts.extend(xyz(p));norms.extend(xyz((normal@tri.normal).normalized()))
    m=o.data.materials[0] if len(o.data.materials) else None;mn=m.name if m else 'default'
    if mn not in materials:
        n=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None) if m and m.use_nodes else None
        materials[mn]={'color':list(n.inputs['Base Color'].default_value[:3]) if n else [.6,.6,.6],'roughness':float(n.inputs['Roughness'].default_value) if n else .8,'metalness':float(n.inputs['Metallic'].default_value) if n else 0,'glow':float(n.inputs['Emission Strength'].default_value) if n and 'Emission Strength' in n.inputs else 0}
    bounds=[o.matrix_world@Vector(c) for c in o.bound_box];lo=[min(p[i] for p in bounds) for i in range(3)];hi=[max(p[i] for p in bounds) for i in range(3)]
    row={'name':o.name,'positions':verts,'normals':norms,'material':mn}
    if template:
        row['origin']=xyz(origin);templates.setdefault(template,[]).append(row)
    else:
        roof=bool(o.get('game_roof')) or (not o.get('district') and lo[2]>3.34)
        row['roof']=roof
        if o.get('roof_zone'):row['roofZone']=json.loads(o['roof_zone'])
        elif roof and not o.get('district'):row['roofZone']=[-6.5,6.5,-2,8]
        row['gate']=bool(o.get('dynamic_gate')) or o.name.startswith('DZ | Gate chevron')
        objects.append(row)
        name=o.name
        solid=o.get('game_collision',False) or name.startswith(('West ground wall','East ground wall','Rear sandstone pier','Privacy wall','Rear privacy wall','Raised planter','Rear feature planter','Pergola column','Patio sofa base','Lounge chair base','Dining tabletop','Garden bench seat'))
        if solid and lo[2]<2.5 and hi[2]>.63:
            colliders.append({'name':name,'min':[round(lo[0],3),round(-hi[1],3)],'max':[round(hi[0],3),round(-lo[1],3)],'height':round(hi[2],3),'gate':bool(o.get('dynamic_gate'))})
    ev.to_mesh_clear()
out=r'C:\Users\xxtro\Documents\Codex\2026-10-16\new-chat\outputs'
asset=os.path.join(out,'house-game','dist','assets','district.json')
with open(asset,'w',encoding='utf-8') as f:json.dump({'materials':materials,'objects':objects,'templates':templates,'colliders':colliders,'stations':stations,'bounds':[-47.3,47.3,-25.3,73.3],'spawn':{'x':3,'z':11}},f,separators=(',',':'))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out,'ashfall-zombies.blend'))
print('Built ASHFALL:',len(objects),'world meshes,',len(colliders),'colliders;',len(zombie),'zombie parts; templates',list(templates))
print('Export size',os.path.getsize(asset))
