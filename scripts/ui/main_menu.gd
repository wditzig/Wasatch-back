extends Control
## Title screen with rider/outfit select, high scores, settings and the
## satire disclaimer + real-world context page.

const UI = preload("res://scripts/ui/ui_kit.gd")
const Riders = preload("res://scripts/data/riders.gd")
const BG = preload("res://scripts/ui/menu_background.gd")
const HowToPlay = preload("res://scripts/ui/how_to_play.gd")
const Share = preload("res://scripts/ui/share.gd")

var main_box: VBoxContainer
var panels := {}
var preview: TextureRect
var outfit_info: Label
var rider_buttons := {}
var outfit_buttons := {}
var _preview_t := 0.0
var _preview_pose := 0

func _ready() -> void:
	get_tree().paused = false
	RenderingServer.set_default_clear_color(Color8(20, 26, 51))
	theme = UI.make_theme()
	add_child(BG.new())
	_build_main()
	panels["rider"] = _build_rider()
	panels["scores"] = _build_scores()
	panels["settings"] = _build_settings()
	panels["about"] = _build_about()
	for p in panels.values():
		p["root"].visible = false
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--open="):
			_open(a.substr(7))
		elif a == "--autoplay":
			Game.seen_tutorial = true
			get_tree().create_timer(1.0).timeout.connect(_play)
		elif a == "--howto":
			_how_to_play(false)

func _build_main() -> void:
	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right"]:
		margin.add_theme_constant_override("margin_" + side, 18)
	margin.add_theme_constant_override("margin_top", 28)
	margin.add_theme_constant_override("margin_bottom", 16)
	add_child(margin)
	main_box = VBoxContainer.new()
	main_box.add_theme_constant_override("separation", 10)
	margin.add_child(main_box)
	# Big logo: WASATCH spans the width, BACK hits harder underneath.
	var logo := VBoxContainer.new()
	logo.add_theme_constant_override("separation", -6)
	logo.add_child(UI.pixel_text("WASATCH", 7.2, Color.WHITE))
	logo.add_child(UI.pixel_text("BACK", 5.0, Color8(255, 138, 36)))
	main_box.add_child(logo)
	var tw := logo.create_tween().set_loops()
	logo.pivot_offset = Vector2(162, 75)
	tw.tween_property(logo, "scale", Vector2(1.025, 1.025), 1.4).set_trans(Tween.TRANS_SINE)
	tw.tween_property(logo, "scale", Vector2.ONE, 1.4).set_trans(Tween.TRANS_SINE)
	# The punchline: gold pixel type directly under the title, one quiet
	# supporting line beneath it.
	var tag_box := VBoxContainer.new()
	tag_box.add_theme_constant_override("separation", 2)
	tag_box.add_child(UI.pixel_text("YOU CAN'T SKI FREE.", 2.5, Color8(255, 216, 74)))
	var sub := UI.label("THE GREATEST SNOW ON EARTH. TERMS APPLY.", 11, Color.WHITE, HORIZONTAL_ALIGNMENT_CENTER, 0)
	sub.add_theme_color_override("font_shadow_color", Color(0.08, 0.1, 0.2, 0.9))
	sub.add_theme_constant_override("shadow_offset_x", 1)
	sub.add_theme_constant_override("shadow_offset_y", 1)
	tag_box.add_child(sub)
	main_box.add_child(tag_box)
	var play := UI.button("RIDE!", _play, 60)
	play.add_theme_font_size_override("font_size", 26)
	main_box.add_child(play)
	main_box.add_child(UI.button("RIDER & GEAR", func(): _open("rider")))
	var row0 := HBoxContainer.new()
	row0.add_theme_constant_override("separation", 10)
	var how := UI.button("HOW TO PLAY", func(): _how_to_play(false))
	var hs := UI.button("SCORES", func(): _open("scores"))
	for b in [how, hs]:
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row0.add_child(b)
	main_box.add_child(row0)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	var s := UI.button("SETTINGS", func(): _open("settings"))
	var a := UI.button("ABOUT", func(): _open("about"))
	s.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	a.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(s)
	row.add_child(a)
	main_box.add_child(row)
	var grow := Control.new()
	grow.size_flags_vertical = Control.SIZE_EXPAND_FILL
	main_box.add_child(grow)
	var best := UI.label("BEST  %d   |   %d m" % [Game.best_score, int(Game.best_distance)], 13, Color8(20, 26, 51))
	main_box.add_child(best)
	var foot := UI.label("A work of satire. All companies and characters are fictional.", 10, Color8(36, 48, 106))
	main_box.add_child(foot)
	play.call_deferred("grab_focus")

