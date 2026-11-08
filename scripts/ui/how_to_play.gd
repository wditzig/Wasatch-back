extends RefCounted
## Illustrated, paged How to Play overlay. Shown automatically before the very
## first run, and available from the title screen and the pause menu.

const UI = preload("res://scripts/ui/ui_kit.gd")

const PAGES := [
	{
		"title": "WELCOME",
		"art": [["pine_laden", false], ["ski_down", false], ["excavator", false]],
		"body": "[b][color=#ffd84a]WELCOME TO WASATCH BACK[/color][/b]\n\nThe Greatest Snow on Earth(tm) is under new management.\n\nThe mountains are filling up with developers, luxury resorts, gondola projects and corporate interests.\n\nYour mission is simple: ski as far as you can, dodge the developers, and enjoy what's left of the powder. The farther you go, the harder it gets.\n\nThe mountain used to belong to everyone.\n[b][color=#ffd84a]NOW YOU CAN'T SKI FREE.[/color][/b]",
	},
	{
		"title": "STEER",
		"art": [["ski_diag", true], ["ski_down", false], ["ski_diag", false]],
		"body": "[b]Hold & drag[/b] - your rider skis toward your finger.\n\n[color=#ffd84a]Finger far below[/color] = TUCK (faster)\n[color=#ffd84a]Finger above the rider[/color] = BRAKE\n\nPrefer buttons? Settings > TAP ZONES: hold the left or right side to turn.",
	},
	{
		"title": "JUMPS & TRICKS",
		"art": [["ramp", false], ["kicker_big", false], ["ski_air", false]],
		"body": "Hit a [b]kicker[/b] to launch. Moguls pop you up too. In the air:\n\n[color=#ffd84a]TAP[/color] = 360\n[color=#ffd84a]SWIPE UP[/color] = BACKFLIP\n[color=#ffd84a]SWIPE DOWN[/color] = GRAB\n\nChain them: 720, DOUBLE BACKFLIP, BACKFLIP + 360...\n[color=#ff8a24]Land before the trick finishes or you bail![/color]",
	},
	{
		"title": "THE MOUNTAIN",
		"art": [["token", false], ["powder", false], ["pine_big", false], ["rock", false], ["cone", false]],
		"body": "[color=#58c864]COLLECT:[/color] gold Public Access Passes. [color=#58c864]RIDE:[/color] kickers and moguls for air. Snowboarders surf deep powder; skiers bog down in it. Blue ice makes turning harder.\n\n[color=#ff8a24]AVOID:[/color] trees, buildings, towers and heavy machinery - unless you're flying off a kicker, which clears everything until you come down to land. A quick hop clears rocks, fences, moose and hot tubs. Cones, stumps and stakes just trip you up.\n\nToll gates and paywalls cost points - unless you jump them.",
	},
	{
		"title": "COMBOS & CHIP",
		"art": [["developer", false]],
		"body": "Close calls, tricks and passes build a [b]COMBO[/b]. It banks after 3 seconds - crash first and it's lost.\n\n[color=#d8363c]Chip Lodgeworth III[/color] wants your line. [b]Tuck and ski straight[/b] to outrun him until he gets bored. If he catches you, you're ACQUIRED.\n\n3 crashes = SEASON PASS REVOKED.",
	},
]

## Opens the guide over `parent`. `on_done` runs when it is closed.
static func open(parent: Control, on_done: Callable = Callable(), done_label := "DONE") -> Control:
	var ov := UI.overlay(parent, 330)
	var root: Control = ov["root"]
	var vb: VBoxContainer = ov["box"]
	var state := {"page": 0}
	var title_holder := CenterContainer.new()
	vb.add_child(title_holder)
	var art_row := HBoxContainer.new()
	art_row.alignment = BoxContainer.ALIGNMENT_CENTER
	art_row.add_theme_constant_override("separation", 12)
	var art_bg := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color8(232, 240, 255)
	sb.set_content_margin_all(8)
	art_bg.add_theme_stylebox_override("panel", sb)
	art_bg.custom_minimum_size = Vector2(0, 96)
	art_bg.add_child(art_row)
	vb.add_child(art_bg)
	var body := RichTextLabel.new()
	body.bbcode_enabled = true
	body.fit_content = true
	body.scroll_active = false
	body.custom_minimum_size = Vector2(0, 236)
	body.add_theme_font_size_override("normal_font_size", 14)
	body.add_theme_font_size_override("bold_font_size", 14)
	vb.add_child(body)
	if not (OS.has_feature("mobile") or OS.has_feature("web_android") or OS.has_feature("web_ios")):
		vb.add_child(UI.label("KEYS: arrows steer, DOWN tuck, UP brake, SPACE hop/360, K backflip, L grab, ESC pause", 10, UI.ICE))
	var dots := UI.label("", 12, UI.ICE)
	vb.add_child(dots)
	var nav := HBoxContainer.new()
	nav.add_theme_constant_override("separation", 10)
	vb.add_child(nav)
	var prev := Button.new()
	var next := Button.new()
	for b in [prev, next]:
		b.custom_minimum_size = Vector2(0, 50)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		nav.add_child(b)
	prev.text = "BACK"
	var render := func():
		var i: int = state["page"]
		var pg: Dictionary = PAGES[i]
		for c in title_holder.get_children():
			c.queue_free()
		title_holder.add_child(UI.pixel_text(pg["title"], 2.5))
		for c in art_row.get_children():
			c.queue_free()
		for a in pg["art"]:
			var tex: Texture2D = Art.tex(a[0], Game.current_outfit() if String(a[0]).begins_with("ski_") else {})
			var sc := 4.0 if tex.get_height() <= 16 else 3.0
			if tex.get_width() * sc > 100.0:
				sc = 100.0 / tex.get_width()
			var tr := UI.sprite_rect(tex, sc)
			tr.flip_h = a[1]
			art_row.add_child(tr)
		body.text = pg["body"]
		dots.text = "  ".join(range(PAGES.size()).map(func(k): return "#" if k == i else "."))
		prev.disabled = i == 0
		next.text = done_label if i == PAGES.size() - 1 else "NEXT"
	prev.pressed.connect(func():
		Sfx.play("click")
		state["page"] = maxi(0, int(state["page"]) - 1)
		render.call())
	next.pressed.connect(func():
		Sfx.play("click")
		if int(state["page"]) >= PAGES.size() - 1:
			root.queue_free()
			if on_done.is_valid():
				on_done.call()
		else:
			state["page"] = int(state["page"]) + 1
			render.call())
	render.call()
	next.call_deferred("grab_focus")
	return root
