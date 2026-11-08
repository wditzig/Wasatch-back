extends CanvasLayer
## In-run HUD: score, distance, combo meter, lives, banners, newswire ticker,
## pause menu and game-over screen.

signal pause_requested
signal resume_requested
signal restart_requested
signal menu_requested

const UI = preload("res://scripts/ui/ui_kit.gd")
const HowToPlay = preload("res://scripts/ui/how_to_play.gd")
const Share = preload("res://scripts/ui/share.gd")

var root: Control
var score_l: Label
var dist_l: Label
var tokens_l: Label
var lives_box: HBoxContainer
var combo_l: Label
var combo_bar: ColorRect
var combo_bar_bg: ColorRect
var banner: TextureRect
var banner_sub: Label
var event_l: Label
var msg_l: Label
var warn_l: Label
var hint_l: Label
var ticker_l: Label
var ticker_clip: Control
var ticker_head: Label
var pause_btn: Button
var pause_ov: Dictionary
var over_ov: Dictionary
var _ticker_x := 0.0
var _warn_t := 0.0
var _life_tex: Texture2D

func _ready() -> void:
	layer = 10
	process_mode = Node.PROCESS_MODE_ALWAYS
	root = Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.theme = UI.make_theme()
	add_child(root)
	_life_tex = Art.tex("life", Game.current_outfit())
	_build_top()
	_build_center()
	_build_ticker()
	_build_pause()
	_build_over()

func _build_top() -> void:
	var bar := ColorRect.new()
	bar.color = Color(UI.NAVY, 0.72)
	bar.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	bar.custom_minimum_size = Vector2(0, 46)
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(bar)
	score_l = UI.label("0", 22, Color.WHITE, HORIZONTAL_ALIGNMENT_LEFT)
	score_l.position = Vector2(10, 2)
	score_l.autowrap_mode = TextServer.AUTOWRAP_OFF
	bar.add_child(score_l)
	dist_l = UI.label("0 m", 12, UI.ICE, HORIZONTAL_ALIGNMENT_LEFT)
	dist_l.position = Vector2(11, 28)
	dist_l.autowrap_mode = TextServer.AUTOWRAP_OFF
	bar.add_child(dist_l)
	lives_box = HBoxContainer.new()
	lives_box.add_theme_constant_override("separation", 4)
	lives_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bar.add_child(lives_box)
	tokens_l = UI.label("0", 12, UI.GOLD, HORIZONTAL_ALIGNMENT_LEFT)
	tokens_l.autowrap_mode = TextServer.AUTOWRAP_OFF
	tokens_l.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	tokens_l.position = Vector2(4, 28)
	bar.add_child(tokens_l)
	var tok_icon := UI.sprite_rect(Art.tex("token"), 1.5)
	tok_icon.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	tok_icon.position = Vector2(-10, 29)
	bar.add_child(tok_icon)
	pause_btn = Button.new()
	pause_btn.text = "II"
	pause_btn.add_theme_font_size_override("font_size", 16)
	pause_btn.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	pause_btn.custom_minimum_size = Vector2(44, 38)
	pause_btn.position = Vector2(-50, 4)
	pause_btn.focus_mode = Control.FOCUS_NONE
	pause_btn.pressed.connect(func(): pause_requested.emit())
	bar.add_child(pause_btn)
	# combo meter
	combo_l = UI.label("", 16, UI.GOLD, HORIZONTAL_ALIGNMENT_CENTER, 4)
	combo_l.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	combo_l.position = Vector2(0, 50)
	root.add_child(combo_l)
	combo_bar_bg = ColorRect.new()
	combo_bar_bg.color = Color(UI.NAVY, 0.6)
	combo_bar_bg.size = Vector2(120, 5)
	combo_bar_bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(combo_bar_bg)
	combo_bar = ColorRect.new()
	combo_bar.color = UI.GOLD
	combo_bar.size = Vector2(120, 5)
	combo_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(combo_bar)
	combo_bar_bg.visible = false
	combo_bar.visible = false
	warn_l = UI.label("", 14, UI.RED, HORIZONTAL_ALIGNMENT_CENTER, 4)
	warn_l.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	warn_l.position = Vector2(0, 92)
	root.add_child(warn_l)

