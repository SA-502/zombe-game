import bpy
import bmesh
import math
import os
import json
from mathutils import Vector, Euler, Matrix

print(">>> Starting ASHFALL Visual Remaster Batch 2 Generation (High-Fidelity Pass)...")

DELIVERY_DIR = r"C:\Users\xxtro\Documents\Codex\2026-10-16\new-chat\outputs\blender-delivery"
os.makedirs(DELIVERY_DIR, exist_ok=True)

COLLECTION_NAME = "08 | ASHFALL REMASTER BATCH 2"
col_batch2 = bpy.data.collections.get(COLLECTION_NAME)
if not col_batch2:
    col_batch2 = bpy.data.collections.new(COLLECTION_NAME)
    bpy.context.scene.collection.children.link(col_batch2)
else:
    for obj in list(col_batch2.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

def to_engine_coords(v):
    # Blender Z-up (x, y, z) -> Three.js Y-up (x, z, -y)
    return [round(v[0], 5), round(v[2], 5), round(-v[1], 5)]

def look_at(obj, target):
    direction = target - obj.location
    rot_quat = direction.to_track_quat('-Z', 'Y')
    obj.rotation_euler = rot_quat.to_euler()

# ==============================================================================
# 1. PBR MATERIALS SETUP
# ==============================================================================
def get_or_create_material(name, base_color, metallic=0.0, roughness=0.5, emission=(0,0,0,1), emission_strength=0.0):
    mat = bpy.data.materials.get(name)
    if not mat:
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if not bsdf:
        bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    
    bsdf.inputs["Base Color"].default_value = base_color
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    elif "Emission" in bsdf.inputs:
        bsdf.inputs["Emission"].default_value = emission
    return mat

mat_gun_steel = get_or_create_material("Ashfall | Parkerized Gun Steel", (0.07, 0.07, 0.08, 1.0), metallic=0.88, roughness=0.28)
mat_gun_polymer = get_or_create_material("Ashfall | Gun Polymer Grip", (0.04, 0.04, 0.045, 1.0), metallic=0.05, roughness=0.65)
mat_walnut_wood = get_or_create_material("Ashfall | Treated Walnut Wood", (0.24, 0.11, 0.04, 1.0), metallic=0.0, roughness=0.35)
mat_tactical_glove = get_or_create_material("Ashfall | Tactical Glove", (0.06, 0.07, 0.05, 1.0), metallic=0.1, roughness=0.7)
mat_tactical_sleeve = get_or_create_material("Ashfall | Tactical Sleeve", (0.12, 0.14, 0.10, 1.0), metallic=0.0, roughness=0.85)

mat_pap_cyan = get_or_create_material("Ashfall | Pack-A-Punch Plasma Cyan", (0.05, 0.45, 0.65, 1.0), metallic=0.92, roughness=0.15, emission=(0.1, 0.85, 1.0, 1.0), emission_strength=5.0)
mat_pap_amber = get_or_create_material("Ashfall | Pack-A-Punch Thermal Amber", (0.65, 0.25, 0.02, 1.0), metallic=0.92, roughness=0.15, emission=(1.0, 0.45, 0.05, 1.0), emission_strength=5.0)

mat_stone_wall = get_or_create_material("Ashfall | Weathered Sandstone", (0.42, 0.36, 0.28, 1.0), metallic=0.02, roughness=0.9)
mat_chalk_trace = get_or_create_material("Ashfall | Luminous Chalk Trace", (0.98, 0.96, 0.90, 1.0), metallic=0.0, roughness=0.95, emission=(1.0, 0.98, 0.88, 1.0), emission_strength=2.2)
mat_price_slate = get_or_create_material("Ashfall | Price Tag Slate", (0.03, 0.03, 0.035, 1.0), metallic=0.7, roughness=0.4, emission=(1.0, 0.7, 0.1, 1.0), emission_strength=1.5)
mat_barricade_wood = get_or_create_material("Ashfall | Weathered Wood Plank", (0.22, 0.16, 0.11, 1.0), metallic=0.0, roughness=0.88)
mat_rusty_iron = get_or_create_material("Ashfall | Rusty Iron Nails", (0.18, 0.12, 0.09, 1.0), metallic=0.75, roughness=0.7)

def create_box(name, center, size, mat=None, collection=col_batch2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = v.co.x * size[0] + center[0]
        v.co.y = v.co.y * size[1] + center[1]
        v.co.z = v.co.z * size[2] + center[2]
    
    mesh = bpy.data.meshes.new(name + "_mesh")
    bm.to_mesh(mesh)
    bm.free()
    
    obj = bpy.data.objects.new(name, mesh)
    if mat:
        obj.data.materials.append(mat)
    collection.objects.link(obj)
    return obj

def create_cylinder(name, center, radius, depth, axis='Y', segments=14, mat=None, collection=col_batch2):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius, radius2=radius, depth=depth)
    
    if axis == 'Y':
        rot = Matrix.Rotation(math.radians(90), 4, 'X')
        bm.transform(rot)
    elif axis == 'X':
        rot = Matrix.Rotation(math.radians(90), 4, 'Y')
        bm.transform(rot)
    
    trans = Matrix.Translation(Vector(center))
    bm.transform(trans)
    
    mesh = bpy.data.meshes.new(name + "_mesh")
    bm.to_mesh(mesh)
    bm.free()
    
    obj = bpy.data.objects.new(name, mesh)
    if mat:
        obj.data.materials.append(mat)
    collection.objects.link(obj)
    return obj

def extract_mesh_data(obj):
    mesh = obj.to_mesh()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    
    positions = []
    normals = []
    
    world_matrix = obj.matrix_world
    for face in bm.faces:
        for loop in face.loops:
            v_world = world_matrix @ loop.vert.co
            eng_p = to_engine_coords(v_world)
            positions.extend(eng_p)
            
            n_world = (world_matrix.to_3x3() @ loop.vert.normal).normalized()
            eng_n = [round(n_world.x, 4), round(n_world.z, 4), round(-n_world.y, 4)]
            normals.extend(eng_n)
            
    bm.free()
    obj.to_mesh_clear()
    
    mat_name = obj.data.materials[0].name if len(obj.data.materials) > 0 else "Ashfall | Default"
    return {
        "name": obj.name,
        "material": mat_name,
        "positions": positions,
        "normals": normals
    }

# ==============================================================================
# 2. BUILD WEAPONS (1911, Nimer-47, Raad-12, Upgraded Variants)
# ==============================================================================
print(">>> Building Weapons Rack...")
ARMORY_POS = Vector((85.0, 0.0, 0.0))

# Armory Table Rack
create_box("WPN_Armory_Backing", ARMORY_POS + Vector((0.0, 0.0, -0.15)), (0.8, 4.6, 0.08), mat_gun_polymer)
create_box("WPN_Armory_Frame_Top", ARMORY_POS + Vector((0.0, 0.0, 0.65)), (0.8, 4.6, 0.06), mat_gun_steel)

# 1. 1911 Pistol (Positioned at Y = -1.6)
P1911_POS = ARMORY_POS + Vector((0.0, -1.6, 0.12))
p1911_objects = []
p1911_objects.append(create_box("WPN_P1911_Frame", P1911_POS + Vector((0.0, 0.0, 0.0)), (0.034, 0.18, 0.075), mat_gun_steel))
p1911_objects.append(create_box("WPN_P1911_Slide", P1911_POS + Vector((0.0, 0.015, 0.045)), (0.034, 0.20, 0.04), mat_gun_steel))
p1911_objects.append(create_cylinder("WPN_P1911_Barrel", P1911_POS + Vector((0.0, 0.11, 0.045)), radius=0.01, depth=0.06, axis='Y', segments=12, mat=mat_gun_steel))
p1911_objects.append(create_box("WPN_P1911_Grip", P1911_POS + Vector((0.0, -0.06, -0.065)), (0.032, 0.05, 0.12), mat_gun_polymer))
p1911_objects.append(create_box("WPN_P1911_TriggerGuard", P1911_POS + Vector((0.0, -0.01, -0.025)), (0.02, 0.05, 0.025), mat_gun_steel))

# 2. Raad-12 Tactical Pump Shotgun (Positioned at Y = -0.8)
RAAD_POS = ARMORY_POS + Vector((0.0, -0.8, 0.12))
raad_objects = []
raad_objects.append(create_box("WPN_Raad12_Receiver", RAAD_POS + Vector((0.0, 0.0, 0.04)), (0.048, 0.26, 0.085), mat_gun_steel))
raad_objects.append(create_cylinder("WPN_Raad12_Barrel", RAAD_POS + Vector((0.0, 0.35, 0.058)), radius=0.015, depth=0.48, axis='Y', segments=14, mat=mat_gun_steel))
raad_objects.append(create_cylinder("WPN_Raad12_MagTube", RAAD_POS + Vector((0.0, 0.32, 0.025)), radius=0.014, depth=0.44, axis='Y', segments=12, mat=mat_gun_steel))
raad_objects.append(create_box("WPN_Raad12_HeatShield", RAAD_POS + Vector((0.0, 0.28, 0.075)), (0.042, 0.28, 0.022), mat_gun_steel))
raad_objects.append(create_box("WPN_Raad12_PumpSlide", RAAD_POS + Vector((0.0, 0.25, 0.02)), (0.052, 0.19, 0.065), mat_gun_polymer))
raad_objects.append(create_box("WPN_Raad12_StockComb", RAAD_POS + Vector((0.0, -0.26, 0.015)), (0.042, 0.28, 0.09), mat_gun_polymer))
raad_objects.append(create_box("WPN_Raad12_Buttpad", RAAD_POS + Vector((0.0, -0.405, 0.015)), (0.046, 0.02, 0.11), mat_gun_polymer))
raad_objects.append(create_box("WPN_Raad12_Grip", RAAD_POS + Vector((0.0, -0.09, -0.06)), (0.036, 0.065, 0.11), mat_gun_polymer))
raad_objects.append(create_box("WPN_Raad12_TriggerGuard", RAAD_POS + Vector((0.0, -0.02, -0.03)), (0.022, 0.06, 0.028), mat_gun_steel))
raad_objects.append(create_box("WPN_Raad12_GhostRing", RAAD_POS + Vector((0.0, -0.08, 0.095)), (0.024, 0.025, 0.025), mat_gun_steel))
raad_objects.append(create_cylinder("WPN_Raad12_FrontBead", RAAD_POS + Vector((0.0, 0.58, 0.076)), radius=0.005, depth=0.012, axis='Z', segments=8, mat=mat_pap_amber))

# 3. Nimer-47 Assault Rifle (Positioned at Y = 0.0)
NIMER_POS = ARMORY_POS + Vector((0.0, 0.0, 0.12))
nimer_objects = []
nimer_objects.append(create_box("WPN_Nimer47_Receiver", NIMER_POS + Vector((0.0, 0.0, 0.03)), (0.046, 0.28, 0.08), mat_gun_steel))
nimer_objects.append(create_box("WPN_Nimer47_DustCover", NIMER_POS + Vector((0.0, -0.02, 0.075)), (0.042, 0.24, 0.028), mat_gun_steel))
nimer_objects.append(create_cylinder("WPN_Nimer47_Barrel", NIMER_POS + Vector((0.0, 0.32, 0.035)), radius=0.012, depth=0.38, axis='Y', segments=12, mat=mat_gun_steel))
nimer_objects.append(create_cylinder("WPN_Nimer47_GasTube", NIMER_POS + Vector((0.0, 0.24, 0.062)), radius=0.011, depth=0.22, axis='Y', segments=12, mat=mat_gun_steel))
nimer_objects.append(create_cylinder("WPN_Nimer47_MuzzleBrake", NIMER_POS + Vector((0.0, 0.52, 0.035)), radius=0.014, depth=0.04, axis='Y', segments=10, mat=mat_gun_steel))
nimer_objects.append(create_box("WPN_Nimer47_HandguardLower", NIMER_POS + Vector((0.0, 0.22, 0.02)), (0.048, 0.18, 0.055), mat_walnut_wood))
nimer_objects.append(create_box("WPN_Nimer47_HandguardUpper", NIMER_POS + Vector((0.0, 0.22, 0.068)), (0.044, 0.16, 0.035), mat_walnut_wood))
nimer_objects.append(create_box("WPN_Nimer47_Buttstock", NIMER_POS + Vector((0.0, -0.28, 0.0)), (0.042, 0.30, 0.095), mat_walnut_wood))
nimer_objects.append(create_box("WPN_Nimer47_Buttplate", NIMER_POS + Vector((0.0, -0.435, 0.0)), (0.044, 0.012, 0.105), mat_gun_steel))
nimer_objects.append(create_box("WPN_Nimer47_PistolGrip", NIMER_POS + Vector((0.0, -0.10, -0.075)), (0.034, 0.065, 0.12), mat_walnut_wood))
nimer_objects.append(create_box("WPN_Nimer47_TriggerGuard", NIMER_POS + Vector((0.0, -0.03, -0.045)), (0.024, 0.07, 0.03), mat_gun_steel))
nimer_objects.append(create_box("WPN_Nimer47_Trigger", NIMER_POS + Vector((0.0, -0.03, -0.035)), (0.008, 0.02, 0.025), mat_gun_steel))
nimer_objects.append(create_box("WPN_Nimer47_MagTop", NIMER_POS + Vector((0.0, 0.08, -0.06)), (0.028, 0.07, 0.07), mat_gun_steel))
nimer_objects.append(create_box("WPN_Nimer47_MagMid", NIMER_POS + Vector((0.0, 0.095, -0.125)), (0.028, 0.07, 0.07), mat_gun_steel))
nimer_objects.append(create_box("WPN_Nimer47_MagBot", NIMER_POS + Vector((0.0, 0.12, -0.19)), (0.028, 0.07, 0.07), mat_gun_steel))
nimer_objects.append(create_box("WPN_Nimer47_SightRear", NIMER_POS + Vector((0.0, 0.10, 0.088)), (0.025, 0.06, 0.02), mat_gun_steel))
nimer_objects.append(create_box("WPN_Nimer47_SightFront", NIMER_POS + Vector((0.0, 0.46, 0.08)), (0.018, 0.025, 0.07), mat_gun_steel))
nimer_objects.append(create_cylinder("WPN_Nimer47_ChargingHandle", NIMER_POS + Vector((0.032, 0.03, 0.05)), radius=0.006, depth=0.035, axis='X', segments=8, mat=mat_gun_steel))

# 4. Nimer-47 Upgraded — Pack-A-Punch Plasma (Positioned at Y = 0.85)
NIMER_UPG_POS = ARMORY_POS + Vector((0.0, 0.85, 0.12))
nimer_upg_objects = []
nimer_upg_objects.append(create_box("WPN_Nimer47_Upg_Receiver", NIMER_UPG_POS + Vector((0.0, 0.0, 0.03)), (0.048, 0.28, 0.082), mat_pap_cyan))
nimer_upg_objects.append(create_cylinder("WPN_Nimer47_Upg_Barrel", NIMER_UPG_POS + Vector((0.0, 0.32, 0.035)), radius=0.013, depth=0.38, axis='Y', segments=12, mat=mat_gun_steel))
nimer_upg_objects.append(create_box("WPN_Nimer47_Upg_QuadBrake", NIMER_UPG_POS + Vector((0.0, 0.53, 0.035)), (0.038, 0.06, 0.038), mat_pap_cyan))
nimer_upg_objects.append(create_cylinder("WPN_Nimer47_Upg_DrumMag", NIMER_UPG_POS + Vector((0.0, 0.08, -0.12)), radius=0.075, depth=0.075, axis='X', segments=16, mat=mat_pap_cyan))
nimer_upg_objects.append(create_box("WPN_Nimer47_Upg_Stock", NIMER_UPG_POS + Vector((0.0, -0.28, 0.0)), (0.044, 0.30, 0.095), mat_gun_polymer))
nimer_upg_objects.append(create_box("WPN_Nimer47_Upg_Grip", NIMER_UPG_POS + Vector((0.0, -0.10, -0.075)), (0.036, 0.065, 0.12), mat_gun_polymer))
nimer_upg_objects.append(create_box("WPN_Nimer47_Upg_Handguard", NIMER_UPG_POS + Vector((0.0, 0.22, 0.03)), (0.052, 0.18, 0.07), mat_pap_cyan))

# 5. Raad-12 Upgraded — Pack-A-Punch Thermal (Positioned at Y = 1.7)
RAAD_UPG_POS = ARMORY_POS + Vector((0.0, 1.7, 0.12))
raad_upg_objects = []
raad_upg_objects.append(create_box("WPN_Raad12_Upg_Receiver", RAAD_UPG_POS + Vector((0.0, 0.0, 0.04)), (0.05, 0.26, 0.088), mat_pap_amber))
raad_upg_objects.append(create_cylinder("WPN_Raad12_Upg_Barrel", RAAD_UPG_POS + Vector((0.0, 0.35, 0.058)), radius=0.016, depth=0.48, axis='Y', segments=14, mat=mat_gun_steel))
raad_upg_objects.append(create_box("WPN_Raad12_Upg_BreachChoke", RAAD_UPG_POS + Vector((0.0, 0.60, 0.058)), (0.045, 0.05, 0.045), mat_pap_amber))
raad_upg_objects.append(create_box("WPN_Raad12_Upg_SideSaddle", RAAD_UPG_POS + Vector((-0.032, 0.0, 0.045)), (0.015, 0.18, 0.05), mat_pap_amber))
raad_upg_objects.append(create_box("WPN_Raad12_Upg_Pump", RAAD_UPG_POS + Vector((0.0, 0.25, 0.02)), (0.054, 0.19, 0.068), mat_pap_amber))
raad_upg_objects.append(create_box("WPN_Raad12_Upg_Stock", RAAD_UPG_POS + Vector((0.0, -0.26, 0.015)), (0.044, 0.28, 0.09), mat_gun_polymer))

# Lighting for Weapons Armory
light_wpn_key = bpy.data.lights.new("Light_WPN_Key", type='AREA')
light_wpn_key.energy = 450
light_wpn_key.size = 2.5
light_wpn_key_obj = bpy.data.objects.new("Light_WPN_Key_Obj", light_wpn_key)
light_wpn_key_obj.location = ARMORY_POS + Vector((-1.8, 0.0, 1.8))
look_at(light_wpn_key_obj, ARMORY_POS + Vector((0.0, 0.0, 0.1)))
col_batch2.objects.link(light_wpn_key_obj)

light_wpn_rim = bpy.data.lights.new("Light_WPN_Rim", type='POINT')
light_wpn_rim.energy = 220
light_wpn_rim.color = (0.2, 0.8, 1.0)
light_wpn_rim_obj = bpy.data.objects.new("Light_WPN_Rim_Obj", light_wpn_rim)
light_wpn_rim_obj.location = ARMORY_POS + Vector((1.5, 0.0, 1.2))
col_batch2.objects.link(light_wpn_rim_obj)

# ==============================================================================
# 3. BUILD CHALK WALL-BUYS (Arranged side by side on Wall along X)
# ==============================================================================
print(">>> Building Chalk Wall-Buys along Wall...")
wallbuy_objects = []

# Single Grand Sandstone Wall at Y = 50.0 spanning X from 64.0 to 76.0 (length 12m, height 2.2m)
WALL_Y = 50.0
create_box("WB_Grand_Wall_Backing", Vector((70.0, WALL_Y, 1.1)), (12.4, 0.22, 2.2), mat_stone_wall)

def build_chalk_wallbuy(name, center_x, weapon_type, price_buy, price_ammo, width=2.4, height=1.6):
    objs = []
    base_pos = Vector((center_x, WALL_Y, 0.2))
    y_front = WALL_Y - 0.115 # on the front face of wall facing -Y
    
    # 1. Chipped Plaster Wall Plaque
    plaque = create_box(f"WB_{name}_Plaque", Vector((center_x, y_front - 0.01, 1.1)), (width, 0.02, height), mat_stone_wall)
    objs.append(plaque)
    
    # 2. Recessed Dynamic Price Plaque (facing -Y)
    plate = create_box(f"WB_{name}_PricePlate", Vector((center_x, y_front - 0.025, 1.65)), (0.75, 0.02, 0.18), mat_price_slate)
    objs.append(plate)
    
    # 3. Chalk Silhouette Outline
    y_chalk = y_front - 0.03
    if weapon_type == "pistol":
        objs.append(create_box(f"WB_{name}_ChalkSlide", Vector((center_x, y_chalk, 1.05)), (0.42, 0.005, 0.08), mat_chalk_trace))
        objs.append(create_box(f"WB_{name}_ChalkGrip", Vector((center_x - 0.10, y_chalk, 0.88)), (0.11, 0.005, 0.26), mat_chalk_trace))
        objs.append(create_box(f"WB_{name}_ChalkTriggerGuard", Vector((center_x + 0.04, y_chalk, 0.94)), (0.09, 0.005, 0.08), mat_chalk_trace))
    elif weapon_type == "shotgun":
        objs.append(create_box(f"WB_{name}_ChalkBarrel", Vector((center_x + 0.28, y_chalk, 1.02)), (1.1, 0.005, 0.06), mat_chalk_trace))
        objs.append(create_box(f"WB_{name}_ChalkReceiver", Vector((center_x - 0.35, y_chalk, 1.02)), (0.46, 0.005, 0.11), mat_chalk_trace))
        objs.append(create_box(f"WB_{name}_ChalkStock", Vector((center_x - 0.72, y_chalk, 0.98)), (0.42, 0.005, 0.12), mat_chalk_trace))
        objs.append(create_box(f"WB_{name}_ChalkPump", Vector((center_x + 0.08, y_chalk, 0.96)), (0.32, 0.005, 0.07), mat_chalk_trace))
    elif weapon_type == "rifle":
        objs.append(create_box(f"WB_{name}_ChalkBarrel", Vector((center_x + 0.35, y_chalk, 1.05)), (1.05, 0.005, 0.055), mat_chalk_trace))
        objs.append(create_box(f"WB_{name}_ChalkReceiver", Vector((center_x - 0.25, y_chalk, 1.05)), (0.48, 0.005, 0.12), mat_chalk_trace))
        objs.append(create_box(f"WB_{name}_ChalkStock", Vector((center_x - 0.72, y_chalk, 1.01)), (0.50, 0.005, 0.13), mat_chalk_trace))
        objs.append(create_box(f"WB_{name}_ChalkBananaMag", Vector((center_x - 0.12, y_chalk, 0.82)), (0.16, 0.005, 0.32), mat_chalk_trace))
    
    # 4. Ammo box chalk icon on side
    objs.append(create_box(f"WB_{name}_ChalkAmmoBox", Vector((center_x + width/2 - 0.28, y_chalk, 0.75)), (0.22, 0.005, 0.18), mat_chalk_trace))
    return objs

wb_1911 = build_chalk_wallbuy("1911", 66.2, "pistol", 500, 250, width=2.2, height=1.5)
wb_raad = build_chalk_wallbuy("Raad12", 70.0, "shotgun", 1200, 600, width=2.6, height=1.5)
wb_nimer = build_chalk_wallbuy("Nimer47", 73.8, "rifle", 1500, 750, width=2.8, height=1.5)

wallbuy_objects.extend(wb_1911)
wallbuy_objects.extend(wb_raad)
wallbuy_objects.extend(wb_nimer)

# Spotlights for Wallbuys
for idx, spot_x in enumerate([66.2, 70.0, 73.8]):
    s_light = bpy.data.lights.new(f"Spot_WB_{idx}", type='SPOT')
    s_light.energy = 380
    s_light.spot_size = math.radians(65)
    s_light.color = (1.0, 0.92, 0.75)
    s_obj = bpy.data.objects.new(f"Spot_WB_Obj_{idx}", s_light)
    s_obj.location = Vector((spot_x, WALL_Y - 1.8, 2.4))
    look_at(s_obj, Vector((spot_x, WALL_Y - 0.1, 1.1)))
    col_batch2.objects.link(s_obj)

# ==============================================================================
# 4. BUILD UPPER FLOOR ARCHITECTURE & TACTICAL LOOP (Priority 2)
# ==============================================================================
print(">>> Building Upper Floor Architecture & Tactical Kiting Loop...")
env_objects = []
ENV_POS = Vector((0.0, -3.0, 0.0))

# 1. Concrete / Sandstone Staircase
STAIR_START = ENV_POS + Vector((-5.2, -4.2, 0.42))
for step_idx in range(14):
    h = 0.241
    cur_z = 0.42 + (step_idx + 0.5) * h
    cur_y = STAIR_START.y + step_idx * 0.28
    step_obj = create_box(f"ENV_Stair_Tread_{step_idx:02d}", Vector((STAIR_START.x, cur_y, cur_z)), (1.35, 0.32, h), mat_stone_wall)
    env_objects.append(step_obj)

# Metal Handrail for stairs
env_objects.append(create_cylinder("ENV_Stair_Handrail", Vector((STAIR_START.x + 0.65, STAIR_START.y + 1.9, 2.85)), radius=0.03, depth=4.6, axis='Y', segments=8, mat=mat_gun_steel))

# 2. Upper Floor Slab (Playable Gallery / Balcony Room)
UPPER_FLOOR_Z = 3.80
env_objects.append(create_box("ENV_Upper_Floor_Slab", ENV_POS + Vector((-1.5, 0.5, UPPER_FLOOR_Z - 0.14)), (8.8, 6.6, 0.28), mat_stone_wall))

# Upper Parapet & Defensive Half-Walls
env_objects.append(create_box("ENV_Upper_Parapet_West", ENV_POS + Vector((-5.8, 0.5, UPPER_FLOOR_Z + 0.55)), (0.28, 6.6, 1.1), mat_stone_wall))
env_objects.append(create_box("ENV_Upper_Parapet_North", ENV_POS + Vector((-1.5, 3.7, UPPER_FLOOR_Z + 0.55)), (8.8, 0.28, 1.1), mat_stone_wall))
env_objects.append(create_box("ENV_Upper_Parapet_South", ENV_POS + Vector((-1.5, -2.7, UPPER_FLOOR_Z + 0.55)), (8.8, 0.28, 1.1), mat_stone_wall))

# Tactical Jump-Down Balcony Breach
env_objects.append(create_box("ENV_Upper_Parapet_East_A", ENV_POS + Vector((2.8, 2.2, UPPER_FLOOR_Z + 0.55)), (0.28, 2.8, 1.1), mat_stone_wall))
env_objects.append(create_box("ENV_Upper_Parapet_East_B", ENV_POS + Vector((2.8, -1.2, UPPER_FLOOR_Z + 0.55)), (0.28, 2.8, 1.1), mat_stone_wall))
env_objects.append(create_box("ENV_Tactical_Escape_Ledge", ENV_POS + Vector((2.8, 0.5, UPPER_FLOOR_Z + 0.05)), (0.55, 1.8, 0.12), mat_pap_amber))

# 3. Window Barricade Multi-Stage Planks
BARRICADE_POS = ENV_POS + Vector((-5.8, 0.5, UPPER_FLOOR_Z + 0.8))
barricade_planks = []
for p_idx in range(5):
    p_z = BARRICADE_POS.z - 0.4 + p_idx * 0.20
    plank = create_box(f"ENV_Window_Plank_{p_idx+1}", Vector((BARRICADE_POS.x + 0.04, BARRICADE_POS.y, p_z)), (0.04, 1.45, 0.16), mat_barricade_wood)
    nail_l = create_cylinder(f"ENV_Plank_{p_idx+1}_Nail_L", Vector((BARRICADE_POS.x + 0.07, BARRICADE_POS.y - 0.6, p_z)), radius=0.012, depth=0.06, axis='X', segments=6, mat=mat_rusty_iron)
    nail_r = create_cylinder(f"ENV_Plank_{p_idx+1}_Nail_R", Vector((BARRICADE_POS.x + 0.07, BARRICADE_POS.y + 0.6, p_z)), radius=0.012, depth=0.06, axis='X', segments=6, mat=mat_rusty_iron)
    barricade_planks.extend([plank, nail_l, nail_r])
env_objects.extend(barricade_planks)

# 4. Debris Barrier Prop
DEBRIS_POS = ENV_POS + Vector((0.0, -1.8, 0.42))
env_objects.append(create_box("ENV_Debris_Rubble_Core", DEBRIS_POS + Vector((0.0, 0.0, 0.45)), (2.4, 0.85, 0.9), mat_stone_wall))
env_objects.append(create_box("ENV_Debris_Timber_1", DEBRIS_POS + Vector((0.2, -0.1, 0.65)), (2.1, 0.22, 0.22), mat_barricade_wood))
env_objects.append(create_box("ENV_Debris_Metal_Rebar", DEBRIS_POS + Vector((-0.3, 0.1, 0.75)), (0.04, 1.2, 0.9), mat_gun_steel))
env_objects.append(create_box("ENV_Debris_Padlock_Chain", DEBRIS_POS + Vector((0.0, -0.42, 0.55)), (0.35, 0.05, 0.35), mat_rusty_iron))

# ==============================================================================
# 5. EXPORT JSON DATASETS (In Three.js Y-up coordinates)
# ==============================================================================
print(">>> Exporting JSON Deliverables for Engine Integration...")

weapons_manifest = {
    "version": "2.0.0",
    "batch": "visual-remaster-v2",
    "coordinate_system": "Three.js Y-up (X=x, Y=z, Z=-y)",
    "weapons": {
        "pistol_1911": {
            "name_ar": "مسدس 1911",
            "type": "semi_pistol",
            "mag_capacity": 7,
            "sockets": {
                "muzzle_point": to_engine_coords(Vector((0.0, 0.12, 0.045))),
                "ejection_port": to_engine_coords(Vector((0.02, 0.02, 0.045))),
                "iron_sights": to_engine_coords(Vector((0.0, 0.10, 0.075))),
                "mag_well": to_engine_coords(Vector((0.0, -0.06, -0.12)))
            },
            "mesh_components": [extract_mesh_data(o) for o in p1911_objects]
        },
        "nimer_47": {
            "name_ar": "بندقية نمر 47",
            "type": "assault_rifle",
            "fire_rate_rpm": 600,
            "mag_capacity": 30,
            "sockets": {
                "muzzle_point": to_engine_coords(Vector((0.0, 0.54, 0.035))),
                "ejection_port": to_engine_coords(Vector((0.026, 0.05, 0.045))),
                "iron_sight_rear": to_engine_coords(Vector((0.0, 0.10, 0.098))),
                "iron_sight_front": to_engine_coords(Vector((0.0, 0.46, 0.115))),
                "mag_well": to_engine_coords(Vector((0.0, 0.08, -0.04))),
                "charging_handle": to_engine_coords(Vector((0.035, 0.03, 0.05))),
                "left_hand_grip": to_engine_coords(Vector((0.0, 0.22, 0.02))),
                "right_hand_grip": to_engine_coords(Vector((0.0, -0.10, -0.075)))
            },
            "mesh_components": [extract_mesh_data(o) for o in nimer_objects]
        },
        "raad_12": {
            "name_ar": "خرطوش رعد 12",
            "type": "pump_shotgun",
            "mag_capacity": 6,
            "pump_cycle_sec": 0.65,
            "sockets": {
                "muzzle_point": to_engine_coords(Vector((0.0, 0.59, 0.058))),
                "ejection_port": to_engine_coords(Vector((0.028, 0.02, 0.048))),
                "pump_slide": to_engine_coords(Vector((0.0, 0.25, 0.02))),
                "pump_slide_back": to_engine_coords(Vector((0.0, 0.15, 0.02))),
                "loading_gate": to_engine_coords(Vector((0.0, -0.02, 0.01))),
                "iron_sights": to_engine_coords(Vector((0.0, 0.58, 0.082))),
                "left_hand_grip": to_engine_coords(Vector((0.0, 0.25, 0.02))),
                "right_hand_grip": to_engine_coords(Vector((0.0, -0.09, -0.06)))
            },
            "mesh_components": [extract_mesh_data(o) for o in raad_objects]
        },
        "nimer_47_upgraded": {
            "name_ar": "نمر 47 المطورة — صائد الرماد",
            "type": "assault_rifle_upgraded",
            "mag_capacity": 60,
            "plasma_emission": True,
            "sockets": {
                "muzzle_point": to_engine_coords(Vector((0.0, 0.56, 0.035))),
                "ejection_port": to_engine_coords(Vector((0.028, 0.05, 0.045)))
            },
            "mesh_components": [extract_mesh_data(o) for o in nimer_upg_objects]
        },
        "raad_12_upgraded": {
            "name_ar": "رعد 12 المطورة — قاصف البرق",
            "type": "shotgun_upgraded",
            "mag_capacity": 10,
            "thermal_emission": True,
            "sockets": {
                "muzzle_point": to_engine_coords(Vector((0.0, 0.62, 0.058))),
                "ejection_port": to_engine_coords(Vector((0.03, 0.02, 0.048)))
            },
            "mesh_components": [extract_mesh_data(o) for o in raad_upg_objects]
        }
    }
}

with open(os.path.join(DELIVERY_DIR, "weapons-pack-v2.json"), "w", encoding="utf-8") as f:
    json.dump(weapons_manifest, f, indent=2, ensure_ascii=False)

# Export 2: Chalk Wall-Buys
wallbuys_manifest = {
    "version": "2.0.0",
    "batch": "visual-remaster-v2",
    "wallbuys": [
        {
            "id": "wallbuy_1911",
            "weapon_key": "pistol_1911",
            "weapon_name_ar": "مسدس 1911",
            "price_buy": 500,
            "price_ammo": 250,
            "world_mount_dims": [2.2, 1.5, 0.08],
            "price_display_center": [66.2, 1.65, -(WALL_Y - 0.13)],
            "mesh_components": [extract_mesh_data(o) for o in wb_1911]
        },
        {
            "id": "wallbuy_raad12",
            "weapon_key": "raad_12",
            "weapon_name_ar": "خرطوش رعد 12",
            "price_buy": 1200,
            "price_ammo": 600,
            "world_mount_dims": [2.6, 1.5, 0.08],
            "price_display_center": [70.0, 1.65, -(WALL_Y - 0.13)],
            "mesh_components": [extract_mesh_data(o) for o in wb_raad]
        },
        {
            "id": "wallbuy_nimer47",
            "weapon_key": "nimer_47",
            "weapon_name_ar": "بندقية نمر 47",
            "price_buy": 1500,
            "price_ammo": 750,
            "world_mount_dims": [2.8, 1.5, 0.08],
            "price_display_center": [73.8, 1.65, -(WALL_Y - 0.13)],
            "mesh_components": [extract_mesh_data(o) for o in wb_nimer]
        }
    ]
}

with open(os.path.join(DELIVERY_DIR, "wallbuys-and-props-v2.json"), "w", encoding="utf-8") as f:
    json.dump(wallbuys_manifest, f, indent=2, ensure_ascii=False)

# Export 3: Upper Floor Architecture & Navigation Data
upper_manifest = {
    "version": "2.0.0",
    "batch": "visual-remaster-v2",
    "elevation_data": {
        "ground_level_y": round(0.42, 3),
        "upper_floor_level_y": round(UPPER_FLOOR_Z, 3),
        "drop_height_delta": round(UPPER_FLOOR_Z - 0.42, 3)
    },
    "walkable_surfaces": [
        {
            "id": "upper_floor_main_deck",
            "bounds_engine": {
                "center": to_engine_coords(ENV_POS + Vector((-1.5, 0.5, UPPER_FLOOR_Z))),
                "size_engine": [8.8, 0.28, 6.6]
            }
        },
        {
            "id": "tactical_escape_balcony",
            "bounds_engine": {
                "center": to_engine_coords(ENV_POS + Vector((2.8, 0.5, UPPER_FLOOR_Z))),
                "size_engine": [0.55, 0.12, 1.8]
            },
            "jump_down_target_courtyard": to_engine_coords(ENV_POS + Vector((4.2, 0.5, 0.42)))
        }
    ],
    "collision_boxes": [
        { "id": "parapet_west", "box": [-5.8, 0.5, UPPER_FLOOR_Z + 0.55, 0.28, 6.6, 1.1] },
        { "id": "parapet_north", "box": [-1.5, 3.7, UPPER_FLOOR_Z + 0.55, 8.8, 0.28, 1.1] },
        { "id": "parapet_south", "box": [-1.5, -2.7, UPPER_FLOOR_Z + 0.55, 8.8, 0.28, 1.1] }
    ],
    "window_barricade": {
        "id": "window_barricade_upper_west",
        "total_planks": 5,
        "repair_points_per_plank": 10,
        "stages": {
            "broken": 0,
            "critical": 1,
            "damaged": 2,
            "reinforced": 4,
            "intact": 5
        }
    },
    "debris_barrier": {
        "id": "debris_barrier_house_doorway",
        "clear_cost": 750,
        "center_engine": to_engine_coords(DEBRIS_POS),
        "collision_box_engine": [2.4, 0.9, 0.85]
    },
    "mesh_components": [extract_mesh_data(o) for o in env_objects]
}

with open(os.path.join(DELIVERY_DIR, "upper-floor-architecture-v2.json"), "w", encoding="utf-8") as f:
    json.dump(upper_manifest, f, indent=2, ensure_ascii=False)

print(">>> Saving updated .blend file...")
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(DELIVERY_DIR, "ashfall-remaster-v2.blend"))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(DELIVERY_DIR, "ashfall-remaster-v1.blend"))

