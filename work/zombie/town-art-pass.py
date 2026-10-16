import bpy, math, random, json, os
from mathutils import Vector
random.seed(901)
scene=bpy.context.scene
old=bpy.data.collections.get('06 | TOWN REMASTER')
if old:
    for o in list(old.objects):bpy.data.objects.remove(o,do_unlink=True)
    bpy.data.collections.remove(old)
col=bpy.data.collections.new('06 | TOWN REMASTER');scene.collection.children.link(col)
def mat(name,c,metal=0,rough=.85,glow=0):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
    n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');n.inputs['Base Color'].default_value=(*c,1);n.inputs['Metallic'].default_value=metal;n.inputs['Roughness'].default_value=rough
    if 'Emission Color' in n.inputs:n.inputs['Emission Color'].default_value=(*c,1);n.inputs['Emission Strength'].default_value=glow
    return m
brick=mat('Town | fired brick',(.34,.18,.12));plaster=mat('Town | soot plaster',(.42,.39,.32));stone=mat('Town | limestone',(.42,.43,.40));dark=mat('Town | blackened steel',(.055,.065,.07),.65,.48);rust=mat('Town | rust steel',(.29,.16,.075),.45);timber=mat('Town | splintered timber',(.23,.14,.075));void=mat('Town | window void',(.014,.022,.028));glass=mat('Town | surviving glass',(.11,.19,.21),.6,.24);blue=mat('Town | enamel teal',(.08,.23,.24),.35);cream=mat('Town | faded bus paint',(.52,.46,.29),.3);char=mat('Town | scorched asphalt',(.035,.032,.028));ember=mat('Town | molten ember',(1,.18,.018),0,.5,4);gold=mat('Town | amber neon',(1,.48,.16),0,.4,3);cyan=mat('Town | clinic neon',(.10,.64,.66),0,.4,2.5);bone=mat('Town | sign lettering',(.72,.69,.53),.1)
def link(o):
    for c in list(o.users_collection):c.objects.unlink(o)
    col.objects.link(o);o['district']=True;return o
def box(name,x,z,y,w,d,h,m,solid=False,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y+h/2));o=link(bpy.context.object);o.name='ART | '+name;o.dimensions=(w,d,h);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m);o['game_collision']=solid
    if bevel:b=o.modifiers.new('Worn edges','BEVEL');b.width=bevel;b.segments=2
    return o
def cylinder(name,x,z,y,r,h,m,solid=False,vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=h,location=(x,-z,y+h/2));o=link(bpy.context.object);o.name='ART | '+name;o.data.materials.append(m);o['game_collision']=solid;return o
def beam(name,a,b,r,m):
    # Game coordinates x, vertical y, z.
    aa=Vector((a[0],-a[2],a[1]));bb=Vector((b[0],-b[2],b[1]));mid=(aa+bb)*.5
    bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=r,depth=(bb-aa).length,location=mid);o=link(bpy.context.object);o.name='ART | '+name;o.rotation_euler=(bb-aa).to_track_quat('Z','Y').to_euler();o.data.materials.append(m);return o
def text(name,body,x,z,y,size,m,back=False):
    bpy.ops.object.text_add(location=(x,-z,y));o=link(bpy.context.object);o.name='ART | '+name;o.data.body=body;o.data.size=size;o.data.extrude=.006
    for prop,value in [('align_x','CENTER'),('align_y','CENTER')]:
        if value in [i.identifier for i in o.data.bl_rna.properties[prop].enum_items]:setattr(o.data,prop,value)
    o.rotation_euler=(math.pi/2,0,0 if back else math.pi);o.data.materials.append(m)
    bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');o['district']=True;return o
