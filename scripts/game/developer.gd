extends Node2D
## CHIP LODGEWORTH III, founder & Chief Exclusivity Officer of MONOPEAK HOLDINGS.
## Fictional. Chases the rider on a gold-trimmed snowmobile, bulldozing trees
## into stumps. Outrun him (tuck!) until he gets bored.

signal caught_player
signal gave_up

enum S { IDLE, CHASE, LEAVE }

const SCALE := 2.0
const CHASE_TIME := 15.0
const LINES := ["LET'S TALK EQUITY!", "SIGN HERE!", "I'LL MAKE YOU AN OFFER!", "YOU'RE ON MY LAND!",
	"THINK OF THE SHAREHOLDERS!", "PUBLIC? NOT FOR LONG!", "I LOVE NATURE! I OWN SOME!", "DON'T MAKE ME REZONE YOU!"]

var state: S = S.IDLE
var t := 0.0
var speed := 0.0
var body: Sprite2D
var bubble: Label
var exhaust: CPUParticles2D
var _line_t := 0.0
var _leave_dir := 1.0

func _ready() -> void:
	visible = false
	exhaust = CPUParticles2D.new()
	exhaust.amount = 20
	exhaust.lifetime = 0.6
	exhaust.local_coords = false
	exhaust.direction = Vector2(0, -1)
	exhaust.spread = 25
	exhaust.gravity = Vector2.ZERO
	exhaust.initial_velocity_min = 20
	exhaust.initial_velocity_max = 50
	exhaust.scale_amount_min = 2
	exhaust.scale_amount_max = 4
	exhaust.color = Color(0.5, 0.52, 0.6, 0.6)
	exhaust.position = Vector2(0, -36)
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
	bubble.position = Vector2(-60, -64)
	bubble.custom_minimum_size = Vector2(120, 0)
	bubble.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(bubble)
	z_index = 5

func is_active() -> bool:
	return state != S.IDLE

func is_chasing() -> bool:
	return state == S.CHASE

func start(player_pos: Vector2) -> void:
	state = S.CHASE
	t = 0.0
	position = player_pos + Vector2(randf_range(-90, 90), -380)
	visible = true
	modulate.a = 1.0
	exhaust.emitting = true
	_say()

func _say() -> void:
	bubble.text = LINES[randi() % LINES.size()]
	_line_t = 2.6

func update(delta: float, player: Node2D, player_max: float) -> void:
	match state:
		S.CHASE:
			t += delta
			_line_t -= delta
			if _line_t <= 0.0:
				_say()
			var mult := lerpf(0.88, 1.12, clampf(t / 12.0, 0.0, 1.0))
			speed = player_max * mult
			var to: Vector2 = player.position - position
			if to.length() > 1.0:
				position += to.normalized() * minf(speed * delta, to.length())
			body.flip_h = to.x < 0.0
			if to.length() < 16.0 and not player.is_airborne() and player.state != player.S.CAUGHT:
				caught_player.emit()
			if t >= CHASE_TIME:
				state = S.LEAVE
				_leave_dir = 1.0 if randf() < 0.5 else -1.0
				bubble.text = "UGH. ZONING MEETING."
				t = 0.0
				gave_up.emit()
		S.LEAVE:
			t += delta
			position += Vector2(_leave_dir * 260.0, -60.0) * delta
			modulate.a = clampf(1.0 - t / 1.5, 0.0, 1.0)
			if t > 1.5:
				stop()
		_:
			pass

func stop() -> void:
	state = S.IDLE
	visible = false
	exhaust.emitting = false

func grab_rect() -> Rect2:
	return Rect2(position.x - 18, position.y - 14, 36, 14)
