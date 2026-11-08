extends RefCounted
## Timed world events and the fictional MONOPEAK newswire.
##   whiteout   - visibility drops, the GONDOLUX closes "due to weather"
##   powder_day - fresh snow, all points x2
## Also supplies the GONDOLUX(tm) opening date (EST. 2057, forever) and its excuses.

const Headlines = preload("res://scripts/data/headlines.gd")

signal event_started(id: String, title: String, subtitle: String)
signal event_ended(id: String)
signal headline(text: String)

var active := ""
var _timer := 0.0
var _next_event := 22.0
var _next_headline := 2.0
var _headline_idx := 0
var _order: Array = []
## The GONDOLUX(tm) opening date matches the in-game sign: EST. 2057.
## Delays never move the date, only the excuse.
const GONDOLA_YEAR := 2057
var gondola_excuse := "WEATHER"

func _init() -> void:
	_order = range(Headlines.HEADLINES.size())
	_order.shuffle()

func gondola_eta() -> String:
	return "EST. %d" % GONDOLA_YEAR

func _delay_gondola() -> void:
	gondola_excuse = Headlines.GONDOLA_EXCUSES[randi() % Headlines.GONDOLA_EXCUSES.size()]

func update(delta: float, zone_index: int) -> void:
	_next_headline -= delta
	if _next_headline <= 0.0:
		_next_headline = 11.0
		var text: String = Headlines.HEADLINES[_order[_headline_idx % _order.size()]]
		_headline_idx += 1
		if text.contains("GONDOLUX"):
			_delay_gondola()
		headline.emit(text)
	if active != "":
		_timer -= delta
		if _timer <= 0.0:
			var id := active
			active = ""
			event_ended.emit(id)
		return
	_next_event -= delta
	if _next_event <= 0.0:
		_next_event = randf_range(24.0, 36.0)
		var pool := ["powder_day"]
		if zone_index >= 1:
			pool.append("whiteout")
			pool.append("whiteout")
		_start(pool[randi() % pool.size()])

func _start(id: String) -> void:
	active = id
	match id:
		"whiteout":
			_timer = 9.0
			_delay_gondola()
			event_started.emit(id, "WHITEOUT!", "GONDOLUX(tm) CLOSED DUE TO %s. STILL OPENING %d." % [gondola_excuse, GONDOLA_YEAR])
		"powder_day":
			_timer = 10.0
			event_started.emit(id, "POWDER DAY!", "Fresh public snow. All points x2!")
