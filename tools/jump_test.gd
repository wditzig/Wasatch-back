extends Node
## Rides straight down off the start kicker into a tree, a rock and another
## tree placed just past it. A ramp jump should clear them all.
## Run: godot --headless --fixed-fps 60 res://tools/jump_test.tscn
var game: Node

func _ready() -> void:
	var extra := OS.get_cmdline_user_args()
	Game._dev_args = PackedStringArray(["--jump-test"]) + extra
	game = load("res://scenes/game.tscn").instantiate()
	add_child(game)
	get_tree().create_timer(4.0).timeout.connect(_done)

func _done() -> void:
	print("JUMPTEST done y=%d lives=%d" % [int(game.player.position.y), game.lives])
	get_tree().quit()