func _build_center() -> void:
	banner = TextureRect.new()
	banner.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	banner.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	banner.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	banner.mouse_filter = Control.MOUSE_FILTER_IGNORE
	banner.modulate.a = 0.0
	root.add_child(banner)
	banner_sub = UI.label("", 13, Color.WHITE, HORIZONTAL_ALIGNMENT_CENTER, 4)
	banner_sub.modulate.a = 0.0
	root.add_child(banner_sub)
	event_l = UI.label("", 13, UI.GOLD, HORIZONTAL_ALIGNMENT_CENTER, 4)
	event_l.modulate.a = 0.0
	root.add_child(event_l)
	msg_l = UI.label("", 14, Color.WHITE, HORIZONTAL_ALIGNMENT_CENTER, 4)
	msg_l.modulate.a = 0.0
	root.add_child(msg_l)
	hint_l = UI.label("", 13, UI.NAVY2, HORIZONTAL_ALIGNMENT_CENTER, 0)
	root.add_child(hint_l)

func _build_ticker() -> void:
	ticker_clip = Control.new()
	ticker_clip.clip_contents = true
	ticker_clip.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	ticker_clip.custom_minimum_size = Vector2(0, 26)
	ticker_clip.position.y = -26
	ticker_clip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(ticker_clip)
	var bg := ColorRect.new()
	bg.color = Color(UI.NAVY, 0.85)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ticker_clip.add_child(bg)
	ticker_l = UI.label("", 12, UI.SNOW, HORIZONTAL_ALIGNMENT_LEFT)
	ticker_l.autowrap_mode = TextServer.AUTOWRAP_OFF
	ticker_l.position = Vector2(400, 5)
	ticker_clip.add_child(ticker_l)
	ticker_head = UI.label(" MONOPEAK NEWSWIRE ", 11, UI.NAVY, HORIZONTAL_ALIGNMENT_LEFT)
	ticker_head.autowrap_mode = TextServer.AUTOWRAP_OFF
	var sb := StyleBoxFlat.new()
	sb.bg_color = UI.ORANGE
	sb.set_content_margin_all(5)
	ticker_head.add_theme_stylebox_override("normal", sb)
	ticker_head.position = Vector2(0, 0)
	ticker_clip.add_child(ticker_head)

func _layout() -> void:
	var vs := root.get_viewport_rect().size
	if banner.texture:
		banner.size = banner.custom_minimum_size
		banner.position = Vector2((vs.x - banner.size.x) * 0.5, vs.y * 0.52)
	banner_sub.size = Vector2(vs.x - 24, 0)
	banner_sub.position = Vector2(12, vs.y * 0.52 + banner.size.y + 4)
	event_l.size = Vector2(vs.x - 24, 0)
	event_l.position = Vector2(12, 118)
	msg_l.size = Vector2(vs.x - 24, 0)
	msg_l.position = Vector2(12, vs.y * 0.74)
	hint_l.size = Vector2(vs.x - 24, 0)
	hint_l.position = Vector2(12, vs.y * 0.82)
	lives_box.position = Vector2((vs.x - lives_box.get_combined_minimum_size().x) * 0.5, 6)
	combo_bar_bg.position = Vector2((vs.x - 120) * 0.5, 74)
	combo_bar.position = combo_bar_bg.position

func _process(delta: float) -> void:
	if _entering and _slot < _slot_letters.size():
		_blink += delta
		for i in _slot_letters.size():
			_slot_letters[i].modulate.a = (0.45 + 0.55 * absf(cos(_blink * 4.0))) if i == _slot else 1.0
	_layout()
	ticker_l.position.x -= 48.0 * delta
	if ticker_l.position.x < -ticker_l.size.x:
		ticker_l.position.x = root.get_viewport_rect().size.x
	if _warn_t > 0.0:
		_warn_t -= delta
		warn_l.visible = int(_warn_t * 5.0) % 2 == 0
		if _warn_t <= 0.0:
			warn_l.text = ""

func is_point_on_ui(p: Vector2) -> bool:
	return pause_btn.get_global_rect().grow(6).has_point(p) or pause_ov["root"].visible or over_ov["root"].visible

# ---------------------------------------------------------------- updates
func set_stats(score: int, meters: float, tokens: int) -> void:
	score_l.text = _fmt(score)
	dist_l.text = "%d m" % int(meters)
	tokens_l.text = str(tokens)

