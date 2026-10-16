import bpy
import bmesh
import json
import os
from mathutils import Vector

print(">>> Updating Batch 2 JSON exports with materials palette and local origins...")

DELIVERY_DIR = r"C:\Users\xxtro\Documents\Codex\2026-10-16\new-chat\outputs\blender-delivery"

def to_engine_coords(v):
    # Blender Z-up (x, y, z) -> Three.js Y-up (x, z, -y)
    return [round(v[0], 5), round(v[2], 5), round(-v[1], 5)]

materials_palette = {
    "Ashfall | Parkerized Gun Steel": {
        "base_color": [0.07, 0.07, 0.08, 1.0],
        "metallic": 0.88,
        "roughness": 0.28,
        "emission": [0.0, 0.0, 0.0, 1.0],
        "emission_strength": 0.0
    },
    "Ashfall | Gun Polymer Grip": {
        "base_color": [0.04, 0.04, 0.045, 1.0],
        "metallic": 0.05,
        "roughness": 0.65,
        "emission": [0.0, 0.0, 0.0, 1.0],
        "emission_strength": 0.0
    },
    "Ashfall | Treated Walnut Wood": {
        "base_color": [0.24, 0.11, 0.04, 1.0],
        "metallic": 0.0,
        "roughness": 0.35,
        "emission": [0.0, 0.0, 0.0, 1.0],
        "emission_strength": 0.0
    },
    "Ashfall | Tactical Glove": {
        "base_color": [0.06, 0.07, 0.05, 1.0],
        "metallic": 0.1,
        "roughness": 0.7,
        "emission": [0.0, 0.0, 0.0, 1.0],
        "emission_strength": 0.0
    },
    "Ashfall | Tactical Sleeve": {
        "base_color": [0.12, 0.14, 0.10, 1.0],
        "metallic": 0.0,
        "roughness": 0.85,
        "emission": [0.0, 0.0, 0.0, 1.0],
        "emission_strength": 0.0
    },
    "Ashfall | Pack-A-Punch Plasma Cyan": {
        "base_color": [0.05, 0.45, 0.65, 1.0],
        "metallic": 0.92,
        "roughness": 0.15,
        "emission": [0.1, 0.85, 1.0, 1.0],
        "emission_strength": 5.0
    },
    "Ashfall | Pack-A-Punch Thermal Amber": {
        "base_color": [0.65, 0.25, 0.02, 1.0],
        "metallic": 0.92,
        "roughness": 0.15,
        "emission": [1.0, 0.45, 0.05, 1.0],
        "emission_strength": 5.0
    },
    "Ashfall | Weathered Sandstone": {
        "base_color": [0.42, 0.36, 0.28, 1.0],
        "metallic": 0.02,
        "roughness": 0.9,
        "emission": [0.0, 0.0, 0.0, 1.0],
        "emission_strength": 0.0
    },
    "Ashfall | Luminous Chalk Trace": {
        "base_color": [0.98, 0.96, 0.90, 1.0],
        "metallic": 0.0,
        "roughness": 0.95,
        "emission": [1.0, 0.98, 0.88, 1.0],
        "emission_strength": 2.2
    },
    "Ashfall | Price Tag Slate": {
        "base_color": [0.03, 0.03, 0.035, 1.0],
        "metallic": 0.7,
        "roughness": 0.4,
        "emission": [1.0, 0.7, 0.1, 1.0],
        "emission_strength": 1.5
    },
    "Ashfall | Weathered Wood Plank": {
        "base_color": [0.22, 0.16, 0.11, 1.0],
        "metallic": 0.0,
        "roughness": 0.88,
        "emission": [0.0, 0.0, 0.0, 1.0],
        "emission_strength": 0.0
    },
    "Ashfall | Rusty Iron Nails": {
        "base_color": [0.18, 0.12, 0.09, 1.0],
        "metallic": 0.75,
        "roughness": 0.7,
        "emission": [0.0, 0.0, 0.0, 1.0],
        "emission_strength": 0.0
    }
}

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

