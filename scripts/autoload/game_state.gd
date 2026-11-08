extends Node
## Persistent player profile: selected rider/outfit, settings, high scores,
## unlock progress. Saved locally with ConfigFile - no backend required.

const Riders = preload("res://scripts/data/riders.gd")
const SAVE_PATH := "user://wasatch_back.cfg"
const MAX_SCORES := 10

signal settings_changed

var rider := "skier"
var outfit := "classic"
var settings := {
	"music": 0.6,
	"sfx": 0.85,
	"controls": "drag", # "drag" (ski toward finger) or "zones" (hold left/right halves)
	"shake": true,
	"haptics": true,
}
var high_scores: Array = []
var best_distance := 0.0
var best_score := 0
var total_tokens := 0
var runs := 0
var seen_tutorial := false
var last_initials := "AAA"
var acquired_count := 0

var _shot_dir := ""
var _shot_every := 2.0
var _shot_t := 0.0
var _shot_n := 0

const TITLE := "Wasatch Back — You Can't Ski Free"

func _ready() -> void:
	DisplayServer.window_set_title(TITLE)
	_setup_input()
	load_game()
	# Dev tool: `-- --shots=<dir> [--shot-every=2]` saves periodic screenshots.
	for a in dev_args():
		if a.begins_with("--shots="):
			_shot_dir = a.substr(8)
		elif a.begins_with("--shot-every="):
			_shot_every = float(a.substr(13))
	process_mode = Node.PROCESS_MODE_ALWAYS
	set_process(_shot_dir != "")

var _dev_args = null

## Developer/testing flags: command-line user args (`-- --autoplay`), or on
## the web the URL hash, e.g. index.html#--autoplay,--start-m=700
func dev_args() -> PackedStringArray:
	if _dev_args == null:
		var args := OS.get_cmdline_user_args()
		if OS.has_feature("web"):
			var h = JavaScriptBridge.eval("decodeURIComponent(window.location.hash || '')", true)
			if typeof(h) == TYPE_STRING and String(h).begins_with("#--"):
				for part in String(h).substr(1).split(","):
					args.append(part)
		_dev_args = args
	return _dev_args

func _process(delta: float) -> void:
	_shot_t += delta
	if _shot_t >= _shot_every:
		_shot_t = 0.0
		_shot_n += 1
		var img := get_viewport().get_texture().get_image()
		img.save_png("%s/shot_%03d.png" % [_shot_dir, _shot_n])

func _setup_input() -> void:
	var map := {
		"steer_left": [KEY_LEFT, KEY_A],
		"steer_right": [KEY_RIGHT, KEY_D],
		"tuck": [KEY_DOWN, KEY_S],
		"brake": [KEY_UP, KEY_W],
		"jump": [KEY_SPACE, KEY_J],
		"backflip": [KEY_K],
		"grab": [KEY_L],
		"pause": [KEY_ESCAPE, KEY_P],
		"restart": [KEY_R],
	}
	for action in map.keys():
		if not InputMap.has_action(action):
			InputMap.add_action(action)
		for k in map[action]:
			var ev := InputEventKey.new()
			ev.physical_keycode = k
			InputMap.action_add_event(action, ev)

# ---------------------------------------------------------------- persistence
func load_game() -> void:
	var cf := ConfigFile.new()
	if cf.load(SAVE_PATH) != OK:
		return
	rider = cf.get_value("profile", "rider", rider)
	outfit = cf.get_value("profile", "outfit", outfit)
	best_distance = cf.get_value("profile", "best_distance", 0.0)
	best_score = cf.get_value("profile", "best_score", 0)
	total_tokens = cf.get_value("profile", "total_tokens", 0)
	runs = cf.get_value("profile", "runs", 0)
	seen_tutorial = cf.get_value("profile", "seen_tutorial", false)
	last_initials = cf.get_value("profile", "last_initials", "AAA")
	acquired_count = cf.get_value("profile", "acquired_count", 0)
	high_scores = cf.get_value("scores", "list", [])
	var s: Dictionary = cf.get_value("settings", "values", {})
	for k in s.keys():
		settings[k] = s[k]
	if not Riders.RIDERS.has(rider):
		rider = "skier"
	if not is_unlocked(outfit):
		outfit = "classic"

func save_game() -> void:
	var cf := ConfigFile.new()
	cf.set_value("profile", "rider", rider)
	cf.set_value("profile", "outfit", outfit)
	cf.set_value("profile", "best_distance", best_distance)
	cf.set_value("profile", "best_score", best_score)
	cf.set_value("profile", "total_tokens", total_tokens)
	cf.set_value("profile", "runs", runs)
	cf.set_value("profile", "seen_tutorial", seen_tutorial)
	cf.set_value("profile", "last_initials", last_initials)
	cf.set_value("profile", "acquired_count", acquired_count)
	cf.set_value("scores", "list", high_scores)
	cf.set_value("settings", "values", settings)
	cf.save(SAVE_PATH)

func set_setting(key: String, value) -> void:
	settings[key] = value
	save_game()
	settings_changed.emit()

func reset_progress() -> void:
	high_scores = []
	best_distance = 0.0
	best_score = 0
	total_tokens = 0
	runs = 0
	rider = "skier"
	outfit = "classic"
	save_game()

# ---------------------------------------------------------------- unlocks
func is_unlocked(outfit_id: String) -> bool:
	var o := Riders.outfit(outfit_id)
	var r: Array = o["req"]
	match r[0]:
		"distance": return best_distance >= float(r[1])
		"score": return best_score >= int(r[1])
		"tokens": return total_tokens >= int(r[1])
		"runs": return runs >= int(r[1])
	return true

func current_outfit() -> Dictionary:
	return Riders.outfit(outfit)

## Records a finished run. Returns {rank (-1 if not top 10), new_best, unlocked: [names]}.
func record_run(score: int, distance_m: float, tokens: int, cause: String, phase := "") -> Dictionary:
	var before := {}
	for o in Riders.OUTFITS:
		before[o["id"]] = is_unlocked(o["id"])
	runs += 1
	total_tokens += tokens
	var new_best := score > best_score
	best_score = maxi(best_score, score)
	best_distance = maxf(best_distance, distance_m)
	var entry := {
		"score": score,
		"distance": int(distance_m),
		"rider": rider,
		"cause": cause,
		"phase": phase,
		"initials": last_initials,
		"date": Time.get_date_string_from_system(),
	}
	high_scores.append(entry)
	high_scores.sort_custom(func(a, b): return int(a["score"]) > int(b["score"]))
	var rank := high_scores.find(entry)
	if high_scores.size() > MAX_SCORES:
		high_scores.resize(MAX_SCORES)
	if rank >= MAX_SCORES:
		rank = -1
	var unlocked: Array = []
	for o in Riders.OUTFITS:
		if not before[o["id"]] and is_unlocked(o["id"]):
			unlocked.append(o["name"])
	save_game()
	return {"rank": rank, "new_best": new_best, "unlocked": unlocked, "entry": entry if rank >= 0 else {}}

## Stores initials on a high-score entry (and remembers them for next time).
func set_initials(entry: Dictionary, initials: String) -> void:
	initials = initials.strip_edges().to_upper().substr(0, 3)
	if initials == "":
		initials = "???"
	entry["initials"] = initials
	last_initials = initials
	save_game()

func vibrate(ms: int) -> void:
	if settings.get("haptics", true) and (OS.has_feature("android") or OS.has_feature("ios") or OS.has_feature("web_android")):
		Input.vibrate_handheld(ms)