func set_lives(n: int) -> void:
	for c in lives_box.get_children():
		c.queue_free()
	for i in 3:
		var tr := UI.sprite_rect(_life_tex, 2.5)
		tr.modulate = Color.WHITE if i < n else Color(0.3, 0.3, 0.4, 0.6)
		lives_box.add_child(tr)


func set_combo(count: int, pool: int, mult: float, timer_frac: float) -> void:
	if count <= 0:
		combo_l.text = ""
		combo_bar.visible = false
		combo_bar_bg.visible = false
		return
	combo_l.text = "COMBO x%s   +%s" % [_mult_str(mult), _fmt(pool)]
	combo_bar.visible = true
	combo_bar_bg.visible = true
	combo_bar.size.x = 120.0 * clampf(timer_frac, 0, 1)

func _mult_str(m: float) -> String:
	return str(int(m)) if is_equal_approx(m, roundf(m)) else "%.1f" % m

func show_banner(title: String, sub: String, color := Color.WHITE, sub_color := Color.WHITE) -> void:
	banner.texture = Art.text_tex(title, color)
	var sc := 2.0
	if banner.texture.get_width() * 2.0 > root.get_viewport_rect().size.x - 16:
		sc = 1.5
	banner.custom_minimum_size = banner.texture.get_size() * sc
	banner_sub.text = sub
	banner_sub.add_theme_color_override("font_color", sub_color)
	_layout()
	for n in [banner, banner_sub]:
		var tw := create_tween()
		n.modulate.a = 0.0
		tw.tween_property(n, "modulate:a", 1.0, 0.25)
		tw.tween_interval(2.6)
		tw.tween_property(n, "modulate:a", 0.0, 0.6)

func show_event(text: String) -> void:
	event_l.text = text
	var tw := create_tween()
	event_l.modulate.a = 1.0
	tw.tween_interval(4.5)
	tw.tween_property(event_l, "modulate:a", 0.0, 0.8)

func show_message(text: String) -> void:
	msg_l.text = text
	var tw := create_tween()
	msg_l.modulate.a = 1.0
	tw.tween_interval(2.0)
	tw.tween_property(msg_l, "modulate:a", 0.0, 0.6)

func show_hint(text: String, dur := 4.0) -> void:
	hint_l.text = text
	hint_l.modulate.a = 1.0
	var tw := create_tween()
	tw.tween_interval(dur)
	tw.tween_property(hint_l, "modulate:a", 0.0, 0.8)

func clear_warning() -> void:
	_warn_t = 0.0
	warn_l.text = ""
	combo_l.text = ""

func warn(text: String, dur := 2.5) -> void:
	warn_l.text = text
	_warn_t = dur

func set_headline(text: String, eta: String) -> void:
	ticker_l.text = "%s   //   GONDOLUX(tm) OPENING SOON: %s" % [text, eta]
	ticker_l.position.x = root.get_viewport_rect().size.x
	ticker_l.reset_size()

func _fmt(n: int) -> String:
	var s := str(n)
	var out := ""
	while s.length() > 3:
		out = "," + s.substr(s.length() - 3) + out
		s = s.substr(0, s.length() - 3)
	return s + out

# ---------------------------------------------------------------- pause
func _build_pause() -> void:
	pause_ov = UI.overlay(root, 300)
	var vb: VBoxContainer = pause_ov["box"]
	vb.add_child(UI.pixel_text("PAUSED", 3.0))
	vb.add_child(UI.button("RESUME", func(): resume_requested.emit()))
	vb.add_child(UI.button("RESTART", func(): restart_requested.emit()))
	vb.add_child(UI.button("HOW TO PLAY", func(): HowToPlay.open(root)))
	vb.add_child(UI.settings_box())
	vb.add_child(UI.button("QUIT TO MENU", func(): menu_requested.emit()))
	pause_ov["root"].visible = false

func set_paused(on: bool) -> void:
	pause_ov["root"].visible = on

# ---------------------------------------------------------------- game over
func _build_over() -> void:
	over_ov = UI.overlay(root, 320)
	over_ov["root"].visible = false

const CHARSET := "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-!"
## Rotating punchlines on the results screen (one per run, in turn).
const OVER_LINES := [
	"YOU CAN'T SKI FREE.",
	"THE DEVELOPERS WIN THIS ROUND.",
	"PUBLIC ACCESS REVOKED.",
	"YOUR POWDER HAS BEEN REZONED.",
	"THANK YOU FOR VISITING. PARKING IS $85.",
]
var _entering := false
var _initials: Array = ["A", "A", "A"]
var _slot := 0
var _slot_boxes: Array = []
var _slot_letters: Array = []
var _blink := 0.0
var _initials_done: Callable

