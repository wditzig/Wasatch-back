extends Node2D
## Non-colliding environmental storytelling layer.
##
## Ground details (tracks, drifts, mud, cables, QR codes...) are generated per
## cell from their OWN random stream, so the obstacle generator in spawner.gd
## is untouched. Detail density rises with each phase: the mountain starts
## quiet and gets cluttered as it is developed. Everything here is drawn flat
## and muted, below obstacles, and never affects gameplay.
## Also draws painted property lines at phase boundaries and overhead
## flyovers (birds -> helicopters -> drones -> a corporate blimp).

const Zones = preload("res://scripts/data/zones.gd")

const CELL := 120.0
const PX_PER_M := 16.0
const SCALE := 2.0
const SALT := 7919

## Per phase: [sprite, weight, alpha]. Kept low-contrast on purpose.
const DECOR := [
	[["d_drift", 4, 0.9], ["d_sage", 3, 1.0], ["d_rabbit", 2.5, 0.85], ["d_deer", 2, 0.85],
		["d_needles", 2, 0.8], ["d_cone_pine", 1, 1.0], ["d_sparkle", 4, 1.0]],
	[["d_treads", 4, 0.75], ["d_mud", 3, 0.75], ["d_paint_x", 2, 0.6], ["d_boots", 3, 0.75],
		["d_drift", 1.5, 0.9], ["d_sage", 1, 0.9], ["d_sparkle", 1, 1.0]],
	[["d_corduroy", 4, 0.6], ["d_heated", 1.5, 0.45], ["d_cart", 3, 0.75], ["d_receipt", 2, 0.9],
		["d_valet", 1.5, 0.35], ["d_treads", 1, 0.6]],
	[["d_cable", 4, 0.85], ["d_slush", 3, 0.75], ["d_crack", 3, 0.7], ["d_vent", 2, 1.0],
		["d_treads", 2, 0.6], ["d_receipt", 1, 0.8]],
	[["d_qr", 2.5, 0.28], ["d_dollar", 2, 0.35], ["d_ad", 2, 0.4], ["d_cable", 2, 0.75],
		["d_receipt", 3, 0.9], ["d_slush", 2, 0.75], ["d_corduroy", 1, 0.5]],
]
const DENSITY := [0.10, 0.22, 0.30, 0.38, 0.48]

## Painted across the slope. Each phase boundary carries that phase's slogan;
## the last line sits deep in the final phase, where few riders reach.
const LINES := [
	{"m": 600, "text": "SURVEY LINE  -  PUBLIC ACCESS SUBJECT TO CHANGE.", "color": Color8(240, 138, 36)},
	{"m": 1400, "text": "LOFTSIDE ESTATES  -  YOUR MOUNTAIN. THEIR INVESTMENT.", "color": Color8(200, 148, 32)},
	{"m": 2400, "text": "GRANITECORE DATA CAMPUS  -  POWDER NOW AVAILABLE BY SUBSCRIPTION.", "color": Color8(42, 124, 168)},
	{"m": 3600, "text": "MONOPEAK(tm) MEMBERS ONLY  -  THE GREATEST SNOW ON EARTH. TERMS APPLY.", "color": Color8(138, 74, 192)},
	{"m": 4800, "text": "YOU CAN'T SKI FREE.", "color": Color8(216, 54, 60)},
]

var run_seed := 0
var _cells := {}
var _items: Array = []      # {node, kind, t}
var _fly: Array = []        # overhead flyovers
var _fly_timer := 6.0
var _view := Rect2()
var _last_view_y := 0.0
var _font: Font

func _ready() -> void:
	z_index = -12
	_font = ThemeDB.fallback_font

func setup(p_seed: int) -> void:
	run_seed = p_seed

func update(delta: float, view: Rect2, zone_index: int, gondola_closed: bool) -> void:
	var dy := view.position.y - _last_view_y
	_last_view_y = view.position.y
	_view = view
	_generate(view)
	_animate(delta)
	_update_fly(delta, dy, zone_index, gondola_closed)
	queue_redraw()

