extends Node2D
## Ski / board tracks drawn behind the rider. In deep powder the tracks become
## a wide, shaded trench.

var segments: Array = [] # [{pts: PackedVector2Array, deep: bool}]
var double_line := true
var color := Color(0.7, 0.78, 0.92, 0.9)
var _last := Vector2.INF
var _last_deep := false

func _ready() -> void:
	z_index = -8

func add_point(p: Vector2, on_ground: bool, deep := false) -> void:
	if not on_ground:
		_last = Vector2.INF
		return
	if _last == Vector2.INF or deep != _last_deep:
		var start := PackedVector2Array()
		if _last != Vector2.INF:
			start.append(_last) # keep the line continuous across style changes
		start.append(p)
		segments.append({"pts": start, "deep": deep})
		_last = p
		_last_deep = deep
		return
	if p.distance_to(_last) < 5.0:
		return
	var seg: Dictionary = segments[segments.size() - 1]
	var pts: PackedVector2Array = seg["pts"]
	pts.append(p)
	seg["pts"] = pts
	_last = p

func break_line() -> void:
	_last = Vector2.INF

func prune(min_y: float) -> void:
	while segments.size() > 0:
		var pts: PackedVector2Array = segments[0]["pts"]
		if pts.size() == 0 or pts[pts.size() - 1].y < min_y:
			segments.remove_at(0)
		else:
			break
	queue_redraw()

func _draw() -> void:
	for seg in segments:
		var pts: PackedVector2Array = seg["pts"]
		if pts.size() < 2:
			continue
		if seg["deep"]:
			# powder trench: soft wide furrow with a darker core and bright lip
			draw_polyline(pts, Color(0.62, 0.72, 0.92, 0.5), 12.0)
			draw_polyline(pts, Color(0.5, 0.6, 0.86, 0.6), 6.0)
			var lip := PackedVector2Array()
			for q in pts:
				lip.append(q + Vector2(-6, 0))
			draw_polyline(lip, Color(1, 1, 1, 0.9), 1.5)
		elif double_line:
			var l := PackedVector2Array()
			var r := PackedVector2Array()
			for i in pts.size():
				var a: Vector2 = pts[maxi(i - 1, 0)]
				var b: Vector2 = pts[mini(i + 1, pts.size() - 1)]
				var n := (b - a).normalized().orthogonal() * 3.0
				l.append(pts[i] + n)
				r.append(pts[i] - n)
			draw_polyline(l, color, 1.5)
			draw_polyline(r, color, 1.5)
		else:
			draw_polyline(pts, color, 5.0)
			draw_polyline(pts, Color(color, color.a * 0.5), 7.0)
