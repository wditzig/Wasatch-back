extends RefCounted
## Shared retro UI theme and widget factories.

const NAVY := Color8(20, 26, 51)
const NAVY2 := Color8(36, 48, 106)
const NAVY3 := Color8(52, 68, 140)
const SNOW := Color8(232, 240, 255)
const ICE := Color8(168, 188, 224)
const ORANGE := Color8(255, 138, 36)
const GOLD := Color8(255, 216, 74)
const RED := Color8(216, 54, 60)
const GREEN := Color8(88, 200, 100)

static func _box(bg: Color, border: Color, bw := 3, margin := 10) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(bw)
	sb.set_corner_radius_all(0)
	sb.set_content_margin_all(margin)
	sb.shadow_color = Color(0, 0, 0, 0.35)
	sb.shadow_size = 0
	sb.shadow_offset = Vector2(3, 3)
	return sb

static func make_theme() -> Theme:
	var th := Theme.new()
	var font := SystemFont.new()
	font.font_names = PackedStringArray(["Menlo", "Consolas", "DejaVu Sans Mono", "Droid Sans Mono", "Roboto Mono", "monospace"])
	font.font_weight = 700
	font.antialiasing = TextServer.FONT_ANTIALIASING_GRAY
	th.default_font = font
	th.default_font_size = 16
	var normal := _box(NAVY2, SNOW)
	normal.shadow_size = 1
	var hover := _box(NAVY3, SNOW)
	hover.shadow_size = 1
	var pressed := _box(ORANGE, SNOW)
	var disabled := _box(Color8(40, 44, 60), Color8(90, 96, 120))
	var focus := _box(Color(0, 0, 0, 0), GOLD, 3)
	th.set_stylebox("normal", "Button", normal)
	th.set_stylebox("hover", "Button", hover)
	th.set_stylebox("pressed", "Button", pressed)
	th.set_stylebox("hover_pressed", "Button", pressed)
	th.set_stylebox("disabled", "Button", disabled)
	th.set_stylebox("focus", "Button", focus)
	th.set_color("font_color", "Button", SNOW)
	th.set_color("font_hover_color", "Button", Color.WHITE)
	th.set_color("font_pressed_color", "Button", NAVY)
	th.set_color("font_hover_pressed_color", "Button", NAVY)
	th.set_color("font_disabled_color", "Button", Color8(120, 126, 150))
	th.set_color("font_focus_color", "Button", Color.WHITE)
	th.set_font_size("font_size", "Button", 18)
	th.set_stylebox("panel", "PanelContainer", _box(Color(NAVY, 0.96), SNOW, 3, 14))
	th.set_stylebox("panel", "Panel", _box(Color(NAVY, 0.96), SNOW, 3, 14))
	th.set_color("font_color", "Label", SNOW)
	th.set_color("font_outline_color", "Label", NAVY)
	th.set_constant("outline_size", "Label", 0)
	th.set_color("default_color", "RichTextLabel", SNOW)
	th.set_font_size("normal_font_size", "RichTextLabel", 14)
	th.set_font_size("bold_font_size", "RichTextLabel", 15)
	# sliders
	var track := _box(NAVY2, SNOW, 2, 0)
	track.content_margin_top = 4
	track.content_margin_bottom = 4
	th.set_stylebox("slider", "HSlider", track)
	var fill := _box(ORANGE, SNOW, 2, 0)
	fill.content_margin_top = 4
	fill.content_margin_bottom = 4
	th.set_stylebox("grabber_area", "HSlider", fill)
	th.set_stylebox("grabber_area_highlight", "HSlider", fill)
	th.set_constant("center_grabber", "HSlider", 1)
	th.set_icon("grabber", "HSlider", _grabber_icon())
	th.set_icon("grabber_highlight", "HSlider", _grabber_icon())
	th.set_color("font_color", "CheckButton", SNOW)
	th.set_font_size("font_size", "CheckButton", 16)
	# scrollbars: chunky and touch-friendly
	th.set_stylebox("scroll", "VScrollBar", _box(Color(NAVY2, 0.5), Color(0, 0, 0, 0), 0, 4))
	th.set_stylebox("grabber", "VScrollBar", _box(ICE, ICE, 0, 4))
	th.set_stylebox("grabber_highlight", "VScrollBar", _box(SNOW, SNOW, 0, 4))
	th.set_stylebox("grabber_pressed", "VScrollBar", _box(ORANGE, ORANGE, 0, 4))
	return th