# ---------------------------------------------------------------- ground details
func _generate(view: Rect2) -> void:
	var gen := view.grow_individual(160, 0, 160, 300)
	for cy in range(int(floor(gen.position.y / CELL)), int(floor(gen.end.y / CELL)) + 1):
		for cx in range(int(floor(gen.position.x / CELL)), int(floor(gen.end.x / CELL)) + 1):
			var key := Vector2i(cx, cy)
			if _cells.has(key):
				continue
			_cells[key] = true
			_gen_cell(cx, cy)
	var top := view.position.y - 200.0
	for i in range(_items.size() - 1, -1, -1):
		var it: Dictionary = _items[i]
		var n: Node2D = it["node"]
		if n.position.y < top or absf(n.position.x - view.get_center().x) > view.size.x * 3.0:
			n.queue_free()
			_items.remove_at(i)
	if _cells.size() > 3000:
		for k in _cells.keys():
			if k.y * CELL < top - 400.0:
				_cells.erase(k)

func _gen_cell(cx: int, cy: int) -> void:
	var y0 := cy * CELL
	if y0 < 120.0:
		return
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(Vector4i(run_seed, cx, cy, SALT))
	var zi := Zones.index_for_distance(y0 / PX_PER_M)
	if rng.randf() > DENSITY[zi]:
		return
	var table: Array = DECOR[zi]
	var total := 0.0
	for e in table:
		total += float(e[1])
	var r := rng.randf() * total
	var pick: Array = table[0]
	for e in table:
		r -= float(e[1])
		if r <= 0.0:
			pick = e
			break
	var id: String = pick[0]
	var s := Sprite2D.new()
	if id == "d_ad":
		var ads := ["SNOW+ PREMIUM", "MONOPEAK", "OWN THE VIEW", "TIER 3 POWDER"]
		s.texture = Art.text_tex(ads[rng.randi() % ads.size()], Color8(138, 74, 192), Color(0, 0, 0, 0))
	else:
		s.texture = Art.tex(id)
	s.scale = Vector2(SCALE, SCALE)
	s.flip_h = rng.randf() < 0.5 and id != "d_ad" and id != "d_dollar"
	s.modulate.a = float(pick[2])
	s.position = Vector2(cx * CELL + rng.randf_range(10, CELL - 10), y0 + rng.randf_range(10, CELL - 10))
	add_child(s)
	var item := {"node": s, "kind": id, "t": rng.randf() * TAU, "alpha": float(pick[2])}
	if id == "d_heated" or id == "d_vent":
		var steam := Sprite2D.new()
		steam.texture = Art.tex("d_steam")
		steam.scale = Vector2(SCALE, SCALE)
		steam.z_as_relative = false
		steam.z_index = 2
		s.add_child(steam)
		item["steam"] = steam
	_items.append(item)

func _animate(delta: float) -> void:
	for it in _items:
		it["t"] = float(it["t"]) + delta
		var t: float = it["t"]
		match it["kind"]:
			"d_sparkle":
				var a := maxf(0.0, sin(t * 2.2)) # twinkles on and off
				it["node"].modulate.a = a * a
			_:
				if it.has("steam"):
					var st: Sprite2D = it["steam"]
					var p := fmod(t * 0.5, 1.0)
					st.position = Vector2(sin(t * 2.0) * 2.0, -4.0 - p * 14.0) / SCALE
					st.modulate.a = 0.7 * (1.0 - p)

# ---------------------------------------------------------------- property lines
func _draw() -> void:
	for i in LINES.size():
		var y: float = float(LINES[i]["m"]) * PX_PER_M
		if y < _view.position.y - 20.0 or y > _view.end.y + 20.0:
			continue
		var c: Color = LINES[i]["color"]
		var x0 := floorf(_view.position.x / 24.0) * 24.0 - 24.0
		var x := x0
		while x < _view.end.x + 24.0:
			draw_rect(Rect2(x, y, 14, 3), Color(c, 0.75))
			x += 24.0
		var text: String = LINES[i]["text"]
		var tx := floorf(_view.position.x / 520.0) * 520.0 - 520.0
		while tx < _view.end.x:
			draw_string(_font, Vector2(tx + 10.0, y + 16.0), text, HORIZONTAL_ALIGNMENT_LEFT, -1, 9, Color(c, 0.8))
			tx += 520.0

