extends Node2D
## Shows every pose of every rider (with the current outfit) for art review.
## Run: godot res://tools/rider_preview.tscn
const Riders = preload("res://scripts/data/riders.gd")
const POSES := ["down", "diag", "side", "air", "grab", "tuck", "push", "crash", "getup"]

func _ready() -> void:
	RenderingServer.set_default_clear_color(Color(0.95, 0.97, 1.0))
	var y := 10.0
	for rid in Riders.RIDERS.keys():
		var l := Label.new()
		l.text = Riders.RIDERS[rid]["name"]
		l.add_theme_color_override("font_color", Color8(26, 28, 44))
		l.position = Vector2(4, y)
		add_child(l)
		var x := 60.0
		for p in POSES:
			var s := Sprite2D.new()
			s.texture = Art.tex(String(Riders.RIDERS[rid]["sprite"]) + "_" + p, Riders.OUTFITS[0])
			s.centered = false
			s.scale = Vector2(3, 3)
			s.position = Vector2(x, y)
			add_child(s)
			x += s.texture.get_width() * 3 + 8
		y += 66.0
