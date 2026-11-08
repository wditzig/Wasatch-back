extends Node
## Renders sample share cards to user:// (or `-- --out=<dir>`) for review.
## Run: godot --headless res://tools/card_preview.tscn -- --out=/tmp
const Share = preload("res://scripts/ui/share.gd")
const Riders = preload("res://scripts/data/riders.gd")

func _ready() -> void:
	var out := OS.get_user_data_dir()
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out = a.substr(6)
	var samples := [
		{"score": 12450, "distance": 2431, "rider": "skier", "outfit": Riders.OUTFITS[0], "cause": "ACQUIRED!", "phase": "PHASE 3: THE CLOUD"},
		{"score": 3184, "distance": 765, "rider": "snowboarder", "outfit": Riders.OUTFITS[5], "cause": "SEASON PASS REVOKED", "phase": "PHASE 1: GROUNDBREAKING"},
	]
	for i in samples.size():
		Share.make_card(samples[i]).save_png(out.path_join("card_%d.png" % i))
		print(Share.message(samples[i]))
	get_tree().quit()