static func _grabber_icon() -> Texture2D:
	var img := Image.create(16, 22, false, Image.FORMAT_RGBA8)
	img.fill(SNOW)
	img.fill_rect(Rect2i(2, 2, 12, 18), GOLD)
	return ImageTexture.create_from_image(img)

static func button(text: String, cb: Callable, min_h := 50) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(0, min_h)
	b.focus_mode = Control.FOCUS_ALL
	b.pressed.connect(func():
		Sfx.play("click")
		cb.call())
	return b

static func label(text: String, size := 16, color := SNOW, align := HORIZONTAL_ALIGNMENT_CENTER, outline := 0) -> Label:
	var l := Label.new()
	l.text = text
	l.horizontal_alignment = align
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	if outline > 0:
		l.add_theme_constant_override("outline_size", outline)
		l.add_theme_color_override("font_outline_color", NAVY)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l

static func pixel_text(text: String, scale: float, color := Color.WHITE) -> TextureRect:
	var tr := TextureRect.new()
	tr.texture = Art.text_tex(text, color)
	tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	tr.custom_minimum_size = tr.texture.get_size() * scale
	tr.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return tr

static func sprite_rect(tex: Texture2D, scale: float) -> TextureRect:
	var tr := TextureRect.new()
	tr.texture = tex
	tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	tr.custom_minimum_size = tex.get_size() * scale
	tr.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return tr

## Full-screen dimmed overlay holding a centred, scrollable-width panel.
static func overlay(parent: Control, max_w := 340.0) -> Dictionary:
	var dim := ColorRect.new()
	dim.color = Color(0.03, 0.04, 0.1, 0.7)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	dim.mouse_filter = Control.MOUSE_FILTER_STOP
	parent.add_child(dim)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	dim.add_child(center)
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(max_w, 0)
	center.add_child(panel)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 10)
	panel.add_child(vb)
	return {"root": dim, "panel": panel, "box": vb}

## Settings widgets shared by the main menu and the pause menu.
static func settings_box() -> VBoxContainer:
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 8)
	for pair in [["MUSIC", "music"], ["SOUND FX", "sfx"]]:
		vb.add_child(label(pair[0], 14, ICE, HORIZONTAL_ALIGNMENT_LEFT))
		var s := HSlider.new()
		s.min_value = 0.0
		s.max_value = 1.0
		s.step = 0.05
		s.value = float(Game.settings.get(pair[1], 0.7))
		s.custom_minimum_size = Vector2(0, 30)
		var key: String = pair[1]
		s.value_changed.connect(func(v): Game.set_setting(key, v))
		vb.add_child(s)
	vb.add_child(label("CONTROLS", 14, ICE, HORIZONTAL_ALIGNMENT_LEFT))
	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", 8)
	var b_drag := Button.new()
	var b_zone := Button.new()
	for b in [b_drag, b_zone]:
		b.toggle_mode = true
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.custom_minimum_size = Vector2(0, 44)
		b.add_theme_font_size_override("font_size", 14)
		hb.add_child(b)
	b_drag.text = "FOLLOW FINGER"
	b_zone.text = "TAP ZONES"
	var grp := ButtonGroup.new()
	b_drag.button_group = grp
	b_zone.button_group = grp
	b_drag.button_pressed = Game.settings.get("controls", "drag") == "drag"
	b_zone.button_pressed = not b_drag.button_pressed
	b_drag.pressed.connect(func(): Sfx.play("click"); Game.set_setting("controls", "drag"))
	b_zone.pressed.connect(func(): Sfx.play("click"); Game.set_setting("controls", "zones"))
	vb.add_child(hb)
	for pair in [["SCREEN SHAKE", "shake"], ["HAPTICS", "haptics"]]:
		var c := CheckButton.new()
		c.text = pair[0]
		c.button_pressed = bool(Game.settings.get(pair[1], true))
		var key2: String = pair[1]
		c.toggled.connect(func(on): Sfx.play("click"); Game.set_setting(key2, on))
		vb.add_child(c)
	return vb
