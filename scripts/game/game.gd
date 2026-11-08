extends Node2D
## Run controller: builds the scene graph, routes input, resolves collisions,
## drives difficulty/zones/events, and owns the score + game-over loop.

const PlayerScript = preload("res://scripts/game/player.gd")
const SpawnerScript = preload("res://scripts/game/spawner.gd")
const DeveloperScript = preload("res://scripts/game/developer.gd")
const TracksScript = preload("res://scripts/game/tracks.gd")
const GondolaScript = preload("res://scripts/game/gondola_line.gd")
const ScoreSystem = preload("res://scripts/game/score_system.gd")
const EventDirector = preload("res://scripts/game/event_director.gd")
const HudScript = preload("res://scripts/ui/hud.gd")
const Zones = preload("res://scripts/data/zones.gd")

const PX_PER_M := 16.0
const PLAYER_SCREEN_Y := 0.32
const START_LIVES := 3
const CLOSE_CALL_GAP := 16.0
const DIFFICULTY_FULL_M := 4500.0
const ZOOM := 1.2

enum State { PLAYING, OVER }

var state: State = State.PLAYING
var world: Node2D
var ground: Sprite2D
var tracks: Node2D
var player: Node2D
var spawner: Node2D
var developer: Node2D
var gondola: Node2D
var camera: Camera2D
var hud: CanvasLayer
var snow: CPUParticles2D
var fog: ColorRect
var fog_mat: ShaderMaterial
var score := ScoreSystem.new()
var events := EventDirector.new()

var start_y := 0.0
var distance_m := 0.0
var difficulty := 0.0
var zone_index := -1
var lives := START_LIVES
var tokens := 0
var dev_cooldown := 12.0
var shake := 0.0
var fog_strength := 0.0
var fog_target := 0.0
var hitstop := 0.0
var _cam_x := 0.0
var _touches := {}
var _steer_touch := -1
var _clear_color := Color(0.95, 0.97, 1.0)
var _autoplay := false
var _autoplay_t := 0.0

func _ready() -> void:
	_autoplay = OS.get_cmdline_user_args().has("--autoplay")
	process_mode = Node.PROCESS_MODE_ALWAYS
	randomize()
	_build()
	for n in [ground, tracks, world, spawner, gondola, camera]:
		n.process_mode = Node.PROCESS_MODE_PAUSABLE
	_connect()
	# Dev tool: `-- --start-m=2500` begins the run further down the mountain.
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--start-m="):
			player.position.y = float(a.substr(10)) * PX_PER_M
			dev_cooldown = 3.0
	_set_zone(0)
	hud.set_lives(lives)
	hud.set_headline("Welcome to the Wasatch. It's public land - enjoy it while it lasts.", events.gondola_eta())
	if Game.settings.get("controls", "drag") == "drag":
		hud.show_hint("HOLD + DRAG TO STEER\nTAP = HOP / 360   SWIPE UP = BACKFLIP\nSWIPE DOWN = GRAB", 5.0)
	else:
		hud.show_hint("HOLD LEFT / RIGHT SIDE TO TURN\nTAP = HOP / 360   SWIPE UP = BACKFLIP\nSWIPE DOWN = GRAB", 5.0)
	if not OS.has_feature("mobile"):
		hud.show_message("KEYS: ARROWS steer  DOWN tuck  UP brake\nSPACE hop/360  K backflip  L grab")
	Sfx.set_music_pitch(1.0)

