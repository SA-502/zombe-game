import bpy
import bmesh
import json
import os
import math
from mathutils import Vector, Euler, Matrix

print(">>> Fixing Upper Floor Architecture & Stairwell Cutout according to Feedback...")

DELIVERY_DIR = r"C:\Users\xxtro\Documents\Codex\2026-10-16\new-chat\outputs\blender-delivery"

def to_engine_coords(v):
    # Blender Z-up (x, y, z) -> Three.js Y-up (x, z, -y)
    return [round(v[0], 5), round(v[2], 5), round(-v[1], 5)]

def look_at(obj, target):
    direction = target - obj.location
    rot_quat = direction.to_track_quat('-Z', 'Y')
    obj.rotation_euler = rot_quat.to_euler()

col_batch2 = bpy.data.collections.get("08 | ASHFALL REMASTER BATCH 2")
if not col_batch2:
    col_batch2 = bpy.data.collections.new("08 | ASHFALL REMASTER BATCH 2")
    bpy.context.scene.collection.children.link(col_batch2)

# Remove old ENV_ objects to regenerate cleanly
for obj in list(col_batch2.objects):
    if obj.name.startswith("ENV_"):
        bpy.data.objects.remove(obj, do_unlink=True)

mat_stone_wall = bpy.data.materials.get("Ashfall | Weathered Sandstone")
mat_gun_steel = bpy.data.materials.get("Ashfall | Parkerized Gun Steel")
mat_pap_amber = bpy.data.materials.get("Ashfall | Pack-A-Punch Thermal Amber")
mat_barricade_wood = bpy.data.materials.get("Ashfall | Weathered Wood Plank")
mat_rusty_iron = bpy.data.materials.get("Ashfall | Rusty Iron Nails")

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

def create_cylinder(name, center, radius, depth, axis='Y', segments=12, mat=None, collection=col_batch2):
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
# REBUILD UPPER FLOOR ARCHITECTURE WITH STAIRWELL CUTOUT & REFINED PARAPETS
# ==============================================================================
ENV_POS = Vector((0.0, -3.0, 0.0))
UPPER_FLOOR_Z = 3.80 # Top of slab elevation
SLAB_THICKNESS = 0.28
env_objects = []

# 1. 14-step Concrete / Sandstone Staircase
STAIR_START = ENV_POS + Vector((-5.2, -4.2, 0.42))
for step_idx in range(14):
    h = 0.241
    cur_z = 0.42 + (step_idx + 0.5) * h
    cur_y = STAIR_START.y + step_idx * 0.28 # climbs towards -0.28
    step_obj = create_box(f"ENV_Stair_Tread_{step_idx:02d}", Vector((STAIR_START.x, cur_y, cur_z)), (1.35, 0.32, h), mat_stone_wall)
    env_objects.append(step_obj)

# Metal Handrail along the outer right edge of the staircase
env_objects.append(create_cylinder("ENV_Stair_Handrail", Vector((STAIR_START.x + 0.65, STAIR_START.y + 1.9, 2.85)), radius=0.03, depth=4.6, axis='Y', segments=8, mat=mat_gun_steel))

# 2. Upper Floor Slabs WITH OPEN STAIRWELL VOID
# The stairs arrive from Y = -4.2 to -0.3 at X = -5.2.
# So we leave X = -5.9 to -4.4 OPEN between Y = -4.5 and -0.3 (Stairwell Void)!
# Main deck covers X = -4.4 to +2.9, Y = -2.7 to +3.7 (width: 7.3m, depth: 6.4m)
env_objects.append(create_box("ENV_Upper_Floor_MainDeck", Vector((-0.75, 0.5 - 3.0, UPPER_FLOOR_Z - SLAB_THICKNESS/2)), (7.3, 6.4, SLAB_THICKNESS), mat_stone_wall))

# North landing connects the top of the stairs into the gallery (X = -5.8 to -4.4, Y = -0.3 to +3.7)
# Center: X = -5.1, Y = 1.7 - 3.0 = -1.3, size: (1.4, 4.0, 0.28)
env_objects.append(create_box("ENV_Upper_Floor_NorthLanding", Vector((-5.1, -1.3, UPPER_FLOOR_Z - SLAB_THICKNESS/2)), (1.4, 4.0, SLAB_THICKNESS), mat_stone_wall))

# 3. Defensive Parapet Half-Walls
# West Parapet (along west edge of north landing from Y = -0.3 to +3.7, length 4.0m)
env_objects.append(create_box("ENV_Upper_Parapet_West", Vector((-5.8, -1.3, UPPER_FLOOR_Z + 0.55)), (0.28, 4.0, 1.1), mat_stone_wall))