def mark_roof(o,x,z,w,d):o['game_roof']=True;o['roof_zone']=json.dumps([x-w/2-.5,x+w/2+.5,z-d/2-.5,z+d/2+.5])
def window(name,x,z,y,w=1.5,h=1.7,back=False,boarded=False):
    direction=1 if back else -1
    box(name+' recess',x,z-direction*.10,y,w,.16,h,void)
    for xx in [x-w/2,x+w/2]:box(name+' jamb',xx,z,y-.08,.12,.20,h+.16,stone)
    box(name+' lintel',x,z,y+h,w+.30,.26,.18,stone,bevel=.025)
    box(name+' sill',x,z+direction*.08,y-.12,w+.35,.36,.16,stone,bevel=.02)
    box(name+' mullion',x,z+direction*.10,y,.045,.055,h,dark)
    box(name+' transom',x,z+direction*.10,y+h*.58,w,.055,.045,dark)
    if boarded:
        for i in range(3):
            o=box(name+' board',x,z+direction*.19,y+.2+i*.43,w+.13,.07,.20,timber);o.rotation_euler.y=random.uniform(-.10,.1)
    else:
        box(name+' surviving pane',x-w*.26,z+direction*.03,y+.05,w*.45,.028,h*.50,glass)
        beam(name+' broken frame',(x-w*.45,y+.15,z+direction*.15),(x+w*.33,y+h*.70,z+direction*.15),.025,dark)
buildings=[('Clinic',-25,32,12,10,4.4,2,'MERCY CLINIC',cyan),('Supply store',24,13,12,9,5.0,2,'ASHFALL SUPPLY',gold),('Depot',-26,53,14,12,4.9,1,'NORTH FREIGHT',gold),('Power hall',29,48,17,16,5.8,1,'STATION 09',cyan)]
for name,x,z,w,d,h,stories,title,neon in buildings:
    # Keep the tested building footprint and entrances. Add readable vertical architecture.
    for o in list(bpy.data.objects):
        if o.name.startswith('DZ | '+name+' shop window'):bpy.data.objects.remove(o,do_unlink=True)
    front=z-d/2-.24;back=z+d/2+.24
    for yy in [.35,h-.25,h]:
        for zz in [front,back]:box(name+' stone course',x,zz,yy,w+.5,.28,.22,stone,bevel=.025)
    for xx in [x-w/2+.18,x+w/2-.18]:
        for zz in [front,back]:box(name+' corner pilaster',xx,zz,.2,.38,.35,h+.4,stone)
    for xx in [x-w*.32,x+w*.32]:window(name+' ground window',xx,front,1.15,1.9,1.7,boarded=(name=='Depot'))
    box(name+' door frame',x,front-.05,.22,2.75,.20,.15,stone)
    for xx in [x-1.38,x+1.38]:box(name+' doorway column',xx,front,.25,.16,.22,2.9,stone)
    box(name+' entrance canopy',x,front-.7,3.15,4.1,1.5,.18,dark,bevel=.03)
    for xx in [x-1.8,x+1.8]:beam(name+' canopy brace',(xx,2.65,front),(xx,3.18,front-1.25),.045,rust)
    box(name+' sign backing',x,front-.37,3.45,w*.82,.20,.75,dark,bevel=.035)
    text(name+' sign',title,x,front-.49,3.83,.46 if len(title)>12 else .54,neon)
    for story in range(stories):
        base=h+.2+story*3.05
        count=4 if w>13 else 3;step=w/count
        # Horizontal courses, piers and recessed openings, instead of a plain box wall.
        for zz,isback in [(front,False),(back,True)]:
            box(name+' upper sill band',x,zz,base,w,.26,.78,brick)
            box(name+' upper header band',x,zz,base+2.55,w,.26,.50,brick)
            for k in range(count+1):box(name+' upper brick pier',x-w/2+k*step,zz,base+.78,.60,.30,1.8,brick)
            for k in range(count):
                xx=x-w/2+(k+.5)*step
                window(name+' upper window',xx,zz+(.04 if isback else -.04),base+.8,step-.72,1.7,isback,boarded=(story+k)%4==0)
        for xx in [x-w/2,x+w/2]:box(name+' side upper wall',xx,z,base,.30,d,3.05,brick)
        box(name+' exposed upper floor',x,z,base-.12,w,d,.12,timber)
        for zz in [front-.1,back+.1]:box(name+' projecting cornice',x,zz,base+2.97,w+.8,.50,.22,stone,bevel=.03)
    top=h+.2+stories*3.05
    for xx in [x-w/2,x+w/2]:box(name+' roof parapet',xx,z,top,.35,d,.62,brick)
    for zz in [front,back]:
        for xx,ww in [(x-w*.3,w*.4),(x+w*.32,w*.34)]:box(name+' broken parapet',xx,zz,top,ww,.32,random.uniform(.45,.9),brick)
    for i in range(5):box(name+' roof joist',x-w/2+.7+i*(w-1.4)/4,z,top-.10,.15,d+.4,.20,timber)
    cylinder(name+' chimney',x+w*.28,z+d*.25,top,.44,2.2,brick,vertices=8)
    cylinder(name+' chimney cap',x+w*.28,z+d*.25,top+2.15,.60,.15,dark)
    # Balcony and fire-escape details stay above player head height.
    box(name+' balcony slab',x,front-.65,h+.1,w*.66,1.3,.18,stone)
    for xx in [x-w*.33+i*(w*.66)/8 for i in range(9)]:box(name+' balcony spindle',xx,front-1.24,h+.28,.045,.045,.95,rust)
    for yy in [h+.3,h+1.2]:box(name+' balcony handrail',x,front-1.24,yy,w*.68,.07,.06,rust)
    for xx in [x-w/2-.23,x+w/2+.23]:
        beam(name+' drain pipe',(xx,.3,z-d*.3),(xx,top,z-d*.3),.065,rust)
    box(name+' meter box',x-w/2-.25,z+d*.18,1,.20,.9,.8,dark)
    # Broken plaster patches create a strong material contrast at street level.
    for i in range(7):
        xx=x-w/2+.7+random.random()*(w-1.4)
        if abs(xx-x)<1.7:continue
        box(name+' scarred plaster',xx,front-.03,.40+random.random()*.7,random.uniform(.3,1.0),.035,random.uniform(.2,.7),plaster)
