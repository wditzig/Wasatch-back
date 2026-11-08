extends Node2D
## Procedural terrain. The world is an infinite grid of cells; each cell is
## generated deterministically from (run seed, cell x, cell y) the first time
## it comes near the camera, and freed once it falls far behind.

const Obs = preload("res://scripts/data/obstacles.gd")
const Zones = preload("res://scripts/data/zones.gd")
const ObstacleScript = preload("res://scripts/game/obstacle.gd")

const CELL := 80.0
const PX_PER_M := 16.0
const SAFE_START_Y := 420.0
const TOWER_SPACING := 560.0
## The plain PUBLIC LAND sign only appears in roughly the first 15 seconds
## (~160 m). Past that, its slot becomes a small pine so obstacle count and
## difficulty are unchanged.
const PUBLIC_SIGN_MAX_Y := 160.0 * PX_PER_M

var world: Node2D
var run_seed := 0
var active: Array = []
var _generated := {}
var cable_x := 150.0
var _next_tower_y := -1.0

func setup(p_world: Node2D, p_seed: int) -> void:
	world = p_world
	run_seed = p_seed
	_spawn_start_area()

func _spawn_start_area() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = run_seed
	_spawn("trailhead", Vector2(-64, 70), rng)
	for p in [Vector2(-140, 40), Vector2(-170, 180), Vector2(130, 90), Vector2(160, 240), Vector2(-120, 320), Vector2(110, 380)]:
		_spawn("pine_big" if rng.randf() < 0.5 else "pine_small", p, rng)
	_spawn("ramp", Vector2(0, 330), rng)
	_spawn("token", Vector2(0, 420), rng)
	_spawn("token", Vector2(0, 460), rng)

## Generate cells in view, cull far-away obstacles.
func update_view(view: Rect2, difficulty: float) -> void:
	var gen := view.grow_individual(180, 0, 180, 360)
	var cx0 := int(floor(gen.position.x / CELL))
	var cx1 := int(floor(gen.end.x / CELL))
	var cy0 := int(floor(gen.position.y / CELL))
	var cy1 := int(floor(gen.end.y / CELL))
	for cy in range(cy0, cy1 + 1):
		for cx in range(cx0, cx1 + 1):
			var key := Vector2i(cx, cy)
			if not _generated.has(key):
				_generated[key] = true
				_gen_cell(cx, cy, difficulty)
	_spawn_towers(gen)
	# cull
	var keep_top := view.position.y - 220.0
	for i in range(active.size() - 1, -1, -1):
		var o = active[i]
		if o.position.y < keep_top or absf(o.position.x - view.get_center().x) > view.size.x * 3.0:
			active.remove_at(i)
			o.queue_free()
	if _generated.size() > 4000:
		for k in _generated.keys():
			if k.y * CELL < keep_top - 400.0:
				_generated.erase(k)

func _gen_cell(cx: int, cy: int, difficulty: float) -> void:
	var y0 := cy * CELL
	if y0 < SAFE_START_Y:
		return
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(Vector3i(run_seed, cx, cy))
	var meters := y0 / PX_PER_M
	var zi := Zones.index_for_distance(meters)
	var zone: Dictionary = Zones.ZONES[zi]
	var ramp_in := clampf((y0 - SAFE_START_Y) / 1600.0, 0.6, 1.0)
	var density: float = float(zone["density"]) * (0.8 + 0.7 * difficulty) * ramp_in
	if rng.randf() > density:
		return
	var id := _pick(zi, rng)
	if id == "":
		return
	var pos := Vector2(cx * CELL + rng.randf_range(8, CELL - 8), y0 + rng.randf_range(8, CELL - 8))
	if id == "sign_public" and pos.y > PUBLIC_SIGN_MAX_Y:
		id = "pine_small"
	var def: Dictionary = Obs.DEFS[id]
	if def.has("parts"):
		for part in def["parts"]:
			_spawn(part[0], pos + Vector2(part[1], part[2]), rng)
	elif def.has("cluster"):
		var c: Dictionary = def["cluster"]
		var cnt: Array = c["count"]
		var step: Array = c["step"]
		var n := rng.randi_range(cnt[0], cnt[1])
		for i in n:
			var off := Vector2(step[0] * i, step[1] * (i % 2))
			off += Vector2(rng.randf_range(-1, 1), rng.randf_range(-1, 1)) * float(c.get("jitter", 0))
			_spawn(id, pos + off, rng)
	else:
		_spawn(id, pos, rng)

func _pick(zi: int, rng: RandomNumberGenerator) -> String:
	var total := 0.0
	for k in Obs.DEFS.keys():
		total += float(Obs.DEFS[k]["weights"][zi])
	var r := rng.randf() * total
	for k in Obs.DEFS.keys():
		r -= float(Obs.DEFS[k]["weights"][zi])
		if r <= 0.0:
			return k
	return ""

func _spawn_towers(gen: Rect2) -> void:
	var start_y: float = float(Zones.ZONES[1]["start_m"]) * PX_PER_M
	if _next_tower_y < 0.0:
		_next_tower_y = start_y
	if cable_x < gen.position.x - 200.0 or cable_x > gen.end.x + 200.0:
		# off to the side: keep the counter moving so towers don't pile up
		while _next_tower_y < gen.end.y:
			_next_tower_y += TOWER_SPACING
		return
	var rng := RandomNumberGenerator.new()
	while _next_tower_y < gen.end.y:
		if _next_tower_y > gen.position.y - 100.0:
			_spawn("gondola_tower", Vector2(cable_x, _next_tower_y), rng)
		_next_tower_y += TOWER_SPACING

func _spawn(id: String, pos: Vector2, rng: RandomNumberGenerator) -> Node2D:
	var o := ObstacleScript.new()
	o.position = pos
	world.add_child(o)
	o.setup(id, Obs.DEFS[id], rng)
	active.append(o)
	return o
