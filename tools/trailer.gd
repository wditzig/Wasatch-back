extends Node
## 30-second cinematic trailer, rendered from real gameplay with Godot's
## Movie Maker. Render (see promo/README.md):
##   godot --path . --write-movie promo/frames/f.png --fixed-fps 30 \
##         --resolution 1920x1080 res://tools/trailer.tscn
## then encode the PNG frames + WAV with ffmpeg.

const AudioLib = preload("res://scripts/autoload/audio.gd")
const MenuBG = preload("res://scripts/ui/menu_background.gd")
const GAME := preload("res://scenes/game.tscn")

const GOLD := Color8(255, 216, 74)
const ORANGE := Color8(255, 138, 36)
const BAR_FRAC := 0.128 # 2.39:1 letterbox on a 16:9 frame

var layer: CanvasLayer
var fade: ColorRect
var caption: TextureRect
var card_root: Control
var game: Node = null
var _show_hud_on_over := false
var _braam: AudioStreamPlayer
var _whoosh: AudioStreamPlayer
var _cap_tw: Tween

func _ready() -> void:
	Game.seen_tutorial = true
	Game.acquired_count = 0 # always the "$8.2 million" message
	_build_overlay()
	_build_sounds()
	_run()

func _process(_d: float) -> void:
	if game and is_instance_valid(game) and _show_hud_on_over and game.state == game.State.OVER:
		game.hud.root.visible = true

# ---------------------------------------------------------------- timeline (30.0 s)
func _run() -> void:
	var z := "--zoom=2.3"
	# 0.0 - 3.8  The promise: pristine public land, a kicker, a backflip.
	await _shot(["--autoplay", "--calm", z, "--start-speed=150"], 3.8, "ONCE, THE MOUNTAIN\nBELONGED TO EVERYONE.", 0.3)
	# 4.2 - 5.5
	await _card("THEN...", 1.3)
	# 5.5 - 12.4  Development creeps in.
	await _shot(["--autoplay", "--calm", z, "--start-m=640", "--start-speed=260"], 2.3, "THEY BROKE GROUND.", 0.15)
	await _shot(["--autoplay", "--calm", z, "--start-m=1470", "--start-speed=280"], 2.3, "THEY BUILT 'CABINS.'", 0.15)
	await _shot(["--autoplay", "--calm", z, "--start-m=2480", "--start-speed=300", "--event=whiteout"], 2.3, "THEY BOUGHT THE CLOUD.", 0.15)
	# 12.4 - 13.7
	await _card("AND NOW...", 1.3)
	# 13.7 - 20.7  Chip Lodgeworth III: chase, capture, ACQUIRED!
	await _shot(["--autoplay", z, "--start-m=950", "--start-speed=280", "--chip-now", "--chip-bait", "--chip-bait-after=0.8",
		"--leash=78", "--chase-frame=0.62"], 7.6, "HE WANTS YOUR LINE.", 0.5, true, 2.0)
	# 20.7 - 23.4  Montage.
	await _shot(["--autoplay", "--calm", z, "--start-m=320", "--start-speed=260", "--event=powder_day"], 0.9, "", 0.0)
	await _shot(["--autoplay", "--calm", z, "--start-m=3700", "--start-speed=320"], 0.9, "", 0.0)
	await _shot(["--autoplay", "--calm", z, "--start-m=1800", "--start-speed=320", "--chip-now", "--leash=78", "--chase-frame=0.62"], 0.9, "", 0.0)
	# 23.4 - 30.0  End card.
	await _end_card(6.4)
	get_tree().quit()