func _build() -> void:
	ground = Sprite2D.new()
	ground.texture = Art.tex("speckle")
	ground.texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED
	ground.region_enabled = true
	ground.centered = false
	ground.z_index = -20
	add_child(ground)
	tracks = TracksScript.new()
	add_child(tracks)
	world = Node2D.new()
	world.y_sort_enabled = true
	add_child(world)
	spawner = SpawnerScript.new()
	add_child(spawner)
	player = PlayerScript.new()
	player.setup(Game.rider, Game.current_outfit())
	world.add_child(player)
	tracks.double_line = Game.rider == "skier"
	developer = DeveloperScript.new()
	world.add_child(developer)
	gondola = GondolaScript.new()
	add_child(gondola)
	var seed := randi()
	spawner.setup(world, seed)
	gondola.cable_x = spawner.cable_x
	gondola.start_y = float(Zones.ZONES[1]["start_m"]) * PX_PER_M
	camera = Camera2D.new()
	camera.zoom = Vector2(ZOOM, ZOOM)
	add_child(camera)
	camera.make_current()
	# screen-space snowfall + whiteout fog
	var fx := CanvasLayer.new()
	fx.layer = 5
	add_child(fx)
	fog = ColorRect.new()
	fog.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	fog.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sh := Shader.new()
	sh.code = """
shader_type canvas_item;
uniform vec2 center = vec2(0.5, 0.32);
uniform float strength = 0.0;
uniform float aspect = 0.5625;
uniform float t = 0.0;
void fragment() {
	vec2 d = UV - center;
	d.x *= aspect;
	float r = length(d);
	float n = sin(UV.y * 40.0 + t * 3.0) * sin(UV.x * 23.0 - t * 2.0) * 0.04;
	float a = smoothstep(0.07, 0.30, r + n) * strength;
	COLOR = vec4(0.94, 0.96, 1.0, a * 0.95);
}
"""
	fog_mat = ShaderMaterial.new()
	fog_mat.shader = sh
	fog.material = fog_mat
	fx.add_child(fog)
	snow = CPUParticles2D.new()
	snow.amount = 70
	snow.lifetime = 5.0
	snow.preprocess = 5.0
	snow.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	snow.direction = Vector2(0.2, 1)
	snow.spread = 15
	snow.gravity = Vector2(0, 0)
	snow.initial_velocity_min = 40
	snow.initial_velocity_max = 90
	snow.scale_amount_min = 1.5
	snow.scale_amount_max = 3.0
	snow.color = Color(1, 1, 1, 0.9)
	fx.add_child(snow)
	hud = HudScript.new()
	add_child(hud)

func _connect() -> void:
	player.landed.connect(_on_landed)
	player.bailed_landing.connect(_on_bailed_landing)
	player.trick_started.connect(func(_n): Sfx.play("flip" if _n == "BACKFLIP" else "trick", 0.05))
	developer.caught_player.connect(_on_caught)
	developer.gave_up.connect(func():
		hud.warn("CHIP GOT BORED. YOU KEPT YOUR LAND.", 2.5)
		score.add_style(400)
		_popup("ESCAPED THE DEVELOPER +400", player.position + Vector2(0, -60), Color8(88, 200, 100))
		dev_cooldown = randf_range(18.0, 30.0) - zone_index * 2.0)
	score.banked.connect(func(amount, count):
		if count >= 2:
			Sfx.play("combo")
			_popup("COMBO BANKED +%d" % amount, player.position + Vector2(0, -70), Color8(255, 216, 74)))
	score.lost.connect(func(amount):
		if amount > 0:
			_popup("COMBO LOST -%d" % amount, player.position + Vector2(0, -80), Color8(216, 54, 60)))
	events.event_started.connect(_on_event_started)
	events.event_ended.connect(_on_event_ended)
	events.headline.connect(func(t): hud.set_headline(t, events.gondola_eta()))
	hud.pause_requested.connect(func(): _set_paused(true))
	hud.resume_requested.connect(func(): _set_paused(false))
	hud.restart_requested.connect(_restart)
	hud.menu_requested.connect(_to_menu)