# ---------------------------------------------------------------- flyovers
func _update_fly(delta: float, dy: float, zone_index: int, closed: bool) -> void:
	_fly_timer -= delta
	if _fly_timer <= 0.0 and _fly.size() == 0:
		_fly_timer = randf_range(10.0, 18.0)
		_spawn_fly(zone_index, closed)
	for i in range(_fly.size() - 1, -1, -1):
		var f: Dictionary = _fly[i]
		f["t"] = float(f["t"]) + delta
		var t: float = f["t"]
		for k in f["parts"].size():
			var part: Sprite2D = f["parts"][k]
			var sh: Sprite2D = f["shadows"][k]
			part.position += Vector2(f["vel"].x * delta, f["vel"].y * delta + dy)
			if f["kind"] == "birds":
				part.position.y += sin(t * 3.0 + k) * 0.3
				part.texture = Art.tex("bird_a" if int(t * 6.0 + k) % 2 == 0 else "bird_b")
			sh.position = part.position + f["shadow_off"]
		if f.has("rotor"):
			var rotor: Sprite2D = f["rotor"]
			rotor.position = f["parts"][0].position
			rotor.rotation += delta * 30.0
		if t > 14.0:
			for n in f["parts"] + f["shadows"]:
				n.queue_free()
			if f.has("rotor"):
				f["rotor"].queue_free()
			_fly.remove_at(i)

func _spawn_fly(zone_index: int, closed: bool) -> void:
	var kind := "birds"
	match zone_index:
		0, 1: kind = "birds"
		2: kind = "heli"
		3: kind = "drones"
		_: kind = "blimp"
	if closed:
		return
	var from_left := randf() < 0.5
	var dir := 1.0 if from_left else -1.0
	var x := _view.position.x - 80.0 if from_left else _view.end.x + 80.0
	var y := _view.position.y + _view.size.y * randf_range(0.15, 0.7)
	var f := {"kind": kind, "t": 0.0, "parts": [], "shadows": []}
	var tex := ""
	var count := 1
	var speed := 70.0
	match kind:
		"birds":
			tex = "bird_a"; count = randi_range(3, 5); speed = 55.0
			f["shadow_off"] = Vector2(30, 70)
		"heli":
			tex = "heli"; speed = 150.0
			f["shadow_off"] = Vector2(50, 110)
		"drones":
			tex = "drone"; count = 3; speed = 90.0
			f["shadow_off"] = Vector2(26, 60)
		"blimp":
			tex = "blimp"; speed = 28.0
			f["shadow_off"] = Vector2(70, 150)
	f["vel"] = Vector2(speed * dir, randf_range(-10.0, 10.0))
	for k in count:
		var p := Sprite2D.new()
		p.texture = Art.tex(tex)
		p.scale = Vector2(SCALE, SCALE)
		p.flip_h = not from_left and kind != "blimp"
		p.z_as_relative = false
		p.z_index = 45
		var off := Vector2(-k * 22.0 * dir, (k % 2) * 14.0 - k * 4.0) if kind == "birds" else Vector2(-k * 40.0 * dir, k * 18.0)
		p.position = Vector2(x, y) + off
		var sh := Sprite2D.new()
		sh.texture = p.texture
		sh.scale = p.scale
		sh.flip_h = p.flip_h
		sh.modulate = Color(0.12, 0.15, 0.35, 0.16)
		sh.z_as_relative = false
		sh.z_index = -6
		sh.position = p.position + f["shadow_off"]
		add_child(sh)
		add_child(p)
		f["parts"].append(p)
		f["shadows"].append(sh)
	if kind == "heli":
		var rotor := Sprite2D.new()
		rotor.texture = Art.tex("pixel")
		rotor.scale = Vector2(28, 1)
		rotor.modulate = Color(0.1, 0.1, 0.15, 0.7)
		rotor.z_as_relative = false
		rotor.z_index = 46
		add_child(rotor)
		f["rotor"] = rotor
	if kind == "blimp":
		var l := Label.new()
		l.text = "MONOPEAK: OWN THE VIEW"
		l.add_theme_font_size_override("font_size", 8)
		l.add_theme_color_override("font_color", Color8(26, 28, 44))
		l.position = Vector2(-30, -3)
		l.size = Vector2(120, 12)
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		f["parts"][0].add_child(l)
		l.scale = Vector2(1.0 / SCALE, 1.0 / SCALE)
	_fly.append(f)