# North Parapet (along full north edge from X = -5.8 to +2.9, length 8.7m)
env_objects.append(create_box("ENV_Upper_Parapet_North", Vector((-1.45, 0.7, UPPER_FLOOR_Z + 0.55)), (8.7, 0.28, 1.1), mat_stone_wall))

# South Parapet: DOES NOT BLOCK THE STAIRS! Only spans from X = -4.4 to +2.9 (length 7.3m)
env_objects.append(create_box("ENV_Upper_Parapet_South", Vector((-0.75, -5.7, UPPER_FLOOR_Z + 0.55)), (7.3, 0.28, 1.1), mat_stone_wall))

# East Parapet with 1.8m Tactical Escape Breach in center
env_objects.append(create_box("ENV_Upper_Parapet_East_A", Vector((2.8, -0.8, UPPER_FLOOR_Z + 0.55)), (0.28, 2.3, 1.1), mat_stone_wall))
env_objects.append(create_box("ENV_Upper_Parapet_East_B", Vector((2.8, -4.2, UPPER_FLOOR_Z + 0.55)), (0.28, 2.3, 1.1), mat_stone_wall))

# Tactical Escape Ledge (Breach point leading to courtyard)
env_objects.append(create_box("ENV_Tactical_Escape_Ledge", Vector((2.8, -2.5, UPPER_FLOOR_Z + 0.05)), (0.55, 1.8, 0.12), mat_pap_amber))

# 4. Multi-Stage Window Barricades
BARRICADE_POS = Vector((-5.8, -1.3, UPPER_FLOOR_Z + 0.8))
for p_idx in range(5):
    p_z = BARRICADE_POS.z - 0.4 + p_idx * 0.20
    plank = create_box(f"ENV_Window_Plank_{p_idx+1}", Vector((BARRICADE_POS.x + 0.04, BARRICADE_POS.y, p_z)), (0.04, 1.45, 0.16), mat_barricade_wood)
    nail_l = create_cylinder(f"ENV_Plank_{p_idx+1}_Nail_L", Vector((BARRICADE_POS.x + 0.07, BARRICADE_POS.y - 0.6, p_z)), radius=0.012, depth=0.06, axis='X', segments=6, mat=mat_rusty_iron)
    nail_r = create_cylinder(f"ENV_Plank_{p_idx+1}_Nail_R", Vector((BARRICADE_POS.x + 0.07, BARRICADE_POS.y + 0.6, p_z)), radius=0.012, depth=0.06, axis='X', segments=6, mat=mat_rusty_iron)
    env_objects.extend([plank, nail_l, nail_r])

# 5. Buyable Debris Barrier ($750)
DEBRIS_POS = ENV_POS + Vector((0.0, -1.8, 0.42))
env_objects.append(create_box("ENV_Debris_Rubble_Core", DEBRIS_POS + Vector((0.0, 0.0, 0.45)), (2.4, 0.85, 0.9), mat_stone_wall))
env_objects.append(create_box("ENV_Debris_Timber_1", DEBRIS_POS + Vector((0.2, -0.1, 0.65)), (2.1, 0.22, 0.22), mat_barricade_wood))
env_objects.append(create_box("ENV_Debris_Metal_Rebar", DEBRIS_POS + Vector((-0.3, 0.1, 0.75)), (0.04, 1.2, 0.9), mat_gun_steel))
env_objects.append(create_box("ENV_Debris_Padlock_Chain", DEBRIS_POS + Vector((0.0, -0.42, 0.55)), (0.35, 0.05, 0.35), mat_rusty_iron))

# ==============================================================================
# EXPORT STANDALONE PRECISE DATA FOR CODE AGENT
# ==============================================================================
materials_palette = {
    "Ashfall | Weathered Sandstone": {"base_color": [0.42, 0.36, 0.28, 1.0], "metallic": 0.02, "roughness": 0.9, "emission": [0,0,0,1], "emission_strength": 0.0},
    "Ashfall | Parkerized Gun Steel": {"base_color": [0.07, 0.07, 0.08, 1.0], "metallic": 0.88, "roughness": 0.28, "emission": [0,0,0,1], "emission_strength": 0.0},
    "Ashfall | Pack-A-Punch Thermal Amber": {"base_color": [0.65, 0.25, 0.02, 1.0], "metallic": 0.92, "roughness": 0.15, "emission": [1.0, 0.45, 0.05, 1.0], "emission_strength": 5.0},
    "Ashfall | Weathered Wood Plank": {"base_color": [0.22, 0.16, 0.11, 1.0], "metallic": 0.0, "roughness": 0.88, "emission": [0,0,0,1], "emission_strength": 0.0},
    "Ashfall | Rusty Iron Nails": {"base_color": [0.18, 0.12, 0.09, 1.0], "metallic": 0.75, "roughness": 0.7, "emission": [0,0,0,1], "emission_strength": 0.0}
}