func _play() -> void:
	if not Game.seen_tutorial:
		_how_to_play(true)
		return
	get_tree().change_scene_to_file("res://scenes/game.tscn")

## First ride shows the guide, ending in "LET'S RIDE!".
func _how_to_play(then_ride: bool) -> void:
	main_box.visible = false
	for p in panels.values():
		p["root"].visible = false
	var done := func():
		Game.seen_tutorial = true
		Game.save_game()
		if then_ride:
			get_tree().change_scene_to_file("res://scenes/game.tscn")
		else:
			main_box.visible = true
	HowToPlay.open(self, done, "LET'S RIDE!" if then_ride else "DONE")

func _open(id: String) -> void:
	for k in panels.keys():
		panels[k]["root"].visible = k == id
	main_box.visible = id == ""
	if id == "rider":
		_refresh_rider()

func _close() -> void:
	_open("")

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause") or event.is_action_pressed("ui_cancel"):
		_close()

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST:
		_close()

func _process(delta: float) -> void:
	if preview and panels.has("rider") and panels["rider"]["root"].visible:
		_preview_t += delta
		if _preview_t > 0.6:
			_preview_t = 0.0
			_preview_pose = (_preview_pose + 1) % 4
			_update_preview()

# ---------------------------------------------------------------- rider select
func _build_rider() -> Dictionary:
	var ov := UI.overlay(self, 336)
	var vb: VBoxContainer = ov["box"]
	vb.add_child(UI.pixel_text("RIDER & GEAR", 2.0))
	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", 8)
	vb.add_child(hb)
	for rid in Riders.RIDERS.keys():
		var r: Dictionary = Riders.RIDERS[rid]
		var b := Button.new()
		b.toggle_mode = true
		b.text = "%s\n%s" % [r["name"], r["title"]]
		b.custom_minimum_size = Vector2(0, 54)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.add_theme_font_size_override("font_size", 15)
		var id: String = rid
		b.pressed.connect(func():
			Sfx.play("click")
			Game.rider = id
			Game.save_game()
			_refresh_rider())
		hb.add_child(b)
		rider_buttons[rid] = b
	var mid := HBoxContainer.new()
	mid.add_theme_constant_override("separation", 10)
	vb.add_child(mid)
	preview = TextureRect.new()
	preview.custom_minimum_size = Vector2(96, 112)
	preview.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	preview.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	preview.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	var pbg := PanelContainer.new()
	var psb := StyleBoxFlat.new()
	psb.bg_color = Color8(232, 240, 255)
	psb.set_content_margin_all(4)
	pbg.add_theme_stylebox_override("panel", psb)
	pbg.add_child(preview)
	mid.add_child(pbg)
	var stats := VBoxContainer.new()
	stats.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	stats.name = "Stats"
	mid.add_child(stats)
	ov["stats"] = stats
	vb.add_child(UI.label("OUTFIT", 13, UI.ICE, HORIZONTAL_ALIGNMENT_LEFT))
	var grid := GridContainer.new()
	grid.columns = 4
	grid.add_theme_constant_override("h_separation", 6)
	grid.add_theme_constant_override("v_separation", 6)
	vb.add_child(grid)
	for o in Riders.OUTFITS:
		var ob := Button.new()
		ob.custom_minimum_size = Vector2(70, 52)
		ob.toggle_mode = true
		ob.expand_icon = true
		ob.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
		ob.add_theme_constant_override("icon_max_width", 26)
		var oid: String = o["id"]
		ob.pressed.connect(func():
			Sfx.play("click")
			if Game.is_unlocked(oid):
				Game.outfit = oid
				Game.save_game()
			_refresh_rider(oid))
		grid.add_child(ob)
		outfit_buttons[oid] = ob
	outfit_info = UI.label("", 13, Color.WHITE)
	outfit_info.custom_minimum_size = Vector2(0, 36)
	vb.add_child(outfit_info)
	vb.add_child(UI.button("RIDE!", _play, 52))
	vb.add_child(UI.button("BACK", _close, 44))
	return ov

