extends Control
## Animated title backdrop: a pixel Wasatch skyline at alpenglow, pines,
## falling snow and a lone rider carving across the foreground.

var _t := 0.0
var _peaks: PackedVector2Array
var _rider_tex: Array = []
var _pine: Texture2D
var _pine_s: Texture2D

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_pine = Art.tex("pine_big")
	_pine_s = Art.tex("pine_small")
	var prefix := "ski" if Game.rider == "skier" else "board"
	for p in ["side", "diag", "down"]:
		_rider_tex.append(Art.tex(prefix + "_" + p, Game.current_outfit()))
	var snow := CPUParticles2D.new()
	snow.amount = 60
	snow.lifetime = 7.0
	snow.preprocess = 7.0
	snow.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	snow.emission_rect_extents = Vector2(260, 4)
	snow.position = Vector2(180, -10)
	snow.direction = Vector2(0.25, 1)
	snow.spread = 10
	snow.gravity = Vector2.ZERO
	snow.initial_velocity_min = 25
	snow.initial_velocity_max = 55
	snow.scale_amount_min = 1.5
	snow.scale_amount_max = 3
	add_child(snow)

func _process(delta: float) -> void:
	_t += delta
	queue_redraw()

func _band(y0: float, y1: float, c: Color) -> void:
	draw_rect(Rect2(0, y0, size.x, y1 - y0), c)

## Jagged ridge line, stepped so it reads as pixel art.
func _ridge(base: float, amp: float, seed: float, step: float, c: Color, snowcap := Color(0, 0, 0, 0)) -> void:
	var pts := PackedVector2Array()
	pts.append(Vector2(0, size.y))
	var x := 0.0
	var prev_h := base
	while x <= size.x + step:
		var h := base - amp * (0.5 + 0.5 * sin(x * 0.021 + seed)) * (0.6 + 0.4 * sin(x * 0.057 + seed * 2.0)) - amp * 0.35 * absf(sin(x * 0.011 + seed * 0.5))
		h = floorf(h / 4.0) * 4.0
		pts.append(Vector2(x, prev_h))
		pts.append(Vector2(x, h))
		prev_h = h
		x += step
	pts.append(Vector2(size.x, size.y))
	draw_colored_polygon(pts, c)
	if snowcap.a > 0.0:
		x = 0.0
		while x <= size.x:
			var h2 := base - amp * (0.5 + 0.5 * sin(x * 0.021 + seed)) * (0.6 + 0.4 * sin(x * 0.057 + seed * 2.0)) - amp * 0.35 * absf(sin(x * 0.011 + seed * 0.5))
			h2 = floorf(h2 / 4.0) * 4.0
			if h2 < base - amp * 0.55:
				draw_rect(Rect2(x, h2, step, 6), snowcap)
			x += step

func _draw() -> void:
	var h := size.y
	# alpenglow sky
	_band(0, h * 0.12, Color8(36, 34, 88))
	_band(h * 0.12, h * 0.22, Color8(74, 52, 120))
	_band(h * 0.22, h * 0.3, Color8(150, 74, 130))
	_band(h * 0.3, h * 0.36, Color8(232, 120, 120))
	_band(h * 0.36, h * 0.42, Color8(250, 176, 120))
	_band(h * 0.42, h, Color8(250, 210, 150))
	# stars
	for i in 18:
		var sx := fmod(i * 97.3, size.x)
		var sy := fmod(i * 41.7, h * 0.18)
		var tw := 0.5 + 0.5 * sin(_t * 2.0 + i)
		draw_rect(Rect2(sx, sy, 2, 2), Color(1, 1, 1, 0.3 + 0.5 * tw))
	_ridge(h * 0.5, h * 0.2, 1.3, 8, Color8(112, 96, 150), Color8(240, 200, 210))
	_ridge(h * 0.6, h * 0.16, 4.1, 6, Color8(70, 70, 120), Color8(250, 236, 240))
	_ridge(h * 0.7, h * 0.08, 2.2, 4, Color8(44, 52, 96))
	# snowfield
	draw_rect(Rect2(0, h * 0.72, size.x, h * 0.28), Color8(232, 240, 255))
	draw_rect(Rect2(0, h * 0.72, size.x, 3), Color8(200, 214, 240))
	# tree line
	var xs := [8.0, 40.0, 70.0, 280.0, 310.0, 336.0, 20.0, 322.0]
	for i in xs.size():
		var tex: Texture2D = _pine if i % 2 == 0 else _pine_s
		var sc := 3.0 if i < 6 else 2.0
		var y := h * 0.72 + (40.0 if i >= 6 else 6.0)
		var tw2 := tex.get_size() * sc
		draw_texture_rect(tex, Rect2(Vector2(xs[i] * size.x / 360.0 - tw2.x * 0.5, y - tw2.y + 30.0), tw2), false)
	# carving rider
	var phase := fmod(_t * 0.25, 1.0)
	var rx := lerpf(-40.0, size.x + 40.0, phase)
	var ry := h * 0.86 + sin(phase * TAU * 2.0) * 14.0
	var idx := int(_t * 2.0) % 3
	var rt: Texture2D = _rider_tex[idx]
	draw_texture_rect(rt, Rect2(Vector2(rx - 18, ry - 48), rt.get_size() * 3.0), false)
	for k in 6:
		draw_rect(Rect2(rx - 30 - k * 10, ry - 4 + sin((phase - k * 0.01) * TAU * 2.0) * 4.0, 6, 2), Color8(168, 188, 224))