func is_entering_initials() -> bool:
	return _entering

func show_game_over(title: String, cause: String, score: int, meters: float, tokens: int, rec: Dictionary, best: int, share_data: Dictionary = {}) -> void:
	var results := func(): _show_results(title, cause, score, meters, tokens, rec, best, share_data)
	if int(rec.get("rank", -1)) >= 0 and not rec.get("entry", {}).is_empty():
		_show_initials(rec, score, results)
	else:
		results.call()

func _clear_over() -> VBoxContainer:
	var vb: VBoxContainer = over_ov["box"]
	for c in vb.get_children():
		vb.remove_child(c)
		c.queue_free()
	return vb

func _pop_panel() -> void:
	over_ov["root"].visible = true
	over_ov["panel"].scale = Vector2(0.8, 0.8)
	over_ov["panel"].pivot_offset = over_ov["panel"].size * 0.5
	var tw := create_tween()
	tw.tween_property(over_ov["panel"], "scale", Vector2.ONE, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)

# ---------------------------------------------------------------- initials
func _show_initials(rec: Dictionary, score: int, done: Callable) -> void:
	_entering = true
	_initials_done = func():
		_entering = false
		Game.set_initials(rec["entry"], "".join(_initials))
		Sfx.play("combo")
		done.call()
	var start: String = Game.last_initials.to_upper()
	for i in 3:
		var c := start[i] if i < start.length() else "A"
		_initials[i] = c if CHARSET.contains(c) else "A"
	_slot = 0
	var vb := _clear_over()
	vb.add_child(UI.pixel_text("TOP 10!", 4.0, UI.GOLD))
	vb.add_child(UI.label("HIGH SCORE #%d   -   %s" % [int(rec["rank"]) + 1, _fmt(score)], 15, Color.WHITE))
	vb.add_child(UI.label("ENTER YOUR INITIALS", 13, UI.ICE))
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 12)
	vb.add_child(row)
	_slot_boxes = []
	_slot_letters = []
	for i in 3:
		var col := VBoxContainer.new()
		col.add_theme_constant_override("separation", 4)
		var up := _arrow_button("arrow_up", func(): _spin(i, 1))
		var down := _arrow_button("arrow_down", func(): _spin(i, -1))
		var box := PanelContainer.new()
		box.custom_minimum_size = Vector2(76, 84)
		box.mouse_filter = Control.MOUSE_FILTER_STOP
		box.gui_input.connect(func(ev):
			if (ev is InputEventMouseButton and ev.pressed) or (ev is InputEventScreenTouch and ev.pressed):
				_slot = i
				_refresh_slots())
		var letter := TextureRect.new()
		letter.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		letter.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		letter.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		letter.mouse_filter = Control.MOUSE_FILTER_IGNORE
		box.add_child(letter)
		col.add_child(up)
		col.add_child(box)
		col.add_child(down)
		row.add_child(col)
		_slot_boxes.append(box)
		_slot_letters.append(letter)
	var hint := "Tap the arrows" if OS.has_feature("mobile") or OS.has_feature("web_android") or OS.has_feature("web_ios") else "Type, or use the arrow keys"
	vb.add_child(UI.label(hint, 11, UI.ICE))
	var ok := UI.button("SAVE", func(): _initials_done.call(), 56)
	ok.add_theme_font_size_override("font_size", 22)
	vb.add_child(ok)
	_refresh_slots()
	_pop_panel()

func _arrow_button(icon_id: String, cb: Callable) -> Button:
	var b := Button.new()
	b.icon = Art.tex(icon_id)
	b.expand_icon = true
	b.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	b.add_theme_constant_override("icon_max_width", 26)
	b.custom_minimum_size = Vector2(76, 44)
	b.focus_mode = Control.FOCUS_NONE
	b.pressed.connect(cb)
	return b

func _spin(i: int, dir: int) -> void:
	_slot = i
	var idx := CHARSET.find(_initials[i])
	_initials[i] = CHARSET[(idx + dir + CHARSET.length()) % CHARSET.length()]
	Sfx.play("click", 0.0, -6.0)
	_refresh_slots()