# Turn the flat skyline blocks into old apartment silhouettes.
for o in [o for o in bpy.data.objects if o.name.startswith('DZ | Abandoned skyline')]:
    x=o.location.x;z=-o.location.y;w=o.dimensions.x;d=o.dimensions.y;h=o.dimensions.z
    for yy in [1,h*.5,h-.25]:box('Skyline masonry course',x,z-d/2-.06,yy,w+.4,.20,.18,stone)
    for xx in [x-w/2+.2,x+w/2-.2]:box('Skyline corner',xx,z-d/2-.1,.2,.35,.3,h,plaster)
    for yy in range(2,int(h)-1,3):
        for xx in range(int(x-w/2+2),int(x+w/2),3):window('Skyline window',xx,z-d/2-.12,yy,.95,1.45,boarded=(xx+yy)%3==0)
# Transit bus replaces the left-hand placeholder car.
for o in list(bpy.data.objects):
    if o.name.startswith(('DZ | Abandoned car','DZ | Car ')) and abs(o.location.x+8)<4 and abs(-o.location.y-24)<3:bpy.data.objects.remove(o,do_unlink=True)
box('Bus undercarriage',-8,24,.46,8.2,2.6,.56,dark,True,bevel=.12)
box('Bus lower body',-8,24,1.02,8.2,2.65,.70,cream,False,bevel=.08)
box('Bus roof',-8,24,3.13,8.15,2.65,.22,cream,bevel=.1)
for zz in [22.66,25.34]:
    box('Bus waist stripe',-8,zz,1.35,8.1,.04,.18,rust)
    for i in range(7):
        xx=-11.1+i*1.04
        box('Bus window dark recess',xx,zz,1.82,.88,.045,1.14,void)
        box('Bus window post',xx+.49,zz,1.72,.08,.09,1.42,cream)
        if i%3==0:beam('Bus shattered diagonal',(xx-.36,1.88,zz),(xx+.31,2.72,zz),.018,dark)
    box('Bus rain gutter',-8,zz,3.06,8.2,.1,.08,dark)