# ---------------------------------------------------------------- loop
func _process(delta: float) -> void:
	if get_tree().paused:
		return
	delta = minf(delta, 1.0 / 30.0)
	var screen := get_viewport_rect().size
	var vs := screen / ZOOM
	if hitstop > 0.0:
		hitstop -= delta
		return
	if state == State.PLAYING:
		_read_input(screen)
		player.max_speed = (250.0 + 210.0 * difficulty) * float(player.rider["speed_mult"])
		player.update(delta)
		tracks.add_point(player.position, not player.is_airborne() and not player.is_down())
		distance_m = maxf(distance_m, (player.position.y - start_y) / PX_PER_M)
		score.add_distance(maxf(0.0, player.velocity().y * delta / PX_PER_M) * 0.5)
		difficulty = clampf(distance_m / DIFFICULTY_FULL_M, 0.0, 1.0)
		var zi := Zones.index_for_distance(distance_m)
		if zi != zone_index:
			_set_zone(zi)
		_check_collisions()
		_update_developer(delta)
		events.update(delta, zone_index)
		score.update(delta, player.is_airborne())
		Sfx.set_hiss(0.0 if player.is_airborne() or player.is_down() else player.speed / 450.0)
	else:
		Sfx.set_hiss(0.0)
		if developer.is_active():
			developer.update(delta, player, 0.0)
	# camera
	var look: float = player.velocity().x * 0.25
	_cam_x = lerpf(_cam_x, player.position.x + look, clampf(5.0 * delta, 0, 1))
	camera.position = Vector2(_cam_x, player.position.y + (0.5 - PLAYER_SCREEN_Y) * vs.y)
	if shake > 0.0:
		shake = maxf(0.0, shake - delta * 20.0)
		var amt: float = shake if Game.settings.get("shake", true) else 0.0
		camera.offset = Vector2(randf_range(-amt, amt), randf_range(-amt, amt))
	else:
		camera.offset = Vector2.ZERO
	var view := Rect2(camera.position - vs * 0.5, vs)
	spawner.update_view(view, difficulty)
	gondola.update(delta, view)
	tracks.prune(view.position.y - 40.0)
	ground.position = Vector2(floorf(view.position.x / 64.0) * 64.0 - 64.0, floorf(view.position.y / 64.0) * 64.0 - 64.0)
	ground.region_rect = Rect2(0, 0, vs.x + 192.0, vs.y + 192.0)
	snow.position = Vector2(screen.x * 0.5, -10)
	snow.emission_rect_extents = Vector2(screen.x * 0.7, 4)
	# fog
	fog_strength = move_toward(fog_strength, fog_target, delta * 0.6)
	fog_mat.set_shader_parameter("strength", fog_strength)
	fog_mat.set_shader_parameter("aspect", screen.x / screen.y)
	fog_mat.set_shader_parameter("t", Time.get_ticks_msec() / 1000.0)
	var ps: Vector2 = player.get_global_transform_with_canvas().origin
	fog_mat.set_shader_parameter("center", Vector2(ps.x / screen.x, (ps.y - 20.0) / screen.y))
	fog.visible = fog_strength > 0.01
	# HUD
	hud.set_stats(score.score, distance_m, tokens)
	hud.set_combo(score.combo_count, score.combo_pool, score.multiplier(), score.combo_timer / score.COMBO_WINDOW)

# ---------------------------------------------------------------- input
func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause"):
		if state == State.PLAYING:
			_set_paused(not get_tree().paused)
		return
	if state == State.OVER:
		if event.is_action_pressed("restart") or event.is_action_pressed("jump") or event.is_action_pressed("ui_accept"):
			_restart()
		return
	if event.is_action_pressed("restart"):
		_restart()
		return
	if event.is_action_pressed("jump"):
		_do_jump(player.press_jump())
	elif event.is_action_pressed("backflip") or (event.is_action_pressed("brake") and player.is_airborne()):
		_do_jump(player.press_backflip())
	elif event.is_action_pressed("grab") or (event.is_action_pressed("tuck") and player.is_airborne()):
		player.press_grab()
	if event is InputEventScreenTouch:
		var t := event as InputEventScreenTouch
		if t.pressed:
			if hud.is_point_on_ui(t.position):
				return
			_touches[t.index] = {"start": t.position, "pos": t.position, "time": Time.get_ticks_msec(), "steer": false}
		elif _touches.has(t.index):
			var info: Dictionary = _touches[t.index]
			var dt := Time.get_ticks_msec() - int(info["time"])
			var dv: Vector2 = t.position - info["start"]
			if dt < 320 and dv.y < -40.0 and absf(dv.y) > absf(dv.x):
				_do_jump(player.press_backflip())
			elif dt < 320 and dv.y > 40.0 and absf(dv.y) > absf(dv.x) and player.is_airborne():
				player.press_grab()
			elif dt < 220 and dv.length() < 18.0:
				_do_jump(player.press_jump())
			_touches.erase(t.index)
	elif event is InputEventScreenDrag:
		var d := event as InputEventScreenDrag
		if _touches.has(d.index):
			_touches[d.index]["pos"] = d.position

func _do_jump(kind: String) -> void:
	if kind == "hop":
		Sfx.play("jump", 0.05, -4.0)