func _refresh_rider(focus_outfit := "") -> void:
	for rid in rider_buttons.keys():
		rider_buttons[rid].button_pressed = rid == Game.rider
	var r: Dictionary = Riders.RIDERS[Game.rider]
	var stats: VBoxContainer = panels["rider"]["stats"]
	for c in stats.get_children():
		c.queue_free()
	stats.add_child(UI.label(r["desc"], 12, Color.WHITE, HORIZONTAL_ALIGNMENT_LEFT))
	for k in r["stats"].keys():
		var v: int = r["stats"][k]
		stats.add_child(UI.label("%-8s %s" % [k.to_upper(), "#".repeat(v) + ".".repeat(5 - v)], 12, UI.GOLD, HORIZONTAL_ALIGNMENT_LEFT))
	var prefix: String = r["sprite"]
	for o in Riders.OUTFITS:
		var b: Button = outfit_buttons[o["id"]]
		var unlocked := Game.is_unlocked(o["id"])
		b.icon = Art.tex(prefix + "_down", o)
		b.button_pressed = o["id"] == Game.outfit
		b.modulate = Color.WHITE if unlocked else Color(0.35, 0.35, 0.45)
		b.text = "" if unlocked else "?"
	var show_id := focus_outfit if focus_outfit != "" else Game.outfit
	var so := Riders.outfit(show_id)
	if Game.is_unlocked(show_id):
		outfit_info.text = "%s" % so["name"]
		outfit_info.add_theme_color_override("font_color", Color.WHITE)
	else:
		outfit_info.text = "LOCKED: %s\n%s" % [so["name"], Riders.req_text(so)]
		outfit_info.add_theme_color_override("font_color", UI.ORANGE)
	_update_preview()

func _update_preview() -> void:
	var r: Dictionary = Riders.RIDERS[Game.rider]
	var poses := ["down", "diag", "side", "air"]
	preview.texture = Art.tex(String(r["sprite"]) + "_" + poses[_preview_pose], Game.current_outfit())

# ---------------------------------------------------------------- scores
func _build_scores() -> Dictionary:
	var ov := UI.overlay(self, 330)
	var vb: VBoxContainer = ov["box"]
	vb.add_child(UI.pixel_text("HIGH SCORES", 2.0))
	if Game.high_scores.is_empty():
		vb.add_child(UI.label("No runs yet.\nThe mountain is waiting.", 14, UI.ICE))
	var grid := GridContainer.new()
	grid.columns = 5
	grid.add_theme_constant_override("h_separation", 14)
	grid.add_theme_constant_override("v_separation", 2)
	for i in Game.high_scores.size():
		var e: Dictionary = Game.high_scores[i]
		var rider_tag := "SKI" if e.get("rider", "skier") == "skier" else "BRD"
		var col := UI.GOLD if i == 0 else Color.WHITE
		var cells := ["%d." % (i + 1), String(e.get("initials", "---")), _fmt(int(e["score"])), "%dm" % int(e["distance"]), rider_tag]
		var aligns := [HORIZONTAL_ALIGNMENT_RIGHT, HORIZONTAL_ALIGNMENT_LEFT, HORIZONTAL_ALIGNMENT_RIGHT, HORIZONTAL_ALIGNMENT_RIGHT, HORIZONTAL_ALIGNMENT_LEFT]
		for k in cells.size():
			var l := UI.label(cells[k], 15 if k == 1 else 14, col, aligns[k])
			l.autowrap_mode = TextServer.AUTOWRAP_OFF
			if k == 2:
				l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			grid.add_child(l)
	vb.add_child(grid)
	vb.add_child(HSeparator.new())
	vb.add_child(UI.label("Runs: %d   Passes collected: %d\nBest distance: %d m" % [Game.runs, Game.total_tokens, int(Game.best_distance)], 12, UI.ICE))
	if not Game.high_scores.is_empty():
		var status := UI.label("", 12, UI.GREEN)
		var best: Dictionary = Game.high_scores[0]
		var share_best := func():
			status.text = Share.share({"score": best["score"], "distance": best["distance"], "rider": best.get("rider", "skier"),
				"outfit": Game.current_outfit(), "cause": best.get("cause", ""), "phase": best.get("phase", "")})
		vb.add_child(UI.button("SHARE MY BEST", share_best, 46))
		vb.add_child(status)
	vb.add_child(UI.button("BACK", _close, 44))
	return ov

