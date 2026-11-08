extends Node
## Generates a fixed-seed corridor of terrain and prints obstacle counts per
## phase plus a hash of every (id, position). Used to prove that visual
## changes don't alter obstacle placement or density.
## Run: godot --headless res://tools/terrain_fingerprint.tscn

const SpawnerScript = preload("res://scripts/game/spawner.gd")
const Zones = preload("res://scripts/data/zones.gd")

func _ready() -> void:
	var world := Node2D.new()
	add_child(world)
	var sp = SpawnerScript.new()
	add_child(sp)
	sp.setup(world, 12345)
	var log := PackedStringArray()
	var per_zone := [0, 0, 0, 0, 0]
	var seen := {}
	var y := 0.0
	while y < 70000.0:
		sp.update_view(Rect2(-180, y, 360, 640), clampf(y / 16.0 / 4500.0, 0.0, 1.0))
		for o in sp.active:
			var k := "%s@%d,%d" % [o.id, int(o.position.x), int(o.position.y)]
			if not seen.has(k):
				seen[k] = true
				log.append(k)
				per_zone[Zones.index_for_distance(o.position.y / 16.0)] += 1
		y += 200.0
	print("TERRAIN obstacles=%d per_zone=%s hash=%s" % [log.size(), str(per_zone), "\n".join(log).md5_text()])
	get_tree().quit()
