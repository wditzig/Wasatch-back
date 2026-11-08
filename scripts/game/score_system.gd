extends RefCounted
## Scoring: distance points are banked instantly; style points (close calls,
## jumps, tricks, tokens) build a combo pool that is multiplied and banked
## when the combo timer runs out. Crashing loses the unbanked pool.

signal combo_changed(count: int, pool: int, mult: float)
signal banked(amount: int, count: int)
signal lost(amount: int)

const COMBO_WINDOW := 3.0

var score := 0
var combo_count := 0
var combo_pool := 0
var combo_timer := 0.0
var global_mult := 1.0
var _dist_acc := 0.0

func add_distance(meters: float) -> void:
	_dist_acc += meters * global_mult
	var whole := int(_dist_acc)
	if whole > 0:
		score += whole
		_dist_acc -= whole

func add_style(points: int) -> void:
	combo_count += 1
	combo_pool += int(points * global_mult)
	combo_timer = COMBO_WINDOW
	combo_changed.emit(combo_count, combo_pool, multiplier())

func multiplier() -> float:
	if combo_count <= 1:
		return 1.0
	return minf(1.0 + 0.5 * (combo_count - 1), 8.0)

func add_raw(points: int) -> void:
	score = maxi(0, score + points)

## frozen=true pauses the combo clock (e.g. while airborne).
func update(delta: float, frozen: bool) -> void:
	if combo_count == 0 or frozen:
		return
	combo_timer -= delta
	if combo_timer <= 0.0:
		bank()

func bank() -> void:
	if combo_count == 0:
		return
	var amount := int(combo_pool * multiplier())
	score += amount
	banked.emit(amount, combo_count)
	_reset()

func bail() -> int:
	var l := combo_pool
	if combo_count > 0:
		lost.emit(l)
	_reset()
	return l

func _reset() -> void:
	combo_count = 0
	combo_pool = 0
	combo_timer = 0.0
	combo_changed.emit(0, 0, 1.0)