ARMORY_POS = Vector((85.0, 0.0, 0.0))
P1911_POS = ARMORY_POS + Vector((0.0, -1.6, 0.12))
RAAD_POS = ARMORY_POS + Vector((0.0, -0.8, 0.12))
NIMER_POS = ARMORY_POS + Vector((0.0, 0.0, 0.12))
NIMER_UPG_POS = ARMORY_POS + Vector((0.0, 0.85, 0.12))
RAAD_UPG_POS = ARMORY_POS + Vector((0.0, 1.7, 0.12))

col_batch2 = bpy.data.collections.get("08 | ASHFALL REMASTER BATCH 2")

def get_objs_starting_with(prefix):
    return [o for o in col_batch2.objects if o.name.startswith(prefix)]

p1911_objs = get_objs_starting_with("WPN_P1911_")
nimer_objs = get_objs_starting_with("WPN_Nimer47_")
# filter out upg
nimer_std_objs = [o for o in nimer_objs if "Upg" not in o.name]
nimer_upg_objs = get_objs_starting_with("WPN_Nimer47_Upg_")

raad_objs = get_objs_starting_with("WPN_Raad12_")
raad_std_objs = [o for o in raad_objs if "Upg" not in o.name]
raad_upg_objs = get_objs_starting_with("WPN_Raad12_Upg_")

weapons_data = {
    "version": "2.0.0",
    "batch": "visual-remaster-v2",
    "coordinate_system": "Three.js Y-up (X=x, Y=z, Z=-y)",
    "local_origin_note": "All weapon meshes have their origin [0,0,0] centered at the grip/action point in local engine space.",
    "materials_palette": materials_palette,
    "weapons": {
        "pistol_1911": {
            "name_ar": "مسدس 1911",
            "type": "semi_pistol",
            "mag_capacity": 7,
            "sockets": {
                "muzzle_point": [0.0, 0.045, -0.12],
                "ejection_port": [0.02, 0.045, -0.02],
                "iron_sights": [0.0, 0.075, -0.10],
                "mag_well": [0.0, -0.12, 0.06]
            },
            "mesh_components": [extract_mesh_data(o, P1911_POS) for o in p1911_objs]
        },
        "nimer_47": {
            "name_ar": "بندقية نمر 47",
            "type": "assault_rifle",
            "fire_rate_rpm": 600,
            "mag_capacity": 30,
            "sockets": {
                "muzzle_point": [0.0, 0.035, -0.54],
                "ejection_port": [0.026, 0.045, -0.05],
                "iron_sight_rear": [0.0, 0.098, -0.10],
                "iron_sight_front": [0.0, 0.115, -0.46],
                "mag_well": [0.0, -0.04, -0.08],
                "charging_handle": [0.035, 0.05, -0.03],
                "left_hand_grip": [0.0, 0.02, -0.22],
                "right_hand_grip": [0.0, -0.075, 0.10]
            },
            "mesh_components": [extract_mesh_data(o, NIMER_POS) for o in nimer_std_objs]
        },
        "raad_12": {
            "name_ar": "خرطوش رعد 12",
            "type": "pump_shotgun",
            "mag_capacity": 6,
            "pump_cycle_sec": 0.65,
            "sockets": {
                "muzzle_point": [0.0, 0.058, -0.59],
                "ejection_port": [0.028, 0.048, -0.02],
                "pump_slide": [0.0, 0.02, -0.25],
                "pump_slide_back": [0.0, 0.02, -0.15],
                "loading_gate": [0.0, 0.01, 0.02],
                "iron_sights": [0.0, 0.082, -0.58],
                "left_hand_grip": [0.0, 0.02, -0.25],
                "right_hand_grip": [0.0, -0.06, 0.09]
            },
            "mesh_components": [extract_mesh_data(o, RAAD_POS) for o in raad_std_objs]
        },
        "nimer_47_upgraded": {
            "name_ar": "نمر 47 المطورة — صائد الرماد",
            "type": "assault_rifle_upgraded",
            "mag_capacity": 60,
            "plasma_emission": True,
            "sockets": {
                "muzzle_point": [0.0, 0.035, -0.56],
                "ejection_port": [0.028, 0.045, -0.05]
            },
            "mesh_components": [extract_mesh_data(o, NIMER_UPG_POS) for o in nimer_upg_objs]
        },
        "raad_12_upgraded": {
            "name_ar": "رعد 12 المطورة — قاصف البرق",
            "type": "shotgun_upgraded",
            "mag_capacity": 10,
            "thermal_emission": True,
            "sockets": {
                "muzzle_point": [0.0, 0.058, -0.62],
                "ejection_port": [0.03, 0.048, -0.02]
            },
            "mesh_components": [extract_mesh_data(o, RAAD_UPG_POS) for o in raad_upg_objs]
        }
    }
}

