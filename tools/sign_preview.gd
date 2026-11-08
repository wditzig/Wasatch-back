extends Node2D
## Lays out every sign obstacle for a visual check of the text centring.
## Run: godot res://tools/sign_preview.tscn
const Obs = preload("res://scripts/data/obstacles.gd")
const ObstacleScript = preload("res://scripts/game/obstacle.gd")

func _ready() -> void:
	RenderingServer.set_default_clear_color(Color(0.95, 0.97, 1.0))
	var rng := RandomNumberGenerator.new()
	var i := 0
	for id in Obs.DEFS.keys():
		if not Obs.DEFS[id].has("label"):
			continue
		var o := ObstacleScript.new()
		o.position = Vector2(60 + (i % 2) * 120, 90 + (i / 2) * 80)
		add_child(o)
		o.setup(id, Obs.DEFS[id], rng)
		i += 1
	var cam := Camera2D.new()
	cam.zoom = Vector2(2, 2)
	cam.position = Vector2(120, 190)
	add_child(cam)