for xx in [-12.12,-3.88]:box('Bus end',xx,24,1.7,.12,2.6,1.45,cream)
for xx in [-10.8,-5.1]:
    for zz in [22.62,25.38]:
        o=cylinder('Bus tire',xx,zz,.25,.56,.33,dark);o.rotation_euler.x=math.pi/2
        o=cylinder('Bus wheel hub',xx,zz-.03,.25,.28,.36,rust);o.rotation_euler.x=math.pi/2
box('Bus destination sign',-8,22.60,2.86,3.2,.05,.25,dark)
text('Bus destination','LAST STOP',-8,22.54,2.99,.23,gold)
# Landmark: a ruined clock tower on the existing fountain footprint.
for o in list(bpy.data.objects):
    if o.name.startswith(('DZ | Dry fountain','DZ | Fountain top')):bpy.data.objects.remove(o,do_unlink=True)
cylinder('Clock tower foundation',0,42,.18,3.15,.6,stone,True,vertices=8)
cylinder('Clock tower plinth',0,42,.78,2.15,.55,stone,True,vertices=8)
box('Clock tower shaft',0,42,1.33,2.5,2.5,7.5,brick,True,bevel=.06)
for yy in [1.5,6.5,8.7]:box('Clock tower cornice',0,42,yy,3,3,.22,stone,bevel=.04)
for xx in [-1.2,1.2]:
    for zz in [40.8,43.2]:box('Clock tower pilaster',xx,zz,1.5,.22,.22,7.4,stone)
for back,zz in [(False,40.69),(True,43.31)]:
    o=cylinder('Clock dial',0,zz,6.60,1.03,.07,void,vertices=48);o.location.z=7.5;o.rotation_euler.x=math.pi/2
    text('Clock numerals top','XII',0,zz+(.06 if back else -.06),8.17,.25,bone,back)
    text('Clock numerals bottom','VI',0,zz+(.06 if back else -.06),6.85,.25,bone,back)
    beam('Clock hour hand',(0,7.5,zz),(-.45,7.85,zz),.035,bone)
    beam('Clock minute hand',(0,7.5,zz),(.56,7.91,zz),.025,gold)
for xx in [-1.1,1.1]:beam('Clock tower broken roof',(xx,8.9,41),(0,10.7,42),.12,timber)
box('Clock tower broken cap',-.50,42,9.0,1.2,2.6,.18,dark)
text('Clock memorial plaque','REMEMBER',0,40.72,3.1,.24,bone)
# Make the former modern house read as a fortified survivor outpost.
box('Safehouse sign backing',-.1,7.72,2.9,4.2,.12,.5,dark)
text('Safehouse sign','SAFE HOUSE',-.1,7.80,3.15,.35,cyan,True)
for xx in [-3.6,-.6]:
    for k in range(3):box('Safehouse boarded window',xx,7.82,1.28+k*.4,2.45,.09,.18,timber)
for x,z in [(-6.2,9.5),(-4.9,9.5),(6.6,10.6),(7.8,10.6)]:
    for k in range(3):box('Sandbag barricade',x+(k%2)*.16,z,.2+k*.24,1.2,.65,.25,plaster,True,bevel=.10)