func _refresh_slots() -> void:
	for i in _slot_boxes.size():
		var sb := StyleBoxFlat.new()
		var sel: bool = i == _slot
		sb.bg_color = UI.NAVY2 if not sel else UI.NAVY3
		sb.border_color = UI.GOLD if sel else UI.SNOW
		sb.set_border_width_all(4 if sel else 2)
		sb.set_content_margin_all(6)
		_slot_boxes[i].add_theme_stylebox_override("panel", sb)
		_slot_letters[i].texture = Art.text_tex(_initials[i], UI.GOLD if sel else Color.WHITE)

func _unhandled_input(event: InputEvent) -> void:
	if not _entering or not (event is InputEventKey) or not event.pressed:
		return
	var k := event as InputEventKey
	var handled := true
	match k.keycode:
		KEY_LEFT:
			_slot = maxi(0, _slot - 1)
		KEY_RIGHT, KEY_TAB:
			_slot = mini(2, _slot + 1)
		KEY_UP:
			_spin(_slot, 1)
		KEY_DOWN:
			_spin(_slot, -1)
		KEY_BACKSPACE:
			_slot = maxi(0, _slot - 1)
		KEY_ENTER, KEY_KP_ENTER:
			_initials_done.call()
			get_viewport().set_input_as_handled()
			return
		_:
			var ch := String.chr(k.unicode).to_upper() if k.unicode > 0 else ""
			if ch != "" and CHARSET.contains(ch):
				_initials[_slot] = ch
				Sfx.play("click", 0.0, -6.0)
				_slot = mini(2, _slot + 1)
			else:
				handled = false
	if handled:
		_refresh_slots()
		get_viewport().set_input_as_handled()

# ---------------------------------------------------------------- results
func _show_results(title: String, cause: String, score: int, meters: float, tokens: int, rec: Dictionary, best: int, share_data: Dictionary) -> void:
	var vb := _clear_over()
	var col := UI.RED if title == "ACQUIRED!" else UI.ORANGE
	vb.add_child(UI.pixel_text(title, 3.0 if title.length() <= 10 else 2.0, col))
	# Chip catches always read PUBLIC ACCESS REVOKED.; other endings rotate.
	var punch: String = "PUBLIC ACCESS REVOKED." if title == "ACQUIRED!" else OVER_LINES[(Game.runs - 1 + OVER_LINES.size()) % OVER_LINES.size()]
	vb.add_child(UI.label(punch, 16, UI.GOLD, HORIZONTAL_ALIGNMENT_CENTER, 4))
	vb.add_child(UI.label(cause, 13, UI.ICE))
	var sep := HSeparator.new()
	vb.add_child(sep)
	vb.add_child(UI.label("SCORE", 12, UI.ICE))
	vb.add_child(UI.label(_fmt(score), 30, Color.WHITE))
	var stats := "%d m   |   %d passes   |   best %s" % [int(meters), tokens, _fmt(best)]
	vb.add_child(UI.label(stats, 12, UI.ICE))
	if rec.get("new_best", false):
		var nb := UI.label("NEW PERSONAL BEST!", 16, UI.GOLD)
		vb.add_child(nb)
		var tw := nb.create_tween().set_loops()
		tw.tween_property(nb, "modulate:a", 0.4, 0.4)
		tw.tween_property(nb, "modulate:a", 1.0, 0.4)
	elif int(rec.get("rank", -1)) >= 0:
		var e: Dictionary = rec.get("entry", {})
		vb.add_child(UI.label("HIGH SCORE #%d  -  %s" % [int(rec["rank"]) + 1, String(e.get("initials", ""))], 15, UI.GOLD))
	for u in rec.get("unlocked", []):
		vb.add_child(UI.label("UNLOCKED: %s" % u, 14, UI.GREEN))
	var again := UI.button("RIDE AGAIN", func(): restart_requested.emit(), 58)
	again.add_theme_font_size_override("font_size", 22)
	vb.add_child(again)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	var status := UI.label("", 11, UI.GREEN)
	var share_b := UI.button("SHARE", func(): status.text = Share.share(share_data), 46)
	var menu_b := UI.button("MENU", func(): menu_requested.emit(), 46)
	for b in [share_b, menu_b]:
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(b)
	vb.add_child(row)
	vb.add_child(status)
	_pop_panel()
	again.call_deferred("grab_focus")
