import bpy
import bmesh
import math
import os
import json
from mathutils import Vector, Euler, Matrix

print(">>> Starting ASHFALL Visual Remaster Batch 3 Generation (Optimized Horizontal Layout)...")

DELIVERY_DIR = r"C:\Users\xxtro\Documents\Codex\2026-10-16\new-chat\outputs\blender-delivery"
os.makedirs(DELIVERY_DIR, exist_ok=True)

COLLECTION_NAME = "09 | ASHFALL REMASTER BATCH 3"
col_batch3 = bpy.data.collections.get(COLLECTION_NAME)
if not col_batch3:
    col_batch3 = bpy.data.collections.new(COLLECTION_NAME)
    bpy.context.scene.collection.children.link(col_batch3)
else:
    for obj in list(col_batch3.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

def to_engine_coords(v):
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

mat_perk_vitality = get_or_create_material("Ashfall | Perk Vitality Red", (0.75, 0.08, 0.06, 1.0), metallic=0.6, roughness=0.25, emission=(0.95, 0.12, 0.08, 1.0), emission_strength=2.2)
mat_perk_haste = get_or_create_material("Ashfall | Perk Haste Green", (0.06, 0.65, 0.15, 1.0), metallic=0.6, roughness=0.25, emission=(0.10, 0.85, 0.20, 1.0), emission_strength=2.2)
mat_perk_stamina = get_or_create_material("Ashfall | Perk Stamina Orange", (0.85, 0.40, 0.05, 1.0), metallic=0.6, roughness=0.25, emission=(1.0, 0.45, 0.05, 1.0), emission_strength=2.2)
mat_perk_revive = get_or_create_material("Ashfall | Perk Revive Cyan", (0.05, 0.55, 0.85, 1.0), metallic=0.6, roughness=0.25, emission=(0.10, 0.70, 1.0, 1.0), emission_strength=2.2)

mat_machine_steel = get_or_create_material("Ashfall | Industrial Steel", (0.15, 0.16, 0.17, 1.0), metallic=0.85, roughness=0.35)
mat_machine_chrome = get_or_create_material("Ashfall | Polished Chrome", (0.9, 0.9, 0.92, 1.0), metallic=0.95, roughness=0.1)
mat_glass_blue = get_or_create_material("Ashfall | Plasma Blue Glass", (0.1, 0.6, 0.9, 1.0), metallic=0.1, roughness=0.1, emission=(0.1, 0.7, 1.0, 1.0), emission_strength=3.5)

mat_mystery_box = get_or_create_material("Ashfall | Weathered Ornate Wood", (0.18, 0.12, 0.08, 1.0), metallic=0.05, roughness=0.8)
mat_box_gold = get_or_create_material("Ashfall | Ancient Tarnished Gold", (0.75, 0.60, 0.20, 1.0), metallic=0.9, roughness=0.4)
mat_box_beam = get_or_create_material("Ashfall | Mystery Cyan Light Beam", (0.2, 0.8, 1.0, 1.0), metallic=0.0, roughness=0.1, emission=(0.3, 0.85, 1.0, 1.0), emission_strength=6.0)

mat_powerup_gold = get_or_create_material("Ashfall | PowerUp Gold", (0.95, 0.80, 0.15, 1.0), metallic=0.95, roughness=0.15, emission=(1.0, 0.85, 0.2, 1.0), emission_strength=4.0)
mat_powerup_green = get_or_create_material("Ashfall | PowerUp Emerald", (0.10, 0.85, 0.35, 1.0), metallic=0.85, roughness=0.2, emission=(0.15, 0.95, 0.4, 1.0), emission_strength=4.0)
mat_powerup_red = get_or_create_material("Ashfall | PowerUp Crimson", (0.85, 0.08, 0.12, 1.0), metallic=0.85, roughness=0.2, emission=(1.0, 0.12, 0.15, 1.0), emission_strength=4.5)
mat_tactical_olive = get_or_create_material("Ashfall | Tactical OD Green", (0.14, 0.18, 0.12, 1.0), metallic=0.2, roughness=0.6)
mat_brass_casing = get_or_create_material("Ashfall | Cartridge Brass", (0.82, 0.68, 0.28, 1.0), metallic=0.95, roughness=0.2)
mat_shotgun_red_hull = get_or_create_material("Ashfall | Shotgun Red Hull", (0.65, 0.08, 0.08, 1.0), metallic=0.05, roughness=0.4)

mat_electric_blue = get_or_create_material("Ashfall | High-Voltage Arc", (0.2, 0.7, 1.0, 1.0), metallic=0.0, roughness=0.1, emission=(0.3, 0.8, 1.0, 1.0), emission_strength=8.0)
mat_caution_stripe = get_or_create_material("Ashfall | Hazard Black Yellow", (0.85, 0.75, 0.05, 1.0), metallic=0.1, roughness=0.5)

materials_palette_v3 = {
    "Ashfall | Perk Vitality Red": {"base_color": [0.75, 0.08, 0.06, 1.0], "metallic": 0.6, "roughness": 0.25, "emission": [0.95, 0.12, 0.08, 1.0], "emission_strength": 2.2},
    "Ashfall | Perk Haste Green": {"base_color": [0.06, 0.65, 0.15, 1.0], "metallic": 0.6, "roughness": 0.25, "emission": [0.10, 0.85, 0.20, 1.0], "emission_strength": 2.2},
    "Ashfall | Perk Stamina Orange": {"base_color": [0.85, 0.40, 0.05, 1.0], "metallic": 0.6, "roughness": 0.25, "emission": [1.0, 0.45, 0.05, 1.0], "emission_strength": 2.2},
    "Ashfall | Perk Revive Cyan": {"base_color": [0.05, 0.55, 0.85, 1.0], "metallic": 0.6, "roughness": 0.25, "emission": [0.10, 0.70, 1.0, 1.0], "emission_strength": 2.2},
    "Ashfall | Industrial Steel": {"base_color": [0.15, 0.16, 0.17, 1.0], "metallic": 0.85, "roughness": 0.35, "emission": [0,0,0,1], "emission_strength": 0.0},
    "Ashfall | Polished Chrome": {"base_color": [0.9, 0.9, 0.92, 1.0], "metallic": 0.95, "roughness": 0.1, "emission": [0,0,0,1], "emission_strength": 0.0},
    "Ashfall | Weathered Ornate Wood": {"base_color": [0.18, 0.12, 0.08, 1.0], "metallic": 0.05, "roughness": 0.8, "emission": [0,0,0,1], "emission_strength": 0.0},
    "Ashfall | Ancient Tarnished Gold": {"base_color": [0.75, 0.60, 0.20, 1.0], "metallic": 0.9, "roughness": 0.4, "emission": [0,0,0,1], "emission_strength": 0.0},
    "Ashfall | Mystery Cyan Light Beam": {"base_color": [0.2, 0.8, 1.0, 1.0], "metallic": 0.0, "roughness": 0.1, "emission": [0.3, 0.85, 1.0, 1.0], "emission_strength": 6.0},
    "Ashfall | PowerUp Gold": {"base_color": [0.95, 0.80, 0.15, 1.0], "metallic": 0.95, "roughness": 0.15, "emission": [1.0, 0.85, 0.2, 1.0], "emission_strength": 4.0},
    "Ashfall | PowerUp Emerald": {"base_color": [0.10, 0.85, 0.35, 1.0], "metallic": 0.85, "roughness": 0.2, "emission": [0.15, 0.95, 0.4, 1.0], "emission_strength": 4.0},
    "Ashfall | PowerUp Crimson": {"base_color": [0.85, 0.08, 0.12, 1.0], "metallic": 0.85, "roughness": 0.2, "emission": [1.0, 0.12, 0.15, 1.0], "emission_strength": 4.5},
    "Ashfall | Tactical OD Green": {"base_color": [0.14, 0.18, 0.12, 1.0], "metallic": 0.2, "roughness": 0.6, "emission": [0,0,0,1], "emission_strength": 0.0},
    "Ashfall | Cartridge Brass": {"base_color": [0.82, 0.68, 0.28, 1.0], "metallic": 0.95, "roughness": 0.2, "emission": [0,0,0,1], "emission_strength": 0.0},
    "Ashfall | Shotgun Red Hull": {"base_color": [0.65, 0.08, 0.08, 1.0], "metallic": 0.05, "roughness": 0.4, "emission": [0,0,0,1], "emission_strength": 0.0},
    "Ashfall | High-Voltage Arc": {"base_color": [0.2, 0.7, 1.0, 1.0], "metallic": 0.0, "roughness": 0.1, "emission": [0.3, 0.8, 1.0, 1.0], "emission_strength": 8.0},
    "Ashfall | Hazard Black Yellow": {"base_color": [0.85, 0.75, 0.05, 1.0], "metallic": 0.1, "roughness": 0.5, "emission": [0,0,0,1], "emission_strength": 0.0}
}

def create_box(name, center, size, mat=None, collection=col_batch3):
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

def create_cylinder(name, center, radius, depth, axis='Y', segments=14, mat=None, collection=col_batch3):
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

def extract_mesh_data(obj, local_origin=None):
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
            if local_origin:
                v_world = v_world - Vector(local_origin)
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
# 2. BUILD GAMEPLAY MACHINES (Arranged horizontally along X at Y = 0.0)
# ==============================================================================
print(">>> Building Gameplay Machines lined up along X...")

# Common floor platform for machines
create_box("ENV_Machines_Floor", Vector((94.0, 0.0, -0.05)), (28.0, 3.5, 0.1), mat_machine_steel)

def build_perk_machine(machine_id, name_ar, center_pos, primary_mat, emblem_symbol, price_val):
    objs = []
    # 1. Base pedestal & cabinet (Facing -Y towards camera)
    p_base = create_box(f"PERK_{machine_id}_Cabinet", center_pos + Vector((0.0, 0.0, 0.85)), (0.85, 0.78, 1.70), primary_mat)
    objs.append(p_base)
    p_kick = create_box(f"PERK_{machine_id}_Kickplate", center_pos + Vector((0.0, -0.02, 0.10)), (0.90, 0.82, 0.20), mat_machine_steel)
    objs.append(p_kick)
    p_marquee = create_box(f"PERK_{machine_id}_Marquee", center_pos + Vector((0.0, 0.0, 1.85)), (0.92, 0.84, 0.35), primary_mat)
    objs.append(p_marquee)
    p_bay = create_box(f"PERK_{machine_id}_DisplayBay", center_pos + Vector((0.0, -0.36, 1.15)), (0.55, 0.12, 0.65), mat_machine_steel)
    objs.append(p_bay)
    p_bottle = create_cylinder(f"PERK_{machine_id}_Bottle", center_pos + Vector((0.0, -0.34, 1.10)), radius=0.07, depth=0.32, axis='Z', segments=12, mat=primary_mat)
    objs.append(p_bottle)
    p_cap = create_cylinder(f"PERK_{machine_id}_Cap", center_pos + Vector((0.0, -0.34, 1.28)), radius=0.035, depth=0.05, axis='Z', segments=10, mat=mat_machine_chrome)
    objs.append(p_cap)
    p_price_plate = create_box(f"PERK_{machine_id}_PricePlate", center_pos + Vector((0.0, -0.40, 0.55)), (0.45, 0.02, 0.15), mat_machine_chrome)
    objs.append(p_price_plate)
    p_coin = create_box(f"PERK_{machine_id}_CoinSlot", center_pos + Vector((0.28, -0.39, 0.95)), (0.08, 0.02, 0.12), mat_machine_steel)
    p_dispense = create_box(f"PERK_{machine_id}_Dispenser", center_pos + Vector((0.0, -0.38, 0.30)), (0.35, 0.10, 0.20), mat_machine_steel)
    objs.extend([p_coin, p_dispense])
    
    return {
        "id": machine_id,
        "name_ar": name_ar,
        "price": price_val,
        "emblem": emblem_symbol,
        "center_world": [center_pos.x, center_pos.y, center_pos.z],
        "interaction_point": [0.0, 0.0, -0.85],
        "price_display_center": [0.0, 0.55, -0.41],
        "objects": objs
    }

# Lined up along X from left to right:
# Pack-A-Punch (X=87.5), Vitality (X=90.5), Haste (X=92.5), Stamina (X=94.5), Revive (X=96.5), Mystery Box (X=99.5)
pm_vitality = build_perk_machine("perk_vitality", "مشروب الحيوية والدرع", Vector((90.5, 0.0, 0.0)), mat_perk_vitality, "shield_cross", 2500)
pm_haste = build_perk_machine("perk_haste", "مشروب السرعة والتعمير", Vector((92.5, 0.0, 0.0)), mat_perk_haste, "speed_lightning", 3000)
pm_stamina = build_perk_machine("perk_stamina", "مشروب الركض والتحمل", Vector((94.5, 0.0, 0.0)), mat_perk_stamina, "running_boot", 2000)
pm_revive = build_perk_machine("perk_revive", "مشروب الإنعاش السريع", Vector((96.5, 0.0, 0.0)), mat_perk_revive, "medic_heart", 1500)

all_perk_machines = [pm_vitality, pm_haste, pm_stamina, pm_revive]

# Pack-A-Punch Machine (at X = 87.5)
PAP_POS = Vector((87.5, 0.0, 0.0))
pap_objs = []
pap_objs.append(create_box("PAP_MainFrame", PAP_POS + Vector((0.0, 0.0, 1.1)), (1.8, 1.2, 2.2), mat_machine_steel))
pap_objs.append(create_box("PAP_UpgradeChamber", PAP_POS + Vector((0.0, -0.45, 1.1)), (0.95, 0.45, 0.75), mat_glass_blue))
pap_objs.append(create_cylinder("PAP_TeslaCoil_L", PAP_POS + Vector((-0.65, 0.0, 2.45)), radius=0.22, depth=0.55, axis='Z', segments=14, mat=mat_box_gold))
pap_objs.append(create_cylinder("PAP_TeslaCoil_R", PAP_POS + Vector((0.65, 0.0, 2.45)), radius=0.22, depth=0.55, axis='Z', segments=14, mat=mat_box_gold))
pap_objs.append(create_cylinder("PAP_EnergyArc", PAP_POS + Vector((0.0, 0.0, 2.55)), radius=0.04, depth=1.3, axis='X', segments=8, mat=mat_electric_blue))
pap_objs.append(create_box("PAP_PricePlate", PAP_POS + Vector((0.0, -0.62, 0.45)), (0.55, 0.02, 0.16), mat_machine_chrome))

# Mystery Box (at X = 99.5)
BOX_POS = Vector((99.5, 0.0, 0.0))
mbox_objs = []
mbox_objs.append(create_box("MBOX_BaseChest", BOX_POS + Vector((0.0, 0.0, 0.35)), (1.65, 0.68, 0.55), mat_mystery_box))
mbox_objs.append(create_box("MBOX_GoldBrackets", BOX_POS + Vector((0.0, 0.0, 0.35)), (1.68, 0.70, 0.25), mat_box_gold))
mbox_objs.append(create_cylinder("MBOX_SkullLock_L", BOX_POS + Vector((-0.35, -0.36, 0.45)), radius=0.06, depth=0.06, axis='Y', segments=10, mat=mat_box_gold))
mbox_objs.append(create_cylinder("MBOX_SkullLock_R", BOX_POS + Vector((0.35, -0.36, 0.45)), radius=0.06, depth=0.06, axis='Y', segments=10, mat=mat_box_gold))
mbox_objs.append(create_box("MBOX_ChestLid", BOX_POS + Vector((0.0, 0.12, 0.75)), (1.67, 0.65, 0.22), mat_mystery_box))
mbox_objs.append(create_cylinder("MBOX_CyanLightBeam", BOX_POS + Vector((0.0, 0.0, 4.5)), radius=0.32, depth=8.0, axis='Z', segments=16, mat=mat_box_beam))

# Master Power Switch (at X = 84.5)
POWER_POS = Vector((84.5, 0.0, 0.0))
power_objs = []
power_objs.append(create_box("PWR_BreakerCabinet", POWER_POS + Vector((0.0, 0.0, 1.35)), (0.75, 0.35, 1.1), mat_machine_steel))
power_objs.append(create_cylinder("PWR_LeverPivot", POWER_POS + Vector((0.0, -0.19, 1.35)), radius=0.04, depth=0.15, axis='Y', segments=10, mat=mat_machine_chrome))
power_objs.append(create_box("PWR_ThrowLever", POWER_POS + Vector((0.0, -0.24, 1.50)), (0.06, 0.06, 0.35), mat_perk_vitality))
power_objs.append(create_cylinder("PWR_VoltmeterGauge", POWER_POS + Vector((0.0, -0.18, 1.70)), radius=0.12, depth=0.04, axis='Y', segments=14, mat=mat_powerup_gold))

# Electric Gate Trap (at X = 104.0)
TRAP_POS = Vector((104.0, 0.0, 0.0))
trap_objs = []
trap_objs.append(create_box("TRAP_Pylon_Left", TRAP_POS + Vector((-1.5, 0.0, 1.5)), (0.35, 0.35, 3.0), mat_machine_steel))
trap_objs.append(create_box("TRAP_Pylon_Right", TRAP_POS + Vector((1.5, 0.0, 1.5)), (0.35, 0.35, 3.0), mat_machine_steel))
for z_ins in [1.0, 1.8, 2.6]:
    trap_objs.append(create_cylinder(f"TRAP_Insulator_L_{z_ins}", TRAP_POS + Vector((-1.3, 0.0, z_ins)), radius=0.10, depth=0.22, axis='X', segments=10, mat=mat_perk_vitality))
    trap_objs.append(create_cylinder(f"TRAP_Insulator_R_{z_ins}", TRAP_POS + Vector((1.3, 0.0, z_ins)), radius=0.10, depth=0.22, axis='X', segments=10, mat=mat_perk_vitality))
    trap_objs.append(create_cylinder(f"TRAP_Arc_{z_ins}", TRAP_POS + Vector((0.0, 0.0, z_ins)), radius=0.035, depth=2.4, axis='X', segments=8, mat=mat_electric_blue))
trap_objs.append(create_box("TRAP_HazardStripe", TRAP_POS + Vector((0.0, 0.0, 0.02)), (3.2, 0.9, 0.04), mat_caution_stripe))
trap_objs.append(create_box("TRAP_SwitchBox", TRAP_POS + Vector((-1.75, 0.0, 1.2)), (0.22, 0.35, 0.45), mat_perk_vitality))
trap_objs.append(create_box("TRAP_LeverHandle", TRAP_POS + Vector((-1.9, 0.0, 1.25)), (0.08, 0.06, 0.24), mat_powerup_gold))

# ==============================================================================
# 3. BUILD FLOATING POWER-UPS & TACTICAL PROPS (Lined up horizontally along X at Y = 10.0)
# ==============================================================================
print(">>> Building Floating Power-Ups & Tacticals lined up along X...")
PUPS_Y = 10.0
powerup_objs = []

# Table/Pedestal for powerups & weapons
create_box("ENV_Powerups_Pedestal", Vector((94.0, PUPS_Y, 0.45)), (20.0, 1.6, 0.9), mat_machine_steel)

# 1. Max Ammo (at X = 87.5)
AMMO_POS = Vector((87.5, PUPS_Y, 1.2))
powerup_objs.append(create_box("PUP_MaxAmmo_Canister", AMMO_POS, (0.35, 0.18, 0.26), mat_powerup_green))
powerup_objs.append(create_cylinder("PUP_MaxAmmo_Bullet1", AMMO_POS + Vector((-0.08, 0.0, 0.18)), radius=0.025, depth=0.12, axis='Z', segments=8, mat=mat_powerup_gold))
powerup_objs.append(create_cylinder("PUP_MaxAmmo_Bullet2", AMMO_POS + Vector((0.0, 0.0, 0.18)), radius=0.025, depth=0.12, axis='Z', segments=8, mat=mat_powerup_gold))
powerup_objs.append(create_cylinder("PUP_MaxAmmo_Bullet3", AMMO_POS + Vector((0.08, 0.0, 0.18)), radius=0.025, depth=0.12, axis='Z', segments=8, mat=mat_powerup_gold))

# 2. Insta-Kill (at X = 89.5)
INSTA_POS = Vector((89.5, PUPS_Y, 1.2))
powerup_objs.append(create_box("PUP_InstaKill_Cranium", INSTA_POS, (0.24, 0.26, 0.28), mat_powerup_red))
powerup_objs.append(create_box("PUP_InstaKill_Jaw", INSTA_POS + Vector((0.0, -0.04, -0.16)), (0.16, 0.16, 0.10), mat_powerup_red))
powerup_objs.append(create_cylinder("PUP_InstaKill_CrossBone1", INSTA_POS + Vector((0.0, 0.05, -0.18)), radius=0.025, depth=0.45, axis='X', segments=8, mat=mat_powerup_red))

# 3. Double Points (at X = 91.5)
POINTS_POS = Vector((91.5, PUPS_Y, 1.2))
powerup_objs.append(create_cylinder("PUP_DoublePoints_Coin", POINTS_POS, radius=0.22, depth=0.06, axis='Y', segments=16, mat=mat_powerup_gold))
powerup_objs.append(create_box("PUP_DoublePoints_Numeral2", POINTS_POS + Vector((-0.06, -0.04, 0.0)), (0.07, 0.02, 0.18), mat_powerup_gold))
powerup_objs.append(create_box("PUP_DoublePoints_LetterX", POINTS_POS + Vector((0.06, -0.04, 0.0)), (0.07, 0.02, 0.14), mat_powerup_gold))

# 4. Nuke (at X = 93.5)
NUKE_POS = Vector((93.5, PUPS_Y, 1.2))
powerup_objs.append(create_cylinder("PUP_Nuke_Body", NUKE_POS, radius=0.12, depth=0.42, axis='Z', segments=14, mat=mat_powerup_gold))
powerup_objs.append(create_cylinder("PUP_Nuke_NoseCone", NUKE_POS + Vector((0.0, 0.0, 0.28)), radius=0.06, depth=0.15, axis='Z', segments=12, mat=mat_powerup_red))
powerup_objs.append(create_box("PUP_Nuke_Fin1", NUKE_POS + Vector((0.0, 0.0, -0.18)), (0.34, 0.02, 0.14), mat_powerup_gold))
powerup_objs.append(create_box("PUP_Nuke_Fin2", NUKE_POS + Vector((0.0, 0.0, -0.18)), (0.02, 0.34, 0.14), mat_powerup_gold))

# 5. Carpenter (at X = 95.5)
CARP_POS = Vector((95.5, PUPS_Y, 1.2))
powerup_objs.append(create_cylinder("PUP_Carpenter_Handle", CARP_POS + Vector((0.0, 0.0, -0.05)), radius=0.022, depth=0.35, axis='Z', segments=8, mat=mat_powerup_gold))
powerup_objs.append(create_box("PUP_Carpenter_Head", CARP_POS + Vector((0.0, 0.0, 0.12)), (0.24, 0.08, 0.08), mat_powerup_gold))

# 6. Frag Grenade (at X = 97.5)
tactical_objs = []
tactical_objs.append(create_cylinder("TAC_Frag_Body", Vector((97.5, PUPS_Y, 1.15)), radius=0.055, depth=0.11, axis='Z', segments=12, mat=mat_tactical_olive))
tactical_objs.append(create_cylinder("TAC_Frag_Fuze", Vector((97.5, PUPS_Y, 1.23)), radius=0.02, depth=0.05, axis='Z', segments=8, mat=mat_machine_steel))
tactical_objs.append(create_box("TAC_Frag_Lever", Vector((97.53, PUPS_Y, 1.21)), (0.02, 0.04, 0.09), mat_machine_steel))

# 7. Musical Decoy Monkey Bomb (at X = 99.5)
DECOY_POS = Vector((99.5, PUPS_Y, 1.0))
tactical_objs.append(create_box("TAC_Decoy_Body", DECOY_POS + Vector((0.0, 0.0, 0.15)), (0.22, 0.18, 0.28), mat_perk_vitality))
tactical_objs.append(create_cylinder("TAC_Decoy_Head", DECOY_POS + Vector((0.0, 0.0, 0.38)), radius=0.11, depth=0.18, axis='Z', segments=12, mat=mat_powerup_gold))
tactical_objs.append(create_cylinder("TAC_Decoy_Eye_L", DECOY_POS + Vector((-0.05, -0.11, 0.40)), radius=0.02, depth=0.02, axis='Y', segments=8, mat=mat_powerup_red))
tactical_objs.append(create_cylinder("TAC_Decoy_Eye_R", DECOY_POS + Vector((0.05, -0.11, 0.40)), radius=0.02, depth=0.02, axis='Y', segments=8, mat=mat_powerup_red))
tactical_objs.append(create_cylinder("TAC_Decoy_Cymbal_L", DECOY_POS + Vector((-0.04, -0.18, 0.18)), radius=0.08, depth=0.015, axis='X', segments=10, mat=mat_brass_casing))
tactical_objs.append(create_cylinder("TAC_Decoy_Cymbal_R", DECOY_POS + Vector((0.04, -0.18, 0.18)), radius=0.08, depth=0.015, axis='X', segments=10, mat=mat_brass_casing))

# 8. Shell Casings (at X = 101.5)
casings_objs = []
casings_objs.append(create_cylinder("CASING_Pistol_9mm", Vector((101.2, PUPS_Y, 1.05)), radius=0.012, depth=0.038, axis='Z', segments=10, mat=mat_brass_casing))
casings_objs.append(create_cylinder("CASING_Rifle_762", Vector((101.5, PUPS_Y, 1.07)), radius=0.014, depth=0.075, axis='Z', segments=10, mat=mat_brass_casing))
casings_objs.append(create_cylinder("CASING_Shotgun_Rim", Vector((101.8, PUPS_Y, 1.04)), radius=0.024, depth=0.025, axis='Z', segments=12, mat=mat_brass_casing))
casings_objs.append(create_cylinder("CASING_Shotgun_Hull", Vector((101.8, PUPS_Y, 1.095)), radius=0.023, depth=0.085, axis='Z', segments=12, mat=mat_shotgun_red_hull))

# ==============================================================================
# 4. EXPORT JSON DATASETS (Zero-Origin Local Spaces with Full Materials Palette)
# ==============================================================================
print(">>> Exporting JSON Deliverables for Batch 3...")

# 1. Gameplay Machines Manifest
machines_manifest = {
    "version": "3.0.0",
    "batch": "visual-remaster-v3",
    "coordinate_system": "Three.js Y-up (X=x, Y=z, Z=-y)",
    "local_origin_note": "Every machine mesh has its origin [0,0,0] centered on its floor base contact point.",
    "materials_palette": materials_palette_v3,
    "perk_machines": [
        {
            "id": pm["id"],
            "name_ar": pm["name_ar"],
            "price": pm["price"],
            "emblem": pm["emblem"],
            "interaction_point": pm["interaction_point"],
            "price_display_center": pm["price_display_center"],
            "states": {
                "unpowered": {"marquee_emissive": False, "bottle_light": False, "audio_loop": None},
                "powered_ready": {"marquee_emissive": True, "bottle_light": True, "audio_loop": f"jingle_{pm['id']}"},
                "purchased_active": {"dispense_anim_sec": 1.5, "perk_icon": pm["emblem"]}
            },
            "mesh_components": [extract_mesh_data(o, Vector(pm["center_world"])) for o in pm["objects"]]
        }
        for pm in all_perk_machines
    ],
    "mystery_box": {
        "id": "mystery_box",
        "name_ar": "الصندوق العشوائي",
        "spin_cost": 950,
        "interaction_point": [0.0, 0.0, -0.9],
        "price_display_center": [0.0, 0.75, -0.4],
        "states": {
            "closed_idle": {"light_beam": True, "beam_intensity": 1.0, "lid_open_angle_deg": 0.0},
            "opened_cycling": {"light_beam": True, "beam_intensity": 3.0, "lid_open_angle_deg": 75.0, "cycle_duration_sec": 4.5},
            "weapon_ready": {"pickup_window_sec": 8.0},
            "teddy_bear_relocation": {"box_levitates": True, "relocate_delay_sec": 3.0}
        },
        "mesh_components": [extract_mesh_data(o, BOX_POS) for o in mbox_objs]
    },
    "pack_a_punch": {
        "id": "pack_a_punch_station",
        "name_ar": "محطة التطوير — صاقل الأسلحة",
        "upgrade_cost": 5000,
        "repack_cost": 2500,
        "interaction_point": [0.0, 0.0, -1.2],
        "price_display_center": [0.0, 0.45, -0.62],
        "states": {
            "unpowered": {"coils_spinning": False, "chamber_light": False},
            "ready": {"coils_spinning": True, "idle_rpm": 30, "chamber_light": True},
            "upgrading": {"upgrade_time_sec": 2.5, "coils_rpm": 180, "electric_arcs": True},
            "weapon_ready": {"pickup_window_sec": 12.0}
        },
        "mesh_components": [extract_mesh_data(o, PAP_POS) for o in pap_objs]
    },
    "electric_gate_trap": {
        "id": "electric_gate_trap_courtyard",
        "name_ar": "مصيدة الصعق الكهربائي",
        "activation_cost": 1000,
        "active_duration_sec": 25.0,
        "cooldown_sec": 60.0,
        "switch_interaction_point": [-1.75, 1.25, 0.0],
        "kill_zone_box_engine": [3.2, 2.8, 0.9],
        "mesh_components": [extract_mesh_data(o, TRAP_POS) for o in trap_objs]
    },
    "district_power_switch": {
        "id": "district_master_power_switch",
        "name_ar": "قاطع الكهرباء الرئيسي للحي",
        "interaction_point": [0.0, 1.35, -0.4],
        "states": {
            "power_off": {"lever_angle_deg": 45.0, "voltmeter_active": False, "grid_online": False},
            "power_on": {"lever_angle_deg": -45.0, "voltmeter_active": True, "grid_online": True}
        },
        "mesh_components": [extract_mesh_data(o, POWER_POS) for o in power_objs]
    }
}

with open(os.path.join(DELIVERY_DIR, "gameplay-machines-v3.json"), "w", encoding="utf-8") as f:
    json.dump(machines_manifest, f, indent=2, ensure_ascii=False)

# 2. Power-Ups & Tacticals Manifest
pups_manifest = {
    "version": "3.0.0",
    "batch": "visual-remaster-v3",
    "coordinate_system": "Three.js Y-up (X=x, Y=z, Z=-y)",
    "materials_palette": materials_palette_v3,
    "powerups": [
        {
            "id": "max_ammo",
            "name_ar": "الذخيرة القصوى",
            "icon": "ammo_box",
            "voice_event": "VO_MAX_AMMO",
            "spin_speed_rad_sec": 1.5,
            "hover_amplitude_m": 0.08,
            "active_lifespan_sec": 30.0,
            "flashing_threshold_sec": 5.0,
            "mesh_components": [extract_mesh_data(o, AMMO_POS) for o in [o for o in powerup_objs if "MaxAmmo" in o.name]]
        },
        {
            "id": "insta_kill",
            "name_ar": "القتل الفوري",
            "icon": "skull_crossbones",
            "voice_event": "VO_INSTA_KILL",
            "spin_speed_rad_sec": 1.8,
            "duration_sec": 30.0,
            "mesh_components": [extract_mesh_data(o, INSTA_POS) for o in [o for o in powerup_objs if "InstaKill" in o.name]]
        },
        {
            "id": "double_points",
            "name_ar": "مضاعفة النقاط",
            "icon": "numeral_2x",
            "voice_event": "VO_DOUBLE_POINTS",
            "spin_speed_rad_sec": 2.0,
            "duration_sec": 30.0,
            "mesh_components": [extract_mesh_data(o, POINTS_POS) for o in [o for o in powerup_objs if "DoublePoints" in o.name]]
        },
        {
            "id": "nuke",
            "name_ar": "القنبلة الشاملة",
            "icon": "nuclear_radiation",
            "voice_event": "VO_NUKE",
            "reward_points": 400,
            "spin_speed_rad_sec": 1.2,
            "mesh_components": [extract_mesh_data(o, NUKE_POS) for o in [o for o in powerup_objs if "Nuke" in o.name]]
        },
        {
            "id": "carpenter",
            "name_ar": "النجار — ترميم الحواجز",
            "icon": "hammer_boards",
            "voice_event": "VO_CARPENTER",
            "reward_points": 200,
            "spin_speed_rad_sec": 1.5,
            "mesh_components": [extract_mesh_data(o, CARP_POS) for o in [o for o in powerup_objs if "Carpenter" in o.name]]
        }
    ],
    "tactical_weapons": {
        "frag_grenade": {
            "name_ar": "قنبلة يدوية شظوية",
            "fuse_time_sec": 3.5,
            "blast_radius_m": 6.5,
            "mesh_components": [extract_mesh_data(o, Vector((97.5, PUPS_Y, 1.15))) for o in [o for o in tactical_objs if "Frag" in o.name]]
        },
        "decoy_monkey": {
            "name_ar": "أداة التشتيت الموسيقية",
            "fuse_time_sec": 7.0,
            "attract_radius_m": 18.0,
            "cymbal_cycle_hz": 4.0,
            "mesh_components": [extract_mesh_data(o, DECOY_POS) for o in [o for o in tactical_objs if "Decoy" in o.name]]
        }
    },
    "shell_casings": {
        "pistol_9mm": {"mesh_components": [extract_mesh_data(o, Vector((101.2, PUPS_Y, 1.05))) for o in [o for o in casings_objs if "9mm" in o.name]]},
        "rifle_762": {"mesh_components": [extract_mesh_data(o, Vector((101.5, PUPS_Y, 1.07))) for o in [o for o in casings_objs if "762" in o.name]]},
        "shotgun_12ga": {"mesh_components": [extract_mesh_data(o, Vector((101.8, PUPS_Y, 1.04))) for o in [o for o in casings_objs if "Shotgun" in o.name]]}
    }
}

with open(os.path.join(DELIVERY_DIR, "powerups-and-tacticals-v3.json"), "w", encoding="utf-8") as f:
    json.dump(pups_manifest, f, indent=2, ensure_ascii=False)

# 3. UI Icons & HUD Specifications
ui_manifest = {
    "version": "3.0.0",
    "batch": "visual-remaster-v3",
    "hud_theme": {
        "font_family": "Cairo, sans-serif",
        "primary_color": "#ffbe3b",
        "danger_color": "#e81b23",
        "health_gradient": ["#e81b23", "#ffbe3b", "#00e676"],
        "hud_placement": {
            "round_counter": {"anchor": "bottom-left", "style": "blood_tally_marks_and_numeral"},
            "points_display": {"anchor": "top-right", "style": "gold_led_glow"},
            "perk_tray": {"anchor": "bottom-left-offset", "icon_size_px": 44, "spacing_px": 8},
            "ammo_counter": {"anchor": "bottom-right", "style": "tactical_magazine_and_reserve"}
        }
    },
    "crosshairs": {
        "standard_hipfire": {"color": "rgba(255,255,255,0.85)", "gap_px": 8, "length_px": 12, "expand_on_move": True},
        "hitmarker_body": {"color": "#ffffff", "shape": "diagonal_cross_x", "fade_duration_sec": 0.18},
        "hitmarker_headshot": {"color": "#e81b23", "shape": "bold_cross_x", "fade_duration_sec": 0.28}
    },
    "perk_icons_svg": {
        "vitality": "<svg viewBox='0 0 48 48'><circle cx='24' cy='24' r='22' fill='#750806'/><path d='M24 10 L34 16 L34 28 C34 35 24 40 24 40 C24 40 14 35 14 28 L14 16 Z' fill='#ffffff'/><path d='M21 22 H27 M24 19 V25' stroke='#750806' stroke-width='3'/></svg>",
        "haste": "<svg viewBox='0 0 48 48'><circle cx='24' cy='24' r='22' fill='#066515'/><polygon points='26,8 14,24 23,24 20,40 34,22 25,22' fill='#ffffff'/></svg>",
        "stamina": "<svg viewBox='0 0 48 48'><circle cx='24' cy='24' r='22' fill='#854005'/><path d='M16 14 C20 14 28 14 32 20 L30 26 L22 26 L18 34 H34' fill='none' stroke='#ffffff' stroke-width='4'/></svg>",
        "revive": "<svg viewBox='0 0 48 48'><circle cx='24' cy='24' r='22' fill='#055585'/><path d='M24 14 C20 10 14 12 14 18 C14 26 24 34 24 34 C24 34 34 26 34 18 C34 12 28 10 24 14 Z' fill='#ffffff'/><rect x='22' y='18' width='4' height='10' fill='#055585'/><rect x='19' y='21' width='10' height='4' fill='#055585'/></svg>"
    }
}

with open(os.path.join(DELIVERY_DIR, "ui-icons-and-hud-v3.json"), "w", encoding="utf-8") as f:
    json.dump(ui_manifest, f, indent=2, ensure_ascii=False)

print(">>> Saving updated .blend master file (ashfall-remaster-v3.blend)...")
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(DELIVERY_DIR, "ashfall-remaster-v3.blend"))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(DELIVERY_DIR, "ashfall-remaster-v2.blend"))

