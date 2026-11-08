extends Node2D
## The rider. Owns movement physics, airtime and the trick system.
## game.gd feeds input each frame and calls update(); collisions are resolved
## by game.gd, which calls launch()/crash()/etc.

signal landed(air_time: float, tricks: Array)
signal bailed_landing(tricks: Array)
signal trick_started(trick_name: String)

const Riders = preload("res://scripts/data/riders.gd")

enum S { SKI, AIR, CRASH, CAUGHT, STOP }

const SCALE := 2.0
const MAX_HEADING := deg_to_rad(88.0)
const TRICKS := {
	"spin": {"name": "360", "time": 0.5, "points": 150},
	"flip": {"name": "BACKFLIP", "time": 0.62, "points": 250},
	"grab": {"name": "GRAB", "time": 0.38, "points": 100},
}
const GRAB_NAMES := ["REZONE GRAB", "LAND GRAB", "EASEMENT GRAB", "GOLDEN PARACHUTE", "TAX SHELTER GRAB"]

var state: S = S.SKI
var rider_id := "skier"
var rider: Dictionary
var outfit: Dictionary
var heading := 0.0
var speed := 0.0
var max_speed := 260.0

# input (set by game.gd every frame)
var steer := 0.0
var has_target := false
var target_heading := 0.0
var tuck := false
var brake := false

# air
var air_t := 0.0
var air_dur := 0.0
var air_peak := 0.0
var height := 0.0
var trick := ""            # current trick type ("spin"/"flip"/"grab")
var trick_t := 0.0
var trick_len := 0.0
var trick_dir := 1.0
var queued := ""
var tricks_done: Array = []

var crash_t := 0.0
var invuln := 0.0
var powder_t := 0.0
var ice_t := 0.0
var hop_cd := 0.0
var wobble_t := 0.0

var body: Sprite2D
var shadow: Sprite2D
var spray: CPUParticles2D
var _tex := {}

func setup(p_rider: String, p_outfit: Dictionary) -> void:
	rider_id = p_rider
	rider = Riders.RIDERS[p_rider]
	outfit = p_outfit
	var prefix: String = rider["sprite"]
	for pose in ["down", "diag", "side", "air", "grab", "crash"]:
		_tex[pose] = Art.tex(prefix + "_" + pose, outfit)
	shadow = Sprite2D.new()
	shadow.texture = Art.tex("shadow")
	shadow.scale = Vector2(SCALE, SCALE)
	add_child(shadow)
	spray = CPUParticles2D.new()
	spray.emitting = false
	spray.amount = 28
	spray.lifetime = 0.45
	spray.local_coords = false
	spray.direction = Vector2(0, -1)
	spray.spread = 35.0
	spray.gravity = Vector2(0, 120)
	spray.initial_velocity_min = 40.0
	spray.initial_velocity_max = 110.0
	spray.scale_amount_min = 1.5
	spray.scale_amount_max = 3.0
	spray.color = Color(0.85, 0.92, 1.0, 0.9)
	add_child(spray)
	body = Sprite2D.new()
	body.scale = Vector2(SCALE, SCALE)
	add_child(body)
	_apply_pose()

func is_airborne() -> bool:
	return state == S.AIR

func is_down() -> bool:
	return state == S.CRASH or state == S.CAUGHT or state == S.STOP

func velocity() -> Vector2:
	return Vector2(sin(heading), cos(heading)) * speed

func feet_rect() -> Rect2:
	return Rect2(position.x - 5, position.y - 6, 10, 6)

## Jump/360 input: hop when on the ground, 360 in the air.
func press_jump() -> String:
	if state == S.SKI:
		return _hop()
	if state == S.AIR:
		_start_or_queue("spin")
	return ""

func press_backflip() -> String:
	if state == S.SKI:
		return _hop()
	if state == S.AIR:
		_start_or_queue("flip")
	return ""

func press_grab() -> void:
	if state == S.AIR:
		_start_or_queue("grab")

