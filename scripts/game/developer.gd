extends Node2D
## CHIP LODGEWORTH III - founder & Chief Exclusivity Officer, MONOPEAK HOLDINGS.
## Fictional. Wasatch Back's answer to the 1990s yeti: he rides in from behind
## on a gold-trimmed snowmobile, bulldozing trees into stumps, and chases you
## until he gets bored. He isn't chasing you because you broke the rules.
## He's chasing you because he bought the rules.
##
## AI: simple arcade pursuit with a capped turn rate, so a hard cut makes him
## overshoot. Speed ramps from slightly slower than you to slightly faster;
## a clean straight tuck is still faster than him.

signal caught_player
signal gave_up
signal capture_done

enum S { IDLE, CHASE, LEAVE, CAPTURE }

const SCALE := 2.0
const CHASE_TIME := 15.0
const TURN_RATE := 4.2 # rad/s; tight enough to cut corners, loose enough to juke
const CAPTURE_TIME := 1.9
## Chip's chase runs on his true position (_vpos); he is only *drawn* at most
## LEASH px behind you, so after you outrun him he hangs at the top of the
## screen, visible and still talking, while the real gap (and therefore the
## difficulty) is exactly what it would have been.
const LEASH := 118.0
const LINE_TIME := 2.8
const LINES := ["LET'S TALK EQUITY!", "SIGN HERE!", "I'LL MAKE YOU AN OFFER!", "YOU'RE ON MY LAND!",
	"THINK OF THE SHAREHOLDERS!", "PUBLIC? NOT FOR LONG!", "I LOVE NATURE! I OWN SOME!", "DON'T MAKE ME REZONE YOU!",
	"NICE LINE. I'LL TAKE IT!", "THIS RUN IS UNDER CONTRACT!"]
const CAPTURE_LINES := ["YOU'RE ON PRIVATE PROPERTY!", "BUT I'LL SELL YOU A HOUSE WITH SKI ACCESS!"]

var state: S = S.IDLE
var t := 0.0
var speed := 0.0
var vel := Vector2.ZERO
var body: Sprite2D
var shadow: Sprite2D
var bubble: Label
var exhaust: CPUParticles2D
var spray: CPUParticles2D
var _line_t := 0.0
var _leave_dir := 1.0
var _cap_from := Vector2.ZERO
var _cap_to := Vector2.ZERO
var _cap_stage := 0
var _bag: Array = []
var current_line := ""
var _vpos := Vector2.ZERO

func _ready() -> void:
	visible = false
	z_index = 5
	shadow = Sprite2D.new()
	shadow.texture = Art.tex("shadow_soft")
	shadow.scale = Vector2(1.6, 1.4)
	shadow.position = Vector2(4, -2)
	add_child(shadow)
	# snow kicked up by the track (behind = uphill = up the screen)
	spray = CPUParticles2D.new()
	spray.amount = 26
	spray.lifetime = 0.55
	spray.local_coords = false
	spray.direction = Vector2(0, -1)
	spray.spread = 40
	spray.gravity = Vector2(0, 90)
	spray.initial_velocity_min = 50
	spray.initial_velocity_max = 120
	spray.scale_amount_min = 2
	spray.scale_amount_max = 4
	spray.color = Color(0.94, 0.97, 1.0, 0.95)
	spray.position = Vector2(0, -6)
	spray.emitting = false
	add_child(spray)
	exhaust = CPUParticles2D.new()
	exhaust.amount = 10
	exhaust.lifetime = 0.6
	exhaust.local_coords = false
	exhaust.direction = Vector2(0, -1)
	exhaust.spread = 20
	exhaust.gravity = Vector2.ZERO
	exhaust.initial_velocity_min = 15
	exhaust.initial_velocity_max = 35
	exhaust.scale_amount_min = 2
	exhaust.scale_amount_max = 3
	exhaust.color = Color(0.45, 0.47, 0.55, 0.5)
	exhaust.position = Vector2(10, -40)
	exhaust.emitting = false
	add_child(exhaust)
	body = Sprite2D.new()
	body.texture = Art.tex("developer")
	body.scale = Vector2(SCALE, SCALE)
	body.centered = false
	body.position = Vector2(-body.texture.get_width() * SCALE * 0.5, -body.texture.get_height() * SCALE)
	add_child(body)
	bubble = Label.new()
	bubble.add_theme_font_size_override("font_size", 9)
	bubble.add_theme_color_override("font_color", Color8(26, 28, 44))
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color.WHITE
	sb.border_color = Color8(26, 28, 44)
	sb.set_border_width_all(2)
	sb.set_content_margin_all(3)
	bubble.add_theme_stylebox_override("normal", sb)
	bubble.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	bubble.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	bubble.custom_minimum_size = Vector2(124, 0)
	add_child(bubble)

func is_active() -> bool:
	return state != S.IDLE

func is_chasing() -> bool:
	return state == S.CHASE

func start(player_pos: Vector2) -> void:
	state = S.CHASE
	t = 0.0
	position = player_pos + Vector2(randf_range(-90, 90), -300)
	_vpos = position
	vel = Vector2(0, 1)
	visible = true
	modulate.a = 1.0
	z_index = 5
	exhaust.emitting = true
	spray.emitting = true
	_say(_next_line())

