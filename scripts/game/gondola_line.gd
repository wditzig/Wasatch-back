extends Node2D
## The GONDOLUX(tm): an overhead cable with cabins. Stalled during
## construction, "VIP ONLY" later, and closed whenever the weather turns.

var cable_x := 150.0
var start_y := 9600.0
var running := false
var closed := false
var _offset := 0.0
var cabin_tex: Texture2D
var view := Rect2()

const SPACING := 240.0

func _ready() -> void:
	z_index = 40
	cabin_tex = Art.tex("cabin")

func update(delta: float, p_view: Rect2) -> void:
	view = p_view
	if running and not closed:
		_offset = fmod(_offset + 45.0 * delta, SPACING)
	queue_redraw()

func _draw() -> void:
	var top := maxf(view.position.y, start_y)
	var bottom := view.end.y
	if bottom < start_y:
		return
	var shadow := Color(0.1, 0.12, 0.25, 0.12)
	# cable shadows on the snow, then the cables themselves
	draw_line(Vector2(cable_x + 14, top), Vector2(cable_x + 14, bottom), shadow, 2.0)
	draw_line(Vector2(cable_x - 14, top), Vector2(cable_x - 14, bottom), Color(0.15, 0.16, 0.22), 1.0)
	draw_line(Vector2(cable_x + 14, top), Vector2(cable_x + 14, bottom), Color(0.15, 0.16, 0.22), 1.0)
	var first := floorf((top - start_y) / SPACING) * SPACING + start_y
	var y := first
	var sway := 0.0
	if closed:
		sway = sin(Time.get_ticks_msec() / 300.0) * 3.0
	while y < bottom + SPACING:
		var cy := y - _offset
		var side := -14.0 if int((y - start_y) / SPACING) % 2 == 0 else 14.0
		var pos := Vector2(cable_x + side + sway - cabin_tex.get_width(), cy)
		draw_rect(Rect2(pos + Vector2(18, 40), Vector2(16, 10)), shadow)
		draw_texture_rect(cabin_tex, Rect2(pos, cabin_tex.get_size() * 2.0), false)
		y += SPACING