func _hop() -> String:
	if hop_cd > 0.0:
		return ""
	hop_cd = 0.55
	launch(0.42, 16.0)
	return "hop"

func launch(duration: float, peak: float) -> void:
	if state != S.SKI:
		return
	state = S.AIR
	air_t = 0.0
	air_dur = duration * float(rider["air_mult"])
	air_peak = peak * float(rider["air_mult"])
	trick = ""
	queued = ""
	tricks_done = []
	spray.emitting = false

func launch_from_ramp(ramp_air: float) -> void:
	var dur := (0.55 + speed / 380.0) * ramp_air
	launch(dur, 26.0 + speed * 0.09 * ramp_air)

func _start_or_queue(kind: String) -> void:
	# A quick hop is too short to rotate - ignore spin/flip so a double-tap can't cause a bail.
	if kind != "grab" and air_dur < 0.6:
		return
	if trick == "":
		_start_trick(kind)
	elif queued == "":
		queued = kind

func _start_trick(kind: String) -> void:
	trick = kind
	trick_t = 0.0
	trick_len = float(TRICKS[kind]["time"]) / float(rider["trick_speed"])
	trick_dir = -1.0 if steer < -0.1 or (has_target and target_heading < -0.1) else 1.0
	trick_started.emit(TRICKS[kind]["name"])

func crash() -> void:
	state = S.CRASH
	crash_t = 1.1
	speed = 0.0
	height = 0.0
	trick = ""
	queued = ""
	spray.emitting = false
	_apply_pose()

func caught() -> void:
	state = S.CAUGHT
	speed = 0.0
	height = 0.0
	spray.emitting = false
	_apply_pose()

func stumble() -> void:
	speed *= 0.45
	wobble_t = 0.4

func update(delta: float) -> void:
	hop_cd = maxf(0.0, hop_cd - delta)
	invuln = maxf(0.0, invuln - delta)
	powder_t = maxf(0.0, powder_t - delta)
	ice_t = maxf(0.0, ice_t - delta)
	match state:
		S.SKI: _update_ski(delta)
		S.AIR: _update_air(delta)
		S.CRASH:
			invuln = 1.6
			crash_t -= delta
			if crash_t <= 0.0:
				state = S.SKI
				heading = 0.0
				speed = 30.0
				invuln = 1.6
		_:
			pass
	_apply_pose()

func _update_ski(delta: float) -> void:
	var turn: float = rider["turn_rate"]
	if tuck:
		turn *= 0.6
	if ice_t > 0.0:
		turn *= float(rider["ice_turn"])
	if wobble_t > 0.0:
		wobble_t -= delta
		turn *= 0.3
	if brake:
		var side := 1.0 if heading >= 0.0 else -1.0
		heading = move_toward(heading, MAX_HEADING * side, turn * 1.4 * delta)
	elif has_target:
		heading = move_toward(heading, target_heading, turn * delta)
	else:
		heading += steer * turn * delta
	heading = clampf(heading, -MAX_HEADING, MAX_HEADING)

	var downhill := cos(heading)
	var target := max_speed * pow(maxf(downhill, 0.0), 1.3)
	if tuck:
		target *= 1.22
	if brake:
		target *= 0.15
	if powder_t > 0.0:
		target *= float(rider["powder_mult"])
	if speed < target:
		speed = minf(target, speed + (float(rider["accel"]) * downhill + 40.0) * delta)
	else:
		var decel := 160.0 + 520.0 * (1.0 - downhill)
		if powder_t > 0.0 and float(rider["powder_mult"]) < 1.0:
			decel += 200.0
		speed = maxf(target, speed - decel * delta)
	position += velocity() * delta

	# carve spray when turning hard at speed
	var carving: bool = speed > 140.0 and (absf(heading) > 0.9 or brake or absf(steer) > 0.5)
	spray.emitting = carving
	if carving:
		spray.direction = Vector2(-signf(heading) if heading != 0.0 else 1.0, -1.2).normalized()