# ==============================================================================
# 6. RENDER HIGH-RES SHOWCASE IMAGES (Precise Framing)
# ==============================================================================
print(">>> Setting up Showcase Cameras with Precise Framing...")

def setup_camera(name, loc, target, lens=35):
    cam_data = bpy.data.cameras.get(name + "_cam") or bpy.data.cameras.new(name + "_cam")
    cam_data.lens = lens
    cam_obj = bpy.data.objects.get(name)
    if not cam_obj:
        cam_obj = bpy.data.objects.new(name, cam_data)
        col_batch2.objects.link(cam_obj)
    cam_obj.location = loc
    look_at(cam_obj, target)
    return cam_obj

# 1. Camera: Weapons Showcase (Framing the 5 weapons on the rack)
cam_wpn = setup_camera("CAM_Weapons_Showcase", ARMORY_POS + Vector((-2.6, 0.0, 0.65)), ARMORY_POS + Vector((0.0, 0.0, 0.05)), lens=32)

# 2. Camera: Wallbuys Showcase (Facing the wall from Y = WALL_Y - 4.5 looking towards WALL_Y)
cam_wb = setup_camera("CAM_Wallbuys_Showcase", Vector((70.0, WALL_Y - 5.5, 1.25)), Vector((70.0, WALL_Y - 0.1, 1.15)), lens=30)