# Cracked surfaces and ember seams: visual accents, no added player damage.
def ribbon(name,path,width,y,m):
    vs=[]
    for i,p in enumerate(path):
        prev=Vector(path[max(0,i-1)]);nxt=Vector(path[min(len(path)-1,i+1)]);v=(nxt-prev).normalized();n=Vector((-v.y,v.x))*width*.5
        vs.extend([(p[0]+n.x,-p[1]-n.y,y),(p[0]-n.x,-p[1]+n.y,y)])
    faces=[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(path)-1)];me=bpy.data.meshes.new(name);me.from_pydata(vs,[],faces);me.update();o=bpy.data.objects.new('ART | '+name,me);col.objects.link(o);o.data.materials.append(m);o['district']=True
paths=[[(-26,21),(-18,22),(-12,20.8),(-6,21.4),(2,20.2),(8,22.6),(13,21.9)],[(6,32),(8,35),(7.2,38),(10,41),(8.8,44)],[(23,34),(25,33),(28,35),(32,33.4)]]
for path in paths:
    ribbon('Scorched road fracture',path,.55,.207,char);ribbon('Ember road seam',path,.075,.213,ember)
    for x,z in path[1::2]:ribbon('Fracture branch',[(x,z),(x+.8,z-1.2),(x+1.5,z-1.5)],.028,.215,ember)
for i in range(170):
    x=random.uniform(-41,41);z=random.uniform(17,67)
    # Leave the immediate spawn, entrances, station fronts and main maneuvering route clear.
    if abs(x-3)<3 or any(abs(x-a)<2.7 and abs(z-b)<2.5 for a,b in [(-25,27),(24,8.5),(-26,47),(29,40),(21,35.5)]):continue
    o=box('Street rubble',x,z,.20,random.uniform(.10,.4),random.uniform(.1,.38),random.uniform(.04,.22),brick if i%3 else stone);o.rotation_euler.z=random.uniform(0,6)
# Sidewalk hardware and environmental storytelling, kept at the edges of routes.
for x,z in [(-17,28),(16,14),(-18,48),(39,42)]:
    cylinder('Steel barrel',x,z,.2,.43,1.05,rust,True)
    for yy in [.35,.95]:cylinder('Barrel steel band',x,z,yy,.45,.055,dark)
    box('Fallen warning panel',x+1.1,z,.25,.7,.08,.65,cream)
for x,z in [(-29,25),(-20,43),(18,8),(39,52)]:
    cylinder('Hydrant',x,z,.2,.16,.72,rust)
    box('Hydrant crossbar',x,z,.58,.60,.14,.15,rust)
for x,z in [(-14,30),(17,29),(-17,50)]:
    box('Bollard',x,z,.2,.15,.15,.85,dark)
    box('Bollard reflector',x,z,.75,.16,.16,.10,gold)
# Cables make the skyline feel inhabited, and guide the eye between landmarks.
for path in [[(-11,6.1,18),(0,5.0,22),(11,6.1,29)],[(11,6.1,29),(21,5.0,35),(39,6.1,40)],[(-39,6.1,25),(-24,5.1,28),(-11,6.1,18)]]:
    for a,b in zip(path,path[1:]):beam('Sagging power cable',a,b,.025,dark)
