extends Node2D
## A single data-driven obstacle. Origin is the bottom-centre of the sprite
## (its "feet"), which keeps y-sorting and hitboxes consistent.

const SCALE := 2.0

var id := ""
var def: Dictionary
var kind := "solid"
var tall := false
var vel := Vector2.ZERO
var passed := false
var consumed := false
var hit_size := Vector2(16, 8)
var sprite: Sprite2D
var _t := 0.0

func setup(p_id: String, p_def: Dictionary, rng: RandomNumberGenerator) -> void:
	id = p_id
	def = p_def
	kind = def.get("kind", "solid")
	tall = def.get("tall", false)
	var h: Array = def.get("hit", [16, 8])
	hit_size = Vector2(h[0], h[1])
	if sprite == null:
		sprite = Sprite2D.new()
		sprite.centered = false
		sprite.scale = Vector2(SCALE, SCALE)
		add_child(sprite)
	_set_texture(Art.tex(def["sprite"]))
	if def.get("flat", false):
		z_index = -5
	if def.has("speed"):
		var sp: Array = def["speed"]
		var dir := -1.0 if rng.randf() < 0.5 else 1.0
		vel.x = rng.randf_range(sp[0], sp[1]) * dir
		sprite.flip_h = dir > 0.0 and id == "moose" # moose art faces left
		if id != "moose":
			sprite.flip_h = dir < 0.0
	if def.has("label"):
		var l := Label.new()
		l.text = def["label"]
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		l.add_theme_font_size_override("font_size", 7)
		l.add_theme_color_override("font_color", Color8(26, 28, 44))
		l.add_theme_constant_override("line_spacing", -3)
		l.size = Vector2(56, 24)
		l.position = Vector2(-28, -40)
		add_child(l)
	_t = rng.randf() * TAU

func _set_texture(t: Texture2D) -> void:
	sprite.texture = t
	var ts := t.get_size() * SCALE
	sprite.position = Vector2(-ts.x * 0.5, -ts.y)

func get_hitbox() -> Rect2:
	return Rect2(position.x - hit_size.x * 0.5, position.y - hit_size.y, hit_size.x, hit_size.y)

func _process(delta: float) -> void:
	_t += delta
	if vel != Vector2.ZERO:
		position += vel * delta
	if kind == "token" and not consumed:
		sprite.position.y = -16.0 - 3.0 - sin(_t * 4.0) * 3.0
	if id == "drone":
		sprite.position.y = -sprite.texture.get_height() * SCALE - 18.0 - sin(_t * 3.0) * 4.0

## The Developer bulldozes this obstacle into something worse.
func raze() -> void:
	if consumed or not def.has("raze"):
		return
	var Obs = preload("res://scripts/data/obstacles.gd")
	var nid: String = def["raze"]
	def = Obs.DEFS[nid]
	id = nid
	kind = def.get("kind", "solid")
	tall = def.get("tall", false)
	var h: Array = def.get("hit", [16, 8])
	hit_size = Vector2(h[0], h[1])
	_set_texture(Art.tex(def["sprite"]))
	var tw := create_tween()
	sprite.modulate = Color(1, 0.6, 0.4)
	tw.tween_property(sprite, "modulate", Color.WHITE, 0.4)

func wobble() -> void:
	var tw := create_tween()
	tw.tween_property(sprite, "rotation", 0.2, 0.05)
	tw.tween_property(sprite, "rotation", -0.15, 0.08)
	tw.tween_property(sprite, "rotation", 0.0, 0.08)

func collect() -> void:
	consumed = true
	var tw := create_tween().set_parallel(true)
	tw.tween_property(sprite, "scale", Vector2(SCALE * 1.8, SCALE * 1.8), 0.25)
	tw.tween_property(sprite, "modulate:a", 0.0, 0.25)

func open_gate() -> void:
	consumed = true
	if id == "toll_arm":
		_set_texture(Art.tex("toll_arm_up"))
	elif id == "paywall_gate":
		_set_texture(Art.tex("paywall_open"))

func scare(from_x: float) -> void:
	if id == "moose":
		vel.x = 160.0 * (1.0 if position.x > from_x else -1.0)
		sprite.flip_h = vel.x > 0.0