# ---------------------------------------------------------------- shots
## Plays a live game shot. `skip` fast-forwards that many seconds off-camera
## so the shot opens mid-action.
func _shot(args: Array, dur: float, text: String, text_at: float, show_over := false, text_len := -1.0) -> void:
	_clear_game()
	Game._dev_args = PackedStringArray(args + ["--no-save"])
	game = GAME.instantiate()
	add_child(game)
	move_child(game, 0)
	game.hud.root.visible = false
	_show_hud_on_over = show_over
	_whoosh.play()
	var tw := create_tween()
	fade.color.a = 1.0
	tw.tween_property(fade, "color:a", 0.0, 0.18)
	if text != "":
		_caption(text, text_at, text_len if text_len > 0.0 else dur - text_at - 0.35)
	await get_tree().create_timer(dur).timeout

func _clear_game() -> void:
	if game and is_instance_valid(game):
		game.queue_free()
	game = null
	card_root.visible = false

func _caption(text: String, delay: float, hold: float) -> void:
	caption.texture = Art.text_tex(text, Color.WHITE, Color(0, 0, 0, 1))
	var vs := get_viewport().get_visible_rect().size
	var sc := floorf(vs.y * BAR_FRAC * 0.85 / caption.texture.get_height() * 2.0) / 2.0 # fill the bottom bar
	sc = minf(sc, 4.0)
	caption.custom_minimum_size = caption.texture.get_size() * sc
	caption.size = caption.custom_minimum_size
	caption.position = Vector2((vs.x - caption.size.x) * 0.5, vs.y * (1.0 - BAR_FRAC * 0.5) - caption.size.y * 0.5)
	caption.modulate.a = 0.0
	_cap_tw = create_tween()
	_cap_tw.tween_interval(delay)
	_cap_tw.tween_property(caption, "modulate:a", 1.0, 0.25)
	_cap_tw.tween_interval(maxf(hold, 0.2))
	_cap_tw.tween_property(caption, "modulate:a", 0.0, 0.25)

func _hide_caption() -> void:
	if _cap_tw and _cap_tw.is_valid():
		_cap_tw.kill()
	caption.modulate.a = 0.0

# ---------------------------------------------------------------- cards
func _card(text: String, dur: float) -> void:
	_clear_game()
	_hide_caption()
	Sfx.set_hiss(0.0)
	for c in card_root.get_children():
		c.queue_free()
	card_root.visible = true
	var bg := ColorRect.new()
	bg.color = Color.BLACK
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	card_root.add_child(bg)
	var t := _pixel(text, 5.0, Color.WHITE)
	card_root.add_child(t)
	_center(t, 0.5)
	fade.color.a = 0.0
	t.modulate.a = 0.0
	t.scale = Vector2(0.92, 0.92)
	t.pivot_offset = t.size * 0.5
	_braam.play()
	var tw := create_tween().set_parallel(true)
	tw.tween_property(t, "modulate:a", 1.0, 0.25)
	tw.tween_property(t, "scale", Vector2.ONE, dur).set_trans(Tween.TRANS_SINE)
	await get_tree().create_timer(dur).timeout