with open(os.path.join(DELIVERY_DIR, "weapons-pack-v2.json"), "w", encoding="utf-8") as f:
    json.dump(weapons_data, f, indent=2, ensure_ascii=False)

# Update Wallbuys with materials palette and local origins
WALL_Y = 50.0
wb_1911_objs = get_objs_starting_with("WB_1911_")
wb_raad_objs = get_objs_starting_with("WB_Raad12_")
wb_nimer_objs = get_objs_starting_with("WB_Nimer47_")

wallbuys_data = {
    "version": "2.0.0",
    "batch": "visual-remaster-v2",
    "materials_palette": materials_palette,
    "local_origin_note": "Each wallbuy mesh is centered at [0,0,0] with mounting surface on the Z=0 plane.",
    "wallbuys": [
        {
            "id": "wallbuy_1911",
            "weapon_key": "pistol_1911",
            "weapon_name_ar": "مسدس 1911",
            "price_buy": 500,
            "price_ammo": 250,
            "world_mount_dims": [2.2, 1.5, 0.08],
            "price_display_center": [0.0, 0.55, 0.04],
            "mesh_components": [extract_mesh_data(o, Vector((66.2, WALL_Y, 1.1))) for o in wb_1911_objs]
        },
        {
            "id": "wallbuy_raad12",
            "weapon_key": "raad_12",
            "weapon_name_ar": "خرطوش رعد 12",
            "price_buy": 1200,
            "price_ammo": 600,
            "world_mount_dims": [2.6, 1.5, 0.08],
            "price_display_center": [0.0, 0.55, 0.04],
            "mesh_components": [extract_mesh_data(o, Vector((70.0, WALL_Y, 1.1))) for o in wb_raad_objs]
        },
        {
            "id": "wallbuy_nimer47",
            "weapon_key": "nimer_47",
            "weapon_name_ar": "بندقية نمر 47",
            "price_buy": 1500,
            "price_ammo": 750,
            "world_mount_dims": [2.8, 1.5, 0.08],
            "price_display_center": [0.0, 0.55, 0.04],
            "mesh_components": [extract_mesh_data(o, Vector((73.8, WALL_Y, 1.1))) for o in wb_nimer_objs]
        }
    ]
}

with open(os.path.join(DELIVERY_DIR, "wallbuys-and-props-v2.json"), "w", encoding="utf-8") as f:
    json.dump(wallbuys_data, f, indent=2, ensure_ascii=False)

# Update Upper floor with materials palette
env_objs = get_objs_starting_with("ENV_")
UPPER_FLOOR_Z = 3.80
ENV_POS = Vector((0.0, -3.0, 0.0))
DEBRIS_POS = ENV_POS + Vector((0.0, -1.8, 0.42))

upper_data = {
    "version": "2.0.0",
    "batch": "visual-remaster-v2",
    "materials_palette": materials_palette,
    "elevation_data": {
        "ground_level_y": 0.42,
        "upper_floor_level_y": 3.80,
        "drop_height_delta": 3.38
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
        { "id": "parapet_west", "box": [-5.8, 0.5, round(UPPER_FLOOR_Z + 0.55, 3), 0.28, 6.6, 1.1] },
        { "id": "parapet_north", "box": [-1.5, 3.7, round(UPPER_FLOOR_Z + 0.55, 3), 8.8, 0.28, 1.1] },
        { "id": "parapet_south", "box": [-1.5, -2.7, round(UPPER_FLOOR_Z + 0.55, 3), 8.8, 0.28, 1.1] }
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
    "mesh_components": [extract_mesh_data(o) for o in env_objs]
}

with open(os.path.join(DELIVERY_DIR, "upper-floor-architecture-v2.json"), "w", encoding="utf-8") as f:
    json.dump(upper_data, f, indent=2, ensure_ascii=False)

print(">>> ALL JSON EXPORTS UPDATED WITH MATERIALS PALETTE & ZERO-ORIGIN LOCAL VECTORS!")