# 3. Camera: Upper Floor Architecture Showcase (Dramatic isometric overview of stairs & balcony)
cam_env = setup_camera("CAM_UpperFloor_Showcase", Vector((5.5, -9.0, 8.2)), Vector((-1.0, -1.0, 2.5)), lens=28)

bpy.context.scene.render.resolution_x = 1280
bpy.context.scene.render.resolution_y = 720
bpy.context.scene.render.film_transparent = False

# Render 1: Weapons
bpy.context.scene.camera = cam_wpn
bpy.context.scene.render.filepath = os.path.join(DELIVERY_DIR, "weapons-showcase-v2.png")
bpy.ops.render.render(write_still=True)

# Render 2: Wallbuys
bpy.context.scene.camera = cam_wb
bpy.context.scene.render.filepath = os.path.join(DELIVERY_DIR, "wallbuys-showcase-v2.png")
bpy.ops.render.render(write_still=True)

# Render 3: Upper Floor Architecture
bpy.context.scene.camera = cam_env
bpy.context.scene.render.filepath = os.path.join(DELIVERY_DIR, "upper-floor-showcase-v2.png")
bpy.ops.render.render(write_still=True)

print(">>> ALL BATCH 2 ASSETS AND SHOWCASES COMPLETED PERFECTLY!")