# Save all the original progression metadata; the art pass does not reset game balance.
out=r'C:\Users\xxtro\Documents\Codex\2026-10-16\new-chat\outputs'
asset_path=os.path.join(out,'house-game','dist','assets','district.json')
with open(asset_path,encoding='utf-8') as f:old_asset=json.load(f)
stations=old_asset['stations']
meta={'artVersion':2,'landmarks':['clock tower','transit bus','clinic balconies','power station'],'lights':[{'x':x,'y':y,'z':z,'color':color,'intensity':power} for x,y,z,color,power in [(-9,5.85,18,'#ffb15c',85),(12,5.85,29,'#ffb15c',95),(-10,5.85,51,'#ffb15c',85),(13,5.85,63,'#ffb15c',85),(40,5.85,40,'#ffb15c',95),(-38,5.85,25,'#ffb15c',85),(-25,3.7,26.5,'#6bbfc4',45),(24,4.0,8,'#ffa24c',45),(-26,3.7,46.5,'#ffb45f',45),(29,4.1,39.5,'#66d6b7',50),(0,7.2,40.4,'#ffb45f',30),(-6,1,21,'#ff511a',65),(8,1,35,'#ff511a',60),(28,1,34,'#ff511a',65),(0,3.1,8.0,'#57b9bb',30)]],'smoke':[[-6,21],[8,35],[28,34],[-12,24]],'signs':4}
deps=bpy.context.evaluated_depsgraph_get();materials={};objects=[];templates={};colliders=[]
def xyz(v):return [round(v.x,4),round(v.z,4),round(-v.y,4)]
for o in scene.objects:
    if o.type!='MESH' or o.name=='Presentation ground' or o.get('player_part'):continue
    ev=o.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles();template=o.get('template');verts=[];norms=[];normal=o.matrix_world.to_3x3().inverted().transposed();offset=Vector((70 if template=='zombie' else 80,0,0)) if template else Vector((0,0,0));origin=o.matrix_world.translation-offset
    for tri in me.loop_triangles:
        for vi in tri.vertices:
            p=o.matrix_world@me.vertices[vi].co-offset
            if template:p-=origin
            verts.extend(xyz(p));norms.extend(xyz((normal@tri.normal).normalized()))
    m=o.data.materials[0] if len(o.data.materials) else None;mn=m.name if m else 'default'
    if mn not in materials:
        n=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None) if m and m.use_nodes else None
        materials[mn]={'color':list(n.inputs['Base Color'].default_value[:3]) if n else [.6,.6,.6],'roughness':float(n.inputs['Roughness'].default_value) if n else .8,'metalness':float(n.inputs['Metallic'].default_value) if n else 0,'glow':float(n.inputs['Emission Strength'].default_value) if n and 'Emission Strength' in n.inputs else 0}
    row={'name':o.name,'positions':verts,'normals':norms,'material':mn}
    bounds=[o.matrix_world@Vector(c) for c in o.bound_box];lo=[min(p[i] for p in bounds) for i in range(3)];hi=[max(p[i] for p in bounds) for i in range(3)]
    if template:row['origin']=xyz(origin);templates.setdefault(template,[]).append(row)
    else:
        row['roof']=bool(o.get('game_roof')) or (not o.get('district') and lo[2]>3.34)
        if o.get('roof_zone'):row['roofZone']=json.loads(o['roof_zone'])
        elif row['roof'] and not o.get('district'):row['roofZone']=[-6.5,6.5,-2,8]
        row['gate']=bool(o.get('dynamic_gate')) or o.name.startswith('DZ | Gate chevron');objects.append(row)
        solid=o.get('game_collision',False) or o.name.startswith(('West ground wall','East ground wall','Rear sandstone pier','Privacy wall','Rear privacy wall','Raised planter','Rear feature planter','Pergola column','Patio sofa base','Lounge chair base','Dining tabletop','Garden bench seat'))
        if solid and lo[2]<2.5 and hi[2]>.63:colliders.append({'name':o.name,'min':[round(lo[0],3),round(-hi[1],3)],'max':[round(hi[0],3),round(-lo[1],3)],'height':round(hi[2],3),'gate':bool(o.get('dynamic_gate'))})
    ev.to_mesh_clear()
payload={'materials':materials,'objects':objects,'templates':templates,'colliders':colliders,'stations':stations,'bounds':old_asset['bounds'],'spawn':old_asset['spawn'],'environment':meta}
temp=asset_path+'.tmp'
with open(temp,'w',encoding='utf-8') as f:json.dump(payload,f,separators=(',',':'))
os.replace(temp,asset_path)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out,'ashfall-town-remastered.blend'))
print('Town remaster:',len(objects),'meshes;',len(colliders),'colliders;',len(meta['lights']),'lighting anchors; material families',len(materials))