# ==============================================================================
# 5. RENDER SHOWCASE IMAGES FOR BATCH 3 (Precise Frontal Framing)
# ==============================================================================
print(">>> Setting up Showcase Cameras with Wide Frontal Views...")

def setup_camera(name, loc, target, lens=28):
    cam_data = bpy.data.cameras.get(name + "_cam") or bpy.data.cameras.new(name + "_cam")
    cam_data.lens = lens
    cam_obj = bpy.data.objects.get(name)
    if not cam_obj:
        cam_obj = bpy.data.objects.new(name, cam_data)
        col_batch3.objects.link(cam_obj)
    cam_obj.location = loc
    look_at(cam_obj, target)
    return cam_obj

# Camera 1: Gameplay Machines (Looking from -Y at Y = -7.2, framing Pack-a-punch, perks, mystery box, and trap)
cam_mach = setup_camera("CAM_Machines_Showcase", Vector((94.5, -7.5, 2.4)), Vector((94.5, 0.0, 1.25)), lens=24)

# Camera 2: Power-Ups & Tacticals (Looking from Y = PUPS_Y - 5.5, framing all 5 powerups, tacticals, and shells)
cam_pups = setup_camera("CAM_PowerUps_Showcase", Vector((94.5, PUPS_Y - 5.2, 2.2)), Vector((94.5, PUPS_Y, 1.15)), lens=25)