func _end_card(dur: float) -> void:
	_clear_game()
	_hide_caption()
	Sfx.set_hiss(0.0)
	for c in card_root.get_children():
		c.queue_free()
	card_root.visible = true
	var bg := MenuBG.new()
	card_root.add_child(bg)
	var dim := ColorRect.new()
	dim.color = Color(0.03, 0.04, 0.1, 0.45)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	card_root.add_child(dim)
	var title := _pixel("WASATCH", 13.0, Color.WHITE)
	var back := _pixel("BACK", 8.0, ORANGE)
	var tag := _pixel("YOU CAN'T SKI FREE.", 5.0, GOLD)
	var play := _pixel("PLAY FREE IN YOUR BROWSER", 2.5, Color.WHITE)
	var url := _pixel("WDITZIG.GITHUB.IO/WASATCH-BACK", 2.5, Color8(168, 188, 224))
	var fine := Label.new()
	fine.text = "A work of satire. All companies and characters are fictional."
	fine.add_theme_font_size_override("font_size", 11)
	fine.add_theme_color_override("font_color", Color(1, 1, 1, 0.7))
	var items := [title, back, tag, play, url, fine]
	var ys := [0.25, 0.43, 0.57, 0.68, 0.745, 0.83]
	for i in items.size():
		card_root.add_child(items[i])
		if items[i] is Label:
			items[i].reset_size()
		_center(items[i], ys[i])
		items[i].modulate.a = 0.0
	fade.color.a = 1.0
	_braam.play()
	var tw := create_tween()
	tw.tween_property(fade, "color:a", 0.0, 0.5)
	tw.tween_property(title, "modulate:a", 1.0, 0.3)
	tw.parallel().tween_property(back, "modulate:a", 1.0, 0.3)
	tw.tween_interval(0.5)
	tw.tween_property(tag, "modulate:a", 1.0, 0.4)
	tw.tween_interval(0.6)
	tw.tween_property(play, "modulate:a", 1.0, 0.3)
	tw.parallel().tween_property(url, "modulate:a", 1.0, 0.3)
	tw.parallel().tween_property(fine, "modulate:a", 1.0, 0.3)
	await get_tree().create_timer(dur - 0.6).timeout
	var out := create_tween()
	out.tween_property(fade, "color:a", 1.0, 0.6)
	await out.finished

# ---------------------------------------------------------------- helpers
func _pixel(text: String, sc: float, col: Color) -> TextureRect:
	var tr := TextureRect.new()
	tr.texture = Art.text_tex(text, col)
	tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	tr.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	tr.custom_minimum_size = tr.texture.get_size() * sc
	tr.size = tr.custom_minimum_size
	return tr

func _center(c: Control, y_frac: float) -> void:
	var vs := get_viewport().get_visible_rect().size
	c.position = Vector2((vs.x - c.size.x) * 0.5, vs.y * y_frac - c.size.y * 0.5)

func _build_overlay() -> void:
	layer = CanvasLayer.new()
	layer.layer = 100
	add_child(layer)
	card_root = Control.new()
	card_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	card_root.visible = false
	layer.add_child(card_root)
	for top in [true, false]:
		var bar := ColorRect.new()
		bar.color = Color.BLACK
		bar.anchor_left = 0.0
		bar.anchor_right = 1.0
		bar.anchor_top = 0.0 if top else 1.0 - BAR_FRAC
		bar.anchor_bottom = BAR_FRAC if top else 1.0
		layer.add_child(bar)
	caption = TextureRect.new()
	caption.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	caption.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	caption.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	layer.add_child(caption)
	fade = ColorRect.new()
	fade.color = Color(0, 0, 0, 1)
	fade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(fade)

func _build_sounds() -> void:
	# Trailer "braam": detuned low squares + sub sine + rumble.
	var b := PackedFloat32Array()
	AudioLib._tone(b, 0, 1.6, 55.0, 52.0, 0, 0.22, 0.5, 0.03)
	AudioLib._tone(b, 0, 1.6, 55.6, 52.5, 0, 0.18, 0.4, 0.03)
	AudioLib._tone(b, 0, 1.6, 110.0, 104.0, 0, 0.1, 0.3, 0.03)
	AudioLib._tone(b, 0, 1.4, 40.0, 36.0, 3, 0.5, 0.5, 0.02)
	AudioLib._tone(b, 0, 1.0, 300.0, 300.0, 2, 0.25, 0.5, 0.01)
	_braam = AudioStreamPlayer.new()
	_braam.stream = AudioLib._wav(b)
	_braam.bus = "SFX"
	add_child(_braam)
	var w := PackedFloat32Array()
	AudioLib._tone(w, 0, 0.3, 600.0, 3000.0, 2, 0.25, 0.5, 0.15)
	_whoosh = AudioStreamPlayer.new()
	_whoosh.stream = AudioLib._wav(w)
	_whoosh.bus = "SFX"
	_whoosh.volume_db = -6.0
	add_child(_whoosh)