func _read_input(vs: Vector2) -> void:
	player.steer = Input.get_axis("steer_left", "steer_right")
	player.tuck = Input.is_action_pressed("tuck")
	player.brake = Input.is_action_pressed("brake") and not player.is_airborne()
	player.has_target = false
	if _autoplay:
		_autoplay_input()
		return
	if player.steer != 0.0 or player.tuck or player.brake:
		return
	var now := Time.get_ticks_msec()
	var ps: Vector2 = player.get_global_transform_with_canvas().origin
	var mode: String = Game.settings.get("controls", "drag")
	var left := false
	var right := false
	for idx in _touches.keys():
		var info: Dictionary = _touches[idx]
		var held: bool = now - int(info["time"]) > 120 or (info["pos"] - info["start"]).length() > 14.0
		if not held:
			continue
		var p: Vector2 = info["pos"]
		if mode == "drag":
			var v := p - ps
			if v.y < 10.0:
				player.has_target = true
				player.target_heading = signf(v.x) * player.MAX_HEADING if absf(v.x) > 10.0 else player.heading
			else:
				player.has_target = true
				player.target_heading = clampf(atan2(v.x, v.y), -player.MAX_HEADING, player.MAX_HEADING)
				player.tuck = v.y > vs.y * 0.45 and absf(player.target_heading) < 0.25
		else:
			if p.x < vs.x * 0.5:
				left = true
			else:
				right = true
	if mode != "drag":
		if left and right:
			player.tuck = true
		elif left:
			player.steer = -1.0
		elif right:
			player.steer = 1.0

## Simple bot used by the automated smoke test (run with `-- --autoplay`).
func _autoplay_input() -> void:
	var prev := int(_autoplay_t / 5.0)
	_autoplay_t += get_process_delta_time()
	if int(_autoplay_t / 5.0) != prev:
		print("AUTOPLAY t=%ds dist=%dm score=%d zone=%d lives=%d speed=%d obstacles=%d dev=%s combo=%d" % [int(_autoplay_t), int(distance_m), score.score, zone_index, lives, int(player.speed), spawner.active.size(), developer.is_active(), score.combo_count])
	var best := 0.0
	var danger := false
	for o in spawner.active:
		if o.kind != "solid" or o.consumed:
			continue
		var dy: float = o.position.y - player.position.y
		if dy > 0.0 and dy < 140.0 and absf(o.position.x - player.position.x) < o.hit_size.x * 0.5 + 18.0:
			danger = true
			best = -1.0 if o.position.x > player.position.x else 1.0
			break
	var goal := sin(_autoplay_t * 0.7) * 0.5
	if not danger:
		var nearest := 99999.0
		for o in spawner.active:
			if (o.kind == "ramp" or o.kind == "token") and not o.consumed:
				var v: Vector2 = o.position - player.position
				if v.y > 30.0 and v.y < 260.0 and v.length() < nearest:
					nearest = v.length()
					goal = clampf(atan2(v.x, v.y), -1.0, 1.0)
	player.has_target = true
	player.target_heading = best * 1.0 if danger else goal
	if player.is_airborne() and player.trick == "":
		if int(_autoplay_t) % 2 == 0:
			player.press_backflip()
		else:
			player.press_jump()

# ---------------------------------------------------------------- collisions
func _check_collisions() -> void:
	var feet: Rect2 = player.feet_rect()
	var py: float = player.position.y
	for o in spawner.active:
		if o.consumed:
			continue
		var dy: float = o.position.y - py
		if dy < -40.0 or dy > o.hit_size.y + 10.0:
			continue
		var hb: Rect2 = o.get_hitbox()
		if feet.intersects(hb):
			_contact(o)
		elif not o.passed and py > o.position.y:
			o.passed = true
			_passed(o, hb, feet)
		if player.is_down():
			return

func _passed(o, hb: Rect2, feet: Rect2) -> void:
	if o.kind == "toll" and player.is_airborne():
		if feet.position.x + feet.size.x > hb.position.x and feet.position.x < hb.end.x:
			o.open_gate()
			score.add_style(250)
			_popup("TOLL JUMPED! +250", player.position + Vector2(0, -50), Color8(88, 200, 100))
			Sfx.play("close")
		return
	if o.kind != "solid" or player.is_airborne() or player.is_down() or player.speed < 140.0:
		return
	var gap := maxf(hb.position.x - feet.end.x, feet.position.x - hb.end.x)
	if gap >= 0.0 and gap < CLOSE_CALL_GAP:
		score.add_style(40 if gap > 8.0 else 75)
		_popup("CLOSE CALL!" if gap > 8.0 else "RAZOR CLOSE!", player.position + Vector2(0, -44), Color.WHITE)
		Sfx.play("close", 0.1, -3.0)

