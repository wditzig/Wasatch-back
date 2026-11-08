extends RefCounted
## Timed world events and the fictional MONOPEAK newswire.
##   whiteout   - visibility drops, the GONDOLUX closes "due to weather"
##   powder_day - fresh snow, all points x2
## Also tracks the perpetually slipping gondola opening date.

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
var gondola_year := 2031
var gondola_quarter := 4
var gondola_excuse := "WEATHER"

func _init() -> void:
	_order = range(Headlines.HEADLINES.size())
	_order.shuffle()

func gondola_eta() -> String:
	return "Q%d %d" % [gondola_quarter, gondola_year]

func _delay_gondola() -> void:
	gondola_quarter += randi_range(1, 3)
	while gondola_quarter > 4:
		gondola_quarter -= 4
		gondola_year += 1
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
			event_started.emit(id, "WHITEOUT!", "GONDOLUX(tm) CLOSED DUE TO %s. NEW ETA: %s" % [gondola_excuse, gondola_eta()])
		"powder_day":
			_timer = 10.0
			event_started.emit(id, "POWDER DAY!", "Fresh public snow. All points x2!")