## Shuffle-bag: every line is heard before any repeats.
func _next_line() -> String:
	if _bag.is_empty():
		_bag = LINES.duplicate()
		_bag.shuffle()
		if _bag[0] == current_line:
			_bag.push_back(_bag.pop_front())
	return _bag.pop_front()

func _say(text: String, width := 124.0) -> void:
	bubble.text = text
	current_line = text
	bubble.custom_minimum_size = Vector2(width, 0)
	bubble.size = Vector2(width, 0)
	bubble.reset_size()
	_place_bubble()
	bubble.visible = true
	_line_t = LINE_TIME

## Bubble above Chip, unless that would put it off the top of the screen
## (under the HUD bar) - then it flips below him.
func _place_bubble() -> void:
	var w := bubble.custom_minimum_size.x
	var h := bubble.get_combined_minimum_size().y
	var above := -body.texture.get_height() * SCALE - h - 4.0
	var zoom := get_global_transform_with_canvas().get_scale().y
	var screen_top := get_global_transform_with_canvas().origin.y + above * zoom
	bubble.position = Vector2(-w * 0.5, above if screen_top > 84.0 or state == S.CAPTURE else 6.0)

## Snowmobile body for catching the rider (world space).
func grab_rect() -> Rect2:
	return Rect2(position.x - 16, position.y - 22, 32, 22)

func update(delta: float, player: Node2D, player_max: float) -> void:
	match state:
		S.CHASE:
			t += delta
			_line_t -= delta
			if _line_t <= 0.0:
				_say(_next_line())
			else:
				_place_bubble()
			speed = player_max * lerpf(0.88, 1.12, clampf(t / 12.0, 0.0, 1.0))
			var to: Vector2 = player.position - _vpos
			var want := to.normalized() if to.length() > 1.0 else vel.normalized()
			var cur := vel.normalized() if vel.length() > 0.01 else want
			var ang := cur.angle_to(want)
			cur = cur.rotated(clampf(ang, -TURN_RATE * delta, TURN_RATE * delta))
			vel = cur * speed
			_vpos += vel * delta
			var back: Vector2 = _vpos - player.position
			position = player.position + back.normalized() * LEASH if back.y < 0.0 and back.length() > LEASH else _vpos
			body.flip_h = vel.x < -10.0
			body.position.y = -body.texture.get_height() * SCALE + (1.0 if int(t * 30.0) % 2 == 0 else 0.0) # engine rattle
			if grab_rect().intersects(player.feet_rect()) and not player.is_airborne() and player.state != player.S.CAUGHT:
				caught_player.emit()
			if t >= CHASE_TIME:
				state = S.LEAVE
				_leave_dir = 1.0 if randf() < 0.5 else -1.0
				_say("UGH. ZONING MEETING.")
				t = 0.0
				gave_up.emit()
			var dist := to.length()
			Sfx.set_engine(clampf(1.0 - dist / 520.0, 0.15, 1.0), 0.85 + speed / 900.0)
		S.LEAVE:
			t += delta
			position += Vector2(_leave_dir * 260.0, -60.0) * delta
			modulate.a = clampf(1.0 - t / 1.5, 0.0, 1.0)
			Sfx.set_engine(modulate.a * 0.6, 1.1)
			if t > 1.5:
				stop()
		S.CAPTURE:
			if _cap_stage >= 3:
				Sfx.set_engine(0.0)
				return
			t += delta
			var k := clampf(t / 0.32, 0.0, 1.0)
			position = _cap_from.lerp(_cap_to, 1.0 - pow(1.0 - k, 3.0)) # skid in, ease out
			if k >= 1.0 and _cap_stage == 0:
				_cap_stage = 1
				spray.emitting = false
				_say(CAPTURE_LINES[0], 132.0)
			if t > 1.0 and _cap_stage == 1:
				_cap_stage = 2
				_say(CAPTURE_LINES[1], 150.0)
			Sfx.set_engine(0.5 if t < 0.4 else 0.25, 0.8)
			if t >= CAPTURE_TIME and _cap_stage == 2:
				_cap_stage = 3
				capture_done.emit()
		_:
			pass

## Short capture: Chip skids up alongside the rider and makes his pitch.
func capture(player: Node2D) -> void:
	state = S.CAPTURE
	t = 0.0
	_cap_stage = 0
	visible = true
	modulate.a = 1.0
	z_index = 55 # bubble above everything
	var side := 1.0 if position.x >= player.position.x else -1.0
	_vpos = position
	_cap_from = position
	_cap_to = player.position + Vector2(36.0 * side, 2.0)
	body.flip_h = side > 0.0 # face the rider
	bubble.visible = false
	spray.restart()
	spray.emitting = true
	Sfx.play("skid")

## Tap to skip the capture animation.
func skip_capture() -> void:
	if state == S.CAPTURE and _cap_stage < 3:
		_cap_stage = 3
		capture_done.emit()

func stop() -> void:
	state = S.IDLE
	visible = false
	exhaust.emitting = false
	spray.emitting = false
	Sfx.set_engine(0.0)

func _exit_tree() -> void:
	Sfx.set_engine(0.0)