func _fmt(n: int) -> String:
	var s := str(n)
	var out := ""
	while s.length() > 3:
		out = "," + s.substr(s.length() - 3) + out
		s = s.substr(0, s.length() - 3)
	return s + out

# ---------------------------------------------------------------- settings
func _build_settings() -> Dictionary:
	var ov := UI.overlay(self, 320)
	var vb: VBoxContainer = ov["box"]
	vb.add_child(UI.pixel_text("SETTINGS", 2.5))
	vb.add_child(UI.settings_box())
	var reset := UI.button("RESET PROGRESS", func(): pass, 40)
	reset.add_theme_font_size_override("font_size", 13)
	var armed := [false]
	reset.pressed.connect(func():
		if armed[0]:
			Game.reset_progress()
			get_tree().reload_current_scene()
		else:
			armed[0] = true
			reset.text = "TAP AGAIN TO CONFIRM")
	vb.add_child(reset)
	vb.add_child(UI.button("BACK", _close, 44))
	return ov

# ---------------------------------------------------------------- about
func _build_about() -> Dictionary:
	var ov := UI.overlay(self, 340)
	var vb: VBoxContainer = ov["box"]
	vb.add_child(UI.pixel_text("ABOUT", 2.5))
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(0, 340)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	vb.add_child(scroll)
	var rt := RichTextLabel.new()
	rt.bbcode_enabled = true
	rt.fit_content = true
	rt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	rt.text = ABOUT_TEXT
	scroll.add_child(rt)
	var status := UI.label("", 12, UI.GREEN)
	vb.add_child(UI.button("SHARE THIS GAME", func(): status.text = Share.share_game(), 46))
	vb.add_child(status)
	vb.add_child(UI.button("BACK", _close, 44))
	return ov

const ABOUT_TEXT := """[b][color=#ffd84a]WASATCH BACK[/color][/b]
YOU CAN'T SKI FREE.

A retro skiing game inspired by the 1990s classics, about the commercialization of Utah's mountains.

[b][color=#ff8a24]THIS IS SATIRE[/color][/b]
MONOPEAK HOLDINGS, CHIP LODGEWORTH III, the GONDOLUX(tm), GRANITECORE DATA, and every headline, sign and quote in this game are [b]fictional[/b]. Any resemblance to real companies or people is coincidental. Nothing in-game is a factual claim.

[b][color=#50c8f0]REAL-WORLD CONTEXT[/color][/b]
The game is inspired by real public debates over the Wasatch Mountains, including transportation plans for Little Cottonwood Canyon. In 2023 the Utah Department of Transportation (UDOT) issued a Record of Decision naming a gondola as its preferred long-term alternative, with a phased approach that begins with improved bus service and tolling. The project has drawn both support and significant public opposition, and its funding and timeline remain subject to future decisions.

Facts change. For current, official information, see UDOT's Little Cottonwood Canyon project materials and reporting from local news outlets.

[b][color=#58c864]WHY[/color][/b]
Public lands belong to everyone. Go ride them, learn about them, and show up when decisions about them are made.

[b][color=#ff8a24]TAKE BACK THE MOUNTAIN.[/color][/b]

[b]CREDITS[/b]
Design, code, pixel art and chiptunes generated procedurally for this prototype. Built with Godot Engine (MIT).
"""