func _contact(o) -> void:
	var air: bool = player.is_airborne()
	match o.kind:
		"token":
			o.collect()
			tokens += 1
			score.add_style(50)
			Sfx.play("token", 0.03)
			_popup("+PUBLIC PASS", o.position + Vector2(0, -30), Color8(255, 216, 74))
		"slow":
			if not air:
				player.powder_t = 0.15
				if player.rider_id == "snowboarder" and player.speed > 150.0 and not o.passed:
					o.passed = true
					score.add_style(30)
					_popup("POWDER SURF!", player.position + Vector2(0, -44), Color8(80, 200, 240))
		"ice":
			if not air:
				player.ice_t = 0.2
		"ramp":
			if not air and not player.is_down():
				player.launch_from_ramp(float(o.def.get("air", 1.0)))
				Sfx.play("jump", 0.05)
				o.consumed = true
		"mogul":
			if not air and not player.is_down() and player.speed > 120.0:
				player.launch(0.32, 10.0)
				score.add_style(20)
				Sfx.play("mogul", 0.1, -4.0)
		"toll":
			if not air:
				o.open_gate()
				var cost: int = int(o.def.get("cost", 150))
				score.add_raw(-cost)
				Sfx.play("toll")
				_popup("TOLL: -%d" % cost, player.position + Vector2(0, -48), Color8(216, 54, 60))
				hud.show_message("MONOPEAK thanks you for your contribution.")
		"bump":
			if air or player.invuln > 0.0:
				return
			o.consumed = true
			o.wobble()
			player.stumble()
			score.bail()
			Sfx.play("bump", 0.1)
			hud.show_message(String(o.def.get("msg", "Oof.")))
			shake = 3.0
		"solid":
			if (air and not o.tall) or player.invuln > 0.0:
				return
			o.wobble()
			if o.id == "moose":
				o.scare(player.position.x)
			_crash(String(o.def.get("msg", "Wipeout.")))

func _crash(msg: String) -> void:
	player.crash()
	tracks.break_line()
	lives -= 1
	hud.set_lives(lives)
	score.bail()
	Sfx.play("crash", 0.05)
	Game.vibrate(60)
	shake = 8.0
	hitstop = 0.06
	_burst(player.position)
	hud.show_message(msg)
	if lives <= 0:
		get_tree().create_timer(1.0).timeout.connect(func(): _game_over("SEASON PASS REVOKED", msg))

func _on_landed(air_time: float, tricks: Array) -> void:
	Sfx.play("land", 0.1, -2.0)
	if _autoplay and not tricks.is_empty():
		print("LANDED ", PlayerScript.describe(tricks), " air=", snappedf(air_time, 0.01))
	if air_time < 0.45 and tricks.is_empty():
		return
	var pts := int(air_time * 80.0)
	for t in tricks:
		pts += int(t["points"])
	if tricks.size() >= 2:
		pts = int(pts * 1.5)
	score.add_style(pts)
	var title: String = PlayerScript.describe(tricks)
	if title == "":
		title = "BIG AIR"
	_popup("%s +%d" % [title, pts], player.position + Vector2(0, -56), Color8(255, 216, 74), 1.3 if tricks.size() > 0 else 1.0)
	if tricks.size() > 0:
		Sfx.play("combo", 0.0, -4.0)
		shake = 2.0

func _on_bailed_landing(_tricks: Array) -> void:
	_crash("Landed mid-trick. Bailout not included.")

# ---------------------------------------------------------------- developer
func _update_developer(delta: float) -> void:
	if developer.is_active():
		developer.update(delta, player, player.max_speed)
		if developer.is_chasing():
			var dr: Rect2 = developer.grab_rect()
			for o in spawner.active:
				if absf(o.position.y - developer.position.y) < 40.0 and dr.intersects(o.get_hitbox()):
					o.raze()
					if o.id == "moose":
						o.scare(developer.position.x)
		return
	if zone_index < 1:
		return
	dev_cooldown -= delta
	if dev_cooldown <= 0.0 and not player.is_down():
		developer.start(player.position)
		Sfx.play("alarm")
		hud.warn("! THE DEVELOPER WANTS YOUR LINE - TUCK & RUN !", 3.5)

func _on_caught() -> void:
	if state != State.PLAYING:
		return
	player.caught()
	developer.stop()
	developer.visible = true
	Sfx.play("crash")
	Game.vibrate(120)
	shake = 10.0
	_game_over("ACQUIRED!", "Chip Lodgeworth III bought you, your skis, and the view.")