# Camera 3: Electric Trap (Close dramatic angle of high voltage pylons)
cam_trap = setup_camera("CAM_Trap_Showcase", Vector((101.2, -3.2, 2.6)), Vector((104.0, 0.0, 1.4)), lens=30)

# Studio Lights
l_mach = bpy.data.lights.new("Light_B3_Key", type='AREA')
l_mach.energy = 850
l_mach.size = 14.0
l_mach_obj = bpy.data.objects.new("Light_B3_Key_Obj", l_mach)
l_mach_obj.location = Vector((94.5, -4.5, 4.2))
look_at(l_mach_obj, Vector((94.5, 0.0, 1.2)))
col_batch3.objects.link(l_mach_obj)

l_pups = bpy.data.lights.new("Light_Pups_Key", type='AREA')
l_pups.energy = 750
l_pups.size = 10.0
l_pups_obj = bpy.data.objects.new("Light_Pups_Key_Obj", l_pups)
l_pups_obj.location = Vector((94.5, PUPS_Y - 3.2, 3.8))
look_at(l_pups_obj, Vector((94.5, PUPS_Y, 1.15)))
col_batch3.objects.link(l_pups_obj)

bpy.context.scene.render.resolution_x = 1280
bpy.context.scene.render.resolution_y = 720
bpy.context.scene.render.film_transparent = False

# Render 1: Gameplay Machines
bpy.context.scene.camera = cam_mach
bpy.context.scene.render.filepath = os.path.join(DELIVERY_DIR, "gameplay-machines-showcase-v3.png")
bpy.ops.render.render(write_still=True)

# Render 2: Power-Ups & Tacticals
bpy.context.scene.camera = cam_pups
bpy.context.scene.render.filepath = os.path.join(DELIVERY_DIR, "powerups-and-tacticals-showcase-v3.png")
bpy.ops.render.render(write_still=True)

# Render 3: Trap & Power Switch Atmosphere
bpy.context.scene.camera = cam_trap
bpy.context.scene.render.filepath = os.path.join(DELIVERY_DIR, "lighting-and-vfx-showcase-v3.png")
bpy.ops.render.render(write_still=True)

print(">>> ALL BATCH 3 ASSETS, EXPORTS, AND SHOWCASES COMPLETED PERFECTLY!")
