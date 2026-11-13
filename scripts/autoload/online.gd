extends Node
## Global HIGH SCORE and LONGEST DISTANCE walls, backed by Supabase's REST API.
## Fully optional: with no config (scripts/data/online_config.gd) every call is
## a no-op and the game stays offline. Works on web (fetch/CORS) and native.

signal walls_updated

const Cfg = preload("res://scripts/data/online_config.gd")
const WALL_SIZE := 10
const FIELDS := "initials,score,distance,rider,phase,created_at"

var url := ""
var key := ""
var score_wall: Array = []
var distance_wall: Array = []
var loaded := false
var error := ""
var _busy := 0

func _ready() -> void:
	url = Cfg.SUPABASE_URL.strip_edges().trim_suffix("/")
	key = Cfg.SUPABASE_ANON_KEY.strip_edges()
	for a in Game.dev_args():
		if a.begins_with("--online-url="):
			url = a.substr(13).trim_suffix("/")
		elif a.begins_with("--online-key="):
			key = a.substr(13)
	if enabled():
		refresh()

func enabled() -> bool:
	return url != "" and key != ""

## Test/dev runs (bots, --start-m, etc.) must never reach the real walls.
func can_submit() -> bool:
	if not enabled():
		return false
	var args := Game.dev_args()
	if args.has("--online-test"):
		return true
	for a in args:
		if not (a.begins_with("--online-") or a.begins_with("--rider=")):
			return false
	return true

func _headers(extra: Array = []) -> PackedStringArray:
	var h := PackedStringArray(["apikey: " + key, "Authorization: Bearer " + key, "Content-Type: application/json"])
	h.append_array(extra)
	return h

func refresh() -> void:
	if not enabled():
		return
	_get_wall("score", func(rows): score_wall = rows)
	_get_wall("distance", func(rows): distance_wall = rows)

func _get_wall(column: String, store: Callable) -> void:
	var req := HTTPRequest.new()
	req.timeout = 12.0
	req.accept_gzip = false # browsers already decompress; double-decoding fails on web
	add_child(req)
	_busy += 1
	req.request_completed.connect(func(result, code, _h, body):
		_busy -= 1
		req.queue_free()
		var json := JSON.new()
		if result == HTTPRequest.RESULT_SUCCESS and code == 200 and body.size() > 0 \
				and json.parse(body.get_string_from_utf8()) == OK and json.data is Array:
			store.call(json.data)
			loaded = true
			error = ""
		else:
			error = "Couldn't reach the walls (offline?)"
			if not Game.dev_args().is_empty():
				print("ONLINE wall read failed result=%d code=%d bytes=%d" % [result, code, body.size()])
		if _busy == 0:
			walls_updated.emit())
	var q := "%s/rest/v1/scores?select=%s&order=%s.desc,created_at.asc&limit=%d" % [url, FIELDS, column, WALL_SIZE]
	if req.request(q, _headers()) != OK:
		_busy -= 1
		req.queue_free()

## Would this run make either wall? (If the walls haven't loaded, assume yes
## so the player still gets to enter initials.)
func qualifies(score: int, distance: int) -> bool:
	if not can_submit():
		return false
	if not loaded:
		return true
	return _beats(score_wall, "score", score) or _beats(distance_wall, "distance", distance)

func _beats(wall: Array, field: String, value: int) -> bool:
	if value <= 0:
		return false
	if wall.size() < WALL_SIZE:
		return true
	return value > int(wall[wall.size() - 1][field])

## Position this run would take on a wall (1-based), or 0.
func place_on(field: String, value: int) -> int:
	var wall: Array = score_wall if field == "score" else distance_wall
	for i in wall.size():
		if value > int(wall[i][field]):
			return i + 1
	return wall.size() + 1 if wall.size() < WALL_SIZE and value > 0 else 0

func submit(run: Dictionary) -> void:
	if not Game.dev_args().is_empty():
		print("ONLINE submit can=%s" % can_submit())
	if not can_submit():
		return
	var body := {
		"initials": String(run.get("initials", "---")),
		"score": int(run["score"]),
		"distance": int(run["distance"]),
		"rider": String(run.get("rider", "skier")),
		"phase": String(run.get("phase", "")).substr(0, 40),
		"cause": String(run.get("cause", "")).substr(0, 40),
	}
	var req := HTTPRequest.new()
	req.timeout = 12.0
	req.accept_gzip = false
	add_child(req)
	req.request_completed.connect(func(result, code, _h, _body):
		req.queue_free()
		if not Game.dev_args().is_empty():
			print("ONLINE post result=%d code=%d" % [result, code])
		if result == HTTPRequest.RESULT_SUCCESS and code >= 200 and code < 300:
			refresh()
		else:
			error = "Couldn't post your run (code %d)" % code)
	req.request(url + "/rest/v1/scores", _headers(["Prefer: return=minimal"]), HTTPClient.METHOD_POST, JSON.stringify(body))