func _update_air(delta: float) -> void:
	air_t += delta
	# light air control
	var turn: float = float(rider["turn_rate"]) * 0.25
	if has_target:
		heading = move_toward(heading, clampf(target_heading, -1.2, 1.2), turn * delta)
	else:
		heading = clampf(heading + steer * turn * delta, -MAX_HEADING, MAX_HEADING)
	position += velocity() * delta
	var p := clampf(air_t / air_dur, 0.0, 1.0)
	height = 4.0 * air_peak * p * (1.0 - p)
	if trick != "":
		trick_t += delta
		if trick_t >= trick_len:
			var name: String = TRICKS[trick]["name"]
			if trick == "grab":
				name = GRAB_NAMES[randi() % GRAB_NAMES.size()]
			tricks_done.append({"type": trick, "name": name, "points": TRICKS[trick]["points"]})
			trick = ""
			if queued != "":
				var q := queued
				queued = ""
				_start_trick(q)
	if air_t >= air_dur:
		_land()

func _land() -> void:
	height = 0.0
	# Landing mid-trick (more than a sliver left) is a bail.
	if trick != "" and trick_t < trick_len * 0.8:
		var done := tricks_done.duplicate()
		state = S.SKI
		bailed_landing.emit(done)
		return
	if trick != "":
		tricks_done.append({"type": trick, "name": TRICKS[trick]["name"], "points": TRICKS[trick]["points"]})
	trick = ""
	queued = ""
	state = S.SKI
	landed.emit(air_dur, tricks_done.duplicate())

## Combines a list of completed tricks into a display name: "720", "DOUBLE BACKFLIP"...
static func describe(tricks: Array) -> String:
	if tricks.is_empty():
		return ""
	var parts: Array[String] = []
	var i := 0
	while i < tricks.size():
		var t: Dictionary = tricks[i]
		var n := 1
		while i + n < tricks.size() and tricks[i + n]["type"] == t["type"] and t["type"] != "grab":
			n += 1
		match t["type"]:
			"spin": parts.append(str(360 * n))
			"flip":
				parts.append(["BACKFLIP", "DOUBLE BACKFLIP", "TRIPLE BACKFLIP"][mini(n, 3) - 1] if n <= 3 else "%dx BACKFLIP" % n)
			_: parts.append(t["name"])
		i += n
	return " + ".join(parts)

func _apply_pose() -> void:
	if body == null:
		return
	var pose := "down"
	var a := absf(heading)
	if a > 0.95:
		pose = "side"
	elif a > 0.26:
		pose = "diag"
	body.flip_h = heading < 0.0
	body.rotation = 0.0
	body.scale = Vector2(SCALE, SCALE)
	match state:
		S.AIR:
			pose = "grab" if trick == "grab" else "air"
			if trick == "spin":
				body.rotation = trick_dir * TAU * clampf(trick_t / trick_len, 0, 1)
			elif trick == "flip":
				var p := clampf(trick_t / trick_len, 0, 1)
				body.scale.y = SCALE * cos(p * TAU)
				body.scale.x = SCALE * (1.0 + 0.15 * sin(p * PI))
		S.CRASH, S.CAUGHT:
			pose = "crash"
		_:
			pass
	if wobble_t > 0.0:
		body.rotation = sin(wobble_t * 40.0) * 0.25
	var t: Texture2D = _tex[pose]
	body.texture = t
	var lift := height + (8.0 if state == S.AIR and trick == "flip" else 0.0) * sin(clampf(trick_t / maxf(trick_len, 0.01), 0, 1) * PI)
	body.position = Vector2(0, -t.get_height() * SCALE * 0.5 - lift)
	var sh := clampf(1.0 - height / 90.0, 0.4, 1.0)
	shadow.scale = Vector2(SCALE * sh, SCALE * sh)
	shadow.position = Vector2(0, -1)
	if invuln > 0.0:
		body.modulate.a = 0.35 if int(invuln * 12.0) % 2 == 0 else 1.0
	else:
		body.modulate.a = 1.0
