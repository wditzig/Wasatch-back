extends Node2D
## Ski / board tracks drawn behind the rider.

var segments: Array = [] # Array of PackedVector2Array
var double_line := true
var color := Color(0.7, 0.78, 0.92, 0.9)
var _last := Vector2.INF

func _ready() -> void:
	z_index = -8

func add_point(p: Vector2, on_ground: bool) -> void:
	if not on_ground:
		_last = Vector2.INF
		return
	if _last == Vector2.INF:
		segments.append(PackedVector2Array([p]))
		_last = p
		return
	if p.distance_to(_last) < 5.0:
		return
	var seg: PackedVector2Array = segments[segments.size() - 1]
	seg.append(p)
	segments[segments.size() - 1] = seg
	_last = p

func break_line() -> void:
	_last = Vector2.INF

func prune(min_y: float) -> void:
	while segments.size() > 0:
		var seg: PackedVector2Array = segments[0]
		if seg.size() == 0 or seg[seg.size() - 1].y < min_y:
			segments.remove_at(0)
		else:
			break
	queue_redraw()

func _draw() -> void:
	for seg in segments:
		if seg.size() < 2:
			continue
		if double_line:
			var l := PackedVector2Array()
			var r := PackedVector2Array()
			for i in seg.size():
				var a: Vector2 = seg[maxi(i - 1, 0)]
				var b: Vector2 = seg[mini(i + 1, seg.size() - 1)]
				var n := (b - a).normalized().orthogonal() * 3.0
				l.append(seg[i] + n)
				r.append(seg[i] - n)
			draw_polyline(l, color, 1.5)
			draw_polyline(r, color, 1.5)
		else:
			draw_polyline(seg, color, 5.0)