# ---------------------------------------------------------------- zones & events
func _set_zone(i: int) -> void:
	var first := zone_index == -1
	zone_index = i
	var z: Dictionary = Zones.ZONES[i]
	var tw := create_tween()
	tw.tween_method(func(c: Color):
		_clear_color = c
		RenderingServer.set_default_clear_color(c), _clear_color, z["snow"], 1.5 if not first else 0.01)
	ground.modulate = Color(z["speckle"], 0.6)
	tracks.color = Color(z["speckle"], 0.55)
	gondola.running = i >= 2
	hud.show_banner(z["name"], z["subtitle"])
	if not first:
		Sfx.play("zone")
		score.add_raw(500 * i)
		_popup("NEW PHASE +%d" % (500 * i), player.position + Vector2(0, -90), Color8(88, 200, 100))
		if i == 1:
			dev_cooldown = 6.0

func _on_event_started(id: String, title: String, subtitle: String) -> void:
	hud.show_event("%s\n%s" % [title, subtitle])
	Sfx.play("zone")
	match id:
		"whiteout":
			fog_target = 1.0
			gondola.closed = true
			snow.amount = 220
		"powder_day":
			score.global_mult = 2.0
			snow.amount = 180

func _on_event_ended(id: String) -> void:
	match id:
		"whiteout":
			fog_target = 0.0
			gondola.closed = false
		"powder_day":
			score.global_mult = 1.0
	snow.amount = 70

# ---------------------------------------------------------------- fx
func _popup(text: String, pos: Vector2, color: Color, size := 1.0) -> void:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", int(13 * size))
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_outline_color", Color8(20, 26, 51))
	l.add_theme_constant_override("outline_size", 4)
	l.theme = hud.root.theme
	l.z_index = 60
	l.position = pos - Vector2(100, 0)
	l.size = Vector2(200, 20)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(l)
	var tw := l.create_tween().set_parallel(true)
	tw.tween_property(l, "position:y", pos.y - 40.0, 1.0).set_ease(Tween.EASE_OUT)
	tw.tween_property(l, "modulate:a", 0.0, 1.0).set_delay(0.5)
	tw.chain().tween_callback(l.queue_free)

func _burst(pos: Vector2) -> void:
	var p := CPUParticles2D.new()
	p.one_shot = true
	p.explosiveness = 1.0
	p.amount = 30
	p.lifetime = 0.6
	p.direction = Vector2(0, -1)
	p.spread = 180
	p.gravity = Vector2(0, 300)
	p.initial_velocity_min = 60
	p.initial_velocity_max = 160
	p.scale_amount_min = 2
	p.scale_amount_max = 4
	p.color = Color(0.9, 0.95, 1.0)
	p.position = pos + Vector2(0, -8)
	p.z_index = 30
	add_child(p)
	p.emitting = true
	get_tree().create_timer(1.0).timeout.connect(p.queue_free)

# ---------------------------------------------------------------- flow
func _game_over(title: String, cause: String) -> void:
	if state == State.OVER:
		return
	state = State.OVER
	score.bank()
	Sfx.play("gameover")
	Sfx.set_hiss(0.0)
	var rec: Dictionary = Game.record_run(score.score, distance_m, tokens, title)
	hud.show_game_over(title, cause, score.score, distance_m, tokens, rec, Game.best_score)
	if _autoplay:
		get_tree().create_timer(1.5).timeout.connect(_restart)
	print("RUN_OVER score=%d distance=%d tokens=%d cause=%s" % [score.score, int(distance_m), tokens, title])

func _set_paused(on: bool) -> void:
	if state == State.OVER:
		return
	get_tree().paused = on
	hud.set_paused(on)
	if on:
		Sfx.set_hiss(0.0)
	_touches.clear()

func _restart() -> void:
	get_tree().paused = false
	get_tree().reload_current_scene()

func _to_menu() -> void:
	get_tree().paused = false
	get_tree().change_scene_to_file("res://scenes/main_menu.tscn")

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT or what == NOTIFICATION_APPLICATION_PAUSED:
		if state == State.PLAYING and is_inside_tree() and not _autoplay:
			_set_paused(true)
	elif what == NOTIFICATION_WM_GO_BACK_REQUEST:
		if state == State.PLAYING:
			_set_paused(not get_tree().paused)