# Converting into Three.js Y-up Engine Coordinates: X=x, Y=z, Z=-y
upper_arch_data = {
    "version": "2.1.0",
    "batch": "visual-remaster-v2",
    "notes": "Architectural fix applied: stairwell cutout open, south parapet stairs arrival unblocked, collision boxes in min/max format, walkable surfaces include stairs flight.",
    "materials_palette": materials_palette,
    "elevation_data": {
        "ground_level_y": 0.42,
        "upper_floor_level_y": 3.80,
        "stair_riser_height": 0.241,
        "headroom_clearance_m": 3.38
    },
    "stairwell_void": {
        "description": "Area open to the sky above stairs to provide full headroom clearance",
        "min": [-5.9, 0.42, 0.3],
        "max": [-4.4, 6.0, 4.5]
    },
    "walkable_surfaces": [
        {
            "id": "upper_floor_main_deck",
            "min": [-4.4, 3.80, -0.7],
            "max": [2.9, 3.80, 5.7]
        },
        {
            "id": "upper_floor_north_landing",
            "min": [-5.8, 3.80, -0.7],
            "max": [-4.4, 3.80, 3.3]
        },
        {
            "id": "stairs_flight_slope",
            "bottom": [-5.2, 0.42, 4.2],
            "top": [-5.2, 3.80, 0.3],
            "tread_width": 1.35
        },
        {
            "id": "tactical_escape_balcony",
            "min": [2.5, 3.80, 1.6],
            "max": [3.1, 3.80, 3.4],
            "jump_down_target_courtyard": [4.2, 0.42, 2.5]
        }
    ],
    "navigation_links": [
        {
            "id": "nav_link_stairs_ground_to_upper",
            "from": [-5.2, 0.42, 4.2],
            "to": [-5.2, 3.80, 0.3],
            "bidirectional": True,
            "type": "stairs_walk"
        },
        {
            "id": "nav_link_tactical_drop_to_courtyard",
            "from": [2.8, 3.80, 2.5],
            "to": [4.2, 0.42, 2.5],
            "bidirectional": False,
            "type": "jump_down_escape"
        }
    ],
    "collision_boxes": [
        {
            "id": "parapet_west",
            "min": [-5.94, 3.80, -0.7],
            "max": [-5.66, 4.90, 3.3]
        },
        {
            "id": "parapet_north",
            "min": [-5.94, 3.80, -0.84],
            "max": [2.94, 4.90, -0.56]
        },
        {
            "id": "parapet_south",
            "min": [-4.40, 3.80, 5.56],
            "max": [2.94, 4.90, 5.84]
        },
        {
            "id": "parapet_east_north",
            "min": [2.66, 3.80, -0.7],
            "max": [2.94, 4.90, 1.6]
        },
        {
            "id": "parapet_east_south",
            "min": [2.66, 3.80, 3.4],
            "max": [2.94, 4.90, 5.7]
        }
    ],
    "window_barricade": {
        "id": "window_barricade_upper_west",
        "total_planks": 5,
        "repair_points_per_plank": 10,
        "stages": {"broken": 0, "critical": 1, "damaged": 2, "reinforced": 4, "intact": 5}
    },
    "debris_barrier": {
        "id": "debris_barrier_house_doorway",
        "clear_cost": 750,
        "center_engine": to_engine_coords(DEBRIS_POS),
        "collision_box_engine": [2.4, 0.9, 0.85]
    },
    "mesh_components": [extract_mesh_data(o) for o in env_objects]
}

# Write atomic temporary file then replace to trigger preview server cleanly
tmp_path = os.path.join(DELIVERY_DIR, "upper-floor-architecture-v2.json.tmp")
final_path = os.path.join(DELIVERY_DIR, "upper-floor-architecture-v2.json")
with open(tmp_path, "w", encoding="utf-8") as f:
    json.dump(upper_arch_data, f, indent=2, ensure_ascii=False)
os.replace(tmp_path, final_path)

# Also update .blend files
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(DELIVERY_DIR, "ashfall-remaster-v3.blend"))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(DELIVERY_DIR, "ashfall-remaster-v2.blend"))

print(">>> UPPER FLOOR ARCHITECTURAL FIXES SAVED & EXPORTED ATOMICALLY!")
